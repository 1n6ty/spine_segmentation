from rest_framework.permissions import BasePermission
from rest_framework.request import Request

class IsStaff(BasePermission):
    def has_permission(self, request: Request, view):
        return request.user.is_staff
    
class CanViewUserPermission(BasePermission):
    def has_permission(self, request: Request, view):
        return request.user.has_perm("auth.view_user")
