import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BarChart3, Table2 } from 'lucide-react';
import type { IngresosDia } from '../../types/dashboard';
import { expedientesUrl } from '../../utils/dashboardLinks';
import DashboardPanel from './DashboardPanel';
import { PRIORITY_SERIES } from './chartColors';

interface DailyIntakeChartProps {
  porDia: IngresosDia[];
}

const PLOT_HEIGHT = 160;

function totalDia(d: IngresosDia): number {
  return d.urgente + d.prioritario + d.rutina;
}

/** Máximo "redondo" del eje: 1, 2, 5, 10, 20, 50... */
function niceMax(value: number): number {
  if (value <= 4) return 4;
  const pow = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 5, 10].find((m) => m * pow >= value) ?? 10;
  return step * pow;
}

function parseDia(fecha: string): Date {
  const [y, m, d] = fecha.split('-').map(Number);
  return new Date(y, m - 1, d);
}

const fechaLarga = (fecha: string) =>
  parseDia(fecha).toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric', month: 'short' });

/** Columnas apiladas por prioridad: documentos ingresados por día en el período del inicio. */
const DailyIntakeChart = ({ porDia }: DailyIntakeChartProps) => {
  const [showTable, setShowTable] = useState(false);
  const [active, setActive] = useState<number | null>(null);
  const max = niceMax(Math.max(0, ...porDia.map(totalDia)));
  const sinIngresos = porDia.every((d) => totalDia(d) === 0);

  return (
    <DashboardPanel
      title="Ingresos por día"
      subtitle="Documentos recibidos cada día según su prioridad · clic en un día para verlos en Expedientes"
      action={
        <button
          type="button"
          onClick={() => setShowTable((v) => !v)}
          className="flex items-center gap-1 text-[11px] font-medium text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
        >
          {showTable ? <BarChart3 className="w-3.5 h-3.5" /> : <Table2 className="w-3.5 h-3.5" />}
          {showTable ? 'Ver gráfico' : 'Ver tabla'}
        </button>
      }
    >
      <ul className="flex flex-wrap gap-x-4 gap-y-1">
        {PRIORITY_SERIES.map((s) => (
          <li key={s.key} className="flex items-center gap-1.5 text-[11px] text-slate-300">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: s.color }} />
            {s.label}
          </li>
        ))}
      </ul>

      {showTable ? (
        <div className="overflow-x-auto">
          <table className="w-full text-xs tabular-nums">
            <thead>
              <tr className="text-slate-500 text-left">
                <th className="py-1.5 font-medium">Fecha</th>
                {PRIORITY_SERIES.map((s) => (
                  <th key={s.key} className="py-1.5 font-medium text-right">{s.label}</th>
                ))}
                <th className="py-1.5 font-medium text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {porDia.map((d) => (
                <tr key={d.fecha} className="border-t border-slate-800/70 text-slate-300">
                  <td className="py-1.5 capitalize">{fechaLarga(d.fecha)}</td>
                  {PRIORITY_SERIES.map((s) => (
                    <td key={s.key} className="py-1.5 text-right">{d[s.key]}</td>
                  ))}
                  <td className="py-1.5 text-right font-semibold text-white">{totalDia(d)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : sinIngresos ? (
        <div className="py-10 text-center text-xs text-slate-400">Sin ingresos en el período.</div>
      ) : (
        <div className="flex gap-2">
          {/* Eje Y: tres marcas redondas. */}
          <div className="relative w-6 shrink-0 text-[10px] text-slate-500 tabular-nums" style={{ height: PLOT_HEIGHT }}>
            {[max, max / 2, 0].map((v, i) => (
              <span key={v} className="absolute right-0 -translate-y-1/2" style={{ top: `${i * 50}%` }}>
                {v}
              </span>
            ))}
          </div>

          <div className="flex-1 min-w-0">
            <div className="relative" style={{ height: PLOT_HEIGHT }}>
              {[0, 50, 100].map((top) => (
                <div key={top} className="absolute inset-x-0 h-px bg-slate-800" style={{ top: `${top}%` }} />
              ))}

              <div className="absolute inset-0 flex">
                {porDia.map((d, i) => {
                  const total = totalDia(d);
                  const segmentos = PRIORITY_SERIES.filter((s) => d[s.key] > 0);
                  const align =
                    i < 2 ? 'left-0' : i > porDia.length - 3 ? 'right-0' : 'left-1/2 -translate-x-1/2';
                  return (
                    <Link
                      key={d.fecha}
                      to={expedientesUrl({ dia: d.fecha })}
                      onPointerEnter={() => setActive(i)}
                      onPointerLeave={() => setActive((a) => (a === i ? null : a))}
                      onFocus={() => setActive(i)}
                      onBlur={() => setActive((a) => (a === i ? null : a))}
                      aria-label={`${fechaLarga(d.fecha)}: ${total} documentos`}
                      className="relative flex-1 h-full flex flex-col justify-end items-center group outline-none"
                    >
                      <div
                        className={`w-full max-w-[24px] flex flex-col-reverse gap-[2px] transition-opacity ${
                          active !== null && active !== i ? 'opacity-50' : ''
                        }`}
                      >
                        {segmentos.map((s, idx) => (
                          <div
                            key={s.key}
                            className={idx === segmentos.length - 1 ? 'rounded-t-[4px]' : ''}
                            style={{
                              height: Math.max(2, (d[s.key] / max) * PLOT_HEIGHT - 2),
                              backgroundColor: s.color,
                            }}
                          />
                        ))}
                      </div>

                      {active === i && (
                        <div
                          role="tooltip"
                          className={`absolute bottom-full mb-2 ${align} z-10 w-36 p-2 rounded-lg bg-slate-950 border border-slate-700 shadow-xl text-[11px] pointer-events-none`}
                        >
                          <div className="text-slate-400 capitalize">{fechaLarga(d.fecha)}</div>
                          <div className="text-sm font-semibold text-white">{total} documentos</div>
                          <ul className="mt-1 space-y-0.5">
                            {PRIORITY_SERIES.map((s) => (
                              <li key={s.key} className="flex items-center justify-between gap-2">
                                <span className="flex items-center gap-1.5 text-slate-400">
                                  <span className="w-2.5 h-0.5 rounded-full" style={{ backgroundColor: s.color }} />
                                  {s.label}
                                </span>
                                <span className="font-semibold text-slate-100 tabular-nums">{d[s.key]}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* Eje X: día del mes; el mes se indica en el primer día y cuando cambia. */}
            <div className="flex mt-1.5">
              {porDia.map((d, i) => {
                const date = parseDia(d.fecha);
                const mostrarMes = i === 0 || date.getDate() === 1;
                return (
                  <span key={d.fecha} className="flex-1 text-center text-[10px] text-slate-500 tabular-nums leading-tight">
                    {date.getDate()}
                    {mostrarMes && (
                      <span className="block text-slate-600">
                        {date.toLocaleDateString('es-CL', { month: 'short' })}
                      </span>
                    )}
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </DashboardPanel>
  );
};

export default DailyIntakeChart;
