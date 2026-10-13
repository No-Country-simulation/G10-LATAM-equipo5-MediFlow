"""Punto de entrada de la aplicación FastAPI de MediFlow."""

import logging
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import __version__
from app.core.config import settings
from app.core.database import engine
from app.core.log_config import configure_logging
from app.core.request_logging import REQUEST_ID_HEADER, RequestLoggingMiddleware
from app.features.audit.router import router as audit_router
from app.features.auth.router import router as auth_router
from app.features.auth.models import RevokedToken, user_queues
from app.features.auth.router import users_router
from app.features.catalogs.models import Area, CatalogHistory, DocumentType, RoutingQueue
from app.features.catalogs.router import router as catalogs_router
from app.features.documents.router import router as documents_router
from app.features.health.router import router as health_router

configure_logging(settings.LOG_LEVEL, settings.LOG_FORMAT)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Ciclo de vida de la aplicación: se ejecuta al iniciar y al finalizar."""
    logger.info(
        "Iniciando %s v%s (entorno %s, logs %s/%s)",
        settings.PROJECT_NAME,
        __version__,
        settings.ENVIRONMENT,
        settings.LOG_LEVEL,
        settings.LOG_FORMAT,
    )
    try:
        # Bases de datos anteriores a estas features no tienen sus tablas: se crean si faltan.
        async with engine.begin() as conn:
            tablas = [m.__table__ for m in (RevokedToken, RoutingQueue, DocumentType, Area, CatalogHistory)]
            for table in (*tablas, user_queues):
                await conn.run_sync(table.create, checkfirst=True)
    except Exception:
        logger.exception(
            "No se pudieron verificar las tablas revoked_tokens / catálogos / áreas / historial / colas de usuario"
        )
    yield
    logger.info("Deteniendo %s", settings.PROJECT_NAME)


# En producción Swagger/OpenAPI no se publican: exponen el mapa completo de la API.
_docs_enabled = not settings.is_production

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=__version__,
    lifespan=lifespan,
    docs_url="/docs" if _docs_enabled else None,
    redoc_url="/redoc" if _docs_enabled else None,
    openapi_url="/openapi.json" if _docs_enabled else None,
)

# Se agrega antes que CORS para quedar *dentro* de él: los preflight OPTIONS no se registran y
# la respuesta 500 de un error no controlado también lleva los headers CORS.
app.add_middleware(RequestLoggingMiddleware)

# El token viaja en `Authorization` (no en cookies), así que no hacen falta credenciales CORS.
# `X-Request-ID` une los logs del navegador, n8n y el backend de una misma operación.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_origin_regex=settings.BACKEND_CORS_ORIGIN_REGEX,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", REQUEST_ID_HEADER],
    expose_headers=[REQUEST_ID_HEADER],
)

app.include_router(health_router, prefix=settings.API_V1_PREFIX)
app.include_router(auth_router, prefix=settings.API_V1_PREFIX)
app.include_router(users_router, prefix=settings.API_V1_PREFIX)
app.include_router(documents_router, prefix=f"{settings.API_V1_PREFIX}/documents")
app.include_router(audit_router, prefix=f"{settings.API_V1_PREFIX}/audit")
app.include_router(
    catalogs_router,
    prefix=f"{settings.API_V1_PREFIX}/catalogs",
    tags=["Catalogs & Master Data"],
)
