from rest_framework.request import Request
from rest_framework.exceptions import AuthenticationFailed
from asgiref.sync import sync_to_async

from common.schemas.v1.domain.user import User_Item_Schema


def get_current_user(request: Request, extend: frozenset = frozenset()) -> User_Item_Schema:
    """
    Retrieves the currently authenticated user's full profile, including their
    own effective Django permissions (user + group-inherited, superuser-aware).

    Args:
        request (Request): The DRF request object containing the user.
        extend: fields to render in full shape.

    Returns:
        User_Item_Schema: A Pydantic schema containing user details, phone,
        role, and permissions.

    Raises:
        AuthenticationFailed: If the user is not authenticated.
    """
    user = request.user
    if user.is_authenticated:
        return User_Item_Schema.from_model(user, permissions=sorted(user.get_all_permissions()), extend=extend)
    else:
        raise AuthenticationFailed("Authentication credentials were not provided.")

async def aget_current_user(request: Request, extend: frozenset = frozenset()) -> User_Item_Schema:
    """
    Asynchronously retrieves the currently authenticated user.

    Wraps the synchronous `get_current_user` implementation to avoid blocking
    the async event loop during database operations.

    Args:
        request (Request): The DRF request object containing the user.
        extend: fields to render in full shape.

    Returns:
        User_Item_Schema: A Pydantic schema containing user details, phone,
        role, and permissions.

    Raises:
        AuthenticationFailed: If the user is not authenticated.
    """
    return await sync_to_async(get_current_user)(request, extend)