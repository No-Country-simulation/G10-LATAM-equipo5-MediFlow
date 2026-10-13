from datetime import date, datetime, timezone
from decimal import Decimal

from app.features.auth.enums import UserRole
from app.features.documents.models import ClinicalDocument

URL = "/api/v1/documents/stats"
PERIODO = "fecha_desde=2026-10-01T03:00:00Z&fecha_hasta=2026-10-04T02:59:59Z"


def _document(**kwargs) -> ClinicalDocument:
    fields = dict(
        documento_id="DOC-1",
        estado="PENDIENTE_AUDITORIA",
        identificacion_paciente="1-9",
        nombre_paciente="Ana",
        tipo_documento="RECETA",
        nivel_prioridad="Urgente",
        score_confianza=Decimal("0.500"),
        destino_enrutamiento="Farmacia_Hospitalaria",
        oci_json_path="auditoria_humana/DOC-1.json",
        created_at=datetime(2026, 10, 2, 12, tzinfo=timezone.utc),
    )
    fields.update(kwargs)
    return ClinicalDocument(**fields)


def _queue_conteos(db):
    db.queue(
        [
            (date(2026, 10, 1), "Urgente", 2),
            (date(2026, 10, 1), "Rutina", 3),
            (date(2026, 10, 3), "Prioritario", 1),
        ],
        [("PROCESADO", 4), ("DESCARTADO", 1), ("PENDIENTE_AUDITORIA", 1)],
        [("Farmacia_Hospitalaria", 4), (None, 2)],
        7,
    )


async def test_stats_requires_token(client):
    r = await client.get(URL)
    assert r.status_code == 401


async def test_stats_forbidden_for_gestor_usuarios(client, login_as):
    headers = login_as(UserRole.GESTOR_USUARIOS)
    r = await client.get(URL, headers=headers)
    assert r.status_code == 403


async def test_stats_auditor_recibe_conteos_y_listas_de_trabajo(client, login_as, db):
    _queue_conteos(db)
    db.queue([_document(documento_id="MIO")], [_document()], [_document(documento_id="URG", estado="PROCESADO")])
    headers = login_as(UserRole.AUDITOR_CLINICO)
    r = await client.get(f"{URL}?{PERIODO}&utc_offset_min=-180", headers=headers)

    assert r.status_code == 200
    data = r.json()
    assert data["totales"] == {
        "total": 6,
        "urgente": 2,
        "prioritario": 1,
        "rutina": 3,
        "procesados": 4,
        "auditados": 0,
        "descartados": 1,
        "pendientes_auditoria": 7,
    }
    # Los días sin ingresos vienen en cero, en la hora local del usuario (UTC-3).
    assert [d["fecha"] for d in data["por_dia"]] == ["2026-10-01", "2026-10-02", "2026-10-03"]
    assert data["por_dia"][0] == {"fecha": "2026-10-01", "urgente": 2, "prioritario": 0, "rutina": 3}
    assert data["por_dia"][1]["urgente"] == 0
    assert data["por_destino"] == [
        {"destino": "Farmacia_Hospitalaria", "total": 4},
        {"destino": None, "total": 2},
    ]
    assert [d["documento_id"] for d in data["mis_casos"]] == ["MIO"]
    assert [d["documento_id"] for d in data["pendientes_auditoria"]] == ["DOC-1"]
    assert [d["documento_id"] for d in data["urgentes"]] == ["URG"]
    assert data["recientes"] == []


async def test_stats_operador_recibe_sus_ultimas_cargas(client, login_as, db):
    _queue_conteos(db)
    db.queue([_document(documento_id="MI-CARGA", estado="DESCARTADO")])
    headers = login_as(UserRole.OPERADOR, username="operador")
    r = await client.get(f"{URL}?{PERIODO}", headers=headers)

    assert r.status_code == 200
    data = r.json()
    assert [d["documento_id"] for d in data["recientes"]] == ["MI-CARGA"]
    assert data["mis_casos"] == data["pendientes_auditoria"] == data["urgentes"] == []


async def test_stats_periodo_por_defecto_es_de_14_dias(client, login_as, db):
    db.queue([], [], [], 0, [], [], [])
    headers = login_as(UserRole.ADMIN)
    r = await client.get(URL, headers=headers)

    assert r.status_code == 200
    assert len(r.json()["por_dia"]) == 14


async def test_stats_rechaza_periodo_invertido(client, login_as):
    headers = login_as(UserRole.ADMIN)
    r = await client.get(f"{URL}?fecha_desde=2026-10-05T00:00:00Z&fecha_hasta=2026-10-01T00:00:00Z", headers=headers)
    assert r.status_code == 422


async def test_stats_rechaza_periodo_mayor_a_92_dias(client, login_as):
    headers = login_as(UserRole.ADMIN)
    r = await client.get(f"{URL}?fecha_desde=2026-01-01T00:00:00Z&fecha_hasta=2026-10-01T00:00:00Z", headers=headers)
    assert r.status_code == 422


async def test_stats_acepta_fechas_sin_zona_horaria(client, login_as, db):
    db.queue([], [], [], 0, [], [], [])
    headers = login_as(UserRole.ADMIN)
    r = await client.get(f"{URL}?fecha_desde=2026-10-01T00:00:00&fecha_hasta=2026-10-02T00:00:00", headers=headers)
    assert r.status_code == 200
    assert len(r.json()["por_dia"]) == 2
