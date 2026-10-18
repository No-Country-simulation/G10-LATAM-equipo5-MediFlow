"""Alcance documental por rol: qué documentos puede ver cada usuario.

Un OPERADOR ve los documentos que subió, los derivados a sus colas asistenciales asignadas y los
de las colas de sistema (Ficha Clínica, el destino por defecto, que no se asigna a nadie);
ADMIN y AUDITOR_CLINICO ven todos. Se usa en la bandeja, el detalle y el inicio, para que la
regla sea la misma en todas las vistas.
"""

from sqlalchemy import ColumnElement, or_, select

from app.features.auth.enums import UserRole
from app.features.auth.models import User
from app.features.catalogs.models import RoutingQueue
from app.features.documents.models import ClinicalDocument


def assigned_queue_codes(user: User) -> list[str]:
    """Códigos de las colas asistenciales asignadas al usuario (las de su Consola de Triaje)."""
    return [q.codigo for q in user.colas if q.es_asistencial]


def own_uploads_condition(user: User) -> ColumnElement[bool]:
    """Documentos subidos por el usuario."""
    return ClinicalDocument.uploaded_by_id == user.id


def system_queues_condition() -> ColumnElement[bool]:
    """Documentos de las colas de sistema, visibles para todos (subconsulta: sin ida extra a la base)."""
    return ClinicalDocument.destino_enrutamiento.in_(
        select(RoutingQueue.codigo).where(RoutingQueue.es_sistema.is_(True))
    )


def visible_documents_condition(user: User) -> ColumnElement[bool] | None:
    """Condición SQL con los documentos que ve `user`, o `None` si ve todos."""
    if user.role != UserRole.OPERADOR:
        return None
    condiciones = [own_uploads_condition(user), system_queues_condition()]
    colas = assigned_queue_codes(user)
    if colas:
        condiciones.append(ClinicalDocument.destino_enrutamiento.in_(colas))
    return or_(*condiciones)
