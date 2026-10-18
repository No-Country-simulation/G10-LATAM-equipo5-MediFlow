"""Alcance documental del OPERADOR: lo que subió, lo derivado a sus colas asistenciales y las colas de sistema."""

from sqlalchemy.dialects import postgresql

from app.features.auth.enums import UserRole
from app.features.documents.visibility import visible_documents_condition
from tests.conftest import make_queue, make_user


def _sql(clause) -> str:
    return str(clause.compile(dialect=postgresql.dialect(), compile_kwargs={"literal_binds": True}))


def _record_statements(db) -> list[str]:
    """Hace que la sesión falsa guarde el WHERE de cada consulta (sus resultados siguen encolados)."""
    statements: list[str] = []
    original = db.execute

    async def execute(stmt, *args, **kwargs):
        statements.append(_sql(stmt).partition("WHERE")[2])
        return await original(stmt, *args, **kwargs)

    db.execute = execute
    return statements


def _operador_con_colas():
    return [
        make_queue("Cola_Oncologia", "Oncología", es_asistencial=True),
        make_queue("Farmacia_Hospitalaria", "Farmacia", es_asistencial=False),
    ]


def test_admin_y_auditor_ven_todo():
    assert visible_documents_condition(make_user(UserRole.ADMIN)) is None
    assert visible_documents_condition(make_user(UserRole.AUDITOR_CLINICO)) is None


def test_operador_sin_colas_ve_lo_que_subio_y_las_colas_de_sistema():
    user = make_user(UserRole.OPERADOR)
    sql = _sql(visible_documents_condition(user))

    assert "uploaded_by_id" in sql
    # Ficha Clínica (`es_sistema`) es visible para todos aunque no se asigne a nadie.
    assert "SELECT routing_queues.codigo" in sql and "routing_queues.es_sistema IS true" in sql


def test_operador_con_colas_tambien_ve_las_colas_de_sistema():
    sql = _sql(visible_documents_condition(make_user(UserRole.OPERADOR, colas=_operador_con_colas())))
    assert "routing_queues.es_sistema IS true" in sql


def test_operador_ve_lo_que_subio_y_sus_colas_asistenciales():
    user = make_user(UserRole.OPERADOR, colas=_operador_con_colas())
    sql = _sql(visible_documents_condition(user))

    assert "uploaded_by_id" in sql and " OR " in sql
    assert "'Cola_Oncologia'" in sql
    # Solo las colas asistenciales (las de la Consola de Triaje).
    assert "Farmacia_Hospitalaria" not in sql


async def test_bandeja_del_operador_incluye_documentos_de_sus_colas(client, login_as, db):
    statements = _record_statements(db)
    db.queue(0, [])
    headers = login_as(UserRole.OPERADOR, colas=_operador_con_colas())
    r = await client.get("/api/v1/documents", headers=headers)

    assert r.status_code == 200
    assert all("'Cola_Oncologia'" in sql and "uploaded_by_id" in sql for sql in statements)


async def test_bandeja_del_admin_no_filtra_por_usuario(client, login_as, db):
    statements = _record_statements(db)
    db.queue(0, [])
    r = await client.get("/api/v1/documents", headers=login_as(UserRole.ADMIN))

    assert r.status_code == 200
    assert not any("uploaded_by_id" in sql for sql in statements)


async def test_detalle_del_operador_usa_el_mismo_alcance(client, login_as, db, oci):
    statements = _record_statements(db)
    headers = login_as(UserRole.OPERADOR, colas=_operador_con_colas())
    r = await client.get("/api/v1/documents/DOC-1", headers=headers)

    assert r.status_code == 404
    assert "'Cola_Oncologia'" in statements[0] and "uploaded_by_id" in statements[0]


async def test_inicio_del_operador_cuenta_sus_colas_pero_recientes_son_sus_cargas(client, login_as, db):
    statements = _record_statements(db)
    db.queue([], [], [], 0, [])
    headers = login_as(UserRole.OPERADOR, colas=_operador_con_colas())
    r = await client.get(
        "/api/v1/documents/stats?fecha_desde=2026-10-01T00:00:00Z&fecha_hasta=2026-10-05T00:00:00Z",
        headers=headers,
    )

    assert r.status_code == 200
    *conteos, recientes = statements
    assert all("'Cola_Oncologia'" in sql for sql in conteos)
    assert "uploaded_by_id" in recientes and "Cola_Oncologia" not in recientes and "es_sistema" not in recientes
