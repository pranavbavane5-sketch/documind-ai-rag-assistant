import os
import json
from pathlib import Path
from functools import wraps

from django.shortcuts import render, redirect, get_object_or_404
from django.http import JsonResponse, HttpResponseForbidden
from django.views.decorators.http import require_POST, require_GET
from django.views.decorators.csrf import ensure_csrf_cookie, csrf_exempt
from django.contrib.auth.decorators import login_required
from django.contrib.auth import logout as auth_logout
from django.contrib.auth.models import User
from django.contrib import messages
from django.conf import settings
from allauth.account.views import LoginView

from .models import Document, UserProfile, AdminAuditLog, UserQueryHistory
from .services import (
    validate_file,
    process_and_index_document,
    delete_document_from_index,
    query_rag_pipeline,
    retrieve_relevant_chunks,
    get_total_indexed_vectors,
    get_active_gemini_api_key,
    generate_exam_questions,
    generate_exam_answer_for_question,
)


def get_client_ip(request) -> str:
    """Extracts client IP address with proxy support."""
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        return x_forwarded_for.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR', '127.0.0.1')


def admin_required(view_func):
    """
    Decorator for views requiring administrator privileges.
    Guarantees least-privilege server-side authorization checks.
    Returns custom 403 Forbidden page for unauthorized attempts.
    """
    @wraps(view_func)
    def _wrapped_view(request, *args, **kwargs):
        if not request.user.is_authenticated:
            return redirect(f"{settings.LOGIN_URL}?next={request.path}")
        
        is_admin = (
            request.user.is_staff or 
            request.user.is_superuser or 
            getattr(getattr(request.user, 'profile', None), 'is_admin', False)
        )
        if not is_admin:
            return render(request, 'documents/403.html', status=403)
        return view_func(request, *args, **kwargs)
    return _wrapped_view


def root_view(request, *args, **kwargs):
    """
    Root application entry point (URL: '/').
    - If user is authenticated administrator: redirects directly to '/admin-dashboard/'.
    - If user is authenticated student: redirects directly to '/dashboard/'.
    - If user is unauthenticated: renders the styled DocuMind AI Sign In page.
    """
    if request.user.is_authenticated:
        is_admin = (
            request.user.is_staff or 
            request.user.is_superuser or 
            getattr(getattr(request.user, 'profile', None), 'is_admin', False)
        )
        if is_admin:
            return redirect('admin_dashboard')
        return redirect('dashboard')
    return LoginView.as_view()(request, *args, **kwargs)


@login_required
@ensure_csrf_cookie
def dashboard_view(request):
    """
    Renders the modern DocuMind AI Document Intelligence Assistant dashboard.
    Protected view: only authenticated students/admins can access.
    Enforces document ownership: logged-in students see strictly their own documents.
    """
    documents = Document.objects.filter(user=request.user, is_processed=True)
    user_vectors = sum(d.chunk_count for d in documents)
    total_vectors = get_total_indexed_vectors()
    model_name = getattr(settings, 'GEMINI_MODEL', 'gemini-3.5-flash-lite')
    api_key_present = bool(get_active_gemini_api_key())

    return render(request, 'documents/index.html', {
        'documents': documents,
        'total_vectors': total_vectors,
        'user_vectors': user_vectors,
        'model_name': model_name,
        'api_key_present': api_key_present,
    })


# Backward-compatibility alias so existing references continue to work
home = dashboard_view


def logout_view(request):
    """
    Ends the user session and redirects to the root Login page ('/').
    """
    if request.user.is_authenticated:
        auth_logout(request)
        messages.info(request, "You have been logged out successfully.")
    return redirect('/')


# -----------------------------------------------------------------------------
# Asynchronous REST / JSON API Endpoints (Fetch API / Vanilla JS)
# -----------------------------------------------------------------------------

