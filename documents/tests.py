import os
import shutil
import tempfile
from io import BytesIO
from pathlib import Path
from unittest.mock import patch, MagicMock

from django.test import TestCase, Client, override_settings
from django.urls import reverse
from django.core.files.uploadedfile import SimpleUploadedFile
from django.contrib.auth.models import User

from .models import Document, UserProfile, AdminAuditLog, UserQueryHistory
from .adapters import CustomSocialAccountAdapter
from .services import (
    validate_file,
    extract_text_from_txt,
    chunk_text,
    process_and_index_document,
    retrieve_relevant_chunks,
    delete_document_from_index,
)


class FileValidationTests(TestCase):
    """Tests for file type, size, and empty content validation."""

    def test_valid_txt_file(self):
        file = SimpleUploadedFile("sample.txt", b"Hello world, this is a test.", content_type="text/plain")
        is_valid, msg = validate_file(file)
        self.assertTrue(is_valid)
        self.assertEqual(msg, "")

    def test_valid_pdf_file(self):
        file = SimpleUploadedFile("sample.pdf", b"%PDF-1.4 test content", content_type="application/pdf")
        is_valid, msg = validate_file(file)
        self.assertTrue(is_valid)
        self.assertEqual(msg, "")

    def test_unsupported_file_extension(self):
        file = SimpleUploadedFile("image.png", b"fake image bytes", content_type="image/png")
        is_valid, msg = validate_file(file)
        self.assertFalse(is_valid)
        self.assertIn("Unsupported file format", msg)

    def test_empty_file(self):
        file = SimpleUploadedFile("empty.txt", b"", content_type="text/plain")
        is_valid, msg = validate_file(file)
        self.assertFalse(is_valid)
        self.assertIn("empty", msg.lower())

    def test_file_size_limit_exceeded(self):
        large_bytes = b"0" * (11 * 1024 * 1024)
        file = SimpleUploadedFile("large.txt", large_bytes, content_type="text/plain")
        is_valid, msg = validate_file(file)
        self.assertFalse(is_valid)
        self.assertIn("exceeds", msg.lower())


class TextProcessingTests(TestCase):
    """Tests for text extraction and chunking algorithms."""

    def test_txt_extraction_and_chunking(self):
        with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False, encoding='utf-8') as f:
            f.write("Machine learning is a field of artificial intelligence. It develops algorithms that learn from data.")
            temp_path = f.name

        try:
            pages_data, total_pages = extract_text_from_txt(temp_path)
            self.assertEqual(total_pages, 1)
            self.assertEqual(len(pages_data), 1)
            self.assertEqual(pages_data[0]['page'], 1)
            self.assertIn("Machine learning", pages_data[0]['text'])

            chunks = chunk_text(pages_data, chunk_size=50, overlap=10)
            self.assertGreaterEqual(len(chunks), 2)
            self.assertEqual(chunks[0]['page'], 1)
            self.assertEqual(chunks[0]['chunk_index'], 1)
            self.assertTrue(len(chunks[0]['text']) <= 50)
        finally:
            if os.path.exists(temp_path):
                os.remove(temp_path)


class RAGPipelineTests(TestCase):
    """Tests for document indexing and vector retrieval with ChromaDB."""

    def setUp(self):
        self.temp_chroma_dir = tempfile.mkdtemp()
        self.temp_media_dir = tempfile.mkdtemp()

    def tearDown(self):
        shutil.rmtree(self.temp_chroma_dir, ignore_errors=True)
        shutil.rmtree(self.temp_media_dir, ignore_errors=True)

    def test_document_indexing_and_retrieval(self):
        with override_settings(CHROMA_PERSIST_DIR=Path(self.temp_chroma_dir), MEDIA_ROOT=Path(self.temp_media_dir)):
            content = (
                "Deep learning models require substantial GPU computing power. "
                "Transformers utilize self-attention mechanisms to process sequential data."
            )
            uploaded = SimpleUploadedFile("ai_intro.txt", content.encode('utf-8'), content_type="text/plain")

            doc = Document.objects.create(
                original_name="ai_intro.txt",
                file=uploaded,
                file_type=".txt",
                file_size=len(content)
            )

            chunks_count = process_and_index_document(doc)
            self.assertGreater(chunks_count, 0)
            doc.refresh_from_db()
            self.assertTrue(doc.is_processed)
            self.assertEqual(doc.chunk_count, chunks_count)

            retrieved = retrieve_relevant_chunks("What mechanism do Transformers use?", top_k=2)
            self.assertGreater(len(retrieved), 0)
            top_snippet = retrieved[0]
            self.assertEqual(top_snippet['filename'], "ai_intro.txt")
            self.assertIn("Transformers", top_snippet['text'])

            delete_document_from_index(doc)


