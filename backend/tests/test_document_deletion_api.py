from datetime import datetime, timezone
from decimal import Decimal

from app.features.auth.enums import UserRole
from app.features.documents.models import ClinicalDocument


def _document(**kwargs) -> ClinicalDocument:
    fields = dict(
        documento_id="DOC-1",
        estado="PENDIENTE_AUDITORIA",
        identificacion_paciente="1-9",
        nombre_paciente="Ana",
        tipo_documento="RECETA",
        nivel_prioridad="Rutina",
        score_confianza=Decimal("0.500"),
        destino_enrutamiento="Farmacia_Hospitalaria",
        oci_json_path="auditoria_humana/DOC-1.json",
        created_at=datetime.now(timezone.utc),
    )
    fields.update(kwargs)
    return ClinicalDocument(**fields)


def _capturar_sentencias(db) -> list:
    sentencias = []
    original = db.execute

    async def execute(stmt, *args, **kwargs):
        sentencias.append(stmt)
        return await original(stmt, *args, **kwargs)

    db.execute = execute
    return sentencias


def _sql(stmt) -> str:
    return str(stmt.compile(compile_kwargs={"literal_binds": True}))


async def test_admin_elimina_logicamente_y_queda_en_el_historial(client, login_as, db):
    doc = _document(asignado_a_username="ana")
    db.queue(doc)
    r = await client.post(
        "/api/v1/documents/DOC-1/delete",
        json={"motivo": "  Documento de otro paciente subido por error  "},
        headers=login_as(UserRole.ADMIN, username="admin"),
    )

    assert r.status_code == 200
    data = r.json()
    assert data["estado"] == "ELIMINADO"
    assert data["eliminado_por_username"] == "admin"
    assert data["motivo_eliminacion"] == "Documento de otro paciente subido por error"
    assert doc.estado_previo == "PENDIENTE_AUDITORIA"
    assert doc.asignado_a_username is None  # se libera de la auditoría
    assert doc.corrections[0].origen == "ELIMINACION"
    assert doc.corrections[0].cambios == [
        {"campo": "estado", "etiqueta": "Estado", "antes": "PENDIENTE_AUDITORIA", "despues": "ELIMINADO"}
    ]
    assert db.commits == 1


async def test_eliminar_dos_veces_409(client, login_as, db):
    db.queue(_document(estado="ELIMINADO"))
    r = await client.post(
        "/api/v1/documents/DOC-1/delete", json={"motivo": "Motivo suficiente"}, headers=login_as(UserRole.ADMIN)
    )
    assert r.status_code == 409


async def test_solo_admin_puede_eliminar_o_restaurar(client, login_as):
    for role in (UserRole.AUDITOR_CLINICO, UserRole.OPERADOR, UserRole.GESTOR_USUARIOS):
        headers = login_as(role)
        body = {"motivo": "Motivo suficiente"}
        assert (await client.post("/api/v1/documents/DOC-1/delete", json=body, headers=headers)).status_code == 403
        assert (await client.post("/api/v1/documents/DOC-1/restore", json=body, headers=headers)).status_code == 403


async def test_eliminar_exige_motivo(client, login_as):
    r = await client.post("/api/v1/documents/DOC-1/delete", json={"motivo": " no "}, headers=login_as(UserRole.ADMIN))
    assert r.status_code == 422


async def test_restaurar_vuelve_al_estado_previo(client, login_as, db):
    doc = _document(
        estado="ELIMINADO",
        estado_previo="AUDITADO",
        eliminado_por_username="admin",
        eliminado_at=datetime.now(timezone.utc),
        motivo_eliminacion="Error",
    )
    db.queue(doc)
    r = await client.post(
        "/api/v1/documents/DOC-1/restore", json={"motivo": "Se eliminó por error"}, headers=login_as(UserRole.ADMIN)
    )

    assert r.status_code == 200
    assert r.json()["estado"] == "AUDITADO"
    assert r.json()["eliminado_at"] is None
    assert r.json()["motivo_eliminacion"] is None
    assert doc.corrections[0].origen == "RESTAURACION"


async def test_restaurar_un_documento_no_eliminado_409(client, login_as, db):
    db.queue(_document())
    r = await client.post(
        "/api/v1/documents/DOC-1/restore", json={"motivo": "Motivo suficiente"}, headers=login_as(UserRole.ADMIN)
    )
    assert r.status_code == 409


async def test_listado_excluye_eliminados_por_defecto(client, login_as, db):
    sentencias = _capturar_sentencias(db)
    db.queue(0, [])
    await client.get("/api/v1/documents?estado=PROCESADO,AUDITADO", headers=login_as(UserRole.AUDITOR_CLINICO))
    assert "clinical_documents.estado != 'ELIMINADO'" in _sql(sentencias[0])


async def test_admin_lista_los_eliminados(client, login_as, db):
    sentencias = _capturar_sentencias(db)
    db.queue(0, [])
    r = await client.get("/api/v1/documents?estado=ELIMINADO", headers=login_as(UserRole.ADMIN))

    assert r.status_code == 200
    sql = _sql(sentencias[0])
    assert "clinical_documents.estado IN ('ELIMINADO')" in sql
    assert "!= 'ELIMINADO'" not in sql


async def test_no_admin_no_puede_listar_eliminados(client, login_as):
    r = await client.get("/api/v1/documents?estado=ELIMINADO", headers=login_as(UserRole.AUDITOR_CLINICO))
    assert r.status_code == 403


async def test_detalle_de_eliminado_solo_para_admin(client, login_as, db):
    sentencias = _capturar_sentencias(db)
    db.queue(None)
    r = await client.get("/api/v1/documents/DOC-1", headers=login_as(UserRole.AUDITOR_CLINICO))
    assert r.status_code == 404
    assert "clinical_documents.estado != 'ELIMINADO'" in _sql(sentencias[0])

    db.queue(None)
    await client.get("/api/v1/documents/DOC-1", headers=login_as(UserRole.ADMIN))
    assert "ELIMINADO" not in _sql(sentencias[1])
