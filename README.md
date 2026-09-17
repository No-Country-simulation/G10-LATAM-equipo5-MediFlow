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
