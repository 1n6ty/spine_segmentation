from rest_framework.exceptions import PermissionDenied as PD

class PermissionDenied(PD):
    def __init__(self, data, code=403):
        self.status_code = code

        super().__init__(detail=data, code=code)
