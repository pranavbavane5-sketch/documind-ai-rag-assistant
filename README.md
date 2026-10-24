# DocuMind AI — AI-Powered Document Intelligence Assistant
### Production-Ready RAG & Enterprise Role-Based Access Control (RBAC) Dashboard

[![Django](https://img.shields.io/badge/Django-6.1%2B-092e20?logo=django)](https://www.djangoproject.com/)
[![ChromaDB](https://img.shields.io/badge/VectorDB-ChromaDB-fc60a8)](https://www.trychroma.com/)
[![Google Gemini](https://img.shields.io/badge/LLM-Google%20Gemini-4285F4?logo=google)](https://aistudio.google.com/)
[![Google OAuth 2.0](https://img.shields.io/badge/Auth-Google%20OAuth%202.0-4285F4?logo=google)](https://console.cloud.google.com/)
[![Bootstrap 5](https://img.shields.io/badge/UI-Bootstrap%205%20DocuMind-7952b3?logo=bootstrap)](https://getbootstrap.com/)

> **Tagline:** *Chat with your documents. Discover insights instantly with multi-tenant security.*

---

## 🚀 Overview & Security Architecture

**DocuMind AI** is an intelligent, multi-tenant document intelligence platform designed for students, researchers, and academic institutions:
- **Design Aesthetic**: Modern Cyber & Glassmorphic AI theme with electric violet (`#6366f1`), cyan (`#06b6d4`), and emerald (`#10b981`) accents. Full one-click **Dark Mode (Obsidian) / Light Mode (Pearlescent)** toggle.
- **Enterprise Authentication & OAuth 2.0**:
  - Maintained authentication via **`django-allauth`**.
  - **"Continue with Google"** OAuth 2.0 single sign-on with automatic account creation.
  - Standard username & email + password registration and login matching the DocuMind UI.
  - Secure session management, CSRF protection, and HttpOnly cookies.
- **Role-Based Access Control (RBAC)**:
  - **Student Role**: Automatically provisioned by default for all registrations (including Google OAuth signups). Students can only view, upload, query, summarize, and generate exam questions from their own documents.
  - **Administrator Role**: Strictly reserved for authorized staff created via `python manage.py createsuperuser` or promoted by existing administrators. **Google OAuth claims or email addresses can NEVER grant administrator privileges.**
  - **Least-Privilege Principle**: Dedicated server-side `@admin_required` decorators with custom 403 Forbidden branded responses for unauthorized requests.
- **Strict Multi-Tenant Document Isolation**:
  - Every document record in the database is strictly tied to `request.user`.
  - ChromaDB and vector retrieval are filtered by `allowed_doc_ids` belonging to the requesting user.
  - Two-layer defense-in-depth: filtered at vector query execution and verified at chunk extraction. Users can never retrieve or cite another user's documents.
- **Admin Operations Console (`/admin-dashboard/`)**:
  - Real-time platform metrics: total registered users, students, administrators, indexed documents, total storage size, vector embeddings, and inquiry operations.
  - User Directory: view registration dates, active document counts, and toggle account activation status (`Active` / `Deactivated`).
  - Role management: promote/demote administrators with self-deactivation protection.
  - **Administrative Security Audit Log**: Immutable record of privilege modifications, account activations, and IP addresses.
  - Links to Django Admin (`/admin/`) for authorized superusers.
- **Context-Grounded Generative AI**: Uses Google's official `google-genai` SDK with **Gemini 3.5 Flash Lite** (sub-second synthesis) and strict anti-hallucination verification.
- **Exam Preparation Mode**: Generates university-level 2-mark, 5-mark, and 10-mark questions with structured answers and Mermaid architectural diagrams.
- **Responsive 3-Column Layout**: Left document library (`280px`), center chat canvas (`minmax(400px, 1fr)`), and right Source Intelligence citation panel (`340px`).

---

## 🗂️ Project Directory Structure

```text
DocumentAI/
├── config/                         # Django project configuration
│   ├── settings.py                 # Core settings, allauth, OAuth, session & security policies
│   ├── urls.py                     # Main routing & accounts/ include
│   ├── asgi.py & wsgi.py           # Web server entrypoints
├── documents/                      # Core Django application
│   ├── models.py                   # UserProfile, Document (user-linked), AdminAuditLog, UserQueryHistory
│   ├── adapters.py                 # CustomSocialAccountAdapter (enforces least-privilege student role)
│   ├── services/                   # Modular RAG services package
│   │   ├── __init__.py             # Service exports
│   │   └── rag_pipeline.py         # Multi-tenant RAG pipeline (extract, chunk, embed, ChromaDB, Gemini)
│   ├── views.py                    # REST APIs, profile views, admin dashboard & RBAC decorators
│   ├── urls.py                     # Route mappings
│   ├── admin.py                    # Django Admin registrations
│   ├── tests.py                    # Comprehensive test suite (34 unit tests, 100% pass)
│   └── templates/
│       ├── account/                # Custom DocuMind branded allauth templates
│       │   ├── login.html          # Login page with Google OAuth + Email/Password
│       │   ├── signup.html         # Signup page with student role disclaimer
│       │   └── logout.html         # Sign out confirmation
│       └── documents/
│           ├── index.html          # DocuMind AI 3-column dashboard
│           ├── admin_dashboard.html# Protected Admin Operations Console
│           ├── profile.html        # User Profile & statistics
│           └── 403.html            # Branded 403 Forbidden page
├── media/                          # Local storage for uploaded documents (Git excluded)
├── chroma_db/                      # Persistent ChromaDB vector database (Git excluded)
├── .env.example                    # Template environment file
├── .env                            # Local configuration & API keys (never committed)
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

### 2. Activate Python Virtual Environment
```powershell
.\venv\Scripts\activate
```

### 3. Install Dependencies
```powershell
pip install -r requirements.txt
```

### 4. Configure Environment Variables
Open [.env](file:///d:/DocumentAI/.env) and configure your secrets:
```ini
DEBUG=True
DJANGO_SECRET_KEY=your-secure-secret-key-here
ALLOWED_HOSTS=127.0.0.1,localhost

# Google Gemini API key (Get free at https://aistudio.google.com/)
GEMINI_API_KEY=your-gemini-api-key-here
GEMINI_MODEL=gemini-3.5-flash-lite

# Embeddings Model
EMBEDDING_MODEL_NAME=all-MiniLM-L6-v2

# Google OAuth 2.0 Credentials (Optional: see setup guide below)
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

### 5. Apply Database Migrations
```powershell
python manage.py migrate
```

### 6. Create Initial Administrator Account
Create the primary administrator using Django's secure command-line utility:
```powershell
python manage.py createsuperuser
```
Follow the interactive prompts to set your administrator username, email, and password. This account is automatically granted the `admin` role and staff permissions.

### 7. Run the Automated Test Suite
```powershell
python manage.py test documents
```
Expected output:
```text
Ran 34 tests in 20.189s
OK
```

### 8. Launch the Development Server
```powershell
python manage.py runserver
```
Visit in your browser:
👉 **`http://127.0.0.1:8000/`**

---

## 🔑 Google Cloud Console OAuth 2.0 Setup Guide

To enable "Continue with Google" sign-in:

1. **Go to the Google Cloud Console**:
   Visit [Google Cloud Credentials](https://console.cloud.google.com/apis/credentials).
2. **Create or Select a Project**:
   Click the project dropdown in the top bar and select or create a project (e.g. `DocuMind-AI`).
3. **Configure OAuth Consent Screen**:
   - Go to **APIs & Services > OAuth consent screen**.
   - User Type: Select **External** and click **Create**.
   - App Name: `DocuMind AI`.
   - User Support Email: your email.
   - Developer Contact Email: your email.
   - Click **Save and Continue** through Scopes (`.../auth/userinfo.email`, `.../auth/userinfo.profile`).
   - Add Test Users: add your personal Google account email.
4. **Create OAuth 2.0 Client ID**:
   - Go to **APIs & Services > Credentials > Create Credentials > OAuth client ID**.
   - Application Type: **Web application**.
   - Name: `DocuMind AI Web Client`.
   - **Authorized JavaScript origins**:
     - `http://127.0.0.1:8000`
     - `http://localhost:8000`
   - **Authorized redirect URIs**:
     - `http://127.0.0.1:8000/accounts/google/login/callback/`
     - `http://localhost:8000/accounts/google/login/callback/`
5. **Copy Credentials to `.env`**:
   - Copy the generated **Client ID** and **Client Secret**.
   - Paste them into your `.env` file:
     ```ini
     GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com
     GOOGLE_CLIENT_SECRET=GOCSPX-xxxx
     ```
6. **Restart Django Server**:
   Once restarted, click **Sign In > Continue with Google**.

---

## 🛡️ Administrative Recovery & Commands

### Promoting a User to Administrator
If you need to grant administrator rights to an existing user via the CLI:
```powershell
python manage.py shell -c "from django.contrib.auth.models import User; u = User.objects.get(username='alice'); u.is_staff = True; u.save(); u.profile.role = 'admin'; u.profile.save(); print('User promoted to Admin.')"
```

### Resetting Administrator Password
If you forget your administrator password:
```powershell
python manage.py changepassword <admin_username>
```

---

## 🌐 Application URL Map

| Route | Method | Access Level | Description |
| :--- | :---: | :---: | :--- |
| `/` | `GET` | Public / Student | Main 3-column AI Chat & Document Intelligence Studio |
| `/accounts/login/` | `GET/POST` | Public | Cyber-themed Login with Google OAuth & Email/Password |
| `/accounts/signup/` | `GET/POST` | Public | Student Account Registration with least-privilege guarantee |
| `/accounts/logout/` | `POST` | Authenticated | Secure session termination |
| `/profile/` | `GET` | Authenticated | User Profile, assigned role, statistics, and session details |
| `/admin-dashboard/` | `GET` | Staff / Admin | Admin Operations Console with user management & audit logs |
| `/admin-dashboard/user/<id>/toggle-status/` | `POST` | Staff / Admin | Deactivates or activates user account with audit trail |
| `/admin-dashboard/user/<id>/toggle-role/` | `POST` | Staff / Admin | Promotes or demotes user between Student and Admin |
| `/admin/` | `GET` | Staff / Superuser | Standard Django Admin |
| `/api/upload/` | `POST` | Authenticated | Asynchronously uploads and indexes PDF/TXT to requesting user |
| `/api/ask/` | `POST` | Authenticated | Queries RAG pipeline strictly over user's owned documents |
| `/api/delete/<id>/` | `POST` | Authenticated | Deletes document with strict ownership verification |
| `/api/status/` | `GET` | Authenticated | Returns system health, model status, and user document counts |
| `/api/exam/generate-questions/` | `POST` | Authenticated | Generates exam questions from user's study materials |
| `/api/exam/generate-answer/` | `POST` | Authenticated | Synthesizes 2, 5, or 10-mark model answers from user documents |
