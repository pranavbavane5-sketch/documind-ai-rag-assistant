from django.urls import path
from . import views

urlpatterns = [
    # Main Antigravity UI
    path('', views.home, name='home'),

    # Asynchronous REST APIs for AJAX / Fetch
    path('api/upload/', views.api_upload, name='api_upload'),
    path('api/ask/', views.api_ask, name='api_ask'),
    path('api/delete/<int:document_id>/', views.api_delete, name='api_delete'),
    path('api/status/', views.api_status, name='api_status'),
    path('api/config/key/', views.api_save_key, name='api_save_key'),
    path('api/exam/generate-questions/', views.api_exam_generate_questions, name='api_exam_generate_questions'),
    path('api/exam/generate-answer/', views.api_exam_generate_answer, name='api_exam_generate_answer'),

    # Standard Form POST routes
    path('upload/', views.upload_document, name='upload_document'),
    path('delete/<int:document_id>/', views.delete_document, name='delete_document'),
    path('ask/', views.ask_question, name='ask_question'),
]
