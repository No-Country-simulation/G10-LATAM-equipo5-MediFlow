# Despliegue de MediFlow en Oracle Cloud (OCI)

Todo corre en **una VM** con Docker Compose (`docker-compose.prod.yml`), dentro de la capa Always Free.

```
Internet ──443──► Caddy (web) ──► /            front compilado (React)
                             ├──► /api/*       backend (FastAPI)  ──► PostgreSQL (interno)
                             └──► /webhook/*   n8n (solo webhooks) ──► Gemini
                                                    backend ──► OCI Object Storage (Instance Principal)
Editor de n8n: solo por túnel SSH (127.0.0.1:5678)
```

Front, API y webhooks quedan en **el mismo dominio**: no hay CORS que configurar y el front se compila con
rutas relativas (`/api/v1`, `/webhook/triaje-medico`).

## 1. Recursos en OCI

1. **VM**: *VM.Standard.A1.Flex* (Ampere, arm64), p. ej. 2 OCPU / 12 GB, Oracle Linux 9 o Ubuntu 22.04.
   Todas las imágenes usadas son multi-arquitectura. Evitar *E2.1.Micro* (1 GB RAM no alcanza para n8n + Postgres).
2. **Red (VCN / Security List o NSG)**: ingreso solo **22** (idealmente restringido a sus IPs), **80** y **443**.
   No abrir 5432, 8000 ni 5678.
3. **Bucket** de Object Storage (ej. `mediflow-documents`) con visibilidad **privada**.
4. **Instance Principal** (sin llaves PEM en la VM):
   - Dynamic Group `mediflow-vm`: `ALL {instance.id = '<ocid de la VM>'}`
   - Policy en el compartment del bucket:
     ```
     Allow dynamic-group mediflow-vm to manage objects in compartment <compartment> where target.bucket.name = 'mediflow-documents'
     Allow dynamic-group mediflow-vm to manage buckets in compartment <compartment> where all {target.bucket.name = 'mediflow-documents', any {request.permission = 'BUCKET_INSPECT', request.permission = 'BUCKET_READ', request.permission = 'PAR_MANAGE'}}
     ```
     (`PAR_MANAGE` permite crear las URLs pre-firmadas con que el detalle y la auditoría muestran el documento original; no da permiso para borrar ni crear buckets.)
5. **Dominio**: un registro DNS `A` hacia la IP pública de la VM (Caddy necesita el puerto 80 para emitir el certificado).

## 2. Instalar y levantar

```bash
# En la VM (Oracle Linux: además abrir el firewall local)
sudo firewall-cmd --permanent --add-service=http --add-service=https && sudo firewall-cmd --reload
# Instalar Docker Engine + plugin compose según la doc oficial de Docker para la distro.

git clone <repo> mediflow && cd mediflow
cp .env.prod.example .env
# Completar: DOMAIN, ACME_EMAIL, POSTGRES_PASSWORD, JWT_SECRET_KEY, N8N_ENCRYPTION_KEY (openssl rand -hex 32)
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml ps        # backend y postgres en (healthy)
```

El backend **se niega a arrancar** en producción si `JWT_SECRET_KEY` es el de ejemplo o tiene menos de 32 caracteres.

## 3. Primer administrador

Producción no carga los usuarios de prueba (`seed_dev_users.sql`). Crear el primer ADMIN:

```bash
docker compose -f docker-compose.prod.yml exec backend python -m app.cli create-admin \
    --username admin --email admin@hospital.cl --full-name "Administrador" --area ADMINISTRACION
```

## 4. n8n

```bash
ssh -L 5678:localhost:5678 opc@<ip-vm>     # y abrir http://localhost:5678 en el navegador local
```

