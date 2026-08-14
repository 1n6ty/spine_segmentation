from django.contrib.auth.backends import ModelBackend
from django.contrib.auth import get_user_model
from django.db.models import Q

UserModel = get_user_model()

class EmailBackend(ModelBackend):
    """Authenticate using email instead of username."""

    def authenticate(self, request, username=None, password=None, **kwargs):
        if request is None:
            return None

        email = kwargs.get("email", username)
        if email is None or password is None:
            return None

        try:
            user = UserModel.objects.get(Q(email__iexact=email))
        except (UserModel.DoesNotExist, UserModel.MultipleObjectsReturned):
            return None

        if user.check_password(password) and self.user_can_authenticate(user):
            return user

        return None

    def get_user(self, user_id):
        try:
            user = UserModel.objects.get(pk=user_id)
        except Exception:
            return None
        return user if self.user_can_authenticate(user) else None
