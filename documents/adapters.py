import logging
from django.contrib import messages
from django.shortcuts import redirect
from allauth.socialaccount.adapter import DefaultSocialAccountAdapter
from allauth.account.adapter import DefaultAccountAdapter
from .models import UserProfile

logger = logging.getLogger(__name__)


class CustomSocialAccountAdapter(DefaultSocialAccountAdapter):
    """
    Secure Google OAuth adapter strictly enforcing least-privilege role assignment.
    
    Security Guarantees:
    1. Every new Google OAuth signup is strictly assigned the 'student' role.
    2. Admin/staff/superuser flags are explicitly revoked/denied upon Google registration.
    3. Administrator status can NEVER be obtained through Google email or OAuth claims.
    4. Safely parses Google profile picture and display names.
    5. Gracefully handles OAuth callback errors and missing profile fields.
    """

    def save_user(self, request, sociallogin, form=None):
        # Base user creation
        user = super().save_user(request, sociallogin, form=form)

        # Enforce strict non-admin security constraints
        user.is_staff = False
        user.is_superuser = False
        user.save(update_fields=['is_staff', 'is_superuser'])

        # Extract extra info safely
        extra_data = sociallogin.account.extra_data or {}
        avatar_url = extra_data.get('picture') or extra_data.get('avatar_url') or ''

        profile, _ = UserProfile.objects.get_or_create(user=user)
        profile.role = UserProfile.ROLE_STUDENT
        if avatar_url:
            profile.avatar_url = avatar_url
        profile.save()

        logger.info(f"New student registered via Google OAuth: {user.username} ({user.email})")
        return user

    def authentication_error(self, request, provider_id, error=None, exception=None, extra_context=None):
        """
        Catches Google OAuth cancellation or communication errors safely.
        """
        logger.warning(f"OAuth authentication error from {provider_id}: error={error}, exception={exception}")
        messages.error(
            request,
            "Google sign-in could not be completed. Please ensure your credentials are valid or sign in using username/password."
        )
        return redirect('account_login')


class CustomAccountAdapter(DefaultAccountAdapter):
    """
    Standard account adapter for username/password signups.
    """
    def is_open_for_signup(self, request):
        return True
