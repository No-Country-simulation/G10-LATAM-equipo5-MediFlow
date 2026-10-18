import { useCallback, useEffect, useState } from 'react';
import { catalogService } from '../services/catalogService';
import { createSharedLoader } from '../utils/sharedLoader';
import { createLogger, describeError } from '../utils/logger';

type NameMap = ReadonlyMap<string, string>;

interface CatalogNames {
  queues: NameMap;
  documentTypes: NameMap;
}

const EMPTY: CatalogNames = { queues: new Map(), documentTypes: new Map() };

const log = createLogger('catalogos');

/** Nombres de todas las colas y tipos desde la base de datos (incluye inactivos): una carga compartida. */
const catalogNames = createSharedLoader(async (): Promise<CatalogNames> => {
  try {
    const { colas, tipos_documento } = await catalogService.getLabels();
    return {
      queues: new Map(colas.map((c) => [c.codigo, c.nombre])),
      documentTypes: new Map(tipos_documento.map((t) => [t.codigo, t.nombre])),
    };
  } catch (error) {
    // Se registra aquí (una vez por carga) y no en cada componente que muestra nombres.
    log.warn('No se pudieron cargar los nombres del catálogo: se muestran los códigos', {
      error: describeError(error),
    });
    throw error;
  }
});

/** Descarta los nombres cargados: se llama tras crear, editar o eliminar un registro de catálogo. */
export const invalidateCatalogLabels = catalogNames.invalidate;

/**
 * Nombre para mostrar de una cola o un tipo de documento a partir de su código, según el catálogo
 * de la base de datos. Mientras carga, o si el código no está en el catálogo, se muestra el código.
 */
export const useCatalogLabels = () => {
  const [names, setNames] = useState<CatalogNames>(EMPTY);

  useEffect(() => {
    let cancelled = false;
    catalogNames
      .load()
      .then((loaded) => {
        if (!cancelled) setNames(loaded);
      })
      // Ya registrado en el cargador; sin nombres se muestran los códigos y la pantalla sigue usable.
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const queueName = useCallback(
    (codigo: string | null | undefined): string | null => (codigo ? names.queues.get(codigo) ?? codigo : null),
    [names]
  );

  const documentTypeName = useCallback(
    (codigo: string | null | undefined): string | null =>
      codigo ? names.documentTypes.get(codigo) ?? codigo : null,
    [names]
  );

  return { queueName, documentTypeName };
};