@csrf_exempt
@require_POST
def api_upload(request):
    """
    Asynchronous document upload endpoint supporting PDF and TXT files.
    Enforces tenant isolation: links uploaded document strictly to request.user.
    """
    if not request.user.is_authenticated:
        return JsonResponse({'success': False, 'error': 'Authentication required. Please sign in.'}, status=401)

    uploaded_file = request.FILES.get('document')
    if not uploaded_file:
        return JsonResponse({'success': False, 'error': 'No file was provided.'}, status=400)

    is_valid, err_msg = validate_file(uploaded_file)
    if not is_valid:
        return JsonResponse({'success': False, 'error': err_msg}, status=400)

    ext = Path(uploaded_file.name).suffix.lower()

    # Create model record linked to owning user
    doc = Document.objects.create(
        user=request.user,
        original_name=uploaded_file.name,
        file=uploaded_file,
        file_type=ext,
        file_size=uploaded_file.size,
        is_processed=False
    )

    try:
        chunks_count = process_and_index_document(doc)
        total_vectors = get_total_indexed_vectors()
        return JsonResponse({
            'success': True,
            'message': f"Successfully processed '{doc.original_name}' into {chunks_count} vector chunks.",
            'document': {
                'id': doc.id,
                'name': doc.original_name,
                'type': doc.file_type,
                'size': doc.file_size_display,
                'pages': doc.page_count,
                'chunks': doc.chunk_count,
                'uploaded_at': doc.uploaded_at.strftime("%b %d, %H:%M"),
            },
            'total_vectors': total_vectors
        })
    except Exception as e:
        doc.error_message = str(e)
        doc.save()
        return JsonResponse({'success': False, 'error': str(e)}, status=400)


@csrf_exempt
@require_POST
def api_ask(request):
    """
    Asynchronous chat query endpoint.
    Retrieves semantic context strictly from documents owned by the requesting user.
    """
    if not request.user.is_authenticated:
        return JsonResponse({'success': False, 'error': 'Authentication required. Please sign in.'}, status=401)

    try:
        data = json.loads(request.body.decode('utf-8'))
        query = data.get('query', '').strip()
        language = data.get('language', 'en').strip().lower()
        force_visual = bool(data.get('force_visual', False))
        client_key = (data.get('api_key') or '').strip()
    except Exception:
        query = request.POST.get('query', '').strip()
        language = request.POST.get('language', 'en').strip().lower()
        force_visual = request.POST.get('force_visual', '').lower() in ('true', '1')
        client_key = request.POST.get('api_key', '').strip()

    # If client passed an active key from localStorage/modal, use it
    if client_key and client_key != 'YOUR_GEMINI_API_KEY':
        settings.GEMINI_API_KEY = client_key
        os.environ['GEMINI_API_KEY'] = client_key

    if not query:
        return JsonResponse({'success': False, 'error': 'Please enter a valid question.'}, status=400)

    # Strictly retrieve documents owned by the student
    user_docs = Document.objects.filter(user=request.user, is_processed=True)
    user_doc_ids = list(user_docs.values_list('id', flat=True))

    if not user_doc_ids:
        return JsonResponse({
            'success': False,
            'error': 'Please upload at least one document before asking questions.'
        }, status=400)

    top_k = getattr(settings, 'TOP_K_CHUNKS', 4)
    result = query_rag_pipeline(
        query,
        top_k=top_k,
        language=language,
        force_visual=force_visual,
        allowed_doc_ids=user_doc_ids
    )

    # Record inquiry in query history
    try:
        UserQueryHistory.objects.create(
            user=request.user,
            query_text=query,
            answer_preview=(result.get('answer') or '')[:300],
            sources_count=len(result.get('sources', [])),
            has_context_match=result.get('has_context_match', True),
            language=language
        )
    except Exception:
        pass

    return JsonResponse({
        'success': True,
        'query': query,
        'answer': result.get('answer'),
        'visual': result.get('visual'),
        'sources': result.get('sources', []),
        'has_context_match': result.get('has_context_match', True),
        'language': result.get('language', language),
        'total_vectors': result.get('total_vectors', 0),
    })


