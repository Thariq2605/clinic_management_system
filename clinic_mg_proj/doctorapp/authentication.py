from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import AuthenticationFailed
from rest_framework_simplejwt.settings import api_settings

from core.models import Doctor, User


class CustomJWTAuthentication(JWTAuthentication):

    def get_user(self, validated_token):

        user_id = validated_token.get(api_settings.USER_ID_CLAIM)

        if user_id is None:
            raise AuthenticationFailed(
                "Token contained no recognizable user identification"
            )

        try:
            user = User.objects.get(
                user_id=user_id,
                is_active=True
            )
        except User.DoesNotExist:
            raise AuthenticationFailed(
                "User not found or inactive"
            )

        if user.role.role_name.strip().casefold() == "doctor":
            if not user.role.is_active:
                raise AuthenticationFailed("Doctor role is inactive")
            doctor_id = validated_token.get("doctor_id")
            if doctor_id is None or not Doctor.objects.filter(
                doctor_id=doctor_id,
                staff__user=user,
                staff__is_active=True,
                is_active=True,
            ).exists():
                raise AuthenticationFailed("Active Doctor profile was not found for this token")

        return user
