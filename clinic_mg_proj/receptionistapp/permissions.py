from rest_framework.authentication import BaseAuthentication, SessionAuthentication
from rest_framework.exceptions import NotAuthenticated, PermissionDenied
from rest_framework.permissions import BasePermission

from core.models import Receptionist, User


class ReceptionistSessionAuthentication(BaseAuthentication):
    """Expose a receptionist session as DRF authentication for correct 401 responses."""

    def authenticate(self, request):
        user_id = request.session.get("user_id")
        if not user_id:
            return None
        user = User.objects.filter(user_id=user_id, is_active=True).first()
        if user is None:
            return None
        return user, None

    def authenticate_header(self, request):
        return "Session"


class IsReceptionistSession(BasePermission):
    message = "An authenticated Receptionist account is required."

    def has_permission(self, request, view):
        receptionist_id = request.session.get("receptionist_id")
        user_id = request.session.get("user_id")
        if not receptionist_id or not user_id:
            raise NotAuthenticated(self.message)
        allowed = Receptionist.objects.filter(
            receptionist_id=receptionist_id, is_active=True,
            staff__is_active=True, staff__user_id=user_id,
            staff__user__is_active=True, staff__user__role__is_active=True,
            staff__user__role__role_name__iexact="receptionist",
        ).exists()
        if not allowed:
            raise PermissionDenied(self.message)
        SessionAuthentication().enforce_csrf(request)
        return True