"""
Antigravity Document Intelligence Assistant - RAG Pipeline
===========================================================
This module coordinates the complete Retrieval-Augmented Generation pipeline:
1. Document ingestion and validation (PDF & TXT).
2. Page-aware text extraction using PyPDF / encoding-safe text readers.
3. Semantic text chunking (~500-800 characters with ~100 char overlap).
4. Local vector embedding generation using Sentence Transformers.
5. Persistent vector indexing and cosine similarity retrieval in ChromaDB.
6. Context-grounded Generative AI generation using Google Gemini API.
"""

import os
import re
import json
from pathlib import Path
from typing import List, Dict, Any, Tuple, Optional

from django.conf import settings
from documents.models import Document

# Third-party RAG dependencies
import pypdf
from sentence_transformers import SentenceTransformer
import chromadb

# Cached instances
_EMBEDDING_MODEL = None
_CHROMA_CLIENT = None


def get_embedding_model() -> SentenceTransformer:
    """
    Returns a cached singleton instance of the SentenceTransformer embedding model.
    Default model: 'all-MiniLM-L6-v2' (fast, 384-dimensional dense vectors).
    """
    global _EMBEDDING_MODEL
    if _EMBEDDING_MODEL is None:
        model_name = getattr(settings, 'EMBEDDING_MODEL_NAME', 'all-MiniLM-L6-v2')
        _EMBEDDING_MODEL = SentenceTransformer(model_name)
    return _EMBEDDING_MODEL


def get_chroma_collection():
    """
    Returns the persistent ChromaDB collection for the Antigravity assistant.
    Storage location: settings.CHROMA_PERSIST_DIR.
    """
    global _CHROMA_CLIENT
    persist_dir = str(getattr(settings, 'CHROMA_PERSIST_DIR', settings.BASE_DIR / 'chroma_db'))
    os.makedirs(persist_dir, exist_ok=True)

    if _CHROMA_CLIENT is None:
        _CHROMA_CLIENT = chromadb.PersistentClient(path=persist_dir)

    return _CHROMA_CLIENT.get_or_create_collection(
        name="antigravity_documents_collection",
        metadata={"description": "Antigravity Document Intelligence Vector Store"}
    )


def validate_file(uploaded_file) -> Tuple[bool, str]:
    """
    Validates the uploaded file for acceptable extension and file-size limits.
    """
    max_size = getattr(settings, 'MAX_UPLOAD_SIZE', 10 * 1024 * 1024)
    if uploaded_file.size > max_size:
        max_mb = max_size / (1024 * 1024)
        return False, f"File exceeds maximum allowed size ({max_mb:.0f} MB)."

    if uploaded_file.size == 0:
        return False, "Uploaded file is empty (0 bytes)."

    ext = Path(uploaded_file.name).suffix.lower()
    if ext not in ['.pdf', '.txt']:
        return False, "Unsupported file format. Only PDF (.pdf) and Text (.txt) files are supported."

    return True, ""


def extract_text_from_pdf(file_path: str) -> Tuple[List[Dict[str, Any]], int]:
    """
    Extracts text page-by-page from a PDF file using pypdf.
    Preserves exact page numbering (1-indexed) for citations.
    """
    pages_data = []
    try:
        reader = pypdf.PdfReader(file_path)
        total_pages = len(reader.pages)
        if total_pages == 0:
            raise ValueError("The PDF contains no pages.")

        for idx, page in enumerate(reader.pages, start=1):
            text = page.extract_text() or ""
            clean_text = re.sub(r'[ \t]+', ' ', text).strip()
            if clean_text:
                pages_data.append({
                    'page': idx,
                    'text': clean_text
                })

        if not pages_data:
            raise ValueError("No extractable text found in this PDF. It may be scanned or image-only without OCR.")

        return pages_data, total_pages
    except pypdf.errors.PdfReadError as e:
        raise ValueError(f"Corrupted or invalid PDF file: {str(e)}")


def extract_text_from_txt(file_path: str) -> Tuple[List[Dict[str, Any]], int]:
    """
    Safely reads text from a TXT file with automatic encoding fallbacks.
    """
    encodings = ['utf-8', 'latin-1', 'cp1252']
    raw_text = None

    for enc in encodings:
        try:
            with open(file_path, 'r', encoding=enc) as f:
                raw_text = f.read()
            break
        except UnicodeDecodeError:
            continue

    if raw_text is None:
        with open(file_path, 'r', encoding='utf-8', errors='replace') as f:
            raw_text = f.read()

    clean_text = re.sub(r'[ \t]+', ' ', raw_text).strip()
    if not clean_text:
        raise ValueError("The text file is empty or contains only whitespace.")

    return [{'page': 1, 'text': clean_text}], 1


