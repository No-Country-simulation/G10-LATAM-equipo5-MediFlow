# Matriz de Casos de Prueba (QA Test Suite) — MediFlow MVP

**Proyecto:** MediFlow
**Especialista QA:** Saúl Ever Sánchez Mendoza
**Fecha:** Septiembre 2026 · **Actualizado:** Octubre 2026
**Ambiente:** Local (Docker PostgreSQL + n8n, FastAPI, React)

Plan: [test-plan.md](test-plan.md) · Datos: [test-data.md](test-data.md)

## Leyenda

- 🟢 **PASADO**: ejecutado con éxito por QA.
- 🔴 **FALLADO**: se detectó un bug o un comportamiento no esperado.
- 🟡 **PENDIENTE**: diseñado, listo para ejecutarse.
- **Automático**: prueba automática del repositorio que cubre el mismo comportamiento (no reemplaza la ejecución manual del caso).

---

## Módulo 1: Autenticación y Control de Acceso (AUTH)
| ID | Caso | Precondiciones | Pasos | Resultado esperado | Estado | Automático |
|---|---|---|---|---|---|---|
| `TC-AUTH-001` | Login exitoso | Base iniciada | `POST /api/v1/auth/login` con `admin_user` / `admin123` | `200`, `access_token`, `refresh_token` y objeto de usuario con su área | 🟢 **PASADO** | `test_auth_api.py` |
| `TC-AUTH-002` | Login con contraseña incorrecta | Backend activo | `POST /auth/login` con contraseña errónea | `401` con mensaje claro | 🟢 **PASADO** | `test_auth_api.py` |
| `TC-AUTH-003` | Endpoint protegido sin token | Backend activo | `GET /catalogs/queues/active` sin Bearer | `401` | 🟢 **PASADO** | `test_auth_api.py` |
| `TC-AUTH-004` | Logout y revocación | Token válido | 1. `POST /auth/logout` · 2. Reintentar con el mismo token | `204` en el logout y `401` al reintentar | 🟢 **PASADO** | `test_auth_api.py` |
| `TC-AUTH-005` | Renovación con refresh token | Login hecho | 1. `POST /auth/refresh` con el refresh token · 2. Repetir con el **mismo** refresh token | 1: `200` con un par nuevo · 2: `401` (es de un solo uso) | 🟢 **PASADO** | `test_auth_api.py` |
| `TC-AUTH-006` | Bloqueo por intentos fallidos | Backend activo | 5 logins fallidos seguidos del mismo usuario y luego uno correcto | `429` durante 15 minutos, incluso con la contraseña correcta | 🟡 **PENDIENTE** | `test_hardening.py` |
| `TC-AUTH-007` | Menú por rol | Usuarios de prueba | Iniciar sesión con cada rol | ADMIN: todo · AUDITOR: sin Usuarios ni Catálogos · OPERADOR: *Mis Documentos*, sin Auditoría · GESTOR: Usuarios y Catálogos (solo Áreas) | 🟡 **PENDIENTE** | — |

## Módulo 2: Usuarios y Áreas (USR)
| ID | Caso | Precondiciones | Pasos | Resultado esperado | Estado | Automático |
|---|---|---|---|---|---|---|
| `TC-USR-001` | Crear usuario con área | Rol `ADMIN` o `GESTOR_USUARIOS` | `POST /users` con `area_id` de un área activa | `201`, el usuario aparece con su área | 🟢 **PASADO** | `test_auth_api.py` |
| `TC-USR-002` | Crear usuario sin área | Rol `ADMIN` | `POST /users` sin `area_id` | `422` | 🟢 **PASADO** | `test_auth_api.py` |
| `TC-USR-003` | GESTOR no puede otorgar ADMIN | Rol `GESTOR_USUARIOS` | Crear o editar un usuario con rol `ADMIN` | `403` | 🟢 **PASADO** | `test_auth_api.py` |
| `TC-USR-004` | Smart Delete de un usuario con actividad | Usuario que subió documentos | `DELETE /users/{id}` | Se desactiva (`SOFT_DELETE`) en vez de borrarse | 🟢 **PASADO** | `test_auth_api.py` |
| `TC-USR-005` | Área de origen del documento | Operador del área *Admisión* | Subir un documento | El documento muestra área de origen *Admisión y Recepción* | 🟡 **PENDIENTE** | `test_document_detail_api.py` |

## Módulo 3: Catálogos y Tablas Maestras (CAT)

