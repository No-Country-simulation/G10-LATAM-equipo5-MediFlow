# Front compilado + Caddy (proxy inverso con HTTPS automático). Contexto de build: raíz del repo.
FROM node:22-alpine AS build
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
# Rutas relativas: el front, la API y los webhooks quedan en el mismo dominio (sin CORS).
ARG VITE_API_BASE_URL=/api/v1
ARG VITE_N8N_WEBHOOK_URL=/webhook/triaje-medico
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL \
    VITE_N8N_WEBHOOK_URL=$VITE_N8N_WEBHOOK_URL
RUN npm run build

FROM caddy:2-alpine
COPY deploy/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/dist /srv
