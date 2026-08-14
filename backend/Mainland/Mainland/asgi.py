import os
from django.core.asgi import get_asgi_application
from django.urls import re_path
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack

import Mainland.ws_urls

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "Mainland.settings")

application = ProtocolTypeRouter({
    "http": get_asgi_application(),
    "websocket": AuthMiddlewareStack(
        URLRouter([
            re_path(r'^ws/', URLRouter(Mainland.ws_urls.websocket_urlpatterns)),
        ])
    ),
})

