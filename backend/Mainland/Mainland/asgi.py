import os
from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack

import Mainland.wb_urls

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "Mainland.settings")

application = ProtocolTypeRouter({
    "http": get_asgi_application(),
    "websocket": AuthMiddlewareStack(
        URLRouter(
            Mainland.wb_urls.websocket_urlpatterns
        )
    ),
})