def chunk_text(pages_data: List[Dict[str, Any]], chunk_size: int = 650, overlap: int = 100) -> List[Dict[str, Any]]:
    """
    Splits text across document pages into overlapping semantic chunks
    while retaining page numbers and generating chunk indices.
    """
    chunks = []
    chunk_counter = 1

    for page_item in pages_data:
        page_num = page_item['page']
        text = page_item['text']

        if len(text) <= chunk_size:
            chunks.append({
                'chunk_index': chunk_counter,
                'page': page_num,
                'text': text
            })
            chunk_counter += 1
            continue

        start = 0
        text_len = len(text)
        step = chunk_size - overlap

        while start < text_len:
            end = min(start + chunk_size, text_len)
            chunk_slice = text[start:end].strip()

            if chunk_slice:
                chunks.append({
                    'chunk_index': chunk_counter,
                    'page': page_num,
                    'text': chunk_slice
                })
                chunk_counter += 1

            if end == text_len:
                break
            start += step

    return chunks


def process_and_index_document(document: Document) -> int:
    """
    Executes the ingestion pipeline:
    1. Extracts text from the stored file.
    2. Chunks text with overlap.
    3. Computes dense embeddings with SentenceTransformers.
    4. Indexes chunks and metadata into ChromaDB.
    5. Updates Document model record.
    """
    file_path = document.file.path
    ext = document.file_type.lower()

    if ext == '.pdf':
        pages_data, total_pages = extract_text_from_pdf(file_path)
    elif ext == '.txt':
        pages_data, total_pages = extract_text_from_txt(file_path)
    else:
        raise ValueError(f"Unsupported file format: {ext}")

    document.page_count = total_pages

    chunk_size = getattr(settings, 'CHUNK_SIZE', 650)
    overlap = getattr(settings, 'CHUNK_OVERLAP', 100)
    chunks = chunk_text(pages_data, chunk_size=chunk_size, overlap=overlap)

    if not chunks:
        raise ValueError("Failed to create any text chunks from document.")

    # Generate dense vector embeddings
    model = get_embedding_model()
    chunk_texts = [c['text'] for c in chunks]
    embeddings = model.encode(chunk_texts, show_progress_bar=False).tolist()

    # Index into ChromaDB
    collection = get_chroma_collection()
    ids = [f"doc_{document.id}_chunk_{c['chunk_index']}" for c in chunks]
    metadatas = [
        {
            "document_id": document.id,
            "filename": document.original_name,
            "page": int(c['page']),
            "chunk_index": int(c['chunk_index']),
        }
        for c in chunks
    ]

    collection.add(
        ids=ids,
        embeddings=embeddings,
        metadatas=metadatas,
        documents=chunk_texts
    )

    # Persist status in database
    document.chunk_count = len(chunks)
    document.is_processed = True
    document.error_message = None
    document.save()

    return len(chunks)


def delete_document_from_index(document: Document):
    """
    Purges document chunks from the ChromaDB vector collection and deletes the file from disk.
    """
    try:
        collection = get_chroma_collection()
        collection.delete(where={"document_id": document.id})
    except Exception:
        pass

    if document.file and os.path.isfile(document.file.path):
        try:
            os.remove(document.file.path)
        except OSError:
            pass


def get_total_indexed_vectors() -> int:
    """
    Returns the total count of vector embeddings currently loaded in the ChromaDB collection.
    """
    try:
        collection = get_chroma_collection()
        return collection.count()
    except Exception:
        return 0


