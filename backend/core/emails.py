"""Transactional email helpers (Resend)."""
import logging

import resend
from django.conf import settings
from django.contrib.auth.tokens import PasswordResetTokenGenerator
from django.core.signing import BadSignature, SignatureExpired, TimestampSigner
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from django.utils.encoding import force_bytes, force_str

logger = logging.getLogger(__name__)

VERIFY_SIGNER_SALT = "core.email-verify.v1"
VERIFY_MAX_AGE_SECONDS = 60 * 60 * 24 * 3  # 3 days
RESET_MAX_AGE_SECONDS = 60 * 60  # 1 hour

password_reset_token_generator = PasswordResetTokenGenerator()


def _send(to: str, subject: str, html: str) -> None:
    """Send an email via Resend. No-ops with a warning if the API key isn't configured."""
    api_key = getattr(settings, "RESEND_API_KEY", "")
    if not api_key:
        logger.warning("RESEND_API_KEY not set — skipping email to %s (%s)", to, subject)
        return
    resend.api_key = api_key
    from_email = getattr(settings, "RESEND_FROM_EMAIL", "noreply@odaap.org")
    resend.Emails.send({
        "from": f"ODAAP <{from_email}>",
        "to": [to],
        "subject": subject,
        "html": html,
    })


def make_verification_token(user) -> str:
    signer = TimestampSigner(salt=VERIFY_SIGNER_SALT)
    return signer.sign(str(user.id))


def parse_verification_token(token: str) -> int | None:
    signer = TimestampSigner(salt=VERIFY_SIGNER_SALT)
    try:
        unsigned = signer.unsign(token, max_age=VERIFY_MAX_AGE_SECONDS)
    except (BadSignature, SignatureExpired):
        return None
    try:
        return int(unsigned)
    except (TypeError, ValueError):
        return None


def make_password_reset_token(user) -> tuple[str, str]:
    """Returns (uidb64, token) — token invalidates when password changes."""
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    token = password_reset_token_generator.make_token(user)
    return uid, token


def parse_password_reset_token(uidb64: str, token: str, user_model):
    try:
        uid = force_str(urlsafe_base64_decode(uidb64))
        user = user_model.objects.get(pk=uid)
    except (TypeError, ValueError, OverflowError, user_model.DoesNotExist):
        return None
    if not password_reset_token_generator.check_token(user, token):
        return None
    return user


def send_verification_email(user) -> None:
    token = make_verification_token(user)
    link = f"{settings.FRONTEND_URL}/verify-email?token={token}"
    html = f"""
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#222;">
      <h2 style="color:#4a148c;margin-top:0;">Welcome to ODAAP, {user.first_name}!</h2>
      <p>Thanks for signing up. Please confirm your email address to activate your account:</p>
      <p style="margin:32px 0;">
        <a href="{link}" style="background:#4a148c;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block;">Verify Email</a>
      </p>
      <p style="font-size:13px;color:#666;">Or paste this link into your browser:<br/><a href="{link}" style="color:#4a148c;word-break:break-all;">{link}</a></p>
      <p style="font-size:13px;color:#888;">This link expires in 3 days. If you didn't create this account, you can ignore this email.</p>
    </div>
    """
    _send(user.email, "Verify your ODAAP account", html)


def send_password_reset_email(user) -> None:
    uid, token = make_password_reset_token(user)
    link = f"{settings.FRONTEND_URL}/reset-password?uid={uid}&token={token}"
    html = f"""
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#222;">
      <h2 style="color:#4a148c;margin-top:0;">Reset your password</h2>
      <p>Hi {user.first_name}, we received a request to reset the password for your ODAAP account.</p>
      <p style="margin:32px 0;">
        <a href="{link}" style="background:#4a148c;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block;">Reset Password</a>
      </p>
      <p style="font-size:13px;color:#666;">Or paste this link into your browser:<br/><a href="{link}" style="color:#4a148c;word-break:break-all;">{link}</a></p>
      <p style="font-size:13px;color:#888;">This link expires in 1 hour. If you didn't request a password reset, you can safely ignore this email.</p>
    </div>
    """
    _send(user.email, "Reset your ODAAP password", html)
