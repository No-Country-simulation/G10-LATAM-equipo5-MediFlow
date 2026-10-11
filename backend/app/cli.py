"""Comandos de administración. En producción no se cargan los usuarios de prueba, así que el
primer ADMIN se crea con:

    docker compose -f docker-compose.prod.yml exec backend python -m app.cli create-admin \
        --username admin --email admin@hospital.cl --full-name "Administrador" --area ADMINISTRACION

`--area` es el `codigo` de un área activa (las áreas semilla vienen en `init.sql`).
La contraseña se pide por teclado (no queda en el historial de la shell).
"""

import argparse
import asyncio
import getpass
import sys

from pydantic import ValidationError
from sqlalchemy import select

from app.core.database import AsyncSessionLocal, engine
from app.core.security import get_password_hash
from app.features.auth.enums import UserRole
from app.features.auth.models import User
from app.features.auth.schemas import UserCreateRequest
from app.features.catalogs.models import Area


async def _create_admin(
    username: str, email: str, full_name: str, area_codigo: str, password: str
) -> None:
    async with AsyncSessionLocal() as db:
        area = (
            await db.execute(select(Area).where(Area.codigo == area_codigo, Area.is_active.is_(True)))
        ).scalar_one_or_none()
        if area is None:
            sys.exit(f"No existe un área activa con el código '{area_codigo}'")

        payload = UserCreateRequest(
            username=username,
            email=email,
            password=password,
            full_name=full_name,
            role=UserRole.ADMIN,
            area_id=area.id,
        )
        existing = await db.execute(
            select(User).where((User.username == payload.username) | (User.email == payload.email))
        )
        if existing.scalar_one_or_none() is not None:
            sys.exit("Ya existe un usuario con ese username o email")
        db.add(
            User(
                username=payload.username,
                email=payload.email,
                hashed_password=get_password_hash(payload.password),
                full_name=payload.full_name,
                role=UserRole.ADMIN,
                area=area,
            )
        )
        await db.commit()
    await engine.dispose()
    print(f"Usuario ADMIN '{payload.username}' creado en el área {area.codigo}")


def main() -> None:
    parser = argparse.ArgumentParser(prog="python -m app.cli")
    sub = parser.add_subparsers(dest="command", required=True)
    create = sub.add_parser("create-admin", help="Crea un usuario con rol ADMIN")
    create.add_argument("--username", required=True)
    create.add_argument("--email", required=True)
    create.add_argument("--full-name", required=True)
    create.add_argument("--area", required=True, help="Código de un área activa, ej. ADMINISTRACION")
    args = parser.parse_args()

    password = getpass.getpass("Contraseña (mín. 8 caracteres): ")
    if password != getpass.getpass("Repite la contraseña: "):
        sys.exit("Las contraseñas no coinciden")
    try:
        asyncio.run(
            _create_admin(args.username, args.email, args.full_name, args.area, password)
        )
    except ValidationError as exc:
        sys.exit(f"Datos inválidos:\n{exc}")


if __name__ == "__main__":
    main()