LANGUAGE_CONFIG = {
    'en': {
        'name': 'English',
        'locale': 'en-IN',
        'anti_hallucination': 'Information not found in the uploaded documents.',
        'instruction': 'Answer strictly in English.',
    },
    'hi': {
        'name': 'Hindi (हिन्दी)',
        'locale': 'hi-IN',
        'anti_hallucination': 'अपलोड किए गए दस्तावेज़ों में यह जानकारी नहीं मिली।',
        'instruction': 'Answer fluently in Hindi (हिन्दी) in Devanagari script. Accurately preserve technical computer science terms, proper nouns, code, and numerical values.',
    },
    'mr': {
        'name': 'Marathi (मराठी)',
        'locale': 'mr-IN',
        'anti_hallucination': 'अपलोड केलेल्या कागदपत्रांमध्ये ही माहिती आढळली नाही.',
        'instruction': 'Answer fluently in Marathi (मराठी) in Devanagari script. Accurately preserve technical computer science terms, proper nouns, code, and numerical values.',
    }
}


def get_active_gemini_api_key() -> str:
    """
    Retrieves Gemini API key with dynamic .env fallback if runtime memory is stale.
    """
    key = (
        getattr(settings, 'GEMINI_API_KEY', '')
        or os.getenv('GEMINI_API_KEY', '')
        or os.getenv('GOOGLE_API_KEY', '')
    )
    if not key or key.strip() in ['YOUR_GEMINI_API_KEY', '']:
        env_file = getattr(settings, 'BASE_DIR', Path(__file__).resolve().parent.parent.parent) / '.env'
        if env_file.exists():
            from dotenv import dotenv_values
            vals = dotenv_values(env_file)
            key = (vals.get('GEMINI_API_KEY') or vals.get('GOOGLE_API_KEY') or '').strip()
            if key and key != 'YOUR_GEMINI_API_KEY':
                try:
                    settings.GEMINI_API_KEY = key
                except Exception:
                    pass
                os.environ['GEMINI_API_KEY'] = key
    return key.strip() if key else ''


def expand_cross_lingual_query(query: str, api_key: str = '') -> str:
    """
    If the query contains Devanagari script (Hindi/Marathi), extracts English search
    keywords to enable cross-lingual semantic matching against English documents.
    """
    if not re.search(r'[\u0900-\u097F]', query):
        return query

    if not api_key:
        api_key = get_active_gemini_api_key()

    if not api_key:
        return query

    try:
        from google import genai
        client = genai.Client(api_key=api_key)
        resp = client.models.generate_content(
            model='gemini-3.5-flash-lite',
            contents=f"Translate this Hindi/Marathi document search query into 2-5 concise English technical search keywords for dense vector retrieval. Respond ONLY with the English search keywords without commentary: {query}"
        )
        if resp and hasattr(resp, 'text') and resp.text.strip():
            return resp.text.strip()
    except Exception:
        pass
    return query


def retrieve_relevant_chunks(query: str, top_k: int = 4) -> List[Dict[str, Any]]:
    """
    Performs cosine similarity search against ChromaDB using the embedded query.
    Supports cross-lingual query expansion for Hindi and Marathi queries.
    Returns ranked chunks with confidence/relevance scores.
    """
    collection = get_chroma_collection()
    count = collection.count()
    if count == 0:
        return []

    model = get_embedding_model()
    queries_to_search = [query]

    # If query contains Hindi or Marathi Devanagari characters, expand to English search terms as well
    if re.search(r'[\u0900-\u097F]', query):
        english_expansion = expand_cross_lingual_query(query)
        if english_expansion and english_expansion.lower() != query.lower():
            queries_to_search.append(english_expansion)

    chunks_by_id = {}
    n_results = min(top_k, count)

    for q in queries_to_search:
        query_embedding = model.encode([q]).tolist()[0]
        results = collection.query(
            query_embeddings=[query_embedding],
            n_results=n_results,
            include=["documents", "metadatas", "distances"]
        )

        if results and "documents" in results and results["documents"]:
            docs = results["documents"][0]
            metas = results["metadatas"][0]
            dists = results["distances"][0] if "distances" in results else [0.0] * len(docs)

            for doc_text, meta, dist in zip(docs, metas, dists):
                similarity_pct = max(0, min(100, round((1.0 - (float(dist) / 2.0)) * 100)))
                chunk_id = f"{meta.get('document_id')}_{meta.get('chunk_index')}"

                # Retain the highest score if retrieved via both original & expanded queries
                if chunk_id not in chunks_by_id or similarity_pct > chunks_by_id[chunk_id]["relevance_score"]:
                    chunks_by_id[chunk_id] = {
                        "document_id": meta.get("document_id"),
                        "filename": meta.get("filename", "Document"),
                        "page": meta.get("page", 1),
                        "chunk_index": meta.get("chunk_index", 1),
                        "text": doc_text,
                        "distance": round(float(dist), 4),
                        "relevance_score": similarity_pct,
                    }

    # Sort merged chunks by relevance score descending
    sorted_chunks = sorted(chunks_by_id.values(), key=lambda x: x["relevance_score"], reverse=True)
    return sorted_chunks[:top_k]


