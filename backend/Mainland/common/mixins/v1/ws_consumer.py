from common.schemas.v1.response import ApiResponse, Issue

from django.conf import settings

from asgiref.sync import sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer
from django_redis import get_redis_connection

import json
from typing import Callable, Awaitable
from functools import wraps

class WSConsumer(AsyncWebsocketConsumer):
    """Base mixin for WebSocket consumers providing common connectivity and response utilities.

    This class provides wrappers for connection/disconnection management using Redis
    to track user presence and connection limits.

    Presence is exact Redis-set membership (SADD/SREM), not a TTL heartbeat: it relies on
    `disconnect()` always firing to clean up, which Channels guarantees on both a clean
    close and a dropped connection.
    """

    @property
    def group_name(self):
        """The name of the channel group this consumer belongs to.

        Returns:
            str: The group name.

        Raises:
            NotImplementedError: If the inheriting class does not implement this property.
        """
        raise NotImplementedError("Consumer must be provided with group_name(self) property")

    @staticmethod
    def connect_wrapper():
        """A decorator for the `connect` method of a WSConsumer.

        Validates the maximum number of concurrent websocket connections for the user,
        registers user presence in Redis, and adds the consumer to the channel layer group.

        Returns:
            Callable: A decorator that wraps the `connect` method.
        """
        def decorator(func: Callable[..., Awaitable]):
            @wraps(func)
            async def wrapper(self: "WSConsumer", *args, **kwargs):
                max_connections = settings.API_MANIFEST["limits"]["ws_connections_count_max"]
                user_id = self.scope["user"].pk
                r = get_redis_connection("default")

                current_count = await sync_to_async(r.scard)(f"ws:user:{user_id}:groups")
                if current_count + 1 > max_connections:
                    await self.close(code=4003, reason=f"Too many connections for this user. Connections-per-user limit is {max_connections}")
                    return

                await func(self, *args, **kwargs)

                await sync_to_async(r.sadd)(f"{self.group_name}:presence", user_id)
                await sync_to_async(r.sadd)(f"ws:user:{user_id}:groups", self.group_name)

                await self.channel_layer.group_add(self.group_name, self.channel_name)

                await self.accept()
            return wrapper
        return decorator

    @staticmethod
    def disconnect_wrapper():
        """A decorator for the `disconnect` method of a WSConsumer.

        Removes the user from Redis presence tracking and removes the consumer
        from the channel layer group.

        Returns:
            Callable: A decorator that wraps the `disconnect` method.
        """
        def decorator(func: Callable[..., Awaitable]):
            @wraps(func)
            async def wrapper(self: "WSConsumer", close_code: int, *args, **kwargs):
                await func(self, close_code, *args, **kwargs)

                r = get_redis_connection("default")
                user_id = self.scope["user"].pk

                await sync_to_async(r.srem)(f"{self.group_name}:presence", user_id)
                await sync_to_async(r.srem)(f"ws:user:{user_id}:groups", self.group_name)

                await self.channel_layer.group_discard(self.group_name, self.channel_name)
            return wrapper
        return decorator

    async def send_json_error(self, code: int, message: str):
        """Sends a formatted JSON error response to the websocket client.

        Args:
            code (int): The error code to send.
            message (str): The error message to send.
        """
        response = ApiResponse(status="error", code=code).add_issue(
            Issue(status="error", code=code, message=message)
        )
        await self.send(text_data=json.dumps(response.dict_response))