@csrf_exempt
@require_POST
def api_delete(request, document_id):
    """
    Asynchronous deletion endpoint. Enforces strict ownership validation.
    """
    if not request.user.is_authenticated:
        return JsonResponse({'success': False, 'error': 'Authentication required.'}, status=401)

    doc = get_object_or_404(Document, id=document_id)
    is_admin = (
        request.user.is_staff or 
        request.user.is_superuser or 
        getattr(getattr(request.user, 'profile', None), 'is_admin', False)
    )

    # Ownership verification
    if doc.user_id != request.user.id and not is_admin:
        return JsonResponse({'success': False, 'error': 'Access denied: You do not own this document.'}, status=403)

    doc_name = doc.original_name
    delete_document_from_index(doc)
    doc.delete()

    return JsonResponse({
        'success': True,
        'message': f"Document '{doc_name}' removed.",
        'total_vectors': get_total_indexed_vectors()
    })


@require_GET
def api_status(request):
    """
    Returns live system status: vector counts, model info, and document counts.
    """
    if request.user.is_authenticated:
        docs_count = Document.objects.filter(user=request.user, is_processed=True).count()
    else:
        docs_count = Document.objects.filter(user__isnull=True, is_processed=True).count()

    total_vectors = get_total_indexed_vectors()
    model_name = getattr(settings, 'GEMINI_MODEL', 'gemini-3.5-flash-lite')
    api_key_configured = bool(get_active_gemini_api_key())

    return JsonResponse({
        'documents_count': docs_count,
        'total_vectors': total_vectors,
        'model': model_name,
        'api_key_configured': api_key_configured,
        'status': 'Online'
    })


@csrf_exempt
@require_POST
def api_save_key(request):
    """
    Saves the user's Gemini API key to runtime memory and attempts persistence.
    Works seamlessly on read-only serverless filesystems (Vercel).
    """
    import re
    try:
        data = json.loads(request.body.decode('utf-8'))
        api_key = data.get('api_key', '').strip()
    except Exception:
        api_key = request.POST.get('api_key', '').strip()

    if not api_key:
        return JsonResponse({'success': False, 'error': 'API key cannot be empty.'}, status=400)

    # Update in runtime memory immediately
    settings.GEMINI_API_KEY = api_key
    os.environ['GEMINI_API_KEY'] = api_key

    # Attempt persistence to .env or /tmp/.env
    is_vercel = getattr(settings, 'IS_VERCEL', False)
    env_path = Path('/tmp/.env') if is_vercel else (settings.BASE_DIR / '.env')
    try:
        if env_path.exists():
            content = env_path.read_text(encoding='utf-8')
            if 'GEMINI_API_KEY=' in content:
                content = re.sub(r'GEMINI_API_KEY=.*', f'GEMINI_API_KEY={api_key}', content)
            else:
                content += f"\nGEMINI_API_KEY={api_key}\n"
            env_path.write_text(content, encoding='utf-8')
        else:
            env_path.write_text(f"GEMINI_API_KEY={api_key}\n", encoding='utf-8')
    except Exception:
        pass

    return JsonResponse({
        'success': True,
        'message': 'Gemini API key saved and activated successfully! You can now ask questions.'
    })


@csrf_exempt
@require_POST
def api_exam_generate_questions(request):
    """
    Asynchronous endpoint to generate university exam-oriented questions
    and structured model answers strictly from the requesting user's documents.
    """
    if not request.user.is_authenticated:
        return JsonResponse({'success': False, 'error': 'Authentication required. Please sign in.'}, status=401)

    try:
        data = json.loads(request.body.decode('utf-8'))
        marks = data.get('marks', 'all')
        doc_id = data.get('document_id')
        language = data.get('language', 'en').strip().lower()
        exclude = data.get('exclude_questions', [])
        client_key = (data.get('api_key') or '').strip()
    except Exception:
        marks = request.POST.get('marks', 'all')
        doc_id = request.POST.get('document_id')
        language = request.POST.get('language', 'en').strip().lower()
        exclude = []
        client_key = request.POST.get('api_key', '').strip()

    if client_key and client_key != 'YOUR_GEMINI_API_KEY':
        settings.GEMINI_API_KEY = client_key
        os.environ['GEMINI_API_KEY'] = client_key

    user_docs = Document.objects.filter(user=request.user, is_processed=True)
    user_doc_ids = list(user_docs.values_list('id', flat=True))

    if not user_doc_ids:
        return JsonResponse({
            'success': False,
            'error': 'Please upload and index at least one document before generating exam questions.'
        }, status=400)

    # Verify specific document ownership if requested
    if doc_id:
        try:
            doc_id = int(doc_id)
            if doc_id not in user_doc_ids:
                return JsonResponse({'success': False, 'error': 'Access denied: You do not own this document.'}, status=403)
        except (ValueError, TypeError):
            doc_id = None

    result = generate_exam_questions(
        marks=marks,
        document_id=doc_id,
        language=language,
        exclude_questions=exclude,
        allowed_doc_ids=user_doc_ids
    )
    return JsonResponse(result, status=200 if result.get('success') else 400)


