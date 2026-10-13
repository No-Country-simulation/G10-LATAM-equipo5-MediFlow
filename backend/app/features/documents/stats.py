"""Resumen del inicio (dashboard): conteos agregados en la base de datos y listas de trabajo por rol.

Los conteos se calculan con `GROUP BY` en PostgreSQL, así que no dependen de cuántos documentos
traiga la bandeja paginada.
"""

from datetime import date, datetime, timedelta

from sqlalchemy import Date, Interval, cast, func, literal, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import noload

from app.features.auth.enums import UserRole
from app.features.auth.models import User
from app.features.documents.models import ESTADO_ELIMINADO, ClinicalDocument
from app.features.documents.schemas import (
    ConteoDestino,
    DashboardStatsResponse,
    DashboardTotales,
    DocumentListItemResponse,
    IngresosDia,
)

ESTADO_PENDIENTE = "PENDIENTE_AUDITORIA"
ESTADOS_RESUELTOS = ("PROCESADO", "AUDITADO")
LIMITE_LISTA = 5
_CLAVE_PRIORIDAD = {"Urgente": "urgente", "Prioritario": "prioritario", "Rutina": "rutina"}
_CLAVE_ESTADO = {"PROCESADO": "procesados", "AUDITADO": "auditados", "DESCARTADO": "descartados"}


def _dia_local(utc_offset_min: int):
    """Fecha de ingreso en la hora local del usuario (`created_at` UTC + su desfase)."""
    desfase = literal(timedelta(minutes=utc_offset_min), Interval)
    return cast(func.timezone("UTC", ClinicalDocument.created_at) + desfase, Date)


async def _listar(db: AsyncSession, *conditions, order_by) -> list[DocumentListItemResponse]:
    result = await db.execute(
        select(ClinicalDocument)
        .options(
            noload(ClinicalDocument.attachments),
            noload(ClinicalDocument.medications),
            noload(ClinicalDocument.lab_panels),
            noload(ClinicalDocument.procedures),
        )
        .where(*conditions)
        .order_by(order_by)
        .limit(LIMITE_LISTA)
    )
    return [DocumentListItemResponse.model_validate(doc) for doc in result.scalars().all()]


def _dias_del_periodo(desde: date, hasta: date) -> list[date]:
    return [desde + timedelta(days=i) for i in range((hasta - desde).days + 1)]


async def get_dashboard_stats(
    db: AsyncSession,
    user: User,
    fecha_desde: datetime,
    fecha_hasta: datetime,
    utc_offset_min: int = 0,
) -> DashboardStatsResponse:
    """KPIs y series del período, más las listas de trabajo que corresponden al rol del usuario.

    Un OPERADOR solo cuenta y ve los documentos que subió.
    """
    # Los eliminados no cuentan en ningún número ni lista del inicio.
    alcance = [ClinicalDocument.estado != ESTADO_ELIMINADO]
    if user.role == UserRole.OPERADOR:
        alcance.append(ClinicalDocument.uploaded_by_id == user.id)
    periodo = [
        *alcance,
        ClinicalDocument.created_at >= fecha_desde,
        ClinicalDocument.created_at <= fecha_hasta,
    ]
    dia = _dia_local(utc_offset_min)

    por_dia_result = await db.execute(
        select(dia, ClinicalDocument.nivel_prioridad, func.count(ClinicalDocument.id))
        .where(*periodo)
        .group_by(dia, ClinicalDocument.nivel_prioridad)
    )
    desfase = timedelta(minutes=utc_offset_min)
    serie = {
        d: IngresosDia(fecha=d)
        for d in _dias_del_periodo((fecha_desde + desfase).date(), (fecha_hasta + desfase).date())
    }
    totales = DashboardTotales()
    for fecha, prioridad, cantidad in por_dia_result.all():
        clave = _CLAVE_PRIORIDAD.get(prioridad)
        if clave is None:
            continue
        if fecha in serie:
            setattr(serie[fecha], clave, getattr(serie[fecha], clave) + cantidad)
        setattr(totales, clave, getattr(totales, clave) + cantidad)

    por_estado_result = await db.execute(
        select(ClinicalDocument.estado, func.count(ClinicalDocument.id))
        .where(*periodo)
        .group_by(ClinicalDocument.estado)
    )
    for estado, cantidad in por_estado_result.all():
        totales.total += cantidad
        clave = _CLAVE_ESTADO.get(estado)
        if clave is not None:
            setattr(totales, clave, cantidad)

    por_destino_result = await db.execute(
        select(ClinicalDocument.destino_enrutamiento, func.count(ClinicalDocument.id))
        .where(*periodo)
        .group_by(ClinicalDocument.destino_enrutamiento)
        .order_by(func.count(ClinicalDocument.id).desc())
    )
    por_destino = [ConteoDestino(destino=d, total=t) for d, t in por_destino_result.all()]

    pendientes_result = await db.execute(
        select(func.count(ClinicalDocument.id)).where(*alcance, ClinicalDocument.estado == ESTADO_PENDIENTE)
    )
    totales.pendientes_auditoria = pendientes_result.scalar_one()

    response = DashboardStatsResponse(
        fecha_desde=fecha_desde,
        fecha_hasta=fecha_hasta,
        totales=totales,
        por_dia=list(serie.values()),
        por_destino=por_destino,
    )

    if user.role == UserRole.OPERADOR:
        response.recientes = await _listar(db, *alcance, order_by=ClinicalDocument.created_at.desc())
        return response

    response.mis_casos = await _listar(
        db,
        ClinicalDocument.estado == ESTADO_PENDIENTE,
        ClinicalDocument.asignado_a_id == user.id,
        order_by=ClinicalDocument.asignado_at.asc(),
    )
    # Los más antiguos primero: son los que llevan más tiempo esperando revisión.
    response.pendientes_auditoria = await _listar(
        db, ClinicalDocument.estado == ESTADO_PENDIENTE, order_by=ClinicalDocument.created_at.asc()
    )
    response.urgentes = await _listar(
        db,
        *periodo,
        ClinicalDocument.nivel_prioridad == "Urgente",
        ClinicalDocument.estado.in_(ESTADOS_RESUELTOS),
        order_by=ClinicalDocument.created_at.desc(),
    )
    return response
