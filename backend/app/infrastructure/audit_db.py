"""Manejador nativo de SQLite (modo WAL) para la cola de auditoria manual."""

from __future__ import annotations

import json
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterator

from app.core.config import Settings, get_settings

_CREATE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS auditoria_pendientes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    paciente_nombre TEXT NOT NULL,
    diagnostico TEXT NOT NULL,
    score_confianza REAL NOT NULL,
    estado TEXT NOT NULL DEFAULT 'PENDIENTE',
    payload_json TEXT NOT NULL,
    creado_en TEXT NOT NULL
);
"""


class AuditDB:
    """Acceso a la tabla `auditoria_pendientes` en una base de datos SQLite local."""

    def __init__(self, settings: Settings | None = None) -> None:
        self._settings = settings or get_settings()
        self._db_path = Path(self._settings.audit_db_path)
        self._db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_db()

    @contextmanager
    def _connect(self) -> Iterator[sqlite3.Connection]:
        connection = sqlite3.connect(self._db_path)
        connection.row_factory = sqlite3.Row
        try:
            connection.execute("PRAGMA journal_mode=WAL;")
            yield connection
            connection.commit()
        finally:
            connection.close()

    def _init_db(self) -> None:
        with self._connect() as connection:
            connection.execute(_CREATE_TABLE_SQL)

    def insertar_pendiente(
        self,
        paciente_nombre: str,
        diagnostico: str,
        score_confianza: float,
        payload: dict[str, Any],
    ) -> int:
        """Inserta un nuevo registro en estado PENDIENTE y retorna su id."""
        creado_en = datetime.now(timezone.utc).isoformat()
        with self._connect() as connection:
            cursor = connection.execute(
                """
                INSERT INTO auditoria_pendientes
                    (paciente_nombre, diagnostico, score_confianza, estado, payload_json, creado_en)
                VALUES (?, ?, ?, 'PENDIENTE', ?, ?)
                """,
                (
                    paciente_nombre,
                    diagnostico,
                    score_confianza,
                    json.dumps(payload, ensure_ascii=False),
                    creado_en,
                ),
            )
            return int(cursor.lastrowid)

    def listar_pendientes(self) -> list[dict[str, Any]]:
        """Retorna todos los registros en estado PENDIENTE, mas recientes primero."""
        with self._connect() as connection:
            rows = connection.execute(
                """
                SELECT id, paciente_nombre, diagnostico, score_confianza, estado, payload_json, creado_en
                FROM auditoria_pendientes
                WHERE estado = 'PENDIENTE'
                ORDER BY creado_en DESC
                """
            ).fetchall()
        return [self._row_to_dict(row) for row in rows]

    def marcar_aprobado(self, registro_id: int) -> dict[str, Any] | None:
        """Marca un registro como APROBADO y retorna el registro actualizado, o None si no existe."""
        with self._connect() as connection:
            connection.execute(
                "UPDATE auditoria_pendientes SET estado = 'APROBADO' WHERE id = ?",
                (registro_id,),
            )
            row = connection.execute(
                """
                SELECT id, paciente_nombre, diagnostico, score_confianza, estado, payload_json, creado_en
                FROM auditoria_pendientes
                WHERE id = ?
                """,
                (registro_id,),
            ).fetchone()
        return self._row_to_dict(row) if row is not None else None

    @staticmethod
    def _row_to_dict(row: sqlite3.Row) -> dict[str, Any]:
        data = dict(row)
        data["payload_json"] = json.loads(data["payload_json"])
        return data
