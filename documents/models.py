import os
from django.db import models

class Document(models.Model):
    """
    Represents an uploaded document (PDF or TXT) indexed in the RAG pipeline.
    """
    FILE_TYPE_CHOICES = [
        ('.pdf', 'PDF Document'),
        ('.txt', 'Plain Text File'),
    ]

    original_name = models.CharField(max_length=255, help_text="Original uploaded filename")
    file = models.FileField(upload_to='documents/', help_text="Stored document file")
    file_type = models.CharField(max_length=10, choices=FILE_TYPE_CHOICES)
    file_size = models.PositiveIntegerField(default=0, help_text="File size in bytes")
    page_count = models.PositiveIntegerField(default=0, help_text="Total pages for PDF (0 for TXT)")
    chunk_count = models.PositiveIntegerField(default=0, help_text="Number of text chunks embedded in vector store")
    is_processed = models.BooleanField(default=False, help_text="Whether indexing completed successfully")
    error_message = models.TextField(blank=True, null=True, help_text="Processing error message if failed")
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-uploaded_at']

    def __str__(self):
        return f"{self.original_name} ({self.file_type})"

    @property
    def file_size_display(self):
        """Returns human-readable file size."""
        size = self.file_size
        for unit in ['B', 'KB', 'MB', 'GB']:
            if size < 1024.0:
                return f"{size:.1f} {unit}"
            size /= 1024.0
        return f"{size:.1f} TB"
