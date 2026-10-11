# secrets/

Coloca aquí la clave privada de la API Key de OCI (`oci_api_key.pem`), en la ruta indicada por `OCI_KEY_FILE_PATH` en `backend/.env`. Solo se usa en **desarrollo** (`OCI_AUTH_MODE=api_key`).

En producción, en una VM de OCI, se usa `OCI_AUTH_MODE=instance_principal` y **no hace falta ninguna llave en disco** (ver [`docs/DESPLIEGUE_OCI.md`](../../docs/DESPLIEGUE_OCI.md)).

**No subas archivos `.pem` reales a git.** El `.gitignore` de la raíz ignora cualquier `*.pem`: solo este `README.md` queda versionado.