class DjangoViewTests(TestCase):
    """Tests for Django HTTP endpoints with authenticated student user."""

    def setUp(self):
        self.client = Client()
        self.user = User.objects.create_user(
            username='student_alice',
            email='alice@university.edu',
            password='password123'
        )
        self.client.force_login(self.user)

    def test_homepage_loads_successfully(self):
        response = self.client.get(reverse('home'))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "DocuMind AI")
        self.assertContains(response, "Document Repository")
        self.assertContains(response, "student_alice")

    def test_api_status_endpoint(self):
        response = self.client.get(reverse('api_status'))
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data['status'], 'Online')
        self.assertIn('total_vectors', data)

    def test_api_upload_empty_fails(self):
        response = self.client.post(reverse('api_upload'), {})
        self.assertEqual(response.status_code, 400)
        data = response.json()
        self.assertFalse(data['success'])

    def test_api_ask_empty_query_fails(self):
        response = self.client.post(
            reverse('api_ask'),
            data='{"query": ""}',
            content_type="application/json"
        )
        self.assertEqual(response.status_code, 400)
        data = response.json()
        self.assertFalse(data['success'])

    def test_upload_missing_file_redirects_with_error(self):
        response = self.client.post(reverse('upload_document'), {})
        self.assertEqual(response.status_code, 302)
        self.assertRedirects(response, reverse('dashboard'))

    def test_ask_question_empty_redirects(self):
        response = self.client.post(reverse('ask_question'), {'question': '   '})
        self.assertEqual(response.status_code, 302)
        self.assertRedirects(response, reverse('dashboard'))

    def test_ask_question_no_documents_warns(self):
        response = self.client.post(reverse('ask_question'), {'question': 'What is AI?'})
        self.assertEqual(response.status_code, 302)
        self.assertRedirects(response, reverse('dashboard'))


class ExamModeTests(TestCase):
    """Tests for Exam Preparation Mode question and answer generation."""

    def setUp(self):
        self.client = Client()
        self.user = User.objects.create_user(
            username='student_bob',
            email='bob@university.edu',
            password='password123'
        )
        self.client.force_login(self.user)

    def test_exam_generate_questions_no_docs(self):
        response = self.client.post(
            reverse('api_exam_generate_questions'),
            data='{"marks": "all"}',
            content_type="application/json"
        )
        self.assertEqual(response.status_code, 400)
        data = response.json()
        self.assertFalse(data['success'])
        self.assertIn("at least one document", data['error'].lower())

    def test_exam_generate_answer_empty_question(self):
        response = self.client.post(
            reverse('api_exam_generate_answer'),
            data='{"question": "  ", "marks": 5}',
            content_type="application/json"
        )
        self.assertEqual(response.status_code, 400)
        data = response.json()
        self.assertFalse(data['success'])
        self.assertIn("valid question", data['error'].lower())

    def test_exam_generate_answer_no_docs(self):
        response = self.client.post(
            reverse('api_exam_generate_answer'),
            data='{"question": "Define Overfitting", "marks": 2}',
            content_type="application/json"
        )
        self.assertEqual(response.status_code, 400)
        data = response.json()
        self.assertFalse(data['success'])
        self.assertIn("at least one document", data['error'].lower())

    @patch('documents.views.generate_exam_questions')
    def test_exam_generate_questions_with_docs(self, mock_gen):
        Document.objects.create(
            user=self.user,
            original_name="syllabus.pdf",
            file="documents/syllabus.pdf",
            file_type=".pdf",
            file_size=1024,
            is_processed=True,
            chunk_count=5
        )

        mock_gen.return_value = {
            'success': True,
            'marks': '5',
            'questions': [
                {
                    'question': 'Differentiate between Supervised and Unsupervised Learning.',
                    'marks': 5,
                    'category': 'Differentiate Between',
                    'answer': 'Supervised learning uses labelled data whereas unsupervised uses unlabelled.',
                    'citations': [{'filename': 'syllabus.pdf', 'page': 2}],
                    'marking_scheme': ['Definition & comparison (3 Marks)', 'Examples (2 Marks)']
                }
            ],
            'source_document': 'syllabus.pdf',
            'language': 'en'
        }

        response = self.client.post(
            reverse('api_exam_generate_questions'),
            data='{"marks": 5}',
            content_type="application/json"
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data['success'])
        self.assertEqual(len(data['questions']), 1)
        self.assertEqual(data['questions'][0]['marks'], 5)
        self.assertEqual(data['source_document'], 'syllabus.pdf')

    @patch('documents.views.generate_exam_answer_for_question')
    def test_exam_generate_answer_for_marks_tiers(self, mock_gen_answer):
        Document.objects.create(
            user=self.user,
            original_name="ai_notes.txt",
            file="documents/ai_notes.txt",
            file_type=".txt",
            file_size=512,
            is_processed=True,
            chunk_count=3
        )

        # Test 2 Marks
        mock_gen_answer.return_value = {
            'success': True,
            'question': 'What is Backpropagation?',
            'marks': 2,
            'answer': 'Backpropagation calculates gradients of loss function with respect to weights.',
            'citations': [{'filename': 'ai_notes.txt', 'page': 1}],
            'marking_scheme': ['Definition (1 Mark)', 'Core objective (1 Mark)']
        }

        res_2m = self.client.post(
            reverse('api_exam_generate_answer'),
            data='{"question": "What is Backpropagation?", "marks": 2}',
            content_type="application/json"
        )
        self.assertEqual(res_2m.status_code, 200)
        data_2m = res_2m.json()
        self.assertTrue(data_2m['success'])
        self.assertEqual(data_2m['marks'], 2)
        self.assertIn("Backpropagation", data_2m['answer'])


