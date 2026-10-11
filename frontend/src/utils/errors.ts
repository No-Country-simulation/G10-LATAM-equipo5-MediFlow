/** Mensaje legible de un error desconocido (el `ApiError` del backend ya trae el `detail`). */
export const errorMessage = (err: unknown, fallback: string): string =>
  err instanceof Error && err.message ? err.message : fallback;
