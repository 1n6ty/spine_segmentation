from elasticsearch.dsl import Q as ESQ

from Profile.documents import UserDocument


def search_users(q: str) -> list[int]:
    """Returns User pks ranked by Elasticsearch relevance for the given free-text query."""
    response = UserDocument.search().query(
        ESQ('multi_match', query=q, fields=['email', 'first_name', 'last_name', 'patronymic'])
    ).execute()
    return [int(hit.meta.id) for hit in response]
