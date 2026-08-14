from __future__ import annotations

from typing import Any

import fakeredis
from django_redis.pool import ConnectionFactory

_FAKE_SERVER = fakeredis.FakeServer()

class FakeConnectionFactory(ConnectionFactory):
    """django_redis ConnectionFactory that hands back fakeredis clients backed
    by one shared in-memory FakeServer instead of dialing a real Redis server.

    Wired in via CACHES[alias]["OPTIONS"]["CONNECTION_FACTORY"] in
    settings/test_mocked.py (MOCK_EXTERNAL_SERVICES=True only). Not for use
    outside tests.
    """

    def connect(self, url: str) -> Any:
        return fakeredis.FakeRedis(server=_FAKE_SERVER)

    def disconnect(self, connection: Any) -> None:
        pass
