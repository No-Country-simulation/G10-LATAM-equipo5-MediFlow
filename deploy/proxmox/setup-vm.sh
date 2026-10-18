#!/usr/bin/env bash
# Prepara una VM Ubuntu 24.04 / Debian 12 recién creada para desplegar MediFlow con el runner de GitHub.
# Uso (en la VM, con un usuario con sudo):   sudo bash setup-vm.sh
# Idempotente: se puede volver a ejecutar. Ver docs/DESPLIEGUE_PROXMOX.md.
set -euo pipefail

RUNNER_USER=gha-runner
DEPLOY_DIR=/opt/mediflow

if [ "$(id -u)" -ne 0 ]; then
  echo "Ejecutar con sudo" >&2
  exit 1
fi

. /etc/os-release
case "$ID" in
  ubuntu | debian) ;;
  *) echo "Distribución no soportada: $ID (usar Ubuntu 24.04 o Debian 12)" >&2; exit 1 ;;
esac

echo "==> Paquetes base"
export DEBIAN_FRONTEND=noninteractive
apt-get update -q
apt-get install -yq ca-certificates curl gnupg rsync acl jq qemu-guest-agent unattended-upgrades
systemctl enable --now qemu-guest-agent
dpkg-reconfigure -f noninteractive unattended-upgrades

echo "==> Docker Engine + plugin compose (repositorio oficial de Docker)"
if ! command -v docker >/dev/null; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL "https://download.docker.com/linux/$ID/gpg" -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/$ID $VERSION_CODENAME stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -q
  apt-get install -yq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi
systemctl enable --now docker

echo "==> Usuario del runner: $RUNNER_USER (sin sudo; grupo docker)"
if ! id "$RUNNER_USER" >/dev/null 2>&1; then
  useradd --create-home --shell /bin/bash "$RUNNER_USER"
fi
usermod -aG docker "$RUNNER_USER"

echo "==> Directorio de despliegue: $DEPLOY_DIR"
install -d -m 750 -o "$RUNNER_USER" -g "$RUNNER_USER" "$DEPLOY_DIR"

echo "==> SSH solo con llave"
ADMIN_HOME=$(getent passwd "${SUDO_USER:-root}" | cut -d: -f6)
if [ -s "$ADMIN_HOME/.ssh/authorized_keys" ]; then
  cat > /etc/ssh/sshd_config.d/10-mediflow.conf <<'EOF'
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin no
EOF
  sshd -t
  systemctl reload ssh 2>/dev/null || systemctl reload sshd
else
  echo "    OMITIDO: ${SUDO_USER:-root} no tiene ~/.ssh/authorized_keys (se perdería el acceso). Cargar la llave y re-ejecutar."
fi

cat <<EOF

Listo. Siguientes pasos (docs/DESPLIEGUE_PROXMOX.md, sección 5):
  sudo -iu $RUNNER_USER
  mkdir actions-runner && cd actions-runner
  # Descargar y configurar con los comandos de GitHub (Settings → Actions → Runners → New self-hosted runner),
  # agregando a config.sh:  --labels mediflow-prod --name mediflow-proxmox --unattended
  exit
  cd /home/$RUNNER_USER/actions-runner && sudo ./svc.sh install $RUNNER_USER && sudo ./svc.sh start
EOF
