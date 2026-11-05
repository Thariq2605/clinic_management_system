from rest_framework.permissions import BasePermission


class IsPharmacist(BasePermission):
    message = "An active Pharmacist account is required."

    def has_permission(self, request, view):
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and user.is_active
            and user.role
            and user.role.is_active
            and user.role.role_name.strip().lower() == "pharmacist"
        )