| ID | Caso | Precondiciones | Pasos | Resultado esperado | Estado | Automático |
|---|---|---|---|---|---|---|
| `TC-CAT-001` | Colas activas | Token válido | `GET /catalogs/queues/active` | `200` con las 6 colas semilla | 🟢 **PASADO** | `test_catalogs_api.py` |
| `TC-CAT-002` | Tipos de documento activos | Token válido | `GET /catalogs/document-types/active` | `200` con los **13** tipos semilla | 🟢 **PASADO** | `test_catalogs_api.py` |
| `TC-CAT-003` | Smart Delete de una cola | Rol `ADMIN`, cola sin documentos | 1. `DELETE /catalogs/queues/{id}` · 2. Consultar `/active` | `HARD_DELETE`; con documentos asociados, `SOFT_DELETE`. En ambos casos sale de `/active` | 🟢 **PASADO** | `test_catalogs_api.py` |
| `TC-CAT-004` | Registro de sistema protegido | Rol `ADMIN` | `DELETE` del tipo `OTRO` o la cola `Ficha_Clinica` | `409` | 🟢 **PASADO** | `test_catalogs_api.py` |
| `TC-CAT-005` | Código inmutable y único | Rol `ADMIN` | Crear un tipo con un `codigo` existente | `409` | 🟢 **PASADO** | `test_catalogs_api.py` |
| `TC-CAT-006` | Historial de cambios | Rol `ADMIN` | Editar la descripción de una cola y consultar `/{id}/history` | Entrada con el campo, su valor anterior y el nuevo | 🟢 **PASADO** | `test_catalogs_api.py` |

## Módulo 4: Ingesta y Triaje IA (TRI)

