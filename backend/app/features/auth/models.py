"""Modelo ORM que mapea la tabla `users` existente en PostgreSQL."""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, String, Table, func
from sqlalchemy import Enum as SQLEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.features.auth.enums import UserRole
from app.features.catalogs.models import Area, RoutingQueue

# Colas que atiende cada usuario: en la Consola de Triaje, un OPERADOR o AUDITOR_CLINICO solo ve los
# casos de sus colas (el ADMIN ve todas).
user_queues = Table(
    "user_queues",
    Base.metadata,
    Column("user_id", ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
    Column("queue_id", ForeignKey("routing_queues.id", ondelete="CASCADE"), primary_key=True),
)


class User(Base):
    """Usuario del sistema (auditor clínico, administrador, etc.)."""

    __tablename__ = "users"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    username: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    email: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(150), nullable=False)
    role: Mapped[UserRole] = mapped_column(
        SQLEnum(UserRole, name="user_role_enum", native_enum=False, length=30, validate_strings=True),
        nullable=False,
        default=UserRole.AUDITOR_CLINICO,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    # Nullable solo por los usuarios anteriores a las áreas: la API exige área al crear.
    area_id: Mapped[UUID | None] = mapped_column(ForeignKey("areas.id"), index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.current_timestamp()
    )

    # `joined`: el área llega en la misma consulta que el usuario (se usa en cada respuesta
    # de perfil y al ingerir documentos) y evita el lazy-load implícito, que falla en async.
    area: Mapped[Area | None] = relationship(foreign_keys=[area_id], lazy="joined")
    # `selectin`: una consulta extra al cargar el usuario (sin lazy-load implícito en async).
    colas: Mapped[list[RoutingQueue]] = relationship(
        secondary=user_queues, lazy="selectin", order_by=RoutingQueue.nombre
    )


class RevokedToken(Base):
    """Token JWT invalidado por logout; se conserva hasta su fecha de expiración natural."""

    __tablename__ = "revoked_tokens"

    jti: Mapped[str] = mapped_column(String(64), primary_key=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    revoked_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.current_timestamp()
    )
