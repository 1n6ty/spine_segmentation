from common.schemas.v1.response import ApiResponse, Issue

from django.conf import settings

from channels.generic.websocket import AsyncWebsocketConsumer

import json
from typing import Callable, Awaitable
from functools import wraps

class WSConsumer(AsyncWebsocketConsumer):

    @property
    def group_name(self):
        raise NotImplementedError("Consumer must be provided with group_name(self) property")

    @staticmethod
    def connect_wrapper():
        """
        Decorator for connect method.
        Checks max connections, adds user to Redis presence, joins channel layer group.
        """
        def decorator(func: Callable[..., Awaitable]):
            @wraps(func)
            async def wrapper(self: "WSConsumer", *args, **kwargs):
                max_connections = settings.API_MANIFEST["limits"]["wb_connections_count_max"]
                current_count = await settings.REDIS.scard(f"wb:user:{self.scope["user"].pk}:groups") or 0
                if current_count + 1 > max_connections:
                    await self.close(code=4003, reason=f"Too many connections for this user. Connections-per-user limit is {max_connections}")
                    return

                await func(self, *args, **kwargs)

                await settings.REDIS.sadd(f"{self.group_name}:presence", self.scope['user'].pk)
                await settings.REDIS.sadd(f"wb:user:{self.scope['user'].pk}:groups", self.group_name)

                await self.channel_layer.group_add(self.group_name, self.channel_name)

                await self.accept()
            return wrapper
        return decorator

    @staticmethod
    def disconnect_wrapper():
        """
        Decorator for disconnect method.
        Removes user from Redis presence and leaves channel layer group.
        """
        def decorator(func: Callable[..., Awaitable]):
            @wraps(func)
            async def wrapper(self: "WSConsumer", close_code: int, *args, **kwargs):
                await func(self, close_code, *args, **kwargs)

                await settings.REDIS.srem(f"{self.group_name}:presence", self.scope['user'].pk)
                await settings.REDIS.srem(f"wb:user:{self.scope['user'].pk}:groups", self.group_name)

                await self.channel_layer.group_discard(self.group_name, self.channel_name)
            return wrapper
        return decorator

    async def send_json_error(self, code, message):
        response = ApiResponse(status="error", code=code).add_issue(
            Issue(status="error", code=code, message=message)
        )
        await self.send(text_data=json.dumps(response.dict_response))
