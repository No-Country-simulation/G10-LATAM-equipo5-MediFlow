export interface SharedLoader<T> {
  /** Devuelve la carga en curso o ya resuelta; la primera llamada la inicia. */
  load: () => Promise<T>;
  /** Descarta lo cargado: la próxima llamada a `load` vuelve a pedirlo. */
  invalidate: () => void;
}

/**
 * Comparte una misma petición entre todos los componentes que la usan (filas, tarjetas...), en vez
 * de una por componente. Un fallo no queda guardado: el próximo uso reintenta.
 */
export const createSharedLoader = <T>(fetcher: () => Promise<T>): SharedLoader<T> => {
  let pending: Promise<T> | null = null;

  return {
    load: () => {
      // `Promise.resolve().then` convierte también un error síncrono del fetcher en rechazo.
      pending ??= Promise.resolve()
        .then(fetcher)
        .catch((err: unknown) => {
          pending = null;
          throw err;
        });
      return pending;
    },
    invalidate: () => {
      pending = null;
    },
  };
};
