"""Test-Konfiguration — nutzt PostgreSQL-Testdatenbank."""
import pytest
import asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from app.main import app
from app.core.database import get_db
from app.core.config import settings
from app.models.base import Base

TEST_DB_URL = settings.DATABASE_URL.rsplit("/", 1)[0] + "/ze_ticket_test"

# Tabellen einmalig anlegen beim Start
@pytest.fixture(scope="session", autouse=True)
def setup_db():
    """Tabellen in Test-DB anlegen."""
    async def _setup():
        engine = create_async_engine(TEST_DB_URL, echo=False)
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        await engine.dispose()
    asyncio.run(_setup())
    yield

@pytest.fixture
async def client():
    """HTTP-Client mit eigener DB-Session pro Test."""
    engine = create_async_engine(TEST_DB_URL, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async def override_get_db():
        async with async_session() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise

    app.dependency_overrides[get_db] = override_get_db
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()
    await engine.dispose()

@pytest.fixture
async def live_client():
    """Client ohne DB-Override — nutzt echte App-DB."""
    # Neue Transport-Instanz pro Test verhindert Connection-Konflikte
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
        await c.aclose()
