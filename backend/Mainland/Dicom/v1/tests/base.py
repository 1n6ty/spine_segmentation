from django.contrib.auth.models import Permission, User


def create_doctor_user(username, **extra):
    """Creates a User holding Dicom.access_studies -- the permission
    DcmViewSet/UserRecentStudiesViewSet's get_permissions() now requires (see
    Profile.management.commands.sync_roles' 'doctor' role definition). No
    Profile/Company is created -- these views don't check either, only the
    bare has_perm() gate. Shared by every Dicom test module that needs a
    caller past that gate."""
    user = User.objects.create_user(username=username, **extra)
    user.user_permissions.add(
        Permission.objects.get(codename='access_studies', content_type__app_label='Dicom')
    )
    return user
