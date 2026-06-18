from django.conf import settings

from asgiref.sync import sync_to_async

def count_users_in_channel(group_name: str):
    return settings.SYNC_REDIS.scard(f"{group_name}:presence")

async def acount_users_in_channel(group_name: str):
    return await sync_to_async(count_users_in_channel, thread_sensitive=False)(group_name)

def count_channels_in_user(user_id: int):
    return settings.SYNC_REDIS.scard(f"wb:user:{user_id}:groups")

async def acount_channels_in_user(user_id: int):
    return await sync_to_async(count_channels_in_user, thread_sensitive=False)(user_id)

def is_user_in(group_name: str, user_id):
    return settings.SYNC_REDIS.sismember(f"{group_name}:presence", user_id)

async def ais_user_in(group_name: str, user_id):
    return await sync_to_async(is_user_in, thread_sensitive=False)(group_name, user_id)

def get_channel_users(group_name: str = None):
    return settings.SYNC_REDIS.smembers(f"{group_name}:presence")

async def aget_channel_users(group_name: str = None):
    return await sync_to_async(get_channel_users, thread_sensitive=False)(group_name)

def get_user_channels(user_id: int = None):
    return settings.SYNC_REDIS.smembers(f"wb:user:{user_id}:groups")

async def aget_user_channels(user_id: int = None):
    return await sync_to_async(get_user_channels, thread_sensitive=False)(user_id)
