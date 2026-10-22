import os
import json
from pathlib import Path
from django.shortcuts import render, redirect, get_object_or_404
from django.http import JsonResponse
from django.views.decorators.http import require_POST, require_GET
from django.views.decorators.csrf import ensure_csrf_cookie, csrf_exempt
from django.contrib import messages
from django.conf import settings

from .models import Document
from .services import (
    validate_file,
    process_and_index_document,
    delete_document_from_index,
    query_rag_pipeline,
    get_total_indexed_vectors,
    get_active_gemini_api_key,
)


@ensure_csrf_cookie
def home(request):
    """
    Renders the modern Antigravity Document Intelligence Assistant dashboard.
    """
    documents = Document.objects.filter(is_processed=True)
    total_vectors = get_total_indexed_vectors()
    model_name = getattr(settings, 'GEMINI_MODEL', 'gemini-3.5-flash-lite')
    api_key_present = bool(get_active_gemini_api_key())

    return render(request, 'documents/index.html', {
        'documents': documents,
        'total_vectors': total_vectors,
        'model_name': model_name,
        'api_key_present': api_key_present,
    })


# -----------------------------------------------------------------------------
# Asynchronous REST / JSON API Endpoints (Fetch API / Vanilla JS)
# -----------------------------------------------------------------------------

@csrf_exempt
@require_POST
def api_upload(request):
    """
    Asynchronous document upload endpoint supporting PDF and TXT files.
    Extracts text, calculates semantic chunks, indexes into ChromaDB.
    """
    uploaded_file = request.FILES.get('document')
    if not uploaded_file:
        return JsonResponse({'success': False, 'error': 'No file was provided.'}, status=400)

    is_valid, err_msg = validate_file(uploaded_file)
    if not is_valid:
        return JsonResponse({'success': False, 'error': err_msg}, status=400)

    ext = Path(uploaded_file.name).suffix.lower()

    # Create model record
    doc = Document.objects.create(
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
    Retrieves semantic context from vector store and queries Gemini API.
    """
    try:
        data = json.loads(request.body.decode('utf-8'))
        query = data.get('query', '').strip()
        language = data.get('language', 'en').strip().lower()
        force_visual = bool(data.get('force_visual', False))
    except Exception:
        query = request.POST.get('query', '').strip()
        language = request.POST.get('language', 'en').strip().lower()
        force_visual = request.POST.get('force_visual', '').lower() in ('true', '1')

    if not query:
        return JsonResponse({'success': False, 'error': 'Please enter a valid question.'}, status=400)

    # Check if documents exist in knowledge base
    if not Document.objects.filter(is_processed=True).exists():
        return JsonResponse({
            'success': False,
            'error': 'Please upload at least one document before asking questions.'
        }, status=400)

    top_k = getattr(settings, 'TOP_K_CHUNKS', 4)
    result = query_rag_pipeline(query, top_k=top_k, language=language, force_visual=force_visual)

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
    Asynchronous deletion endpoint. Removes document from database and vector index.
    """
    doc = get_object_or_404(Document, id=document_id)
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
    docs_count = Document.objects.filter(is_processed=True).count()
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
    Saves the user's Gemini API key to .env and updates runtime settings in memory.
    """
    import re
    try:
        data = json.loads(request.body.decode('utf-8'))
        api_key = data.get('api_key', '').strip()
    except Exception:
        api_key = request.POST.get('api_key', '').strip()

    if not api_key:
        return JsonResponse({'success': False, 'error': 'API key cannot be empty.'}, status=400)

    # Update in memory
    settings.GEMINI_API_KEY = api_key
    os.environ['GEMINI_API_KEY'] = api_key

    # Persist to .env file
    env_path = settings.BASE_DIR / '.env'
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

        return JsonResponse({
            'success': True,
            'message': 'Gemini API key saved and activated successfully! You can now ask questions.'
        })
    except Exception as e:
        return JsonResponse({'success': False, 'error': f"Failed to write to .env: {str(e)}"}, status=500)


# -----------------------------------------------------------------------------
# Standard Form Fallback Endpoints (For Traditional Form POSTs)
# -----------------------------------------------------------------------------

@require_POST
def upload_document(request):
    uploaded_file = request.FILES.get('document')
    if not uploaded_file:
        messages.error(request, "No file selected.")
        return redirect('home')

    is_valid, err_msg = validate_file(uploaded_file)
    if not is_valid:
        messages.error(request, err_msg)
        return redirect('home')

    ext = Path(uploaded_file.name).suffix.lower()
    doc = Document.objects.create(
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

    return redirect('home')


@require_POST
def delete_document(request, document_id):
    doc = get_object_or_404(Document, id=document_id)
    name = doc.original_name
    delete_document_from_index(doc)
    doc.delete()
    messages.info(request, f"Deleted document '{name}'.")
    return redirect('home')


@require_POST
def ask_question(request):
    query = request.POST.get('question', '').strip()
    if not query:
        messages.warning(request, "Please enter a question.")
        return redirect('home')

    documents = Document.objects.filter(is_processed=True)
    if not documents.exists():
        messages.warning(request, "Please upload at least one document before asking questions.")
        return redirect('home')

    result = query_rag_pipeline(query, top_k=getattr(settings, 'TOP_K_CHUNKS', 4))

    return render(request, 'documents/index.html', {
        'documents': documents,
        'query': query,
        'answer': result.get('answer'),
        'sources': result.get('sources', []),
        'has_context_match': result.get('has_context_match', True),
        'total_vectors': result.get('total_vectors', 0),
        'model_name': getattr(settings, 'GEMINI_MODEL', 'gemini-1.5-flash'),
        'api_key_present': bool(getattr(settings, 'GEMINI_API_KEY', '').strip()),
    })