import { useCallback, useState } from 'react';

/** Avisos de éxito y error de las páginas de administración. `reset` se llama al iniciar cada acción. */
export const useActionFeedback = () => {
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const reset = useCallback(() => {
    setError(null);
    setSuccessMessage(null);
  }, []);

  return { error, setError, successMessage, setSuccessMessage, reset };
};
