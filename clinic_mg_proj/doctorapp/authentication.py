from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.settings import api_settings
from rest_framework_simplejwt.exceptions import AuthenticationFailed

from core.models import User


class CustomJWTAuthentication(JWTAuthentication):

    def get_user(self, validated_token):

        user_id = validated_token.get(
            api_settings.USER_ID_CLAIM
        )

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

        return user