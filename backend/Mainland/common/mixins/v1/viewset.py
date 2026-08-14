from common.schemas.v1.response import ApiResponse, Issue
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
            message (str, optional): Custom error message. Defaults to None.
            code (int, optional): Custom HTTP status code. Defaults to None.

        Returns:
            Response: This method always raises an exception, so it doesn't return a response.

        Raises:
            PermissionDenied: If the user is unauthenticated (401) or lacks permissions (403).
        """
        code = 403 if request.user.is_authenticated else 401
        msg = "Presented user has not enough permissions." if request.user.is_authenticated else "User wasn't authenticated."
        raise PermissionDenied(
            data=ApiResponse().add_issue(
                Issue(
                    status="error",
                    code=code,
                    message=msg
                )
            ).set_status(
                status="error",
                code=code
            ).dict_response,
            code=code
        )

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
            data=ApiResponse().add_issue(
                Issue(
                    status="error",
                    code=405,
                    message="Non-operable HTTP method was received."
                )
            ).set_status(
                status="error",
                code=405
            ).dict_response,
            code=405,
            method=request.method
        )