"""Roles de usuario admitidos en MediFlow."""

from enum import Enum


class UserRole(str, Enum):
    """Rol asignado a un usuario, usado para control de acceso (RBAC)."""

    ADMIN = "ADMIN"
    GESTOR_USUARIOS = "GESTOR_USUARIOS"
    AUDITOR_CLINICO = "AUDITOR_CLINICO"
