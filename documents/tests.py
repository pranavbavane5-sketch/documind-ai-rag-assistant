import os
import shutil
import tempfile
from io import BytesIO
from pathlib import Path

from django.test import TestCase, Client, override_settings
from django.urls import reverse
from django.core.files.uploadedfile import SimpleUploadedFile

from .models import Document
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
        # 11 MB simulated file
        large_bytes = b"0" * (11 * 1024 * 1024)
        file = SimpleUploadedFile("large.txt", large_bytes, content_type="text/plain")
        is_valid, msg = validate_file(file)
        self.assertFalse(is_valid)
        self.assertIn("exceeds", msg.lower())


class TextProcessingTests(TestCase):
    """Tests for text extraction and chunking algorithms."""

    def test_txt_extraction_and_chunking(self):
        # Create a temporary text file
        with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False, encoding='utf-8') as f:
            f.write("Machine learning is a field of artificial intelligence. It develops algorithms that learn from data.")
            temp_path = f.name

        try:
            pages_data, total_pages = extract_text_from_txt(temp_path)
            self.assertEqual(total_pages, 1)
            self.assertEqual(len(pages_data), 1)
            self.assertEqual(pages_data[0]['page'], 1)
            self.assertIn("Machine learning", pages_data[0]['text'])

            # Test chunking with small chunk size
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

            # Process and index
            chunks_count = process_and_index_document(doc)
            self.assertGreater(chunks_count, 0)
            doc.refresh_from_db()
            self.assertTrue(doc.is_processed)
            self.assertEqual(doc.chunk_count, chunks_count)

            # Retrieve context for query
            retrieved = retrieve_relevant_chunks("What mechanism do Transformers use?", top_k=2)
            self.assertGreater(len(retrieved), 0)
            top_snippet = retrieved[0]
            self.assertEqual(top_snippet['filename'], "ai_intro.txt")
            self.assertIn("Transformers", top_snippet['text'])

            # Clean up
            delete_document_from_index(doc)


class DjangoViewTests(TestCase):
    """Tests for Django HTTP endpoints."""

    def setUp(self):
        self.client = Client()

    def test_homepage_loads_successfully(self):
        response = self.client.get(reverse('home'))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "DocuMind AI")
        self.assertContains(response, "Document Repository")

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
        self.assertRedirects(response, reverse('home'))

    def test_ask_question_empty_redirects(self):
        response = self.client.post(reverse('ask_question'), {'question': '   '})
        self.assertEqual(response.status_code, 302)
        self.assertRedirects(response, reverse('home'))

    def test_ask_question_no_documents_warns(self):
        response = self.client.post(reverse('ask_question'), {'question': 'What is AI?'})
        self.assertEqual(response.status_code, 302)
        self.assertRedirects(response, reverse('home'))


class ExamModeTests(TestCase):
    """Tests for Exam Preparation Mode question and answer generation."""

    def setUp(self):
        self.client = Client()

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

    from unittest.mock import patch

    @patch('documents.views.generate_exam_questions')
    def test_exam_generate_questions_with_docs(self, mock_gen):
        # Create a mock processed document
        Document.objects.create(
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
            'answer': 'Backpropagation is an algorithm used in neural networks to calculate gradients of loss function with respect to weights.',
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
        self.assertIn("Backpropagation is an algorithm", data_2m['answer'])

        # Test 10 Marks with Diagram
        mock_gen_answer.return_value = {
            'success': True,
            'question': 'Explain the Architecture and Working of Convolutional Neural Networks.',
            'marks': 10,
            'answer': '### 1. Introduction\nConvolutional Neural Networks (CNNs) are specialized deep architectures...',
            'diagram': 'graph TD\nInput --> Conv[Convolution Layer] --> Pool[Pooling Layer] --> FC[Fully Connected] --> Output',
            'citations': [{'filename': 'ai_notes.txt', 'page': 3}],
            'marking_scheme': ['Introduction & Principle (2M)', 'Architecture Breakdown (4M)', 'Diagram & Working (2M)', 'Conclusion (2M)']
        }

        res_10m = self.client.post(
            reverse('api_exam_generate_answer'),
            data='{"question": "Explain the Architecture and Working of Convolutional Neural Networks.", "marks": 10}',
            content_type="application/json"
        )
        self.assertEqual(res_10m.status_code, 200)
        data_10m = res_10m.json()
        self.assertTrue(data_10m['success'])
        self.assertEqual(data_10m['marks'], 10)
        self.assertIn("graph TD", data_10m['diagram'])


