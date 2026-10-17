# Despliegue de MediFlow en Proxmox con CI/CD (GitHub Actions)

Plan B al despliegue en OCI ([`DESPLIEGUE_OCI.md`](DESPLIEGUE_OCI.md)): el mismo `docker-compose.prod.yml` corre en
una VM de Proxmox, se publica por el **Cloudflare Tunnel** existente y se redespliega solo después de cada
push a `main`. Los archivos siguen en **OCI Object Storage**.

```
Internet ─HTTPS─► Cloudflare ─► cloudflared (pod en k8s) ─HTTP:80─► VM mediflow
                                                                    ├─ web (Caddy :80): front, /api/*, /webhook/*
                                                                    ├─ backend ──► OCI Object Storage (API key)
                                                                    ├─ n8n (editor solo 127.0.0.1:5678) ──► Gemini
                                                                    ├─ postgres
                                                                    └─ GitHub Actions runner (systemd)

push a main ─► GitHub: tests backend, frontend, workflow n8n y Caddyfile (runners de GitHub)
            └─► si pasan: job deploy en el runner de la VM (Environment "production" con los secrets)
```

- TLS lo termina Cloudflare; Caddy escucha solo HTTP (`SITE_ADDRESS=:80`) y sigue enrutando y poniendo los headers de seguridad.
- No se abre ningún puerto del router. Traefik no participa: el túnel apunta directo a la VM.

## 1. VM en Proxmox

| | |
|---|---|
| SO | Ubuntu Server 24.04 o Debian 12 (plantilla cloud-init con tu llave SSH) |
| Recursos | 4 vCPU, 8 GB RAM, 60 GB disco (build de Vite + n8n + Postgres) |
| Red | IP fija o reserva DHCP en la misma red a la que llegan los nodos de k8s |
| Opciones | *QEMU Guest Agent* activado; *Start at boot* activado |

**Firewall de Proxmox** (VM → Firewall → *Options*: `Firewall = Yes`, `Input policy = DROP`; luego *Add*):

| Dirección | Acción | Protocolo | Puerto | Origen |
|---|---|---|---|---|
| IN | ACCEPT | tcp | 22 | tu red LAN (ej. `192.168.1.0/24`) |
| IN | ACCEPT | tcp | 80 | IP(s) de los nodos de k8s (por ahí sale `cloudflared`) |

Se usa el firewall de Proxmox y no `ufw` dentro de la VM porque Docker publica puertos saltándose `ufw`.

## 2. Preparar la VM

```bash
scp deploy/proxmox/setup-vm.sh usuario@<IP_VM>:
ssh usuario@<IP_VM> 'sudo bash setup-vm.sh'
```

Instala Docker + compose, `rsync`, `acl`, actualizaciones automáticas y el agente de QEMU; crea el usuario
`gha-runner` (sin sudo, en el grupo `docker`) y `/opt/mediflow`; deja SSH solo con llave.

> Pertenecer al grupo `docker` equivale a ser root en la VM. Por eso la VM es de uso exclusivo y el job de
> deploy solo corre con código ya integrado en `main` (ver sección 5).

## 3. OCI: usuario con API key (Instance Principal solo existe dentro de OCI)

1. *Identity → Users*: crear `mediflow-proxmox` (sin contraseña de consola) y un grupo `mediflow-storage` con él.
2. Policy en el compartment del bucket:
   ```
   Allow group mediflow-storage to manage objects in compartment <compartment> where target.bucket.name = 'mediflow-documents'
   Allow group mediflow-storage to manage buckets in compartment <compartment> where all {target.bucket.name = 'mediflow-documents', any {request.permission = 'BUCKET_INSPECT', request.permission = 'BUCKET_READ', request.permission = 'PAR_MANAGE'}}
   ```
   (Si el usuario está en un *Identity Domain* distinto del *Default*, el grupo se escribe `'<dominio>'/'mediflow-storage'`.)
3. En el usuario: *API keys → Add API key → Generate*. Descargar la llave privada y anotar `user`,
   `fingerprint` y `tenancy` del fragmento de configuración que muestra la consola.

## 4. Cloudflare: hostname público

*Zero Trust → Networks → Tunnels →* (túnel de k8s) *→ Public Hostname → Add*:

| Subdominio | Dominio | Tipo | URL |
|---|---|---|---|
| `mediflow` | `jfelipedev.cl` | HTTP | `<IP_VM>:80` |

Cloudflare crea el registro DNS. En *SSL/TLS → Edge Certificates* dejar **Always Use HTTPS** activo.

## 5. GitHub

### 5.1 Seguridad del runner (repo público)

*Settings → Actions → General → Fork pull request workflows from outside collaborators*:
**Require approval for all outside collaborators**. Un PR desde un fork puede cambiar el workflow y pedir
el runner de la VM; así nadie externo ejecuta nada sin que un maintainer lo apruebe. El workflow, además,
solo corre el deploy con `push` / `workflow_dispatch` en `main`.

### 5.2 Instalar el runner

*Settings → Actions → Runners → New self-hosted runner → Linux x64* y, en la VM:

```bash
sudo -iu gha-runner
mkdir actions-runner && cd actions-runner
# curl + tar con la versión que muestra GitHub, luego:
./config.sh --url https://github.com/No-Country-simulation/G10-LATAM-equipo5-MediFlow --token <TOKEN> \
  --labels mediflow-prod --name mediflow-proxmox --unattended
exit
cd /home/gha-runner/actions-runner && sudo ./svc.sh install gha-runner && sudo ./svc.sh start
```

Debe aparecer *Idle* en la lista de runners con las etiquetas `self-hosted, Linux, X64, mediflow-prod`.

### 5.3 Environment `production`

