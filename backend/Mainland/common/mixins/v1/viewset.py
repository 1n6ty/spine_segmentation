from common.schemas.v1.errors import PermissionDeniedResponse, UnauthorizedResponse, MethodNotAllowedResponse
from common.exceptions.permission import PermissionDenied
from common.exceptions.http import MethodNotAllowed

from adrf.viewsets import ViewSet
from rest_framework.request import Request
from rest_framework.response import Response

class StdViewSetMixin(ViewSet):
    """Mixin for standard ViewSets to provide unified error handling for permissions and HTTP methods.
    """

    def permission_denied(self, request: Request, message=None, code=None) -> Response:
        """Raises a PermissionDenied exception with a formatted ApiResponse.

        Args:
            request (Request): The DRF request object.
            message (str, optional): Unused -- the response is always the fixed
                UnauthorizedResponse/PermissionDeniedResponse shape.
            code (int, optional): Unused -- always derived from request.user.is_authenticated.

        Returns:
            Response: This method always raises an exception, so it doesn't return a response.

        Raises:
            PermissionDenied: If the user is unauthenticated (401) or lacks permissions (403).
        """
        if request.user.is_authenticated:
            code, data = 403, PermissionDeniedResponse().dict_response
        else:
            code, data = 401, UnauthorizedResponse().dict_response
        raise PermissionDenied(data=data, code=code)

    def http_method_not_allowed(self, request: Request, *args, **kwargs) -> Response:
        """Raises a MethodNotAllowed exception with a formatted ApiResponse.

        Args:
            request (Request): The DRF request object.
            *args: Variable length argument list.
            **kwargs: Arbitrary keyword arguments.

        Returns:
            Response: This method always raises an exception.

        Raises:
            MethodNotAllowed: When a non-supported HTTP method is used (405).
        """
        raise MethodNotAllowed(
            data=MethodNotAllowedResponse().dict_response,
            code=405,
            method=request.method,
        )