class UnauthenticatedSecurityTests(TestCase):
    """Verifies that unauthenticated requests cannot access protected operations."""

    def setUp(self):
        self.client = Client()

    def test_unauthenticated_api_upload_denied(self):
        response = self.client.post(reverse('api_upload'), {})
        self.assertEqual(response.status_code, 401)
        self.assertIn('Authentication required', response.json().get('error', ''))

    def test_unauthenticated_api_ask_denied(self):
        response = self.client.post(
            reverse('api_ask'),
            data='{"query": "Hello?"}',
            content_type="application/json"
        )
        self.assertEqual(response.status_code, 401)

    def test_unauthenticated_admin_dashboard_redirects_to_login(self):
        response = self.client.get(reverse('admin_dashboard'))
        self.assertEqual(response.status_code, 302)
        self.assertTrue(response.url.startswith('/?next=') or '/login' in response.url)

    def test_unauthenticated_profile_redirects_to_login(self):
        response = self.client.get(reverse('profile_view'))
        self.assertEqual(response.status_code, 302)
        self.assertTrue(response.url.startswith('/?next=') or '/login' in response.url)

    def test_root_unauthenticated_displays_signin_page(self):
        """Root URL ('/') must directly display the Sign In page for unauthenticated visitors."""
        response = self.client.get('/')
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Sign In")
        self.assertContains(response, "Continue with Google")
        self.assertContains(response, "Email or Username")
        self.assertContains(response, "Create free account")

    def test_root_authenticated_redirects_to_dashboard(self):
        """Authenticated users visiting root URL ('/') are redirected directly to dashboard."""
        user = User.objects.create_user(username='authed_student', password='password123')
        self.client.force_login(user)
        response = self.client.get('/')
        self.assertEqual(response.status_code, 302)
        self.assertRedirects(response, reverse('dashboard'))

    def test_dashboard_unauthenticated_redirects_to_root(self):
        """Unauthenticated access to '/dashboard/' redirects to root login page with next param."""
        response = self.client.get(reverse('dashboard'))
        self.assertEqual(response.status_code, 302)
        self.assertTrue(response.url.startswith('/?next=') or '/login' in response.url)

    def test_dashboard_authenticated_loads_successfully(self):
        """Authenticated access to '/dashboard/' renders the DocuMind AI dashboard."""
        user = User.objects.create_user(username='dash_student', password='password123')
        self.client.force_login(user)
        response = self.client.get(reverse('dashboard'))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "DocuMind AI")
        self.assertContains(response, "dash_student")

    def test_logout_view_clears_session_and_redirects_to_root(self):
        """Logging out ends the user session and returns the user to the root Login page."""
        user = User.objects.create_user(username='logout_student', password='password123')
        self.client.force_login(user)
        response = self.client.get(reverse('logout'))
        self.assertRedirects(response, '/')
        # Verify subsequent dashboard request requires authentication
        dash_response = self.client.get(reverse('dashboard'))
        self.assertEqual(dash_response.status_code, 302)


