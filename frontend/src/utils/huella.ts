/**
 * Huella SHA-256 (hex en minúsculas) de un archivo, la misma que guarda el backend al ingerirlo.
 *
 * `crypto.subtle` solo existe en contextos seguros (HTTPS o localhost): si no está disponible se
 * devuelve `null` y la consulta previa se omite; el backend igual marca el duplicado al ingerir.
 */
export const huellaDeArchivo = async (archivo: Blob): Promise<string | null> => {
  if (!globalThis.crypto?.subtle) return null;
  const digest = await crypto.subtle.digest('SHA-256', await archivo.arrayBuffer());
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
};