@csrf_exempt
@require_POST
def api_exam_generate_answer(request):
    """
    Generates an individual exam-ready model answer strictly tailored to the specified marks.
    Grounded strictly in the user's owned study materials.
    """
    if not request.user.is_authenticated:
        return JsonResponse({'success': False, 'error': 'Authentication required. Please sign in.'}, status=401)

    try:
        data = json.loads(request.body.decode('utf-8'))
        question = data.get('question', '').strip()
        marks = data.get('marks', 5)
        doc_id = data.get('document_id')
        language = data.get('language', 'en').strip().lower()
        client_key = (data.get('api_key') or '').strip()
    except Exception:
        question = request.POST.get('question', '').strip()
        marks = request.POST.get('marks', 5)
        doc_id = request.POST.get('document_id')
        language = request.POST.get('language', 'en').strip().lower()
        client_key = request.POST.get('api_key', '').strip()

    if client_key and client_key != 'YOUR_GEMINI_API_KEY':
        settings.GEMINI_API_KEY = client_key
        os.environ['GEMINI_API_KEY'] = client_key

    if not question:
        return JsonResponse({'success': False, 'error': 'Please provide a valid question.'}, status=400)

    user_docs = Document.objects.filter(user=request.user, is_processed=True)
    user_doc_ids = list(user_docs.values_list('id', flat=True))

    if not user_doc_ids:
        return JsonResponse({'success': False, 'error': 'Please upload at least one document first.'}, status=400)

    if doc_id:
        try:
            doc_id = int(doc_id)
            if doc_id not in user_doc_ids:
                return JsonResponse({'success': False, 'error': 'Access denied: You do not own this document.'}, status=403)
        except (ValueError, TypeError):
            doc_id = None

    result = generate_exam_answer_for_question(
        question=question,
        marks=marks,
        document_id=doc_id,
        language=language,
        allowed_doc_ids=user_doc_ids
    )
    return JsonResponse(result, status=200 if result.get('success') else 400)


# -----------------------------------------------------------------------------
# Standard Form Fallback Endpoints (For Traditional Form POSTs)
# -----------------------------------------------------------------------------

@require_POST
def upload_document(request):
    if not request.user.is_authenticated:
        messages.error(request, "Authentication required. Please sign in.")
        return redirect(f"{settings.LOGIN_URL}?next={request.path}")

    uploaded_file = request.FILES.get('document')
    if not uploaded_file:
        messages.error(request, "No file selected.")
        return redirect('dashboard')

    is_valid, err_msg = validate_file(uploaded_file)
    if not is_valid:
        messages.error(request, err_msg)
        return redirect('dashboard')

    ext = Path(uploaded_file.name).suffix.lower()
    doc = Document.objects.create(
        user=request.user,
        original_name=uploaded_file.name,
        file=uploaded_file,
        file_type=ext,
        file_size=uploaded_file.size,
        is_processed=False
    )
    try:
        chunks_count = process_and_index_document(doc)
        messages.success(request, f"Processed '{doc.original_name}' into {chunks_count} chunks.")
    except Exception as e:
        doc.error_message = str(e)
        doc.save()
        messages.error(request, f"Error processing file: {str(e)}")

    return redirect('dashboard')


