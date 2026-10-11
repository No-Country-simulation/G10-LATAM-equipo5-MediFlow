# Workflow n8n — MediFlow

Workflow: [`MediFlow_unificado.json`](MediFlow_unificado.json) (webhook `POST /webhook/triaje-medico`).

Recibe el archivo desde el front, lo hace leer por **Gemini** con el catálogo vigente y envía el resultado al backend
(`POST /documents/ingest`). n8n **no decide** el estado final: el backend normaliza, calcula el score, busca
duplicados y aplica el triaje.

**Índice:** [Cómo importar](#cómo-importar) · [Flujo](#flujo) · [Qué pasa si algo falla](#qué-pasa-si-algo-falla) ·
[Configuración](#configuración) · [Editar el workflow](#editar-el-workflow) · [Logs](#logs-y-seguimiento) ·
[Uso de tokens](#uso-de-tokens-por-qué-el-prompt-es-así)

## Cómo importar

1. n8n (<http://localhost:5678>) → **Import from file** → `MediFlow_unificado.json`. Si ya existía, importarlo
   encima para reemplazarlo.
2. Crear una credencial **Google Gemini(PaLM) Api** con la llave de [Google AI Studio](https://aistudio.google.com/)
   y asignarla en los nodos **Gemini rápido** y **Gemini preciso**.
3. **Activar** el workflow.

> Cada vez que cambie `MediFlow_unificado.json` (o los archivos de `nodos/`), hay que volver a importarlo.

## Flujo

```
Webhook ─► Preparar corrida ─► GET formularios ─► GET colas activas ─► Contexto para IA
   ─► Gemini rápido ─► Interpretar respuesta rápida ─► ¿Escalar?
          sí ─► Gemini preciso ─► Interpretar respuesta precisa ─┐
          no ────────────────────────────────────────────────────┴─► Armar IngestPayload
   ─► POST /documents/ingest ─► Formatear respuesta ─► Responder
```

1. **Preparar corrida** valida el token, el tipo (PDF/PNG/JPG) y el tamaño (≤ 10 MB) **antes** de llamar
   a la IA, genera `documento_id` (`DOC-<uuid>`) y lee los modelos a usar.
2. **GET formularios** (`/catalogs/document-types/forms`) trae los tipos activos con sus campos: la misma
   fuente que usa el formulario de auditoría. Si el token es inválido, el flujo se corta con 401 aquí.
3. **Contexto para IA** arma el prompt (guía de clasificación, identificación del paciente de cualquier
   país, roles de los profesionales, reglas de CIE-10, prioridad y autoevaluación) y adjunta el archivo
   **tal cual**: Gemini lee PDF nativo (texto, tablas y escaneos) e imágenes, sin extracción de texto previa.
4. **Gemini rápido** llama a `generateContent` en modo JSON. **Interpretar respuesta rápida** decide si
   **escalar**: si la legibilidad o la certeza del tipo no son `alta`, hay campos dudosos, varios documentos
   en el archivo o la respuesta no sirve (error HTTP, JSON inválido o cortado), se repite con **Gemini
   preciso**. Si el preciso falla, se conserva la respuesta del rápido.
5. **Armar IngestPayload** arma el contrato v2 (con `evaluacion`, el modelo usado y si hubo escalamiento).
   Nunca rellena con valores inventados. El **backend** normaliza, valida y calcula el score.
6. **Formatear respuesta** devuelve al front el body del backend, o `{status: "error", etapa, detalle,
   request_id}` con el mismo código HTTP si el backend respondió error.

## Qué pasa si algo falla

| Situación | Resultado |
|---|---|
| Sin token, sin archivo, formato distinto de PDF/PNG/JPG o archivo de más de 10 MB | *Preparar corrida* corta el flujo **antes** de llamar a la IA (el front ya valida lo mismo antes de enviar) |
| Token inválido o vencido | *GET formularios* recibe `401` y el flujo se corta: no se gasta en la IA |
| Gemini rápido falla o devuelve un JSON inválido o cortado | Se escala a **Gemini preciso** |
| Los dos modelos fallan | Se ingiere igual como tipo `OTRO` con `requiere_auditoria_humana`: queda **pendiente de auditoría** con el motivo |
| El backend responde error (`400`, `409`, `422`, `500`) | *Formatear respuesta* devuelve `{status: "error", etapa, detalle, request_id}` con el mismo código; `etapa` es `AUTENTICACION` (401/403) o `INGESTA_BACKEND` |

Un archivo **repetido** no es un error de n8n: el front avisa antes de enviarlo y, si el usuario lo sube igual, el
backend lo deja en auditoría como posible duplicado.

## Configuración

| Variable (contenedor n8n) | Para qué |
|---|---|
| `MEDIFLOW_API_BASE_URL` | URL del backend vista desde n8n (`http://host.docker.internal:8000` en local, `http://backend:8000` en `docker-compose.prod.yml`). **Nunca** se toma del request: si viniera del navegador, cualquiera podría desviar el token del usuario (y el gasto del LLM) a otro servidor. |
| `GEMINI_MODELO_RAPIDO` | Modelo que procesa todos los documentos (por defecto `gemini-3.1-flash-lite`). |
| `GEMINI_MODELO_PRECISO` | Modelo para los documentos dudosos (por defecto `gemini-3.8-flash`). Si es igual al rápido, no se escala. Google renueva los IDs: ver [ai.google.dev/gemini-api/docs/models](https://ai.google.dev/gemini-api/docs/models). |
| `N8N_BLOCK_ENV_ACCESS_IN_NODE=false` | Permite leer las variables anteriores desde los nodos Code. Si se deja bloqueado se usan los valores por defecto. |
| `EXECUTIONS_DATA_SAVE_ON_SUCCESS=none` | Las ejecuciones contienen el archivo en base64, el token y datos del paciente: no se guardan las exitosas. |

Los nodos *Gemini rápido* y *Gemini preciso* usan la credencial **Google Gemini(PaLM) Api** (la misma que
usaban los nodos de chat): la llave viaja como parámetro `key` de la URL.

## Editar el workflow

El código de los nodos Code vive en [`nodos/`](nodos) (legible y versionable) y el script
[`construir_workflow.mjs`](construir_workflow.mjs) lo inserta en `MediFlow_unificado.json`:

```bash
node workflow/construir_workflow.mjs     # regenera MediFlow_unificado.json
node --test workflow/tests/nodos.test.mjs   # tests del código de los nodos
```

Los tests ejecutan cada nodo con los globales de n8n simulados (`$`, `$input`, `$env`) y fixtures de
formularios y colas generados desde el backend real. Si editas un nodo desde el editor de n8n, copia el
cambio al archivo de `nodos/` para no perderlo en la próxima regeneración.

## Logs y seguimiento

- El front envía un `request_id` en el formulario; *Preparar corrida* lo valida (o genera uno `n8n-...`) y
  las tres llamadas al backend lo mandan como header `X-Request-ID`. Así, buscando ese ID en el log del
  backend se ve toda la ingesta. Las respuestas de error al front también incluyen `request_id`.
- Logs del **servidor** n8n: `docker logs -f mediflow-n8n` y el archivo `/home/node/.n8n/logs/n8n.log`
  (volumen `n8n_data`, rotado). Nivel con `N8N_LOG_LEVEL`.
- Detalle de cada **ejecución**: editor → *Executions* (solo las fallidas, 72 h, por los datos de pacientes).

Guía completa: [`docs/LOGS.md`](../docs/LOGS.md).

## Uso de tokens (por qué el prompt es así)

Todo lo que entra al prompt se paga en **cada** documento. Reglas aplicadas:

- **Catálogos en una línea por registro** (`- CODIGO (Nombre): descripción`) y los campos de cada tipo en
  forma compacta (`bloque informe_imagenologico:{estudio_realizado,modalidad:(RX|TC|...),...}`), generados
  desde `GET /catalogs/document-types/forms`. Agregar o renombrar un campo se hace en el backend, no aquí.
- **El LLM devuelve códigos** (`RECETA`, `Ficha_Clinica`), no nombres.
- **Salida en modo JSON** (`responseMimeType: application/json`), `temperature: 0` y `maxOutputTokens:
  16384`, suficiente para un laboratorio de varias páginas sin que la respuesta quede cortada.
- **Prefijo estable**: instrucciones fijas → catálogos → archivo al final. Así Gemini puede reutilizar
  la caché implícita del prefijo entre documentos.
- **Escalamiento solo cuando hace falta**: el modelo preciso (más caro) se usa únicamente en los
  documentos que el rápido evaluó como dudosos.
- El base64 del archivo va a Gemini una vez por llamada y **nunca** se devuelve: *Armar IngestPayload*
  lo toma de *Preparar corrida*.
