import { useEffect, useState } from 'react';
import { catalogService } from '../services/catalogService';
import type { DocumentForms } from '../types/forms';
import { errorMessage } from '../utils/errors';

/** Campos de cada tipo de documento (los mismos que extrae la IA), para el formulario de auditoría. */
export const useDocumentForms = () => {
  const [forms, setForms] = useState<DocumentForms | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    catalogService
      .getDocumentForms()
      .then((data) => {
        if (!cancelled) setForms(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(errorMessage(err, 'No se pudieron cargar los campos de los tipos de documento'));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { forms, error };
};