@require_POST
def delete_document(request, document_id):
    if not request.user.is_authenticated:
        return redirect(settings.LOGIN_URL)

    doc = get_object_or_404(Document, id=document_id)
    is_admin = (
        request.user.is_staff or 
        request.user.is_superuser or 
        getattr(getattr(request.user, 'profile', None), 'is_admin', False)
    )
    if doc.user_id != request.user.id and not is_admin:
        messages.error(request, "Access denied: You do not own this document.")
        return redirect('dashboard')

    name = doc.original_name
    delete_document_from_index(doc)
    doc.delete()
    messages.info(request, f"Deleted document '{name}'.")
    return redirect('dashboard')


@require_POST
def ask_question(request):
    if not request.user.is_authenticated:
        return redirect(settings.LOGIN_URL)

    query = request.POST.get('question', '').strip()
    if not query:
        messages.warning(request, "Please enter a question.")
        return redirect('dashboard')

    user_docs = Document.objects.filter(user=request.user, is_processed=True)
    if not user_docs.exists():
        messages.warning(request, "Please upload at least one document before asking questions.")
        return redirect('dashboard')

    user_doc_ids = list(user_docs.values_list('id', flat=True))
    result = query_rag_pipeline(
        query,
        top_k=getattr(settings, 'TOP_K_CHUNKS', 4),
        allowed_doc_ids=user_doc_ids
    )

    return render(request, 'documents/index.html', {
        'documents': user_docs,
        'query': query,
        'answer': result.get('answer'),
        'sources': result.get('sources', []),
        'has_context_match': result.get('has_context_match', True),
        'total_vectors': result.get('total_vectors', 0),
        'model_name': getattr(settings, 'GEMINI_MODEL', 'gemini-3.5-flash-lite'),
        'api_key_present': bool(getattr(settings, 'GEMINI_API_KEY', '').strip()),
    })


# -----------------------------------------------------------------------------
# User Profile & Account Views
# -----------------------------------------------------------------------------

@login_required
def profile_view(request):
    """
    Renders user profile, assigned role, statistics, and logout controls.
    """
    doc_count = Document.objects.filter(user=request.user).count()
    vector_count = sum(d.chunk_count for d in Document.objects.filter(user=request.user))
    return render(request, 'documents/profile.html', {
        'document_count': doc_count,
        'vector_count': vector_count,
    })


# -----------------------------------------------------------------------------
# Administrative Operations & Role-Based Access Control (RBAC)
# -----------------------------------------------------------------------------

@admin_required
def admin_dashboard(request):
    """
    Protected Operations Console for authorized staff and administrators.
    Allows inspecting metrics, managing users, reviewing audit logs, and status toggles.
    """
    total_users = User.objects.count()
    active_users = User.objects.filter(is_active=True).count()
    inactive_users = User.objects.filter(is_active=False).count()
    student_count = UserProfile.objects.filter(role=UserProfile.ROLE_STUDENT).count()
    admin_count = UserProfile.objects.filter(role=UserProfile.ROLE_ADMIN).count()
    total_documents = Document.objects.count()
    total_storage_bytes = sum(d.file_size for d in Document.objects.all())

    # Format storage size nicely
    size = float(total_storage_bytes)
    storage_display = "0.0 B"
    for unit in ['B', 'KB', 'MB', 'GB']:
        if size < 1024.0:
            storage_display = f"{size:.1f} {unit}"
            break
        size /= 1024.0

    total_vectors = get_total_indexed_vectors()
    total_queries = UserQueryHistory.objects.count()

    # User search / filter support
    user_search = request.GET.get('user_q', '').strip()
    if user_search:
        users = User.objects.filter(
            models.Q(username__icontains=user_search) | 
            models.Q(email__icontains=user_search)
        ).select_related('profile').prefetch_related('documents').order_by('-date_joined')
    else:
        users = User.objects.select_related('profile').prefetch_related('documents').order_by('-date_joined')

    # All documents across the system for Document Management
    all_documents = Document.objects.select_related('user').order_by('-uploaded_at')
    audit_logs = AdminAuditLog.objects.select_related('admin_user', 'target_user').order_by('-created_at')[:50]

    return render(request, 'documents/admin_dashboard.html', {
        'total_users': total_users,
        'active_users': active_users,
        'inactive_users': inactive_users,
        'student_count': student_count,
        'admin_count': admin_count,
        'total_documents': total_documents,
        'total_storage_display': storage_display,
        'total_vectors': total_vectors,
        'total_queries': total_queries,
        'users': users,
        'user_search': user_search,
        'all_documents': all_documents,
        'audit_logs': audit_logs,
        'embedding_model': getattr(settings, 'EMBEDDING_MODEL_NAME', 'gemini-embedding-001'),
        'gemini_model': getattr(settings, 'GEMINI_MODEL', 'gemini-3.5-flash-lite'),
    })


