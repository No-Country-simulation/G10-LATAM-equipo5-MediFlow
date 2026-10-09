# Workflow n8n — MediFlow

Workflow: [`MediFlow_unificado.json`](MediFlow_unificado.json) (webhook `POST /webhook/triaje-medico`).

## Flujo

```
Webhook ─► Preparar corrida ─► GET tipos activos ─► GET colas activas ─► ¿PDF o imagen?
   PDF con texto ──► Contexto para IA ─► ¿Con imagen? ─► Triaje e Extracción IA (texto)  ─┐
   imagen / PDF escaneado ─► Normalizador ─► Contexto para IA ─► Triaje IA Visión       ─┤
                                                                                         ▼
                       Armar IngestPayload ─► POST /documents/ingest ─► Formatear respuesta ─► Responder
```

1. **Preparar corrida** valida el token (`Authorization: Bearer`), el tipo (PDF/PNG/JPG) y el tamaño
   (≤ 10 MB) **antes** de llamar a la IA, y genera `documento_id` (`DOC-<uuid>`).
2. Los catálogos activos se leen del backend con el token del usuario: si el token es inválido el flujo
   se corta con 401 antes de gastar tokens del LLM.
3. **Contexto para IA** arma el prompt en un único lugar (lo usan los dos nodos LLM).
4. **Armar IngestPayload** nunca rellena con valores inventados: un dato faltante va `null`, y si falta el
   score, el paciente o el tipo/cola no existe, marca `requiere_auditoria_humana`.
5. **Formatear respuesta** devuelve al front el body del backend, o `{status: "error", etapa, detalle}`
   con el mismo código HTTP si el backend respondió error.

## Configuración

| Variable (contenedor n8n) | Para qué |
|---|---|
| `MEDIFLOW_API_BASE_URL` | URL del backend vista desde n8n (`http://host.docker.internal:8000` en local, `http://backend:8000` en `docker-compose.prod.yml`). **Nunca** se toma del request: si viniera del navegador, cualquiera podría desviar el token del usuario (y el gasto del LLM) a otro servidor. |
| `N8N_BLOCK_ENV_ACCESS_IN_NODE=false` | Permite leer la variable anterior desde el nodo Code. Si se deja bloqueado se usa el valor por defecto. |
| `EXECUTIONS_DATA_SAVE_ON_SUCCESS=none` | Las ejecuciones contienen el archivo en base64, el token y datos del paciente: no se guardan las exitosas. |

## Cómo importar

1. n8n → **Import from file** → `MediFlow_unificado.json`.
2. Asignar la credencial de Gemini en los dos nodos *Google Gemini Chat Model*.
3. Activar el workflow.

## Uso de tokens (por qué el prompt es así)

Todo lo que entra al prompt se paga en **cada** documento. Reglas aplicadas:

- **Catálogos en una línea por registro** (`- CODIGO (Nombre): descripción`), no JSON indentado. Cada tipo
  lleva solo su bloque de `detalle_clinico`, y solo se envían los tipos activos.
- **El LLM devuelve códigos** (`RECETA`, `Ficha_Clinica`), no nombres: sin mapeos rígidos en el código y
  sin documentos enviados a auditoría por un nombre mal escrito.
- **Salida mínima**: solo el bloque del tipo elegido (no 9 bloques en `null`), textos con largo máximo,
  `temperature: 0` y `maxOutputTokens: 4096`.
- **Texto del PDF normalizado y acotado**: se colapsan espacios y saltos de línea, y sobre 24.000
  caracteres se conserva el inicio y el final (`[...texto omitido...]`).
- **Prefijo estable**: instrucciones fijas → catálogos → documento al final. Así Gemini puede reutilizar
  la caché implícita del prefijo entre documentos.
- **Imágenes con la misma cadena simple** (no un nodo *Agent*), con el mismo prompt y catálogos.
- El base64 del archivo **nunca** pasa por la IA: lo agrega *Armar IngestPayload* al final.

Al cambiar un `codigo` semilla o su bloque, actualizar también `BLOQUES` en *Contexto para IA*
(es el mismo mapa que `BLOQUE_POR_TIPO` en `backend/app/features/documents/service.py`).