def parse_llm_visual_response(raw_text: str) -> Tuple[str, Optional[Dict[str, Any]]]:
    """
    Parses LLM output into an answer string and an optional visual specification.
    Safely handles pure JSON, markdown-fenced JSON, or pure text with embedded Mermaid.
    """
    if not raw_text:
        return "", None

    text_to_parse = raw_text.strip()

    # 1. Try stripping ```json ... ``` wrapper
    json_match = re.search(r'```(?:json)?\s*(\{[\s\S]*?\})\s*```', text_to_parse, re.DOTALL)
    if json_match:
        text_to_parse = json_match.group(1).strip()

    # 2. Try JSON parsing (including finding outermost JSON object)
    brace_start = text_to_parse.find('{')
    brace_end = text_to_parse.rfind('}')
    if brace_start != -1 and brace_end > brace_start:
        candidate_json = text_to_parse[brace_start:brace_end + 1]
        try:
            parsed = json.loads(candidate_json)
            if isinstance(parsed, dict) and ('answer' in parsed or 'text_answer' in parsed):
                answer = parsed.get('answer') or parsed.get('text_answer') or ''
                visual = parsed.get('visual')
                # Validate visual structure
                if isinstance(visual, dict) and visual.get('type') in ['mermaid', 'chartjs']:
                    # Clean up mermaid code if wrapped in markdown backticks
                    if visual.get('type') == 'mermaid' and visual.get('code'):
                        code = visual['code'].strip()
                        code = re.sub(r'^```(?:mermaid)?\s*', '', code)
                        code = re.sub(r'\s*```$', '', code).strip()
                        visual['code'] = code
                    return str(answer).strip(), visual
                return str(answer).strip(), None
        except Exception:
            pass

    # 3. Fallback: Check if raw_text contains an explicit ```mermaid block
    mermaid_match = re.search(r'```(?:mermaid)?\s*([\s\S]*?)\s*```', raw_text, re.DOTALL)
    if mermaid_match:
        code = mermaid_match.group(1).strip()
        first_line = code.split('\n')[0].strip().lower()
        if any(first_line.startswith(k) for k in ['graph', 'flowchart', 'sequencediagram', 'timeline', 'classdiagram', 'gantt', 'pie', 'mindmap', 'erdiagram']):
            clean_answer = re.sub(r'```(?:mermaid)?\s*[\s\S]*?\s*```', '', raw_text).strip()
            visual = {
                "type": "mermaid",
                "sub_type": "flowchart" if "flowchart" in first_line or "graph" in first_line else "diagram",
                "title": "Visual Diagram",
                "code": code,
                "has_data": True,
                "insufficient_data_reason": None
            }
            return clean_answer, visual

    # 4. Pure text
    return raw_text.strip(), None


