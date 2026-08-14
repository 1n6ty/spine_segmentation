from asgiref.sync import sync_to_async
from django_redis import get_redis_connection

def _get_presence_key(group_name: str) -> str:
    """Generates the Redis key for group presence.

    Args:
        group_name (str): The name of the websocket group.

    Returns:
        str: The formatted Redis key.
    """
    return f"{group_name}:presence"

def _get_user_groups_key(user_id: int) -> str:
    """Generates the Redis key for user's active groups.

    Args:
        user_id (int): The ID of the user.

    Returns:
        str: The formatted Redis key.
    """
    return f"ws:user:{user_id}:groups"

def get_group_user_count(group_name: str) -> int:
    """Returns the number of users currently present in a websocket group.

    Args:
        group_name (str): The name of the websocket group.

    Returns:
        int: The count of users.
    """
    return get_redis_connection("default").scard(_get_presence_key(group_name))

async def aget_group_user_count(group_name: str) -> int:
    """Asynchronously returns the number of users in a websocket group.

    Args:
        group_name (str): The name of the websocket group.

    Returns:
        int: The count of users.
    """
    return await sync_to_async(get_group_user_count, thread_sensitive=False)(group_name)

def get_user_connection_count(user_id: int) -> int:
    """Returns the number of active websocket connections for a specific user.

    Args:
        user_id (int): The ID of the user.

    Returns:
        int: The count of active connections.
    """
    return get_redis_connection("default").scard(_get_user_groups_key(user_id))

async def aget_user_connection_count(user_id: int) -> int:
    """Asynchronously returns the number of active websocket connections for a user.

    Args:
        user_id (int): The ID of the user.

    Returns:
        int: The count of active connections.
    """
    return await sync_to_async(get_user_connection_count, thread_sensitive=False)(user_id)

def is_user_in_group(group_name: str, user_id: int) -> bool:
    """Checks if a specific user is present in a websocket group.

    Args:
        group_name (str): The name of the websocket group.
        user_id (int): The ID of the user.

    Returns:
        bool: True if the user is in the group, False otherwise.
    """
    return get_redis_connection("default").sismember(_get_presence_key(group_name), user_id)

async def ais_user_in_group(group_name: str, user_id: int) -> bool:
    """Asynchronously checks if a specific user is present in a websocket group.

    Args:
        group_name (str): The name of the websocket group.
        user_id (int): The ID of the user.

    Returns:
        bool: True if the user is in the group, False otherwise.
    """
    return await sync_to_async(is_user_in_group, thread_sensitive=False)(group_name, user_id)

def get_group_users(group_name: str):
    """Returns a set of user IDs present in a websocket group.

    Args:
        group_name (str): The name of the websocket group.

    Returns:
        set: A set of user IDs.
    """
    return get_redis_connection("default").smembers(_get_presence_key(group_name))

async def aget_group_users(group_name: str):
    """Asynchronously returns a set of user IDs present in a websocket group.

    Args:
        group_name (str): The name of the websocket group.

    Returns:
        set: A set of user IDs.
    """
    return await sync_to_async(get_group_users, thread_sensitive=False)(group_name)

def get_user_groups(user_id: int):
    """Returns a set of groups a specific user is currently connected to.

    Args:
        user_id (int): The ID of the user.

    Returns:
        set: A set of group names.
    """
    return get_redis_connection("default").smembers(_get_user_groups_key(user_id))

async def aget_user_groups(user_id: int):
    """Asynchronously returns a set of groups a specific user is connected to.

    Args:
        user_id (int): The ID of the user.

    Returns:
        set: A set of group names.
    """
    return await sync_to_async(get_user_groups, thread_sensitive=False)(user_id)