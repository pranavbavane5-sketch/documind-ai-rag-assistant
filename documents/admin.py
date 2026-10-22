from django.contrib import admin
from .models import Document

@admin.register(Document)
class DocumentAdmin(admin.ModelAdmin):
    list_display = ('original_name', 'file_type', 'file_size_display', 'chunk_count', 'is_processed', 'uploaded_at')
    list_filter = ('file_type', 'is_processed', 'uploaded_at')
    search_fields = ('original_name',)
