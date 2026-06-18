from common.schemas.v1.response import ApiResponse, Issue
from common.exceptions.permission import PermissionDenied
from common.exceptions.http import MethodNotAllowed

from adrf.viewsets import ViewSet
from rest_framework.request import Request
from rest_framework.response import Response

class StdViewSet(ViewSet):

    def permission_denied(self, request: Request, message=None, code=None) -> Response:
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
