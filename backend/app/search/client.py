"""
Elasticsearch-Client — Singleton, wird per Import genutzt.
"""
from elasticsearch import AsyncElasticsearch
from app.core.config import settings

_client: AsyncElasticsearch | None = None


def get_es_client() -> AsyncElasticsearch:
    global _client
    if _client is None:
        _client = AsyncElasticsearch(settings.ELASTICSEARCH_URL)
    return _client


async def close_es_client():
    global _client
    if _client is not None:
        await _client.close()
        _client = None
