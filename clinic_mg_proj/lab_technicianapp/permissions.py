from core.models import LabTechnician
from rest_framework.permissions import BasePermission


class IsLabTechnician(BasePermission):
    message = "An active Laboratory Technician account is required."

    def has_permission(self, request, view):
        user = request.user
        return bool(
            user and user.is_authenticated and user.is_active and user.role
            and user.role.is_active
            and user.role.role_name.strip().casefold() in {"lab technician", "laboratory technician"}
            and LabTechnician.objects.filter(
                staff__user=user, staff__is_active=True, is_active=True
            ).exists()
        )
