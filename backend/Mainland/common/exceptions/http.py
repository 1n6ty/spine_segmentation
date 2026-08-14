from rest_framework.exceptions import MethodNotAllowed as MNA

class MethodNotAllowed(MNA):
    def __init__(self, data, method, code=405):
        self.status_code = code
        
        super().__init__(detail=data, method=method, code=code)
