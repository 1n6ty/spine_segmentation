import hashlib
import mimetypes
import os

from django.http import HttpResponse

from common.schemas.v1.response import Issue

from .models import FileRole


def validate_file_for_role(uploaded_file, role: FileRole | None) -> Issue | None:
    """Returns an Issue if `uploaded_file` violates `role`'s content-type or extension
    restrictions, or None if the file is acceptable. role=None means no restrictions."""
    if role is None:
        return None

    content_type = getattr(uploaded_file, 'content_type', '') or ''
    filename = getattr(uploaded_file, 'name', '') or ''
    ext = os.path.splitext(filename)[1].lower()

    if role.allowed_content_types and content_type not in role.allowed_content_types:
        allowed = ', '.join(role.allowed_content_types)
        return Issue(
            status="error", code=400, field="file",
            message=f"Content type '{content_type}' is not allowed for role '{role.slug}'. "
                    f"Allowed: {allowed}.",
        )

    if role.allowed_extensions and ext not in role.allowed_extensions:
        allowed = ', '.join(role.allowed_extensions)
        return Issue(
            status="error", code=400, field="file",
            message=f"Extension '{ext}' is not allowed for role '{role.slug}'. "
                    f"Allowed: {allowed}.",
        )

    return None


def check_role_max_count(role: FileRole, existing_count: int, adding_count: int) -> 'Issue | None':
    if role.max_count is None:
        return None
    if existing_count + adding_count > role.max_count:
        return Issue(
            status="error", code=400, field="file",
            message=(
                f"Role '{role.slug}' allows at most {role.max_count} file(s) per record. "
                f"{existing_count} already attached."
            ),
        )
    return None


def build_cas_path(file_hash: str) -> str:
    """Content-addressable path: identical content maps to one physical file
    regardless of filename or which entity uploaded it."""
    return f"files/{file_hash}"


def compute_hash(data: bytes) -> str:
    return hashlib.sha512(data).hexdigest()


def serve_file_response(file_obj) -> HttpResponse:
    """file_obj is any model instance that has .file (FileField) and .name (str)."""
    content_type, _ = mimetypes.guess_type(file_obj.name)
    response = HttpResponse(content_type=content_type or 'application/octet-stream')
    response['Content-Disposition'] = f'attachment; filename="{file_obj.name}"'
    response['X-Accel-Redirect'] = f'/internal/private/{file_obj.file.name}'
    return response