class DocumentOwnershipIsolationTests(TestCase):
    """
    Guarantees strict multi-tenant isolation:
    User A can never view, delete, or retrieve citations from User B's documents.
    """

    def setUp(self):
        self.client = Client()
        self.user_a = User.objects.create_user(username='student_a', password='passA123')
        self.user_b = User.objects.create_user(username='student_b', password='passB123')

        self.doc_b = Document.objects.create(
            user=self.user_b,
            original_name="private_research_b.pdf",
            file="documents/private_b.pdf",
            file_type=".pdf",
            file_size=2048,
            is_processed=True,
            chunk_count=8
        )

    def test_user_a_cannot_see_user_b_document_on_dashboard(self):
        self.client.force_login(self.user_a)
        response = self.client.get(reverse('home'))
        self.assertEqual(response.status_code, 200)
        self.assertNotContains(response, "private_research_b.pdf")

    def test_user_a_cannot_delete_user_b_document(self):
        self.client.force_login(self.user_a)
        response = self.client.post(reverse('api_delete', args=[self.doc_b.id]))
        self.assertEqual(response.status_code, 403)
        self.assertTrue(Document.objects.filter(id=self.doc_b.id).exists())

    def test_user_a_cannot_generate_exam_for_user_b_document(self):
        self.client.force_login(self.user_a)
        response = self.client.post(
            reverse('api_exam_generate_questions'),
            data=f'{{"marks": 5, "document_id": {self.doc_b.id}}}',
            content_type="application/json"
        )
        self.assertEqual(response.status_code, 400)  # User A has no processed documents

    def test_user_a_cannot_query_user_b_document(self):
        self.client.force_login(self.user_a)
        response = self.client.post(
            reverse('api_ask'),
            data='{"query": "What is in User B private research?"}',
            content_type="application/json"
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("at least one document", response.json().get('error', '').lower())


class RoleAndAdminDashboardTests(TestCase):
    """Tests Role-Based Access Control and Administrative Dashboard operations."""

    def setUp(self):
        self.client = Client()
        self.student = User.objects.create_user(username='student_charlie', password='password123')
        self.admin = User.objects.create_superuser(username='staff_admin', email='admin@documind.ai', password='adminpassword')

    def test_student_profile_created_by_default(self):
        self.assertEqual(self.student.profile.role, UserProfile.ROLE_STUDENT)
        self.assertTrue(self.student.profile.is_student)
        self.assertFalse(self.student.profile.is_admin)

    def test_admin_profile_created_for_superuser(self):
        self.assertEqual(self.admin.profile.role, UserProfile.ROLE_ADMIN)
        self.assertTrue(self.admin.profile.is_admin)

    def test_student_forbidden_from_admin_dashboard(self):
        self.client.force_login(self.student)
        response = self.client.get(reverse('admin_dashboard'))
        self.assertEqual(response.status_code, 403)
        self.assertContains(response, "Access Denied", status_code=403)

    def test_admin_can_access_admin_dashboard(self):
        self.client.force_login(self.admin)
        response = self.client.get(reverse('admin_dashboard'))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Admin Operations Console")
        self.assertContains(response, "User Directory & Access Control")

    def test_admin_can_toggle_user_status_and_creates_audit_log(self):
        self.client.force_login(self.admin)
        self.assertTrue(self.student.is_active)

        # Deactivate student
        response = self.client.post(reverse('admin_toggle_user_status', args=[self.student.id]))
        self.assertEqual(response.status_code, 302)
        self.student.refresh_from_db()
        self.assertFalse(self.student.is_active)

        # Verify audit log recorded
        log = AdminAuditLog.objects.filter(target_user=self.student, action='USER_DEACTIVATED').first()
        self.assertIsNotNone(log)
        self.assertEqual(log.admin_user, self.admin)

    def test_admin_cannot_deactivate_themselves(self):
        self.client.force_login(self.admin)
        response = self.client.post(reverse('admin_toggle_user_status', args=[self.admin.id]))
        self.assertEqual(response.status_code, 302)
        self.admin.refresh_from_db()
        self.assertTrue(self.admin.is_active)


class GoogleOAuthAdapterSecurityTests(TestCase):
    """Tests least-privilege security guarantees for Google OAuth registrations."""

    def test_google_signup_always_forces_student_role(self):
        user = User(username='google_user', email='admin_impersonator@gmail.com')
        user.is_staff = True  # Attempted privilege escalation
        user.is_superuser = True
        user.save()

        # Mock sociallogin payload
        sociallogin = MagicMock()
        sociallogin.user = user
        sociallogin.account.extra_data = {
            'name': 'Google User',
            'picture': 'https://lh3.googleusercontent.com/a/avatar.jpg'
        }

        adapter = CustomSocialAccountAdapter()
        with patch('allauth.socialaccount.adapter.DefaultSocialAccountAdapter.save_user', return_value=user):
            saved_user = adapter.save_user(request=MagicMock(), sociallogin=sociallogin)

        # Guarantees that admin and staff flags are revoked
        self.assertFalse(saved_user.is_staff)
        self.assertFalse(saved_user.is_superuser)

        saved_user.refresh_from_db()
        self.assertEqual(saved_user.profile.role, UserProfile.ROLE_STUDENT)
        self.assertEqual(saved_user.profile.avatar_url, 'https://lh3.googleusercontent.com/a/avatar.jpg')
