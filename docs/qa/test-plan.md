# Plan e Informe Estratégico de QA — MediFlow MVP

**Especialista QA:** Saúl Ever Sánchez Mendoza (QA Functional Specialist)
**Fecha:** Septiembre 2026 · **Actualizado:** Octubre 2026 (alcance ampliado a áreas, detalle de documentos, corrección con historial y duplicados)
**Proyecto:** MediFlow — Agente Autónomo para Triaje Médico
**Ambiente local:** PostgreSQL 16 y n8n en Docker + FastAPI + React (Vite)

Documentos relacionados: [casos de prueba](test-cases.md) · [datos de prueba](test-data.md).

## 1. Alcance de la cobertura

| Módulo | Qué se valida |
|---|---|
| **Autenticación y RBAC** | Login, refresh token rotativo, logout y revocación, bloqueo tras 5 intentos fallidos, permisos de los 4 roles (`ADMIN`, `GESTOR_USUARIOS`, `AUDITOR_CLINICO`, `OPERADOR`) |
| **Usuarios y áreas** | CRUD de usuarios con área obligatoria, mantenedor de áreas, Smart Delete |
| **Catálogos dinámicos** | CRUD de tipos de documento y colas, lectura de activos, `campos_extraccion`, registros de sistema, historial |
| **Pipeline de triaje IA** | Ingesta (contrato v2), normalización de identificación y CIE-10, score de confianza calculado por el backend (umbral **0.85**), escalamiento al modelo preciso en n8n |
| **Duplicados** | Aviso previo por archivo idéntico (SHA-256) y marcado de posible duplicado por contenido; privacidad del OPERADOR |
| **Bandeja y detalle** | Listados con filtros, detalle con el documento original (URL pre-firmada), duplicados e historial |
| **Human-in-the-Loop** | Tomar caso, resolver con formulario por tipo, descartar; corrección posterior de documentos procesados o auditados con historial |
| **Persistencia** | Archivos y JSON en OCI Object Storage y datos en PostgreSQL, con compensación ante fallos |

## 2. Estrategia de pruebas

1. **Pruebas de contrato (API / esquemas):** validación de los esquemas Pydantic y de los códigos HTTP (`200`, `201`, `204`, `401`, `403`, `404`, `409`, `422`, `429`, `503`).
2. **Pruebas de límites (Boundary Value Testing):** comportamiento alrededor del umbral de confianza (**0.84 vs 0.85**), tamaño máximo de archivo (10 MB) y paginación (máximo 100).
3. **Pruebas E2E:** flujo Frontend → n8n → FastAPI → OCI/PostgreSQL, y flujos de auditoría y corrección en el navegador.
4. **Pruebas de seguridad funcional:** acceso por rol, documentos ajenos para el OPERADOR (`404`), datos de pacientes que no deben aparecer en avisos ni logs.

## 3. Cobertura automática existente

Antes de ejecutar los casos manuales conviene saber qué ya está cubierto por pruebas automáticas (columna *Automático* en [test-cases.md](test-cases.md)):

| Suite | Cantidad | Cómo ejecutarla |
|---|---|---|
| Backend (pytest, sin Postgres ni OCI) | ~300 pruebas | `cd backend && pytest` |
| Nodos del workflow de n8n (`node:test`) | 13 pruebas | `node --test workflow/tests/nodos.test.mjs` |
| Frontend (Vitest + Testing Library) | Servicios, hooks y páginas principales; además chequeo de tipos y lint | `cd frontend && npm test && npm run build && npm run lint` |

Las tres suites corren en cada push y PR a `main` (`.github/workflows/ci-cd.yml`).

Las pruebas automáticas usan base de datos y OCI simulados: los casos E2E de este plan siguen siendo necesarios para validar SQL real, OCI y Gemini.

## 4. Criterios de salida

- Todos los casos de prioridad alta (AUTH, TRI, HITL, COR, DUP) en estado **PASADO**.
- Ningún dato de paciente visible para un rol sin acceso (OPERADOR con documentos ajenos).
- Sin errores en la consola del navegador durante los flujos E2E.
