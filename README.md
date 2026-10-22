# DocuMind AI — AI-Powered Document Intelligence Assistant
### Production-Ready RAG & Generative AI Dashboard

[![Django](https://img.shields.io/badge/Django-5.1%2B-092e20?logo=django)](https://www.djangoproject.com/)
[![ChromaDB](https://img.shields.io/badge/VectorDB-ChromaDB-fc60a8)](https://www.trychroma.com/)
[![Google Gemini](https://img.shields.io/badge/LLM-Google%20Gemini-4285F4?logo=google)](https://aistudio.google.com/)
[![Bootstrap 5](https://img.shields.io/badge/UI-Bootstrap%205%20DocuMind-7952b3?logo=bootstrap)](https://getbootstrap.com/)

> **Tagline:** *Chat with your documents. Discover insights instantly.*

---

## 🚀 Overview & Architecture

**DocuMind AI** is an attractive, modern, responsive single-page web dashboard designed for hackathons and production document intelligence:
- **Design Aesthetic**: Modern Cyber & Glassmorphic AI theme with electric violet (`#6366f1`), cyan (`#06b6d4`), and emerald (`#10b981`) accents. Full one-click **Dark Mode (Obsidian) / Light Mode (Pearlescent)** toggle.
- **Asynchronous Drag-and-Drop Ingestion**: Upload PDF and TXT files (up to 10 MB) seamlessly with real-time vector chunking feedback without page refreshes.
- **Document Management**: Displays uploaded filenames, file formats, page counts, chunk counts, and file sizes. Includes working **Summarize** and **Delete** actions.
- **Page-Aware Text Processing & Semantic Chunking**: PyPDF and multi-encoding safe text readers divide documents into ~650-character chunks with 100-character overlap, preserving document names and exact page citations.
- **Local Dense Semantic Vectors**: Generates 384-dimensional dense embeddings using `sentence-transformers` (`all-MiniLM-L6-v2`) locally on CPU/GPU.
- **Persistent Vector Indexing**: Stores vectors, text snippets, and document metadata in **ChromaDB**.
- **Context-Grounded Generative AI**: Uses Google's official `google-genai` SDK with **Gemini 3.5 Flash Lite** (sub-second synthesis).
- **Strict Anti-Hallucination Guardrail**:
  > *"You are an AI Document Assistant. Use ONLY the provided context chunks below to answer the user's query. If the query cannot be answered based on the context provided, reply strictly with: 'Information not found in the uploaded documents.' Do NOT hallucinate or use outside knowledge."*
- **Smart Visual Learning Engine**:
  - Automatically synthesizes **Flowcharts**, **Block Diagrams**, **Timelines**, and **Concept Maps** using Mermaid.js.
  - Generates interactive **Bar**, **Line**, **Pie**, and **Doughnut charts** using Chart.js based strictly on document numbers.
  - Zero-hallucination policy: never invents statistics, dates, or numbers; flags insufficient document data with clear alerts.
  - Interactive answer toolbar with tabs: `📊 View Diagram/Chart`, `📝 Show Explanation`, and `🔍 Supporting Evidence`.
  - High-resolution modal with pan & **Zoom In / Zoom Out / Reset** controls.
- **Multilingual Support**: Real-time cross-lingual synthesis in **English**, **Hindi (हिंदी)**, and **Marathi (मराठी)** with Devanagari diagram node labels.
- **Voice-Enabled Workflow**: Microphone voice recognition and Text-to-Speech audio reader in English, Hindi, and Marathi.
- **Verifiable Citations**: Inline collapsible citation cards presenting exact retrieved context passages, page numbers, and similarity percentage meters directly below AI answers.

---

## 🗂️ Project Directory Structure

```text
DocumentAI/
├── config/                         # Django project configuration
│   ├── settings.py                 # Core settings, media & vector DB paths, Gemini config
│   ├── urls.py                     # Main routing & development media serving
│   ├── asgi.py & wsgi.py           # Web server entrypoints
├── documents/                      # Core Django application
│   ├── models.py                   # Document database model (files, chunks, pages)
│   ├── services/                   # Modular RAG services package
│   │   ├── __init__.py             # Service exports
│   │   └── rag_pipeline.py         # Complete RAG pipeline (extract, chunk, embed, ChromaDB, Gemini)
│   ├── views.py                    # REST API endpoints (api_upload, api_ask, api_delete, api_status)
│   ├── urls.py                     # Route mappings
│   ├── tests.py                    # Automated test suite (14 unit tests, 100% pass)
│   └── templates/documents/
│       └── index.html              # DocuMind AI 3-column dashboard template
├── static/
│   ├── css/
│   │   ├── documind.css            # Clean white/navy/indigo SaaS dashboard stylesheet
│   │   └── antigravity.css         # Alternative dark theme
│   └── js/
│       ├── documind.js             # Asynchronous Drag-and-drop, chat stream, dynamic citations
│       └── antigravity.js          # Client script
├── media/                          # Local storage for uploaded documents (Git excluded)
│   └── documents/
├── chroma_db/                      # Persistent ChromaDB vector database (Git excluded)
├── .env.example                    # Template environment file
├── .env                            # Local configuration (never committed)
├── .gitignore                      # Git exclusion rules
├── manage.py                       # Django CLI management script
├── requirements.txt                # Python dependencies
└── README.md                       # Documentation
```

---

## ⚡ Quick Start Guide (Windows)

### 1. Open Terminal in Project Directory
```powershell
cd D:\DocumentAI
```

### 2. Activate Your Python Virtual Environment
```powershell
.\venv\Scripts\activate
```

### 3. Install All Dependencies
```powershell
pip install -r requirements.txt
```

### 4. Configure Your Gemini API Key
Open [.env](file:///d:/DocumentAI/.env) and paste your free key from [Google AI Studio](https://aistudio.google.com/):
```ini
DEBUG=True
DJANGO_SECRET_KEY=django-insecure-ps%#09tg6r8y!aow8a&5+*l&1v^s=z@#xi_o4t=zd022n&yofc
ALLOWED_HOSTS=127.0.0.1,localhost

# Google Gemini API key
GEMINI_API_KEY=AIzaSy...your_gemini_api_key_here
GEMINI_MODEL=gemini-3.5-flash-lite

# Embeddings Model
EMBEDDING_MODEL_NAME=all-MiniLM-L6-v2
```

### 5. Run Database Migrations
```powershell
python manage.py migrate
```

### 6. Run Automated Tests
```powershell
python manage.py test documents
```
Expected output:
```text
Ran 14 tests in 1.881s
OK
```

### 7. Launch the Development Server
```powershell
python manage.py runserver
```
Visit in your browser:
👉 **`http://127.0.0.1:8000/`**

---

## 🌐 REST API Endpoints

The web frontend communicates with the Django backend asynchronously:

| Endpoint | Method | Payload | Description |
| :--- | :---: | :--- | :--- |
| `/api/upload/` | `POST` | `multipart/form-data` with `document` | Uploads and indexes PDF/TXT document into ChromaDB |
| `/api/ask/` | `POST` | `{"query": "your question"}` | Retrieves top semantic chunks and calls Gemini |
| `/api/delete/<id>/` | `POST` | None | Purges document from database, disk, and vector index |
| `/api/status/` | `GET` | None | Returns active vector counts, model name, and system health |
