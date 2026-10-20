# Datos de Prueba — MediFlow MVP

**Especialista QA:** Saúl Ever Sánchez Mendoza
**Actualizado:** Octubre 2026

Datos para ejecutar los [casos de prueba](test-cases.md). **Todos son sintéticos.** Nunca usar documentos ni datos de pacientes reales en pruebas, capturas o reportes de bugs.

## Usuarios

Un usuario por rol, creado por `docker/postgres/seed_dev_users.sql`: ver la tabla en el [README principal](../../README.md#usuarios-de-prueba).

Para los casos de privacidad (`TC-DUP-003`, `TC-DOC-002`) hace falta un **segundo operador** de otra área: créalo desde *Usuarios* con el rol `OPERADOR`.

## Identificaciones

| Tipo | Válida | Inválida | Nota |
|---|---|---|---|
| RUT (Chile) | `12.345.678-5` | `12.345.678-9` | Dígito verificador |
| CPF (Brasil) | `111.444.777-35` | `111.444.777-36`, `111.111.111-11` | Dígitos repetidos también son inválidos |
| DNI (España) | `12345678Z` | `12345678A` | Letra de control |
| DNI (Argentina) | `30.123.456` | `123` | Sin dígito verificador; solo se valida el largo |
| CURP (México) | `GODE561231HDFRRN09` | `GODE561231` | Formato completo de 18 caracteres |
| Pasaporte / Cédula | `AB 123456` · `1-0234-0567` | — | Se normalizan sin validar dígito |

## CIE-10

| Entrada | Resultado |
|---|---|
| `j459`, `J45.9` | `J45.9` |
| `I10`, `R73.9`, `E87.0` | Se conservan |
| `XX9`, `12.3` | Se descartan (formato inválido) y bajan el score |

## Archivos

| Caso | Archivo | Resultado esperado |
|---|---|---|
| Formatos admitidos | PDF, PNG o JPG de hasta 10 MB | Se envía a n8n |
| Formato no admitido | `.exe`, `.docx`, `.gif` | El front lo rechaza antes de enviar |
| Tamaño máximo | Un PDF de más de 10 MB | El front lo rechaza ("supera el límite de 10 MB") |
| Duplicado exacto | Subir **dos veces el mismo archivo** (misma copia, sin modificarlo) | Aviso de archivo ya subido (`TC-DUP-001`) |
| Re-escaneo | Dos archivos **distintos** (por ejemplo, dos fotos o dos exportaciones) del mismo documento sintético | Posible duplicado por contenido (`TC-DUP-005`). Requiere la misma identificación, tipo y fecha, y la misma institución o diagnóstico |

## Payloads para el umbral

Para probar el umbral sin depender de Gemini, enviar el payload directo a `POST /api/v1/documents/ingest` (con el token de un usuario con permiso de ingesta). El score lo **calcula el backend** desde `evaluacion` (ver *Score de confianza* en [`backend/README.md`](../../backend/README.md#normalización-y-score)):

| Score esperado | `evaluacion` | Resto del payload |
|---|---|---|
| **0.95** (`PROCESADO`) | `{"certeza_tipo": "alta", "legibilidad": "alta"}` | Paciente con nombre e identificación válida, sin campos dudosos |
| **0.874** (`PROCESADO`) | `{"certeza_tipo": "alta", "legibilidad": "media"}` | Igual |
| **0.80** (`PENDIENTE_AUDITORIA`) | `{"certeza_tipo": "media", "legibilidad": "alta"}` | Igual |

Cada descuento (identificación inválida, CIE-10 inválido, campos dudosos, contenido faltante) baja el score y queda como motivo en `motivos_auditoria`. Para el límite exacto 0.84/0.85, las pruebas automáticas usan el contrato anterior, sin `evaluacion`, con `clasificacion.score_confianza_clasificacion` fijo (`tests/test_ingest_service.py`). Un ejemplo de payload completo está en [`backend/README.md`](../../backend/README.md#ingesta-contrato-v2).

## Documento de laboratorio con valor crítico

Para `TC-TRI-004`, un parámetro con `"critico": true` dentro de `detalle_clinico.examenes_y_laboratorio.paneles[].parametros[]` (por ejemplo, potasio `6.8 mEq/L`) debe elevar la prioridad a `Urgente`.
