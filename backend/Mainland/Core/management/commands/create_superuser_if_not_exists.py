import os
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model


class Command(BaseCommand):
    help = ("Creates a superuser if it doesn't exist. Safe to run multiple times. "
            "Pass --force to resync email/password/staff/superuser flags on an "
            "existing user back to canonical (env-provided) values.")

    def add_arguments(self, parser):
        parser.add_argument('--force', action='store_true',
                             help="Resync the superuser's fields even if it already exists.")

    def handle(self, *args, **options):
        User = get_user_model()
        force = options['force']

        username = os.environ.get("DJANGO_SUPERUSER_USERNAME", "admin")
        email = os.environ.get("DJANGO_SUPERUSER_EMAIL", "admin@example.com")
        password = os.environ.get("DJANGO_SUPERUSER_PASSWORD", "admin123")

        user, created = User.objects.get_or_create(
            username=username,
            defaults={"email": email, "is_staff": True, "is_superuser": True},
        )
        if created:
            user.set_password(password)
            user.save(update_fields=["password"])
            self.stdout.write(self.style.SUCCESS(f"Superuser '{username}' created successfully."))
        elif force:
            user.email = email
            user.is_staff = True
            user.is_superuser = True
            user.set_password(password)
            user.save(update_fields=["email", "is_staff", "is_superuser", "password"])
            self.stdout.write(self.style.SUCCESS(f"Superuser '{username}' resynced to canonical values."))
        else:
            self.stdout.write(self.style.SUCCESS(f"Superuser '{username}' already exists, skipping."))
