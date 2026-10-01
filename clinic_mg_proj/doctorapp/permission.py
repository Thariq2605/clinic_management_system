from rest_framework.permissions import BasePermission


class IsDoctor(BasePermission):

    def has_permission(self, request, view):

        user = request.user

        if not user or not user.is_authenticated:
            return False

        if not user.is_active:
            return False

        if not user.role:
            return False

        return user.role.role_name.lower() == "doctor"