1. Crear el usuario owner e importar `workflow/MediFlow_unificado.json`.
2. Crear la credencial **Google Gemini(PaLM) Api** y asignarla en los nodos **Gemini rápido** y **Gemini preciso**.
3. Activar el workflow. `MEDIFLOW_API_BASE_URL=http://backend:8000` ya viene en el compose.
4. Opcional: elegir los modelos con `GEMINI_MODELO_RAPIDO` y `GEMINI_MODELO_PRECISO` en `.env` (por defecto
   `gemini-3.1-flash-lite` y `gemini-3.8-flash`; ver [`workflow/README.md`](../workflow/README.md#configuración)).
5. Fijar `N8N_VERSION` en `.env` a la versión probada (no usar `latest` en producción).

## 5. Verificación

```bash
curl https://$DOMAIN/api/v1/health/live    # {"status":"alive"}
curl https://$DOMAIN/api/v1/health         # 200 si la base y OCI responden; 503 indica cuál falla
```

## 6. Operación

- **Respaldos de la base** (cron diario, copiar el archivo al bucket o a otro bucket):
  `docker compose -f docker-compose.prod.yml exec -T postgres pg_dump -U mediflow_admin mediflow_db | gzip > backup_$(date +%F).sql.gz`
- **Actualizar**: `git pull && docker compose -f docker-compose.prod.yml up -d --build`, y luego los dos puntos siguientes.
- **Cambios de esquema**: no hay Alembic. **Después de cada actualización** volver a ejecutar `init.sql` (crea
  tablas y columnas nuevas; es re-ejecutable) e `init_catalogo.sql` (actualiza los tipos y colas semilla):
  ```bash
  docker compose -f docker-compose.prod.yml exec -T postgres psql -U mediflow_admin -d mediflow_db < docker/postgres/init.sql
  docker compose -f docker-compose.prod.yml exec -T postgres psql -U mediflow_admin -d mediflow_db < docker/postgres/init_catalogo.sql
  ```
- **Workflow**: si cambió `workflow/MediFlow_unificado.json`, volver a importarlo en n8n (por el túnel SSH).
- **Logs**: `docker compose -f docker-compose.prod.yml logs -f backend n8n`.

## Checklist de seguridad

| Estado | Medida |
|---|---|
| ✅ | HTTPS automático (Caddy) con HSTS, CSP, `X-Frame-Options`, `nosniff` |
| ✅ | Solo 80/443 publicados; Postgres, API interna y editor de n8n no expuestos |
| ✅ | Swagger/OpenAPI desactivados con `ENVIRONMENT=production` |
| ✅ | Secreto JWT validado al arrancar; sin usuarios con contraseñas conocidas |
| ✅ | OCI por Instance Principal (sin llaves en disco) y bucket privado con URLs pre-firmadas de 15 min |
| ✅ | Login bloqueado 15 min tras 5 fallos (usuario + IP) |
| ✅ | Límites de tamaño: 12 MB en el webhook, 10 MB por archivo y 10 archivos en la ingesta, `documento_id` validado |
| ✅ | n8n toma la URL del backend de su configuración (no del navegador) y valida token/archivo antes de llamar a la IA |
| ✅ | n8n no guarda ejecuciones exitosas (contienen archivo, token y datos del paciente) |
| ✅ | Contenedor del backend sin root |
| ✅ | Un OPERADOR solo ve los documentos que subió y los de sus colas asignadas: los demás responden `404`, y el aviso de duplicado no le muestra su ID ni datos del paciente |
| ✅ | Historial de correcciones: cada cambio humano a un documento guarda quién, cuándo, por qué y qué valor cambió |
| ✅ | Detección de archivos repetidos antes de llamar a la IA (huella SHA-256) y de posibles duplicados al ingerir |
| ⬜ | El token JWT vive en `sessionStorage`: ante un XSS sería legible. A futuro: cookie `HttpOnly` + `SameSite=Strict` |
| ✅ | Access token de 30 min + refresh token de 7 días con rotación (cada refresh token es de un solo uso) |
| ⬜ | El bloqueo de login es en memoria (por proceso): con varias réplicas, moverlo a Redis/BD |
| ⬜ | Auditoría de **lecturas** de datos clínicos (quién abrió qué documento), exigible por normativa de datos de salud. Hoy las modificaciones quedan en la base, y las consultas solo en el log del backend (usuario y ruta de cada petición), que rota |
| ⬜ | Cifrado del bucket con llave propia (OCI Vault) y política de retención/ciclo de vida |
| ⬜ | Alembic para migraciones versionadas en vez de re-ejecutar `init.sql` |
