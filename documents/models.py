import os
from django.db import models
from django.conf import settings
from django.contrib.auth.models import User
from django.db.models.signals import post_save
from django.dispatch import receiver


class UserProfile(models.Model):
    """
    Profile extension for Django User implementing Role-Based Access Control (RBAC).
    Separates Student and Admin roles while linking with Django's internal permission system.
    """
    ROLE_STUDENT = 'student'
    ROLE_ADMIN = 'admin'
    ROLE_CHOICES = [
        (ROLE_STUDENT, 'Student'),
        (ROLE_ADMIN, 'Admin'),
    ]

    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='profile')
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default=ROLE_STUDENT, db_index=True)
    avatar_url = models.URLField(max_length=500, blank=True, null=True, help_text="Google OAuth or custom profile picture")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user.username} ({self.get_role_display()})"

    @property
    def is_student(self) -> bool:
        """True if user is an ordinary student and not a staff/superuser."""
        return self.role == self.ROLE_STUDENT and not self.user.is_staff and not self.user.is_superuser

    @property
    def is_admin(self) -> bool:
        """True if user possesses administrator privileges or is Django staff."""
        return self.role == self.ROLE_ADMIN or self.user.is_staff or self.user.is_superuser


@receiver(post_save, sender=User)
def create_or_sync_user_profile(sender, instance, created, **kwargs):
    """
    Automatically creates a UserProfile for any newly registered user.
    New users (including Google OAuth signups) receive the Student role by default.
    Superusers or staff created via createsuperuser receive the Admin role.
    """
    if created:
        initial_role = UserProfile.ROLE_ADMIN if (instance.is_staff or instance.is_superuser) else UserProfile.ROLE_STUDENT
        UserProfile.objects.create(user=instance, role=initial_role)
    else:
        # Keep profile role in sync if staff status changed
        if hasattr(instance, 'profile'):
            if (instance.is_staff or instance.is_superuser) and instance.profile.role != UserProfile.ROLE_ADMIN:
                instance.profile.role = UserProfile.ROLE_ADMIN
                instance.profile.save(update_fields=['role'])


class Document(models.Model):
    """
    Represents an uploaded document (PDF or TXT) indexed in the RAG pipeline.
    Linked to an owning user for multi-tenant isolation and security.
    """
    FILE_TYPE_CHOICES = [
        ('.pdf', 'PDF Document'),
        ('.txt', 'Plain Text File'),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='documents',
        null=True,
        blank=True,
        help_text="Owning user for tenant isolation"
    )
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
        owner = self.user.username if self.user else "System/Legacy"
        return f"{self.original_name} ({self.file_type}) - {owner}"

    @property
    def file_size_display(self):
        """Returns human-readable file size."""
        size = self.file_size
        for unit in ['B', 'KB', 'MB', 'GB']:
            if size < 1024.0:
                return f"{size:.1f} {unit}"
            size /= 1024.0
        return f"{size:.1f} TB"


class AdminAuditLog(models.Model):
    """
    Audit trail recording significant administrative actions for security compliance.
    """
    admin_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='admin_audit_actions'
    )
    action = models.CharField(max_length=100, help_text="Action identifier, e.g. USER_DEACTIVATED")
    target_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='target_audit_logs'
    )
    details = models.TextField(blank=True, default='', help_text="Details of the action taken")
    ip_address = models.GenericIPAddressField(null=True, blank=True, help_text="IP address of requester")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        admin_name = self.admin_user.username if self.admin_user else "System"
        return f"[{self.created_at.strftime('%Y-%m-%d %H:%M')}] {admin_name} - {self.action}"


class UserQueryHistory(models.Model):
    """
    Tracks question queries and RAG retrieval activities per user.
    """
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='query_history'
    )
    query_text = models.TextField()
    answer_preview = models.TextField(blank=True, default='')
    sources_count = models.PositiveIntegerField(default=0)
    has_context_match = models.BooleanField(default=True)
    language = models.CharField(max_length=10, default='en')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user.username}: {self.query_text[:40]}"
