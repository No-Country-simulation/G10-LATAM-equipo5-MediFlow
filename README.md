# MediFlow — Agente Autónomo para Triaje, Extracción y Enrutamiento de Documentos Clínicos

> **Hackathon ONE G10** | *Oracle Next Education & Alura*
> **Sector:** HealthTech / Gestión Hospitalaria / Aseguradoras de Salud

---

## 📋 ¿Qué es MediFlow?

En hospitales y aseguradoras, cada día llegan cientos de documentos (informes de laboratorio, recetas, certificados, reportes radiológicos) que hoy se leen y derivan **a mano**. Es lento y propenso a errores.

**MediFlow** automatiza ese proceso con Inteligencia Artificial:

1. **Recibe** el documento (PDF o imagen).
2. **Lo clasifica y extrae** los datos clave (paciente, médico, diagnóstico CIE-10, prioridad).
3. **Decide a dónde enviarlo** (por ejemplo, Cola de Emergencia Médica o Farmacia Hospitalaria).
4. Si la IA **no está segura** (confianza baja) o el caso lo requiere, lo deja en una **bandeja de auditoría** para que una persona lo revise y corrija (*Human-in-the-Loop*).
5. **Guarda** el archivo original y el resultado estructurado en **Oracle Cloud (OCI Object Storage)**, y los registra en **PostgreSQL**.

## 🎯 Objetivos

1. **Ingestión multimodal:** PDFs escaneados o digitales, imágenes y JSON.
2. **Clasificación y extracción precisa** con LLMs multimodales.
3. **Orquestación con agentes** que evalúan confianza y severidad.
4. **Human-in-the-Loop:** los casos dudosos van a una cola de auditoría manual.
5. **Persistencia en la nube** usando solo la capa *Always Free* de OCI.

---

## 🧩 Arquitectura general

```
 Documento (PDF/imagen)
        │
        ▼
 ┌──────────────┐   payload JSON + archivo (base64)   ┌───────────────────┐
 │  n8n (IA /   │ ──────────────────────────────────▶ │  Backend FastAPI  │
 │  workflow)   │      POST /api/v1/documents/ingest  │   (carpeta backend)│
 └──────────────┘                                     └─────────┬─────────┘
                                                                │
                                      ┌─────────────────────────┼──────────────────────┐
                                      ▼                                                ▼
                            ┌───────────────────┐                        ┌──────────────────────────┐
                            │    PostgreSQL     │                        │  OCI Object Storage      │
                            │ (usuarios y datos │                        │ (archivo original + JSON)│
                            │  de documentos)   │                        └──────────────────────────┘
                            └───────────────────┘
                                      ▲
                                      │ consulta / audita
                            ┌───────────────────┐
                            │ Frontend / Auditor│
                            │ (bandeja central) │
                            └───────────────────┘
```

**Regla de triaje:** un documento pasa a `PENDIENTE_AUDITORIA` si su score de confianza es **menor a 0.85** o si el workflow marca `requiere_auditoria_humana`. En caso contrario queda como `PROCESADO`.

| Estado | Significado | Ruta del JSON en OCI |
|---|---|---|
| `PROCESADO` | Enrutado automáticamente | `procesados/<prioridad>/<id>.json` |
| `PENDIENTE_AUDITORIA` | Espera revisión humana | `auditoria_humana/<id>.json` |
| `AUDITADO` | Corregido por un auditor | `procesados/auditados/<id>.json` |

El archivo original se guarda en `recibidos/<id>.<extensión>`.

---

## 📁 Estructura del repositorio

```
.
├── backend/                 # API REST en FastAPI (ver backend/README.md)
├── docker/
│   └── postgres/init.sql    # Crea tablas, índices y el usuario administrador semilla
├── docker-compose.yml       # Levanta PostgreSQL 16 para desarrollo
├── .env.example             # Variables del contenedor de PostgreSQL
└── README.md                # Este archivo
```

> Cada servicio tiene su propio `.env` dentro de su carpeta (ej. `backend/.env`). El `.env` de la raíz **solo** sirve para las credenciales de Postgres de `docker-compose`.

---

## 🚀 Puesta en marcha rápida

**Requisitos:** Docker, Python 3.11+ y credenciales de OCI (ver `backend/README.md`).

1. **Clonar el repositorio** y entrar a la carpeta raíz.

2. **Configurar y levantar la base de datos:**

   ```bash
   cp .env.example .env          # credenciales de Postgres
   docker compose up -d          # levanta PostgreSQL en localhost:5432
   ```

   La primera vez, `docker/postgres/init.sql` crea las tablas `users` y `clinical_documents` y un usuario administrador de prueba.

3. **Levantar el backend** siguiendo [`backend/README.md`](backend/README.md) (entorno virtual, `pip install`, `backend/.env`, `uvicorn`).

4. **Comprobar que todo funciona:**

   ```bash
   curl http://localhost:8000/api/v1/health
   ```

   Documentación interactiva: <http://localhost:8000/docs>

### Usuario de prueba

| Campo | Valor |
|---|---|
| Usuario | `admin_user` |
| Contraseña | `admin123` |
| Rol | `ADMIN` |

> ⚠️ Es solo para desarrollo. Cambia la contraseña y el `JWT_SECRET_KEY` antes de cualquier despliegue real.

### Comandos útiles de la base de datos

```bash
docker compose ps               # ver estado
docker compose logs -f postgres # ver logs
docker compose down             # detener (conserva los datos)
docker compose down -v          # detener y BORRAR los datos (re-ejecuta init.sql al volver a levantar)
```

---

## 👥 Roles de usuario

| Rol | Puede hacer |
|---|---|
| `ADMIN` | Todo: gestionar usuarios, ver documentos, ingestar y auditar |
| `GESTOR_USUARIOS` | Crear, listar y modificar usuarios |
| `AUDITOR_CLINICO` | Ver la bandeja de documentos y resolver casos de auditoría |

Todos los usuarios autenticados pueden ver y editar su propio perfil y cambiar su contraseña.

---

## 🔌 Resumen de la API

Prefijo: `/api/v1`. Salvo `health` y `login`, todos requieren `Authorization: Bearer <token>`. El detalle está en [`backend/README.md`](backend/README.md).

| Área | Endpoints |
|---|---|
| Salud | `GET /health` |
| Autenticación | `POST /auth/login`, `GET /auth/me` |
| Perfil y usuarios | `/users/me`, `/users/me/change-password`, `/users` |
| Documentos | `POST /documents/ingest`, `GET /documents` |
| Auditoría | `GET /audit/{documento_id}`, `PUT /audit/{documento_id}/resolve` |

---

## 🛠️ Tecnologías

FastAPI · Python 3.11+ · PostgreSQL 16 · SQLAlchemy (async) · JWT · Oracle Cloud Infrastructure (Object Storage) · Docker Compose · n8n (workflow de IA)
