import { useCallback, useEffect, useState } from 'react';
import type { CatalogApi } from '../services/catalogService';
import type { CatalogPayload, CatalogRecord } from '../types/catalog';
import { errorMessage } from '../utils/errors';
import { useActionFeedback } from './useActionFeedback';
import { invalidateActiveCatalogs } from './useCatalogs';
import { invalidateCatalogLabels } from './useCatalogLabels';

/** Tras cada cambio se descartan las cargas compartidas, para que las demás pantallas vean lo nuevo. */
const invalidateCatalogs = () => {
  invalidateActiveCatalogs();
  invalidateCatalogLabels();
};

/** Estado y acciones CRUD de un catálogo; `singular` se usa en los mensajes ("área", "cola"). */
export const useCatalogManagement = (api: CatalogApi<CatalogRecord>, singular: string) => {
  const [records, setRecords] = useState<CatalogRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const { error, setError, successMessage, setSuccessMessage, reset } = useActionFeedback();

  const replaceRecord = (updated: CatalogRecord) =>
    setRecords((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));

  // Solo actualiza el estado en los callbacks de la promesa: así puede llamarse desde el efecto.
  const requestRecords = useCallback(
    (isCancelled: () => boolean = () => false) =>
      api
        .list()
        .then((data) => {
          if (!isCancelled()) setRecords(data);
        })
        .catch((err: unknown) => {
          if (!isCancelled()) setError(errorMessage(err, 'Error al cargar el catálogo'));
        })
        .finally(() => {
          if (!isCancelled()) setIsLoading(false);
        }),
    [api, setError]
  );

  useEffect(() => {
    let cancelled = false;
    void requestRecords(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, [requestRecords]);

  const refresh = () => {
    setIsLoading(true);
    reset();
    return requestRecords();
  };

  const create = async (payload: CatalogPayload): Promise<boolean> => {
    reset();
    try {
      const created = await api.create(payload);
      invalidateCatalogs();
      setRecords((prev) => [...prev, created].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')));
      setSuccessMessage(`Registro ${created.codigo} creado correctamente`);
      return true;
    } catch (err) {
      setError(errorMessage(err, `Error al crear ${singular}`));
      return false;
    }
  };

  const update = async (id: string, payload: CatalogPayload): Promise<boolean> => {
    reset();
    try {
      const updated = await api.update(id, payload);
      invalidateCatalogs();
      replaceRecord(updated);
      setSuccessMessage(`Registro ${updated.codigo} actualizado correctamente`);
      return true;
    } catch (err) {
      setError(errorMessage(err, `Error al actualizar ${singular}`));
      return false;
    }
  };

  const toggleActive = async (record: CatalogRecord) => {
    setUpdatingId(record.id);
    const isActive = !record.is_active;
    const ok = await update(record.id, { is_active: isActive });
    if (ok) setSuccessMessage(`Registro ${record.codigo} ${isActive ? 'activado' : 'desactivado'} correctamente`);
    setUpdatingId(null);
  };

  /** Smart Delete: si el registro está en uso, el backend solo lo desactiva. */
  const remove = async (record: CatalogRecord): Promise<void> => {
    reset();
    try {
      const result = await api.remove(record.id);
      invalidateCatalogs();
      if (result.deletion_type === 'HARD_DELETE') {
        setRecords((prev) => prev.filter((r) => r.id !== record.id));
      } else {
        replaceRecord({ ...record, is_active: false });
      }
      setSuccessMessage(result.message);
    } catch (err) {
      setError(errorMessage(err, `Error al eliminar ${singular}`));
    }
  };

  return {
    records,
    isLoading,
    updatingId,
    error,
    successMessage,
    dismissMessages: reset,
    refresh,
    create,
    update,
    toggleActive,
    remove,
  };
};
