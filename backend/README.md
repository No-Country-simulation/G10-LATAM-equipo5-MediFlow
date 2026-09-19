# MediFlow API — Backend

Backend de **MediFlow** construido con **FastAPI** siguiendo una **Arquitectura por Feature (Vertical Slice Architecture)**.

## Estructura del proyecto

```
backend/
├── app/
│   ├── main.py                # Instancia de FastAPI, CORS y registro de routers
│   ├── core/                  # Configuración transversal (settings, base de datos)
│   ├── shared/                # Clientes y utilidades compartidas entre features (OCI, etc.)
│   └── features/              # Features verticales (cada una con su schemas/service/router)
│       └── health/            # Diagnóstico y salud de la API
├── .env.example
├── requirements.txt
└── README.md
```

## Requisitos previos

- Python 3.11 o superior
- PostgreSQL en ejecución (local o remoto)
- Credenciales de Oracle Cloud Infrastructure (OCI) con acceso a un bucket de Object Storage

## Instalación local

1. Crear y activar un entorno virtual:

   ```powershell
   # Windows (PowerShell) — usa el lanzador "py", no "python"
   py -3.12 -m venv .venv
   .venv\Scripts\Activate.ps1
   ```

   ```bash
   # Linux / macOS
   python3 -m venv .venv
   source .venv/bin/activate
   ```

   > En Windows, `python`/`pip` suelen no estar en el PATH salvo que se hayan agregado manualmente durante la instalación. El [launcher `py`](https://docs.python.org/3/using/windows.html#launcher) viene incluido con cualquier instalación oficial de Python y siempre está disponible. Usa `py -0p` para listar las versiones instaladas.

2. Instalar dependencias:

   ```bash
   pip install -r requirements.txt
   ```

   Una vez activado el entorno virtual, `pip` y `python` quedan disponibles directamente dentro de esa sesión de PowerShell (ya no hace falta `py`).

3. Configurar variables de entorno:

   ```bash
   cp .env.example .env
   ```

   Completa `.env` con las credenciales reales de PostgreSQL y OCI (incluyendo la ruta a la clave `.pem` de autenticación programática).

## Ejecución en desarrollo

Desde el directorio `backend/`:

```bash
uvicorn app.main:app --reload --port 8000
```

La API quedará disponible en `http://localhost:8000`.

## Verificar el estado del sistema

```bash
curl http://localhost:8000/api/v1/health
```

Retorna `200 OK` si la base de datos y OCI Object Storage están operativos, o `503 Service Unavailable` si alguna dependencia falla.

## Documentación interactiva

- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`