| ID | Caso | Precondiciones | Pasos | Resultado esperado | Estado | Automático |
|---|---|---|---|---|---|---|
| `TC-TRI-001` | Triaje con alta confianza | n8n y API listos | Subir un PDF legible de una receta vía `POST /webhook/triaje-medico` con Bearer JWT | `PROCESADO`, JSON en `procesados/<prioridad>/<id>.json`. *(En entorno dev sin credenciales OCI, el backend valida la extracción de Gemini y ataja el error de almacenamiento devolviendo `{"etapa":"INGESTA_BACKEND","detalle":"No fue posible almacenar los archivos..."}`)* | 🟢 **PASADO** | `test_ingest_service.py` |
| `TC-TRI-002` | Límite inferior (score 0.84) | API lista | Enviar a `/documents/ingest` un payload cuyo score calculado sea 0.84 (ver [datos](test-data.md#payloads-para-el-umbral)) | `PENDIENTE_AUDITORIA` con el motivo del score | 🟢 **PASADO** | `test_ingest_service.py` |
| `TC-TRI-003` | Límite superior (score 0.85) | API lista | Igual, con score calculated 0.85 | `PROCESADO` | 🟢 **PASADO** | `test_ingest_service.py` |
| `TC-TRI-004` | Valor crítico de laboratorio | Laboratorio con un parámetro marcado `critico` | Ingerir el documento | Prioridad elevada a `Urgente` | 🟢 **PASADO** | `test_ingest_service.py` |
| `TC-TRI-005` | Archivo no soportado | Front activo | Elegir un `.exe` o un archivo de más de 10 MB | El front lo rechaza antes de enviarlo; por API, `422` o `400` | 🟡 **PENDIENTE** | `test_documents_api.py` |
| `TC-TRI-006` | Identificación con dígito verificador inválido | API lista | Ingerir con RUT `12.345.678-9` | Queda en auditoría con el motivo `Identificación RUT con formato o dígito verificador inválido` | 🟢 **PASADO** | `test_ingest_service.py` |
| `TC-TRI-007` | Identificación de otro país | API lista | Ingerir con DNI, CPF o CURP válidos | Se normaliza sin descontar score | 🟢 **PASADO** | `test_normalization.py` |

## Módulo 5: Duplicados (DUP)

| ID | Caso | Precondiciones | Pasos | Resultado esperado | Estado | Automático |
|---|---|---|---|---|---|---|
| `TC-DUP-001` | Aviso de archivo ya subido | Un documento ya ingerido | Elegir el **mismo** archivo en *Procesar Documento IA* | Aviso "Este archivo ya fue subido antes" con fecha, ID y *Ver documento*; el botón dice *Subir igual*; **no** se llama a n8n hasta confirmar | 🟡 **PENDIENTE** | `test_duplicates.py` |
| `TC-DUP-002` | Carga rápida del Inicio | Igual | Soltar el mismo archivo en el dropzone del Inicio | No se envía solo: muestra el aviso con *Subir igual* y *Cancelar* | 🟡 **PENDIENTE** | — |
| `TC-DUP-003` | Privacidad del OPERADOR | Documento subido por otro usuario | Un OPERADOR elige ese mismo archivo | Aviso "Ya lo subió el área X el (fecha)", **sin** ID ni datos del paciente | 🟡 **PENDIENTE** | `test_duplicates.py` |
| `TC-DUP-004` | Subir igual un archivo idéntico | TC-DUP-001 | Pulsar *Subir igual* | Queda en auditoría con el motivo "Archivo idéntico a otro documento ya registrado" y el detalle muestra el original | 🟡 **PENDIENTE** | `test_duplicates.py` |
| `TC-DUP-005` | Re-escaneo del mismo documento | Documento ingerido | Subir otro archivo (otra foto) con el mismo paciente, tipo y fecha | Queda en auditoría como "Posible duplicado: mismo paciente, tipo y fecha" con enlace al original | 🟡 **PENDIENTE** | `test_duplicates.py` |

## Módulo 6: Bandeja y Detalle (DOC)

| ID | Caso | Precondiciones | Pasos | Resultado esperado | Estado | Automático |
|---|---|---|---|---|---|---|
| `TC-DOC-001` | Filtros de la bandeja | Varios documentos | `GET /documents` con `estado`, `prioridad`, `destino` e `identificacion` | Solo los que cumplen todos los filtros | 🟡 **PENDIENTE** | `test_documents_api.py` |
| `TC-DOC-002` | OPERADOR ve lo suyo y sus colas | Documentos de otro usuario: uno derivado a una cola del OPERADOR y otro a una cola ajena | Como OPERADOR: listar y abrir ambos por su ID | Lista y abre el de su cola; el de la cola ajena no aparece y su detalle responde `404` | 🟡 **PENDIENTE** | `test_visibility.py` |
| `TC-DOC-003` | Detalle desde cualquier listado | Documentos procesados | Clic en una tarjeta de Inicio, Triaje y Expedientes (kanban y lista) | Se abre a pantalla completa con el original y los datos; Escape lo cierra | 🟡 **PENDIENTE** | — |
| `TC-DOC-004` | Detalle si OCI falla | OCI caído | Abrir el detalle | Los datos se muestran igual, con un aviso de que el archivo no está disponible | 🟡 **PENDIENTE** | `test_document_detail_api.py` |

## Módulo 7: Auditoría Human-in-the-Loop (HITL)

| ID | Caso | Precondiciones | Pasos | Resultado esperado | Estado | Automático |
|---|---|---|---|---|---|---|
| `TC-HITL-001` | Bandeja del auditor | Token de `AUDITOR_CLINICO` | `GET /api/v1/documents?estado=PENDIENTE_AUDITORIA` (pantalla *Auditoría*) | `200` con los casos pendientes, sus motivos y quién los tiene tomados | 🟡 **PENDIENTE** | `test_documents_api.py` |
| `TC-HITL-002` | Resolver con corrección | Caso pendiente | Abrir *Revisar*, corregir y `PUT /audit/{id}/resolve` con notas | `AUDITADO`, JSON en `procesados/auditados/` y una entrada **Auditoría** en el historial | 🟡 **PENDIENTE** | `test_audit_api.py` |
| `TC-HITL-003` | Formulario según el tipo | Caso pendiente | Cambiar el tipo a *Certificado / Licencia Médica* | Aparecen sus campos, con opciones legibles ("Licencia Médica", sin guiones bajos); al volver al tipo original se recupera su bloque | 🟡 **PENDIENTE** | — |
| `TC-HITL-004` | Validaciones al resolver | Caso pendiente | Resolver con RUT inválido o sin diagnóstico principal | `422` con la lista de problemas | 🟡 **PENDIENTE** | `test_audit_api.py` |
| `TC-HITL-005` | Caso tomado por otro auditor | Caso tomado por el auditor A | El auditor B intenta resolverlo | `409` "en revisión por A" | 🟡 **PENDIENTE** | `test_audit_api.py` |
| `TC-HITL-006` | Descartar | Caso pendiente | `PUT /audit/{id}/discard` con motivo | `DESCARTADO`, JSON en `descartados/` | 🟡 **PENDIENTE** | `test_audit_api.py` |

## Módulo 8: Corrección posterior e Historial (COR)

| ID | Caso | Precondiciones | Pasos | Resultado esperado | Estado | Automático |
|---|---|---|---|---|---|---|
| `TC-COR-001` | Corregir un documento procesado | Documento `PROCESADO`, rol `AUDITOR_CLINICO` | En el detalle: *Corregir*, cambiar la edad, escribir la justificación y guardar | "Corrección guardada"; el detalle muestra el valor nuevo y el historial "Paciente › Edad (años): 36 → 37" | 🟡 **PENDIENTE** | `test_document_correction_api.py` |
| `TC-COR-002` | Corrección sin cambios | Igual | Guardar sin modificar nada | `422` "La corrección no modifica ningún valor del documento" | 🟡 **PENDIENTE** | `test_document_correction_api.py` |
| `TC-COR-003` | Re-enrutamiento al corregir | Igual | Cambiar el destino a *Urgencias* | El documento conserva su estado y aparece en la nueva cola | 🟡 **PENDIENTE** | `test_document_correction_api.py` |
| `TC-COR-004` | Roles y estados permitidos | Documentos en distintos estados | OPERADOR abre un detalle; ADMIN intenta corregir uno pendiente o descartado | OPERADOR no ve *Corregir*; `PUT` de un OPERADOR → `403`; pendiente o descartado → `409` | 🟡 **PENDIENTE** | `test_document_correction_api.py` |
| `TC-COR-005` | Justificación obligatoria | Formulario de corrección | Guardar sin justificación | El formulario no se envía | 🟡 **PENDIENTE** | `test_document_correction_api.py` |
