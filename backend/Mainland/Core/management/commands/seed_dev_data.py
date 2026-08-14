from django.contrib.auth.models import User
from django.core.management import call_command
from django.core.management.base import BaseCommand

# Deliberately not "username == password" or any other guessable derivation --
# a habit worth avoiding even in throwaway dev/demo data. Printed in full by
# _print_summary() at the end of a run, since that's the only place a
# developer can recover it; kept stable across reruns so _upsert_user's
# create-only password assignment (see its docstring) never invalidates a
# session someone is using.
_DOCTOR_EMAIL = 'doctor@example.com'
_DOCTOR_PASSWORD = 'Bx4-Radius-DoctorSeed-19'


class Command(BaseCommand):
    help = ('Populate the development database with a single login-capable '
            'doctor account for manual testing / e2e runs against a real '
            'backend. No Dicom rows are seeded here -- the e2e workflow '
            'uploads its own DICOM fixture client-side and needs nothing '
            'server-side beyond a real session.')

    def add_arguments(self, parser):
        parser.add_argument(
            '--manifest-path', type=str, default=None,
            help='If set, write a JSON seed manifest (doctor credentials, company) to this path.',
        )

    def handle(self, *args, **options):
        self.stdout.write(self.style.MIGRATE_HEADING('▶ Running init_spine_segmentation...'))
        call_command('init_spine_segmentation', verbosity=0)
        self.stdout.write(self.style.SUCCESS('✔ init_spine_segmentation done\n'))

        self._seed_company()
        self._seed_doctor()

        self._print_summary()

        if options.get('manifest_path'):
            self._write_manifest(options['manifest_path'])

    # ── Company ───────────────────────────────────────────────────────────────

    def _seed_company(self):
        from Company.models import Company

        existing = Company.objects.filter(
            translations__name='Spine Clinic', translations__language_code='en-us'
        ).first()
        if existing:
            self.company = existing
            return

        company = Company(slug='spine-clinic', email='clinic@example.com')
        company.set_current_language('en-us')
        company.name = 'Spine Clinic'
        company.save()
        self.company = company

    # ── Doctor user + Profile ────────────────────────────────────────────────

    def _seed_doctor(self):
        from Profile.models import Profile, Role

        self.doctor = self._upsert_user('doctor', _DOCTOR_PASSWORD, _DOCTOR_EMAIL)
        doctor_role = Role.objects.get(slug='doctor')

        profile, created = Profile.objects.get_or_create(
            user=self.doctor, defaults={'company': self.company, 'role': doctor_role},
        )
        update_fields = []
        if not created and profile.company_id != self.company.id:
            profile.company = self.company
            update_fields.append('company')
        if not created and profile.role_id != doctor_role.id:
            profile.role = doctor_role
            update_fields.append('role')
        if update_fields:
            profile.save(update_fields=update_fields)
        self.doctor.groups.add(doctor_role.group)

    def _upsert_user(self, username, password, email):
        """Create-only password assignment: an existing user's password is left
        untouched on rerun, so reseeding a dev DB never invalidates a session
        someone is actively using with a manually-changed password."""
        user = User.objects.filter(username=username).first()
        created = user is None
        if user is None:
            user = User(username=username)

        update_fields = []
        if created:
            user.set_password(password)
            update_fields.append('password')
        if user.email != email:
            user.email = email
            update_fields.append('email')

        if created:
            user.save()
        elif update_fields:
            user.save(update_fields=update_fields)

        return user

    # ── Manifest ──────────────────────────────────────────────────────────────

    def _write_manifest(self, path):
        """Opt-in JSON seed manifest -- for consumers (e.g. the frontend's
        real-backend e2e suite) that need to know what this run actually
        seeded without re-deriving it, rather than hardcoding credentials that
        could drift from this command."""
        import json

        manifest = {
            'company': {'slug': self.company.slug, 'name': str(self.company)},
            'doctor': {'email': _DOCTOR_EMAIL, 'password': _DOCTOR_PASSWORD, 'company': self.company.slug},
        }
        with open(path, 'w') as f:
            json.dump(manifest, f, indent=2)
        self.stdout.write(self.style.SUCCESS(f'✔ seed manifest written to {path}\n'))

    # ── Summary ───────────────────────────────────────────────────────────────

    def _print_summary(self):
        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS('Dev seed data ready.'))
        self.stdout.write('')
        self.stdout.write('  Users:')
        self.stdout.write(f'    {_DOCTOR_EMAIL} / {_DOCTOR_PASSWORD} → {self.company} [doctor]')
        self.stdout.write('')
