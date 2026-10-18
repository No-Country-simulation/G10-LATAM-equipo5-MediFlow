import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import type { ConteoDestino } from '../../types/dashboard';
import { useCatalogLabels } from '../../hooks/useCatalogLabels';
import { expedientesUrl } from '../../utils/dashboardLinks';
import DashboardPanel from './DashboardPanel';
import { SINGLE_SERIES_COLOR } from './chartColors';

interface QueueDistributionChartProps {
  porDestino: ConteoDestino[];
  dias: number;
}

const MAX_FILAS = 6;

interface Fila {
  key: string;
  label: string;
  total: number;
  /** Cola a la que enlaza; sin ella la fila no es clickeable ("Sin cola asignada", "Otras"). */
  destino?: string;
}

/** Barras horizontales: a qué colas se derivaron los documentos del período. */
const QueueDistributionChart = ({ porDestino, dias }: QueueDistributionChartProps) => {
  const { queueName } = useCatalogLabels();

  const filas = useMemo<Fila[]>(() => {
    const todas: Fila[] = porDestino.map(({ destino, total }) =>
      destino
        ? { key: destino, label: queueName(destino) ?? destino, total, destino }
        : { key: '__sin_cola__', label: 'Sin cola asignada', total }
    );
    if (todas.length <= MAX_FILAS) return todas;
    const resto = todas.slice(MAX_FILAS - 1).reduce((acc, f) => acc + f.total, 0);
    return [...todas.slice(0, MAX_FILAS - 1), { key: '__otras__', label: 'Otras colas', total: resto }];
  }, [porDestino, queueName]);

  const max = Math.max(1, ...filas.map((f) => f.total));

  return (
    <DashboardPanel title="Derivación por cola" subtitle={`Documentos por destino · últimos ${dias} días`}>
      {filas.length === 0 ? (
        <div className="py-10 text-center text-xs text-slate-400">Sin derivaciones en el período.</div>
      ) : (
        <ul className="space-y-1">
          {filas.map((fila) => {
            const contenido = (
              <>
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-slate-300 truncate">{fila.label}</span>
                  <span className="font-semibold text-white tabular-nums">{fila.total}</span>
                </div>
                <div className="mt-1 h-2.5">
                  <div
                    className="h-full rounded-r-[4px]"
                    style={{ width: `${Math.max(2, (fila.total / max) * 100)}%`, backgroundColor: SINGLE_SERIES_COLOR }}
                  />
                </div>
              </>
            );
            return (
              <li key={fila.key}>
                {fila.destino ? (
                  <Link
                    to={expedientesUrl({ destino: fila.destino })}
                    title={`Ver documentos de ${fila.label} en Expedientes`}
                    className="block px-2 py-1.5 rounded-lg hover:bg-slate-800/50 transition-colors"
                  >
                    {contenido}
                  </Link>
                ) : (
                  <div className="px-2 py-1.5">{contenido}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </DashboardPanel>
  );
};

export default QueueDistributionChart;
