from rest_framework.permissions import BasePermission


class IsAdministrator(BasePermission):

    def has_permission(self, request, view):

        if not request.user or not request.user.is_authenticated:
            return False

        if not request.user.is_active:
            return False

        if not request.user.role:
            return False

        return request.user.role.role_name.lower() == "administrator"