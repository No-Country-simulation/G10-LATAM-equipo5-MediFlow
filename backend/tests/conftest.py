"""Fixtures compartidas: los tests no necesitan PostgreSQL ni OCI reales."""

import os

# Deben definirse ANTES de importar `app`, porque la configuración y el engine se crean al importar.
os.environ["DATABASE_URL"] = "postgresql+asyncpg://test:test@localhost:5432/test"
os.environ["JWT_SECRET_KEY"] = "test-secret-key"
os.environ["JWT_ALGORITHM"] = "HS256"
os.environ["ACCESS_TOKEN_EXPIRE_MINUTES"] = "60"
os.environ["OCI_BUCKET_NAME"] = "test-bucket"

import base64  # noqa: E402
from datetime import datetime, timezone  # noqa: E402
from uuid import uuid4  # noqa: E402

import httpx  # noqa: E402
import pytest  # noqa: E402

from app.core.database import get_db  # noqa: E402
from app.core.security import create_access_token, get_password_hash  # noqa: E402
from app.features.auth import dependencies as auth_dependencies  # noqa: E402
from app.features.auth.enums import UserRole  # noqa: E402
from app.features.auth.models import User  # noqa: E402
from app.main import app  # noqa: E402


class FakeResult:
    """Imita el resultado de `session.execute(...)` para los accesos usados por los services."""

    def __init__(self, value):
        self.value = value

    def scalar_one_or_none(self):
        return self.value

    def scalar_one(self):
        return self.value

    def scalars(self):
        return self

    def all(self):
        return self.value if isinstance(self.value, list) else [self.value]


class FakeSession:
    """Sesión asíncrona falsa: devuelve resultados encolados y registra las operaciones."""

    def __init__(self):
        self.results: list[FakeResult] = []
        self.added: list = []
        self.commits = 0
        self.rollbacks = 0
        self.fail_commit: Exception | None = None

    def queue(self, *values):
        self.results.extend(FakeResult(v) for v in values)

    async def execute(self, *_args, **_kwargs):
        return self.results.pop(0) if self.results else FakeResult(None)

    async def get(self, *_args, **_kwargs):
        return None

    def add(self, obj):
        self.added.append(obj)

    async def commit(self):
        if self.fail_commit is not None:
            raise self.fail_commit
        self.commits += 1

    async def rollback(self):
        self.rollbacks += 1

    async def refresh(self, obj):
        # Simula los valores que asigna la base de datos al insertar.
        if getattr(obj, "created_at", 0) is None:
            obj.created_at = datetime.now(timezone.utc)


class FakeOCI:
    """Reemplaza al cliente de OCI: guarda lo que se sube y permite simular fallos."""

    def __init__(self):
        self.uploaded: dict[str, bytes] = {}
        self.deleted: list[str] = []
        self.fail_on: str | None = None

    async def upload_object(self, name, content, content_type="application/octet-stream"):
        if self.fail_on and self.fail_on in name:
            raise RuntimeError("OCI caído")
        self.uploaded[name] = content

    async def delete_object(self, name):
        self.deleted.append(name)

    async def create_preauthenticated_request(self, *_args, **_kwargs):
        return "https://oci.example/preview"


@pytest.fixture
def db() -> FakeSession:
    return FakeSession()


@pytest.fixture
def oci(monkeypatch) -> FakeOCI:
    fake = FakeOCI()
    monkeypatch.setattr("app.features.documents.service.oci_storage_client", fake)
    monkeypatch.setattr("app.features.audit.service.oci_storage_client", fake)
    return fake


@pytest.fixture
async def client(db):
    app.dependency_overrides[get_db] = lambda: db
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()


def make_user(role: UserRole, username: str = "tester", active: bool = True) -> User:
    return User(
        id=uuid4(),
        username=username,
        email=f"{username}@mediflow.cl",
        hashed_password=get_password_hash("password123"),
        full_name="Usuario de Prueba",
        role=role,
        is_active=active,
        created_at=datetime.now(timezone.utc),
    )


@pytest.fixture
def login_as(monkeypatch):
    """Devuelve una función que autentica como un usuario del rol dado y entrega los headers."""

    def _login(role: UserRole, **kwargs) -> dict[str, str]:
        user = make_user(role, **kwargs)

        async def fake_get_user(_db, _username):
            return user

        async def fake_revoked(_db, _jti):
            return False

        monkeypatch.setattr(auth_dependencies, "get_user_by_username", fake_get_user)
        monkeypatch.setattr(auth_dependencies, "is_token_revoked", fake_revoked)
        token = create_access_token({"sub": user.username})
        return {"Authorization": f"Bearer {token}"}

    return _login


def ingest_body(score: float = 0.95, requiere_auditoria: bool = False, **overrides) -> dict:
    body = {
        "documento_id": "DOC-TEST-1",
        "tipo_archivo": "PDF",
        "archivo_base64": base64.b64encode(b"contenido").decode(),
        "clasificacion": {
            "tipo_documento": "Informe de Estudio por Imagenes",
            "especialidad": "Radiologia",
            "nivel_prioridad": "Urgente",
            "score_confianza_clasificacion": score,
        },
        "datos_extraidos": {
            "paciente": {"nombre": "Carlos Mendes", "edad": 52, "rut": "12.345.678-9"},
            "medico_solicitante": {"nombre": "Dra. Silveira", "rut": "9.876.543-2"},
            "estudio_realizado": "Tomografia de Torax",
            "diagnostico_principal": "TEP Agudo",
            "cie10_sugerido": "I26.9",
        },
        "decision_enrutamiento": {
            "destino_principal": "Cola_Emergencia_Medica",
            "requiere_auditoria_humana": requiere_auditoria,
            "justificacion_enrutamiento": "Hallazgo critico",
            "notificacion_generada": {"canal": "Alerta_Guardia_Medica", "mensaje": "ALERTA"},
        },
    }
    body.update(overrides)
    return body
