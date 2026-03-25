import importlib
import pkgutil
import signal
import sys
import asyncio
import logging
from multiprocessing import Process
from django.core.management.base import BaseCommand
from django.apps import apps

logging.getLogger("aiokafka").setLevel(logging.WARNING)

def run_async(coro_func):
    """Wrapper to run async function in a new event loop."""
    def wrapper():
        asyncio.run(coro_func())
    return wrapper

class Command(BaseCommand):
    help = "Run all Kafka consumers in separate processes (detached for same container)"

    def handle(self, *args, **options):
        consumer_modules = []

        # Discover consumers in each app
        for app_config in apps.get_app_configs():
            try:
                kafka_pkg = importlib.import_module(f"{app_config.name}.kafka.consumers")
            except ModuleNotFoundError:
                continue

            for _, module_name, _ in pkgutil.iter_modules(kafka_pkg.__path__):
                module_path = f"{kafka_pkg.__name__}.{module_name}"
                module = importlib.import_module(module_path)
                if hasattr(module, "run"):
                    consumer_modules.append(module_path)
                    self.stdout.write(f"Found consumer: {module_path}")

        if not consumer_modules:
            self.stdout.write("No Kafka consumers found.")
            return

        # Spawn one process per consumer
        processes = []
        for module_path in consumer_modules:
            module = importlib.import_module(module_path)
            p = Process(target=run_async(module.run), daemon=False)
            p.start()
            processes.append(p)

        self.stdout.write(f"Started {len(processes)} consumer processes.")

        # Optional: handle signals to stop consumers gracefully
        def shutdown(signum, frame):
            self.stdout.write("Shutting down consumers...")
            for p in processes:
                if p.is_alive():
                    p.terminate()
            for p in processes:
                p.join()
            sys.exit(0)

        signal.signal(signal.SIGTERM, shutdown)
        signal.signal(signal.SIGINT, shutdown)

        # Wait for all processes (blocking)
        for p in processes:
            p.join()
