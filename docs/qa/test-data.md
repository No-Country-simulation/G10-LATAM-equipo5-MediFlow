# Matriz de Casos de Prueba (QA Test Suite) — MediFlow MVP

**Proyecto:** MediFlow  
**Especialista QA:** Saúl Ever Sánchez Mendoza  
**Fecha de actualización:** Septiembre 2026  
**Ambiente:** Local (Docker PostgreSQL + FastAPI)

---

## Leyenda de Estados
- 🟢 **PASADO**: Caso ejecutado con éxito.
- 🔴 **FALLADO**: Se detectó un bug o comportamiento no esperado.
- 🟡 **PENDIENTE**: Caso diseñado, listo para ejecutarse cuando el módulo/integración esté disponible.

---

## Módulo 1: Autenticación y Control de Acceso (AUTH)

| ID | Título del Caso | Precondiciones | Pasos de Ejecución | Resultado Esperado | Estado |
|---|---|---|---|---|---|
| `TC-AUTH-001` | Login exitoso con usuario administrador | Base de datos iniciada (`init.sql`) | 1. Hacer `POST /api/v1/auth/login` enviando `admin_user` y `admin123`. | HTTP `200 OK`, retorna `access_token` JWT y objeto de usuario. | 🟢 **PASADO** |
| `TC-AUTH-002` | Login fallido con credenciales incorrectas | Servidor backend activo | 1. Hacer `POST /api/v1/auth/login` con contraseña errónea. | HTTP `401 Unauthorized`, mensaje de error claro. | 🟢 **PASADO** |
| `TC-AUTH-003` | Rechazo de acceso a endpoint protegido sin token | Backend activo | 1. Consultar `GET /api/v1/catalogs/queues/active` sin Bearer Token. | HTTP `401 Unauthorized` o `403 Forbidden`. | 🟢 **PASADO** |
| `TC-AUTH-004` | Cierre de sesión y revocación de token | Token válido activo | 1. Hacer `POST /api/v1/auth/logout`. <br> 2. Reintentar petición usando el mismo token. | HTTP `200 OK` en logout y `401 Unauthorized` al reintentar. | 🟡 **PENDIENTE** |

---

## Módulo 2: Catálogos y Tablas Maestras (CAT)

| ID | Título del Caso | Precondiciones | Pasos de Ejecución | Resultado Esperado | Estado |
|---|---|---|---|---|---|
| `TC-CAT-001` | Consulta de colas de enrutamiento activas | Token JWT de `ADMIN` | 1. Hacer `GET /api/v1/catalogs/queues/active`. | HTTP `200 OK`, lista JSON con las 6 colas semilla (Urgencias, Oncología, etc.). | 🟢 **PASADO** |
| `TC-CAT-002` | Consulta de tipos de documento activos | Token JWT de `ADMIN` | 1. Hacer `GET /api/v1/catalogs/document-types/active`. | HTTP `200 OK`, lista JSON con los 9 tipos de documento semilla. | 🟡 **PENDIENTE** |
| `TC-CAT-003` | Desactivación dinámica de catálogo (*Smart Delete*) | Rol `ADMIN` activo | 1. Hacer `DELETE /api/v1/catalogs/queues/{id}`. <br> 2. Consultar `/active`. | La cola seleccionada cambia a inactiva y no aparece en la lista para n8n. | 🟡 **PENDIENTE** |

---

## Módulo 3: Ingesta, Triaje IA y Boundary Testing (TRI)

| ID | Título del Caso | Precondiciones | Pasos de Ejecución | Resultado Esperado | Estado |
|---|---|---|---|---|---|
| `TC-TRI-001` | Triaje con Alta Confianza ($\ge 0.85$) | Workflow n8n y API listos | 1. Enviar PDF/Imagen legible de receta médica. | Estado `PROCESADO`, guardado en OCI en `procesados/<prioridad>/<id>.json`. | 🟡 **PENDIENTE** |
| `TC-TRI-002` | Boundary Test — Confianza en Límite Inferior ($0.84$) | Imagen con ligera ambigüedad | 1. Simular respuesta de IA con `confidence = 0.84`. | Estado `PENDIENTE_AUDITORIA`, enrutado a bandeja de revisión humana (HITL). | 🟡 **PENDIENTE** |
| `TC-TRI-003` | Boundary Test — Confianza en Límite Superior ($0.85$) | Documento claro | 1. Simular respuesta de IA con `confidence = 0.85`. | Estado `PROCESADO`, aprobación automática directa sin auditoría. | 🟡 **PENDIENTE** |
| `TC-TRI-004` | Detección de Urgencia Crítica | Documento con diagnóstico crítico | 1. Enviar informe con hallazgo grave (ej. TEP o Potasio > 6.5). | `priority` = "Urgente", `routing_queue` = "Cola_Emergencia_Medica". | 🟡 **PENDIENTE** |
| `TC-TRI-005` | Rechazo de archivo corrupto o no soportado | Backend activo | 1. Intentar ingesta de archivo `.exe` o PDF dañado. | HTTP `422 Validation Error` o `400 Bad Request`. | 🟡 **PENDIENTE** |

---

## Módulo 4: Bandeja de Auditoría Human-in-the-Loop (HITL)

| ID | Título del Caso | Precondiciones | Pasos de Ejecución | Resultado Esperado | Estado |
|---|---|---|---|---|---|
| `TC-HITL-001` | Consulta de bandeja por auditor | Token de `AUDITOR_CLINICO` | 1. Hacer `GET /api/v1/audit/pending`. | HTTP `200 OK`, muestra lista de documentos con `PENDIENTE_AUDITORIA`. | 🟡 **PENDIENTE** |
| `TC-HITL-002` | Resolución y corrección manual de auditoría | Caso en pendiente | 1. Hacer `PUT /api/v1/audit/{id}/resolve` corrigiendo la cola o prioridad. | Estado pasa a `AUDITADO`, el JSON en OCI se guarda en `procesados/auditados/`. | 🟡 **PENDIENTE** |