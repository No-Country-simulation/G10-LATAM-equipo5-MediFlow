# Imagen de producción del backend. Multi-arquitectura: sirve en VMs Ampere A1 (arm64) de la
# capa Always Free de OCI y en x86.
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY app ./app

# Sin privilegios de root dentro del contenedor.
RUN useradd --create-home --uid 10001 mediflow && mkdir -p /app/secrets && chown -R mediflow /app
USER mediflow

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/v1/health/live', timeout=4)"

# --proxy-headers: la IP real del cliente llega desde Caddy (X-Forwarded-For); el puerto 8000
# no se publica fuera de la red de Docker.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2", \
     "--proxy-headers", "--forwarded-allow-ips", "*"]
