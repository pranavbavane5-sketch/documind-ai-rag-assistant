from django.contrib import admin
from .models import Document, UserProfile, AdminAuditLog, UserQueryHistory


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'role', 'created_at', 'updated_at')
    list_filter = ('role', 'created_at')
    search_fields = ('user__username', 'user__email')


@admin.register(Document)
class DocumentAdmin(admin.ModelAdmin):
    list_display = ('original_name', 'user', 'file_type', 'file_size_display', 'chunk_count', 'is_processed', 'uploaded_at')
    list_filter = ('file_type', 'is_processed', 'uploaded_at', 'user')
    search_fields = ('original_name', 'user__username', 'user__email')


@admin.register(AdminAuditLog)
class AdminAuditLogAdmin(admin.ModelAdmin):
    list_display = ('created_at', 'admin_user', 'action', 'target_user', 'ip_address')
    list_filter = ('action', 'created_at')
    search_fields = ('admin_user__username', 'target_user__username', 'action', 'details')
    readonly_fields = ('created_at', 'admin_user', 'action', 'target_user', 'details', 'ip_address')


@admin.register(UserQueryHistory)
class UserQueryHistoryAdmin(admin.ModelAdmin):
    list_display = ('created_at', 'user', 'query_text', 'sources_count', 'has_context_match', 'language')
    list_filter = ('language', 'has_context_match', 'created_at')
    search_fields = ('user__username', 'query_text')
