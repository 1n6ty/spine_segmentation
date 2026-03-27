from rest_framework.permissions import BasePermission

from DSL.utils.dataset import DatasetSpec
from DSL.utils.dataset import map_dataset_to_spec

class DatasetPermission(BasePermission):
    def has_permission(self, request, view):
        if request.method != "POST":
            return True

        dataset = request.data.get("dataset")
        if not dataset:
            return False

        spec = map_dataset_to_spec(dataset)
        if not spec:
            return False

        for perm_cls in spec.permissions:
            perm = perm_cls()
            if not perm.has_permission(request, view):
                return False

        return True

def get_allowed_fields(request, spec: str | DatasetSpec, view) -> list[str]:
    dataset = spec
    if isinstance(spec, str):
        dataset = map_dataset_to_spec(spec)
        if dataset is None:
            return []

    allowed_fields = []
    perm_cache = {}

    for field_name, field_spec in dataset.fields.items():
        allowed = True
        for perm_cls in field_spec.permissions:
            if perm_cls not in perm_cache:
                perm = perm_cls()
                perm_cache[perm_cls] = perm.has_permission(request, view)

            if not perm_cache[perm_cls]:
                allowed = False
                break

        if allowed:
            allowed_fields.append(field_name)

    return allowed_fields

