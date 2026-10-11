import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { createLogger } from '../../utils/logger';

const log = createLogger('navegación');

/** Registra cada cambio de página (sin la query, que puede traer filtros con datos de pacientes). */
export const RouteLogger = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    log.debug(`Página ${pathname}`);
  }, [pathname]);

  return null;
};
