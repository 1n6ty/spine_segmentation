import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'Mainland.settings')
django.setup()

from django_crontab.crontab import Crontab

# 1. Bypass OS read: Provide a clean slate instead of hitting forbidden system binary
def safe_read(self):
    self.crontab_lines = []

# 2. Bypass OS write: Capture the memory buffer and route it directly to a file
def safe_write(self):
    with open('/tmp/crontab.txt', 'w') as f:
        if self.crontab_lines:
            for line in self.crontab_lines:
                # Ensure each cron rule ends cleanly with a newline character
                f.write(line if line.endswith('\n') else line + '\n')
        else:
            # A genuinely 0-byte crontab file crashes supercronic
            # ("Failed to fork exec: no such file or directory") — a
            # comment-only line keeps it a valid, parseable empty crontab.
            f.write('# no CRONJOBS configured\n')
    print('-> Successfully extracted django-crontab targets into user-space!')

# Inject our safe handlers into the target library
Crontab.read = safe_read
Crontab.write = safe_write

# Safely execute the default lifecycle wrapper
with Crontab() as crontab:
    crontab.add_jobs()