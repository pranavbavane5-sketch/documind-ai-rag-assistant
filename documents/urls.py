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

    # Standard Form POST routes
    path('upload/', views.upload_document, name='upload_document'),
    path('delete/<int:document_id>/', views.delete_document, name='delete_document'),
    path('ask/', views.ask_question, name='ask_question'),
]
