"""
Rate Limiting via Redis — Sliding Window Counter.

Verwendung:
    await check_rate_limit(redis, key="login:1.2.3.4", limit=5, window=900)

Wirft HTTP 429 bei Überschreitung.
"""
from fastapi import HTTPException, status
import redis.asyncio as aioredis


async def check_rate_limit(
    redis: aioredis.Redis,
    key: str,
    limit: int,
    window: int,          # Sekunden
    detail: str = "Zu viele Versuche. Bitte später erneut versuchen.",
):
    """
    Erhöht den Zähler für `key` und wirft 429 wenn `limit` überschritten.
    TTL wird beim ersten Request gesetzt und nicht erneuert (Fixed Window).
    """
    redis_key = f"ratelimit:{key}"

    current = await redis.incr(redis_key)

    # TTL nur beim ersten Request setzen
    if current == 1:
        await redis.expire(redis_key, window)

    if current > limit:
        ttl = await redis.ttl(redis_key)
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=detail,
            headers={"Retry-After": str(ttl)},
        )
