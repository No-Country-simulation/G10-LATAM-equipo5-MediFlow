# MediFlow - Agente Autónomo para Triaje, Extracción y Enrutamiento de Documentos Clínicos

> **Hackathon ONE G10** | *Oracle Next Education & Alura*  
> **Sector:** HealthTech / Gestión Hospitalaria / Aseguradoras de Salud

---

## 📋 Descripción del Proyecto

**MediFlow** es una solución basada en Inteligencia Artificial y Agentes Autónomos orientada a resolver la ineficiencia, lentitud y errores en el procesamiento manual de documentos médicos y administrativos en el sector salud. 

El sistema es capaz de recibir e ingestar documentos clínicos en múltiples formatos (PDFs escaneados o digitales, imágenes y JSON), clasificarlos automáticamente mediante LLMs multimodales, extraer entidades y datos médicos vitales con alta precisión y enrutarlos hacia sus destinos correspondientes sin intervención humana para casos estándar. Para situaciones de urgencia médica o datos ambiguos, la plataforma integra un mecanismo de **Human-in-the-Loop** y alertas inmediatas.

---

## 🎯 Objetivos Principales

1. **Ingestión Multimodal:** Procesar informes de laboratorio, recetas, certificados y reportes radiológicos.
2. **Clasificación y Extracción Precisa:** Utilizar modelos de lenguaje (LLM/Visión) para estructurar datos clave (identificación de paciente, diagnóstico CIE-10, médico tratante, dosis de medicamentos y urgencia).
3. **Orquestación mediante Agentes:** Implementar un grafo de decisión condicional que evalúe niveles de confianza y severidad.
4. **Manejo de Contingencias (Human-in-the-Loop):** Canalizar documentos dudosos o ilegibles a una cola de auditoría manual.
5. **Persistencia en la Nube:** Almacenar de forma segura los documentos y resultados estructurados en **Oracle Cloud Infrastructure (OCI) Object Storage** utilizando únicamente la capa *Always Free*.

---

## 🏗️ Arquitectura (Monorrepo)

El proyecto se organiza en tres módulos independientes que se comunican entre sí mediante HTTP:

```
├── frontend/    → React + TypeScript + Vite (interfaz de carga y auditoría)
├── backend/     → Python + FastAPI (extracción, triaje y persistencia)
└── workflows/   → n8n (orquestación y enrutamiento de resultados)
```

- **Frontend**: permite subir documentos clínicos y revisar/editar manualmente los casos con baja confianza (`score_confianza < 0.85`).
- **Backend**: expone la API REST, extrae texto de los documentos (PDF/texto plano), estructura los datos clínicos, calcula el score de confianza y persiste los casos dudosos en SQLite (`auditoria_pendientes`). Opcionalmente sube los documentos a OCI Object Storage y notifica el resultado a n8n.
- **Orquestación (n8n)**: recibe el resultado del triaje vía webhook y lo enruta según su nivel de prioridad.

## 🚀 Puesta en marcha

1. Copiar `.env.example` a `.env` y completar las variables reales (credenciales de OCI, API keys de LLM, etc.).
2. Colocar la clave privada de OCI (`oci_api_key.pem`) dentro de `backend/secrets/` (este directorio está excluido de git salvo `.gitkeep`).
3. Levantar todos los servicios:

   ```bash
   docker compose up --build
   ```

4. Servicios disponibles:
   - Frontend: http://localhost
   - Backend (API + docs): http://localhost:8000/docs
   - n8n: http://localhost:5678

### Desarrollo local sin Docker

```bash
# Backend
cd backend
python -m venv .venv
source .venv/bin/activate      # En Windows (PowerShell): .venv\Scripts\Activate.ps1
pip install .
uvicorn app.main:app --reload
```

> **Windows sin entorno virtual:** si `pip` no se reconoce como comando, usa el lanzador `py`:
> `py -m pip install .` y luego `py -m uvicorn app.main:app --reload`.

```bash
# Frontend
cd frontend
npm install
npm run dev
```