*Settings → Environments → New environment* `production`. En *Deployment branches and tags*: **Selected
branches** → `main`. Así los secrets solo se entregan a jobs que corren desde `main`.

**Secrets** (cifrados; GitHub los oculta en los logs):

| Secret | Valor |
|---|---|
| `POSTGRES_PASSWORD` | `openssl rand -hex 32` |
| `JWT_SECRET_KEY` | `openssl rand -hex 32` |
| `N8N_ENCRYPTION_KEY` | `openssl rand -hex 32` |
| `OCI_USER_OCID` | `ocid1.user.oc1..` del paso 3 |
| `OCI_TENANCY_OCID` | `ocid1.tenancy.oc1..` |
| `OCI_FINGERPRINT` | `aa:bb:...` |
| `OCI_API_KEY_PEM` | contenido completo del `.pem` (con `-----BEGIN PRIVATE KEY-----`) |

> `POSTGRES_PASSWORD` y `N8N_ENCRYPTION_KEY` **no se cambian** después del primer deploy: la primera queda
> grabada en el volumen de Postgres y la segunda cifra las credenciales de n8n. Guardarlas también en un
> gestor de contraseñas.

**Variables** (no sensibles):

| Variable | Valor |
|---|---|
| `DOMAIN` | `mediflow.jfelipedev.cl` |
| `ACME_EMAIL` | tu correo (Caddy lo exige aunque con `:80` no emite certificados) |
| `TRUSTED_PROXIES` | **un** CIDR que cubra los nodos de k8s: `192.168.1.20/32` si es uno, o la subred, ej. `192.168.1.0/24` |
| `POSTGRES_USER` / `POSTGRES_DB` | `mediflow_admin` / `mediflow_db` |
| `OCI_REGION` / `OCI_BUCKET_NAME` | `sa-saopaulo-1` / `mediflow-documents` |
| `OCI_COMPARTMENT_OCID` | OCID del compartment del bucket |
| `N8N_VERSION` | versión fija con la que se probó el workflow (ej. `1.x.y`); vacía = `latest` |
| `LOG_LEVEL`, `GEMINI_MODELO_RAPIDO`, `GEMINI_MODELO_PRECISO` | opcionales (vacías = valor por defecto) |

`TRUSTED_PROXIES` hace que el backend vea la IP real del usuario (header `Cf-Connecting-Ip`) y no la del nodo
de k8s; sin ella el bloqueo de login por usuario + IP agruparía a todos bajo una sola IP.

## 6. Primer despliegue

1. *Actions → CI/CD → Run workflow* (rama `main`). El job **Despliegue (Proxmox)** termina con
   `/api/v1/health` en 200 (base de datos y OCI respondiendo).
2. Primer administrador:
   ```bash
   ssh usuario@<IP_VM>
   cd /opt/mediflow && sudo -u gha-runner docker compose -p mediflow -f docker-compose.prod.yml exec backend \
     python -m app.cli create-admin --username admin --email admin@jfelipedev.cl --full-name "Administrador" --area ADMINISTRACION
   ```
3. n8n (el editor no se publica):
   ```bash
   ssh -L 5678:localhost:5678 usuario@<IP_VM>    # y abrir http://localhost:5678
   ```
   Crear el owner, importar `workflow/MediFlow_unificado.json`, crear la credencial **Google Gemini(PaLM) Api**,
   asignarla en **Gemini rápido** y **Gemini preciso**, y activar el workflow.
4. Probar `https://mediflow.jfelipedev.cl`: login, ingesta de un documento y vista previa del original.

## 7. Qué hace cada deploy

Tras cada push a `main` con los tests en verde:

1. Copia el código a `/opt/mediflow` (fuera del workspace del runner, que se limpia en cada checkout).
2. Escribe `.env` (permisos `600`) y `backend/secrets/oci_api_key.pem` (legible solo por el UID 10001 del
   backend, vía ACL) a partir de los secrets del Environment.
3. Levanta Postgres y re-ejecuta `init.sql` (crea tablas/columnas nuevas; es re-ejecutable).
4. `docker compose up -d --build --wait` con proyecto fijo `mediflow` (los volúmenes se conservan).
5. Verifica `/api/v1/health`; si falla, el job queda en rojo y muestra los logs de `backend`, `web` y `n8n`.
6. Borra imágenes huérfanas y caché de build de más de 7 días.

**No automatizado a propósito:**
- `init_catalogo.sql` revierte los tipos y colas semilla editados desde la UI. Para aplicarlo: *Run workflow*
  con **Re-ejecutar init_catalogo.sql** marcado.
- El workflow de n8n: si cambió `workflow/MediFlow_unificado.json`, volver a importarlo por el túnel SSH.

## 8. Operación

- **Logs**: `cd /opt/mediflow && sudo -u gha-runner docker compose -p mediflow -f docker-compose.prod.yml logs -f backend n8n`
- **Rollback**: *Actions →* el run del commit bueno *→ Re-run all jobs*, o `git revert` + push.
- **Respaldo**: backup de la VM en Proxmox (*Datacenter → Backup*) y, si los datos importan,
  `docker compose ... exec -T postgres pg_dump -U mediflow_admin mediflow_db | gzip > backup_$(date +%F).sql.gz`.

## 9. Desmontaje (fin de la hackathon)

1. GitHub: *Settings → Actions → Runners* → quitar `mediflow-proxmox`; borrar el Environment `production`
   (elimina sus secrets).
2. Cloudflare: borrar el public hostname `mediflow` (y su registro DNS si queda).
3. OCI: borrar la API key y el usuario `mediflow-proxmox` (y la policy); vaciar/borrar el bucket si corresponde.
4. Proxmox: destruir la VM (los volúmenes con datos de pacientes de prueba se van con ella).
