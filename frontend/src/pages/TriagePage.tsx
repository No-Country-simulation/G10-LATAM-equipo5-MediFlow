import { useState, useMemo } from 'react';
import { AlertCircle, CheckCircle2, Clock, Inbox } from 'lucide-react';
import { useDocumentList } from '../hooks/useDocumentList';
import CriticalAlertBanner from '../components/dashboard/CriticalAlertBanner';
import TriageCaseCard from '../components/triage/TriageCaseCard';
import { normalizePriority } from '../types/medical';

type TriageTab = 'ALL' | 'Urgente' | 'Prioritario' | 'Rutina';
const SEVERITY_ORDER: Record<string, number> = { Urgente: 1, Prioritario: 2, Rutina: 3 };
const ACTIVE_CLINICAL_QUEUES = new Set(['Cola_Emergencia_Medica', 'Cola_Oncologia', 'Gestion_Procedimientos', 'Gestion_Interconsultas']);

const KPI_DEFS = [
  { label: 'Urgente', key: 'Urgente' as const, desc: 'Compromiso vital / Emergencia', icon: AlertCircle, color: 'text-rose-400', border: 'border-rose-500/20', bg: 'bg-rose-500/10' },
  { label: 'Prioritario', key: 'Prioritario' as const, desc: 'Atención preferente / Subagudo', icon: Clock, color: 'text-amber-400', border: 'border-amber-500/20', bg: 'bg-amber-500/10' },
  { label: 'Rutina', key: 'Rutina' as const, desc: 'Atención estándar / Rutina', icon: CheckCircle2, color: 'text-emerald-400', border: 'border-emerald-500/20', bg: 'bg-emerald-500/10' },
];

const TriagePage = () => {
  const { documents, state, error } = useDocumentList({ page_size: 100 });
  const [selectedFilter, setSelectedFilter] = useState<TriageTab>('ALL');

  const triagedCases = useMemo(() => {
    return documents
      .filter((doc) => !doc.requiere_auditoria && doc.estado !== 'PENDIENTE_AUDITORIA' && Boolean(doc.destino_enrutamiento && ACTIVE_CLINICAL_QUEUES.has(doc.destino_enrutamiento)))
      .sort((a, b) => {
        const diff = (SEVERITY_ORDER[normalizePriority(a.nivel_prioridad)] ?? 4) - (SEVERITY_ORDER[normalizePriority(b.nivel_prioridad)] ?? 4);
        if (diff !== 0) return diff;
        return (b.created_at ? new Date(b.created_at).getTime() : 0) - (a.created_at ? new Date(a.created_at).getTime() : 0);
      });
  }, [documents]);

  const counts = useMemo(() => ({
    Urgente: triagedCases.filter((d) => normalizePriority(d.nivel_prioridad) === 'Urgente').length,
    Prioritario: triagedCases.filter((d) => normalizePriority(d.nivel_prioridad) === 'Prioritario').length,
    Rutina: triagedCases.filter((d) => normalizePriority(d.nivel_prioridad) === 'Rutina').length,
  }), [triagedCases]);

  const displayedCases = useMemo(() => (
    selectedFilter === 'ALL' ? triagedCases : triagedCases.filter((d) => normalizePriority(d.nivel_prioridad) === selectedFilter)
  ), [triagedCases, selectedFilter]);

  const tabs = (['ALL', 'Urgente', 'Prioritario', 'Rutina'] as const).map((k) => ({
    key: k,
    label: k === 'ALL' ? 'Todos' : k,
    count: k === 'ALL' ? triagedCases.length : counts[k],
  }));

  return (
    <div className="max-w-6xl w-full mx-auto p-4 sm:p-6 space-y-5 animate-fade-in">
      <div>
        <div className="flex items-center gap-2.5">
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Consola de Triaje Asistencial</h1>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />Monitoreo en Tiempo Real
          </span>
        </div>
        <p className="text-xs text-slate-400 mt-1">Pacientes con derivación asistencial activa organizados por severidad</p>
      </div>

      <CriticalAlertBanner criticalCount={counts.Urgente} onViewCritical={() => setSelectedFilter('Urgente')} />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {KPI_DEFS.map((kpi) => (
          <button key={kpi.label} type="button" onClick={() => setSelectedFilter((p) => (p === kpi.key ? 'ALL' : kpi.key))} className={`p-3.5 rounded-2xl bg-slate-900/70 border text-left transition-all cursor-pointer ${selectedFilter === kpi.key ? `${kpi.border} ring-2 ring-slate-700 bg-slate-900` : 'border-slate-800/80 hover:border-slate-700'}`}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400">{kpi.label}</span>
              <div className={`p-1.5 rounded-lg border ${kpi.border} ${kpi.bg} ${kpi.color}`}><kpi.icon className="w-4 h-4" /></div>
            </div>
            <div className={`text-2xl font-bold mt-2 ${kpi.color}`}>{counts[kpi.key]}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">{kpi.desc}</div>
          </button>
        ))}
      </div>

      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">Casos Asistenciales Activos ({displayedCases.length})</h2>
          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-900/80 border border-slate-800 self-start sm:self-auto">
            {tabs.map((t) => (
              <button key={t.key} type="button" onClick={() => setSelectedFilter(t.key)} className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${selectedFilter === t.key ? 'bg-slate-800 text-white border border-slate-700 shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}>
                {t.label} <span className="text-[11px] text-slate-500 font-mono">({t.count})</span>
              </button>
            ))}
          </div>
        </div>

        {error && <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">{error}</div>}

        {state === 'loading' ? (
          <div className="space-y-3">{[1, 2].map((i) => <div key={i} className="h-24 rounded-2xl bg-slate-900/50 border border-slate-800 animate-pulse" />)}</div>
        ) : displayedCases.length === 0 ? (
          <div className="p-8 text-center rounded-2xl bg-slate-900/40 border border-slate-800/80">
            <Inbox className="w-8 h-8 text-slate-500 mx-auto mb-2" /><p className="text-sm font-medium text-slate-300">No hay casos en la categoría asistencial seleccionada</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {displayedCases.map((doc) => <TriageCaseCard key={doc.documento_id} doc={doc} />)}
          </div>
        )}
      </div>
    </div>
  );
};

export default TriagePage;
