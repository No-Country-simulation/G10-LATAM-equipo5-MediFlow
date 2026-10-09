# Plan e Informe Estratégico de QA — MediFlow MVP

**Especialista QA:** Saúl Ever Sánchez Mendoza (QA Functional Specialist)
**Fecha:** Septiembre 2026
**Proyecto:** MediFlow — Agente Autónomo para Triaje Médico
**Estado del Ambiente Local:** Operativo (PostgreSQL 16 en Docker + FastAPI Local)

## 1. Alcance de la Cobertura (Scope)
- **Autenticación y RBAC:** Validación de roles (`ADMIN`, `GESTOR_USUARIOS`, `AUDITOR_CLINICO`) y revocación de tokens JWT.
- **Catálogos Dinámicos:** Gestión CRUD y lectura de opciones activas (`/catalogs/queues` y `/catalogs/document-types`).
- **Pipeline de Triaje IA:** Ingesta multimodal, validación de contrato JSON, y cálculo de score de confianza ($Threshold \ge 0.85$).
- **Flujo Human-in-the-Loop (HITL):** Enrutamiento a la bandeja de auditoría para casos dudosos ($< 0.85$) y resolución manual.
- **Persistencia Segregada:** Almacenamiento de archivos y JSONs estructurados en OCI Object Storage y PostgreSQL.

## 2. Estrategia de Pruebas Aplicada
1. **Pruebas de Contrato (API / Schemas):** Validación estricta de esquemas Pydantic y códigos de respuesta HTTP (200, 401, 422, 503).
2. **Pruebas de Límites (Boundary Value Testing):** Evaluación del comportamiento alrededor del umbral crítico de confianza ($0.84$ vs $0.85$).
3. **Pruebas E2E (End-to-End):** Flujo completo Front-end $\rightarrow$ n8n Workflow $\rightarrow$ FastAPI Backend $\rightarrow$ OCI/PostgreSQL.