from django.contrib import admin
from django.contrib.auth.models import User
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import Document, UserProfile, AdminAuditLog, UserQueryHistory


class UserProfileInline(admin.StackedInline):
    model = UserProfile
    can_delete = False
    verbose_name_plural = 'DocuMind Role Profile'
    fields = ('role', 'avatar_url')


admin.site.unregister(User)


@admin.register(User)
class CustomUserAdmin(BaseUserAdmin):
    inlines = (UserProfileInline,)
    list_display = ('username', 'email', 'first_name', 'last_name', 'get_documind_role', 'is_active', 'is_staff')
    list_filter = ('is_staff', 'is_active', 'profile__role', 'date_joined')

    def get_documind_role(self, obj):
        profile = getattr(obj, 'profile', None)
        return profile.get_role_display() if profile else "Student"
    get_documind_role.short_description = "Role"


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
