from rest_framework.permissions import BasePermission

from core.models import Doctor


class IsDoctor(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated or not user.is_active:
            return False

        if not user.role or user.role.role_name.casefold() != "doctor":
            return False

        doctor_id = getattr(view, "kwargs", {}).get("doctor_id")
        if doctor_id is None:
            return True

        return Doctor.objects.filter(
            doctor_id=doctor_id,
            staff__user_id=user.user_id,
            staff__is_active=True,
            is_active=True,
        ).exists()
