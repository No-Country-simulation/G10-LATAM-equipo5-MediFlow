# Matriz Executable de Casos de Prueba (QA Test Suite)

## Módulo 1: Autenticación y Seguridad (AUTH)

| ID | Título del Caso | Precondiciones | Pasos de Ejecución | Resultado Esperado | Estado |
|---|---|---|---|---|---|
| `TC-AUTH-001` | Login Exitoso con Credenciales Válidas | Contenedor Postgres activo | 1. `POST /api/v1/auth/login` con `admin_user`/`admin123`. | HTTP `200 OK`, entrega de `access_token` JWT válido. | **PASADO** |
| `TC-AUTH-002` | Login Fallido por Contraseña Incorrecta | API activa | 1. `POST /api/v1/auth/login` con `admin_user`/`pass_erronea`. | HTTP `401 Unauthorized`, mensaje `"Usuario o contraseña incorrectos"`. | **PASADO** |
| `TC-AUTH-003` | Petición Protegida sin Encabezado Authorization | API activa | 1. `GET /api/v1/catalogs/queues/active` sin Bearer Token. | HTTP `401 Unauthorized` o `403 Forbidden`. | **PASADO** |

---

## Módulo 2: Catálogos y Tablas Maestras (CAT)

| ID | Título del Caso | Precondiciones | Pasos de Ejecución | Resultado Esperado | Estado |
|---|---|---|---|---|---|
| `TC-CAT-001` | Consulta de Colas Activas | Token Bearer de `ADMIN` | 1. `GET /api/v1/catalogs/queues/active`. | HTTP `200 OK`, retorna lista JSON con las 6 colas semilla (`Cola_Emergencia_Medica`, `Cola_Oncologia`, etc.). | **PASADO** |
| `TC-CAT-002` | Desactivación Dinámica de Cola por Admin | Token Bearer de `ADMIN` | 1. `DELETE /api/v1/catalogs/queues/{id}`.<br>2. Reconsultar `/active`. | La cola pasa a inactiva y desaparece del catálogo expuesto para n8n (*Smart Delete*). | **PENDIENTE** |

---

## Módulo 3: Triaje IA, Límites y HITL (TRI)

| ID | Título del Caso | Precondiciones | Pasos de Ejecución | Resultado Esperado | Estado |
|---|---|---|---|---|---|
| `TC-TRI-001` | Triaje Alta Confianza ($\ge 0.85$) | Archivo legible e ingesta enviada | 1. Documento procesado con `confidence = 0.88`. | Estado `PROCESADO`, guardado en `procesados/<prioridad>/<id>.json`. | **DISEÑADO** |
| `TC-TRI-002` | Boundary Test — Límite Inf. ($0.84$) | Archivo con ligera ambigüedad | 1. Documento procesado con `confidence = 0.84`. | Estado `PENDIENTE_AUDITORIA`, enrutado a bandeja de auditoría. | **DISEÑADO** |
| `TC-TRI-003` | Boundary Test — Límite Sup. ($0.85$) | Archivo claro | 1. Documento procesado con `confidence = 0.85`. | Estado `PROCESADO`, aprobación directa sin intervención humana. | **DISEÑADO** |
| `TC-TRI-004` | Detección de Urgencia Crítica | Documento con hallazgo de TEP o valor crítico | 1. Se procesa documento urgente. | `priority` = "Urgente", `routing_queue` = "Cola_Emergencia_Medica", dispara alerta a guardia. | **DISEÑADO** |