def query_rag_pipeline(query: str, top_k: int = 4, language: str = 'en', force_visual: bool = False) -> Dict[str, Any]:
    """
    Complete Multilingual RAG workflow with Smart Visual Learning Engine:
    1. Cross-lingual semantic similarity retrieval via ChromaDB.
    2. Context-grounded response and visual diagram/chart synthesis via Google Gemini API.
    3. Intelligent visual selection (Flowchart, Block Diagram, Timeline, Concept Map, Bar/Pie Charts).
    4. Strict document grounding & anti-hallucination verification.
    """
    lang = language.lower() if language else 'en'
    if lang not in LANGUAGE_CONFIG:
        lang = 'en'
    lang_info = LANGUAGE_CONFIG[lang]
    anti_hallucination_phrase = lang_info['anti_hallucination']
    lang_instruction = lang_info['instruction']

    retrieved_chunks = retrieve_relevant_chunks(query, top_k=top_k)

    if not retrieved_chunks:
        return {
            "answer": anti_hallucination_phrase,
            "visual": None,
            "sources": [],
            "has_context_match": False,
            "language": lang,
            "total_vectors": get_total_indexed_vectors()
        }

    # Format context passages
    context_blocks = []
    for idx, c in enumerate(retrieved_chunks, start=1):
        context_blocks.append(
            f"[Chunk {idx} | Document: {c['filename']} | Page: {c['page']}]\n{c['text']}"
        )
    formatted_context = "\n\n".join(context_blocks)

    # Validate Gemini API key
    api_key = get_active_gemini_api_key()
    if not api_key:
        return {
            "answer": (
                "⚠️ **Gemini API Key Required**\n\n"
                "Please configure your `GEMINI_API_KEY` to enable Generative AI responses:\n"
                "1. Click the **'Configure API Key'** button in the top navigation bar (or paste it into your `.env` file).\n"
                "2. Get a free API key at [Google AI Studio](https://aistudio.google.com/).\n\n"
                "*Note: Semantic retrieval was successful! The relevant passages from your document are displayed in the Citations panel below.*"
            ),
            "visual": None,
            "sources": retrieved_chunks,
            "has_context_match": True,
            "api_key_missing": True,
            "language": lang,
            "total_vectors": get_total_indexed_vectors()
        }

    # Smart Visual Learning Engine directives
    visual_engine_rules = (
        "SMART VISUAL LEARNING ENGINE DIRECTIVES:\n"
        "Evaluate whether the question or the retrieved document context naturally benefits from a visual explanation:\n"
        "- Sequences, workflows, algorithms, execution steps -> Flowchart (Mermaid `flowchart TD`)\n"
        "- System architecture, hardware components, microprocessors -> Block Diagram (Mermaid `graph TD` or `flowchart LR`)\n"
        "- Chronological events, history, milestones -> Timeline (Mermaid `timeline`)\n"
        "- Concept relations -> Concept Map (Mermaid `graph TD`)\n"
        "- Comparing concepts -> Comparison Diagram (Mermaid `graph LR` or matrix)\n"
        "- Discrete numerical metrics / comparisons -> Bar Chart (Chart.js JSON)\n"
        "- Category proportions / breakdown with reliable totals -> Pie or Doughnut Chart (Chart.js JSON)\n"
        "\nGROUNDING & ZERO-HALLUCINATION RULES:\n"
        "1. Strictly use ONLY verifiable facts, components, and numbers from the provided context chunks.\n"
        "2. NEVER invent numerical values, dates, percentages, or statistics.\n"
        "3. If the user asks for a chart or statistics but the document lacks verifiable numbers, set visual.has_data to false and visual.insufficient_data_reason to a clear explanation in the requested language.\n"
        "4. If a normal text answer is sufficient and no visual structure makes sense, set visual to null. Do NOT force a chart for mere decoration.\n"
        f"{'5. Note: The user explicitly requested a visual explanation. Generate the most suitable diagram or chart grounded in the context.' if force_visual else ''}\n"
        "\nMERMAID RULES:\n"
        "- All node text MUST be enclosed in double quotes, e.g. A[\"Java Code\"] --> B[\"Bytecode\"], A[\"जाव्हा कोड\"] --> B[\"बाइटकोड\"].\n"
        "- Never use unquoted parenthesis, braces, or brackets inside node labels.\n"
        "- In Hindi or Marathi, ensure the node text inside double quotes is in the requested language.\n"
        "\nOUTPUT SCHEMA:\n"
        "You MUST respond strictly with a valid JSON object matching this schema:\n"
        "{\n"
        '  "answer": "Grounded answer text in the requested language with source citations [Chunk 1, Chunk 2]...",\n'
        '  "visual": null | {\n'
        '    "type": "mermaid" | "chartjs",\n'
        '    "sub_type": "flowchart" | "block_diagram" | "timeline" | "concept_map" | "comparison" | "bar" | "line" | "pie" | "doughnut",\n'
        '    "title": "Short descriptive title in requested language",\n'
        '    "code": "Mermaid diagram code string (when type is mermaid)",\n'
        '    "chart_config": { "type": "bar"|"line"|"pie"|"doughnut", "data": { "labels": [...], "datasets": [{ "label": "...", "data": [...] }] } },\n'
        '    "has_data": true | false,\n'
        '    "insufficient_data_reason": null | "Reason why data was insufficient in document"\n'
        '  }\n'
        "}\n"
        "Output ONLY the JSON object. Do not add markdown formatting or commentary outside the JSON."
    )

    # Strict system prompt prescribed by requirements
    strict_system_prompt = (
        "You are an AI Document Assistant powered by DocuMind AI's Smart Visual Learning Engine. "
        "Use ONLY the provided context chunks below to answer the user's query. "
        f"If the query cannot be answered based on the context provided, reply strictly with: "
        f"'{anti_hallucination_phrase}' "
        "Do NOT hallucinate or use outside knowledge. "
        f"Language Instruction: {lang_instruction} "
        "Ensure factual accuracy and preserve numbers, code, and technical definitions faithfully. "
        "Do NOT invent or alter any source citations or chunk IDs.\n\n"
        f"{visual_engine_rules}"
    )

    prompt = (
        f"{strict_system_prompt}\n\n"
        f"--- CONTEXT CHUNKS START ---\n"
        f"{formatted_context}\n"
        f"--- CONTEXT CHUNKS END ---\n\n"
        f"USER QUERY: {query}\n\n"
        f"ANSWER:"
    )

    # Invoke Google Gemini API
    configured_model = getattr(settings, 'GEMINI_MODEL', 'gemini-3.5-flash-lite')
    candidate_models = [configured_model, 'gemini-3.5-flash-lite', 'gemini-3.5-flash', 'gemini-flash-latest']
    seen = set()
    candidate_models = [m for m in candidate_models if not (m in seen or seen.add(m))]

    raw_response_text = None
    last_error = None

    try:
        # First attempt: modern google.genai SDK
        try:
            from google import genai
            client = genai.Client(api_key=api_key)
            for m in candidate_models:
                try:
                    response = client.models.generate_content(
                        model=m,
                        contents=prompt
                    )
                    if hasattr(response, 'text') and response.text:
                        raw_response_text = response.text.strip()
                        break
                except Exception as model_err:
                    last_error = model_err
                    continue
        except Exception as sdk_err:
            last_error = sdk_err

        # Fallback attempt: google.generativeai package
        if not raw_response_text:
            try:
                import google.generativeai as legacy_genai
                legacy_genai.configure(api_key=api_key)
                for m in candidate_models:
                    try:
                        m_clean = m.replace('models/', '')
                        model = legacy_genai.GenerativeModel(m_clean)
                        response = model.generate_content(prompt)
                        if hasattr(response, 'text') and response.text:
                            raw_response_text = response.text.strip()
                            break
                    except Exception as legacy_err:
                        last_error = legacy_err
                        continue
            except Exception:
                pass

        if not raw_response_text:
            raise last_error or RuntimeError("Failed to generate response from Gemini API.")

        # Parse structured text and visual payload
        answer_text, visual_data = parse_llm_visual_response(raw_response_text)

        fallback_signals = [
            "information not found in the uploaded documents",
            "the uploaded documents do not provide",
            "not mentioned in the context",
            "not found in the provided",
            "अपलोड किए गए दस्तावेज़ों में यह जानकारी नहीं मिली",
            "अपलोड केलेल्या कागदपत्रांमध्ये ही माहिती आढळली नाही",
        ]
        has_match = not any(sig in answer_text for sig in fallback_signals) and not any(sig in answer_text.lower() for sig in ["information not found", "not mentioned in the context", "not found in the provided"])

        # If context did not match or query is out-of-scope, strictly disallow hallucinated visuals
        if not has_match:
            visual_data = None

        return {
            "answer": answer_text,
            "visual": visual_data,
            "sources": retrieved_chunks,
            "has_context_match": has_match,
            "language": lang,
            "total_vectors": get_total_indexed_vectors()
        }

    except Exception as e:
        err_msg = str(e)
        if "API_KEY_INVALID" in err_msg or ("400" in err_msg and "key" in err_msg.lower()):
            friendly_err = "Invalid Gemini API key. Please check the GEMINI_API_KEY in `.env`."
        elif "RESOURCE_EXHAUSTED" in err_msg or "429" in err_msg:
            friendly_err = "Gemini API rate limit or quota exceeded. Please wait a moment and try again."
        else:
            friendly_err = f"Gemini API Error: {err_msg}"

        return {
            "answer": f"{friendly_err}\n\nRetrieved context chunks remain available in the citations section below.",
            "visual": None,
            "sources": retrieved_chunks,
            "has_context_match": False,
            "error": err_msg,
            "language": lang,
            "total_vectors": get_total_indexed_vectors()
        }