@admin_required
@require_POST
def admin_delete_document(request, document_id):
    """
    Allows authorized administrators to delete any document from the system
    with complete audit logging.
    """
    doc = get_object_or_404(Document, id=document_id)
    doc_name = doc.original_name
    owner_name = doc.user.username if doc.user else "System"

    delete_document_from_index(doc)
    doc.delete()

    AdminAuditLog.objects.create(
        admin_user=request.user,
        action="DOCUMENT_DELETED",
        target_user=doc.user,
        details=f"Document '{doc_name}' belonging to user '{owner_name}' was deleted by administrator.",
        ip_address=get_client_ip(request)
    )
    messages.success(request, f"Document '{doc_name}' has been deleted successfully.")
    return redirect('admin_dashboard')


@admin_required
@require_POST
def admin_toggle_user_status(request, user_id):
    """
    Toggles user account status (active/deactivated) and records administrative audit log.
    Prevents administrators from deactivating their own account.
    """
    target_user = get_object_or_404(User, id=user_id)
    if target_user.id == request.user.id:
        messages.error(request, "Security protection: You cannot deactivate your own administrative account.")
        return redirect('admin_dashboard')

    target_user.is_active = not target_user.is_active
    target_user.save(update_fields=['is_active'])

    action_str = "USER_ACTIVATED" if target_user.is_active else "USER_DEACTIVATED"
    AdminAuditLog.objects.create(
        admin_user=request.user,
        action=action_str,
        target_user=target_user,
        details=f"Account status set to {'Active' if target_user.is_active else 'Deactivated'}.",
        ip_address=get_client_ip(request)
    )
    messages.success(request, f"User '{target_user.username}' has been {'activated' if target_user.is_active else 'deactivated'}.")
    return redirect('admin_dashboard')


@admin_required
@require_POST
def admin_toggle_user_role(request, user_id):
    """
    Toggles user role between Student and Administrator.
    Synchronizes Django staff permissions and records administrative audit trail.
    """
    target_user = get_object_or_404(User, id=user_id)
    if target_user.id == request.user.id:
        messages.error(request, "Security protection: You cannot demote your own administrative account.")
        return redirect('admin_dashboard')

    profile, _ = UserProfile.objects.get_or_create(user=target_user)
    if profile.role == UserProfile.ROLE_ADMIN or target_user.is_staff:
        profile.role = UserProfile.ROLE_STUDENT
        target_user.is_staff = False
        action_str = "ROLE_DEMOTED"
        msg = f"User '{target_user.username}' demoted to Student."
    else:
        profile.role = UserProfile.ROLE_ADMIN
        target_user.is_staff = True
        action_str = "ROLE_PROMOTED"
        msg = f"User '{target_user.username}' promoted to Administrator."

    profile.save(update_fields=['role'])
    target_user.save(update_fields=['is_staff'])

    AdminAuditLog.objects.create(
        admin_user=request.user,
        action=action_str,
        target_user=target_user,
        details=msg,
        ip_address=get_client_ip(request)
    )
    messages.success(request, msg)
    return redirect('admin_dashboard')