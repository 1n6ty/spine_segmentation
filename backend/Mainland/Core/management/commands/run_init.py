from django.core.management.base import BaseCommand
from django.apps import apps
import importlib

class Command(BaseCommand):
    help = "Runs `init()` function in all custom apps if defined"

    def handle(self, *args, **options):
        self.stdout.write(self.style.MIGRATE_HEADING("Running init() in all custom apps..."))

        for app_config in apps.get_app_configs():
            # Skip Django built-in apps
            if app_config.name.startswith("django."):
                continue

            try:
                module = importlib.import_module(app_config.name)
            except ModuleNotFoundError:
                self.stdout.write(self.style.WARNING(f"Could not import {app_config.name}"))
                continue

            # Look for init() function in the module
            init_func = getattr(module, "init", None)

            if callable(init_func):
                self.stdout.write(f"Running init() for {app_config.name}...")
                try:
                    init_func()
                    self.stdout.write(self.style.SUCCESS(f"{app_config.name} initialized successfully"))
                except Exception as e:
                    self.stdout.write(self.style.ERROR(f"Error initializing {app_config.name}: {e}"))
            else:
                self.stdout.write(f"No init() found for {app_config.name}")

        self.stdout.write(self.style.SUCCESS("All init() calls completed."))
