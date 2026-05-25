from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from app.core.config import settings

# Async Engine für PostgreSQL
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.APP_ENV == "development",  # SQL-Queries im Dev-Modus loggen
    pool_pre_ping=True,                       # Verbindung vor Nutzung prüfen
)

# Session Factory
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def get_db() -> AsyncSession:
    """
    FastAPI Dependency: Gibt eine DB-Session zurück.
    Wird automatisch nach dem Request geschlossen.
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
