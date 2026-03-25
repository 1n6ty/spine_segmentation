from rest_framework.exceptions import PermissionDenied as PD, MethodNotAllowed as MNA

class PermissionDenied(PD):
    def __init__(self, data, code=403):
        self.status_code = code
        
        super().__init__(detail=data, code=code)

class MethodNotAllowed(MNA):
    def __init__(self, data, method, code=405):
        self.status_code = code
        
        super().__init__(detail=data, method=method, code=code)