const rawFastApiBaseUrl =
  (import.meta.env.VITE_FASTAPI_BASE_URL as string | undefined) ||
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(
    /\/api\/v1\/?$/,
    "",
  ) ||
  "http://localhost:8000";

export const FASTAPI_BASE_URL: string = rawFastApiBaseUrl.replace(/\/+$/, "");

export const API_PREFIX = "/api/v1" as const;

export const API_BASE_URL: string =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ||
  `${FASTAPI_BASE_URL}${API_PREFIX}`;

export const FASTAPI_ENDPOINTS = {
  auth: {
    login: "/auth/login",
    logout: "/auth/logout",
    me: "/auth/me",
  },
  documents: {
    base: "/documents",
    ingest: "/documents/ingest",
    statsOverview: "/documents/stats/overview",
  },
  audit: {
    detail: (id: string) => `/audit/${id}`,
    claim: (id: string) => `/audit/${id}/claim`,
    resolve: (id: string) => `/audit/${id}/resolve`,
    discard: (id: string) => `/audit/${id}/discard`,
  },
  catalogs: {
    documentTypesActive: "/catalogs/document-types/active",
    queuesActive: "/catalogs/queues/active",
  },
  users: {
    base: "/users",
    detail: (id: string) => `/users/${id}`,
  },
} as const;

const rawN8nBaseUrl =
  (import.meta.env.VITE_N8N_BASE_URL as string | undefined) ||
  "http://localhost:5678";

export const N8N_BASE_URL: string = rawN8nBaseUrl.replace(/\/+$/, "");

export const N8N_WEBHOOK_PATHS = {
  triajeMedico: "/webhook/triaje-medico",
  mediflowCompleta: "/webhook/mediflow-completa",
  "triaje-medico": "/webhook/triaje-medico",
  "mediflow-completa": "/webhook/mediflow-completa",
} as const;

export type N8nWebhookRoute = keyof typeof N8N_WEBHOOK_PATHS;

export const ACTIVE_N8N_ROUTE: N8nWebhookRoute =
  //"mediflowCompleta";
  "triajeMedico";

export const getN8nWebhookUrl = (
  route: N8nWebhookRoute = ACTIVE_N8N_ROUTE,
): string => {
  return `${N8N_BASE_URL}${N8N_WEBHOOK_PATHS[route]}`;
};

export const N8N_WEBHOOK_INGESTION_URL: string =
  (import.meta.env.VITE_N8N_WEBHOOK_URL as string | undefined) ||
  getN8nWebhookUrl(ACTIVE_N8N_ROUTE);
