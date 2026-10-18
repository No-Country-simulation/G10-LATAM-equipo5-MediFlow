import { useState, useMemo, useCallback, useEffect } from 'react';
import { AlertCircle, CheckCircle2, Clock, Inbox, Shuffle, Undo2, X } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useTriageConsole } from '../hooks/useTriageConsole';
import { useCatalogLabels } from '../hooks/useCatalogLabels';
import { useDocumentDetailModal } from '../context/documentDetailContext';
import CriticalAlertBanner from '../components/dashboard/CriticalAlertBanner';
import TriageCaseCard from '../components/triage/TriageCaseCard';
import DeriveCaseModal from '../components/triage/DeriveCaseModal';
import ConfirmAttendModal from '../components/triage/ConfirmAttendModal';
import { FilterButtonGroup } from '../components/documents/FilterButtonGroup';
import { documentService } from '../services/documentService';
import { normalizePriority, type DocumentListItemResponse } from '../types/medical';
import { AUDIT_ACCESS_ROLES, canAccessRoute } from '../utils/permissions';

type TriageTab = 'ALL' | 'Urgente' | 'Prioritario' | 'Rutina';
const SEVERITY_ORDER: Record<string, number> = { Urgente: 1, Prioritario: 2, Rutina: 3 };
const ALL_QUEUES = '__todas__';
const FEEDBACK_MS = 10_000;

const KPI_DEFS = [
  { label: 'Urgente', key: 'Urgente' as const, desc: 'Compromiso vital / Emergencia', icon: AlertCircle, color: 'text-rose-400', border: 'border-rose-500/20', bg: 'bg-rose-500/10' },
  { label: 'Prioritario', key: 'Prioritario' as const, desc: 'Atención preferente / Subagudo', icon: Clock, color: 'text-amber-400', border: 'border-amber-500/20', bg: 'bg-amber-500/10' },
  { label: 'Rutina', key: 'Rutina' as const, desc: 'Atención estándar / Rutina', icon: CheckCircle2, color: 'text-emerald-400', border: 'border-emerald-500/20', bg: 'bg-emerald-500/10' },
];

type Feedback =
  | { kind: 'attended'; doc: DocumentListItemResponse }
  | { kind: 'derived'; doc: DocumentListItemResponse; queueName: string };

const TriagePage = () => {
  const { user } = useAuth();
  // ADMIN y AUDITOR_CLINICO actúan sobre los casos; el OPERADOR solo consulta.
  const canAct = canAccessRoute(user?.role, AUDIT_ACCESS_ROLES);
  const isAdmin = user?.role === 'ADMIN';
  const { colas, cases, loaded, state, error, reload } = useTriageConsole();
  const { notificarCambio } = useDocumentDetailModal();
  const [selectedFilter, setSelectedFilter] = useState<TriageTab>('ALL');
  const [selectedQueue, setSelectedQueue] = useState<string>(ALL_QUEUES);
  const [attendingId, setAttendingId] = useState<string | null>(null);
  const [attendTargetCase, setAttendTargetCase] = useState<DocumentListItemResponse | null>(null);
  const [derivingDoc, setDerivingDoc] = useState<DocumentListItemResponse | null>(null);
  // Se ocultan al instante, sin esperar la recarga de la consola.
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(() => new Set());
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const queueNames = useMemo(() => new Map(colas.map((q) => [q.codigo, q.nombre])), [colas]);
  const { queueName: catalogQueueName } = useCatalogLabels();
  // Las colas de la consola son solo las del usuario: las demás (p. ej. al derivar) salen del catálogo.
  const queueName = useCallback(
    (codigo: string | null) => (codigo ? queueNames.get(codigo) ?? catalogQueueName(codigo) ?? codigo : 'Sin cola'),
    [queueNames, catalogQueueName]
  );

  const hide = (id: string) => setHiddenIds((prev) => new Set(prev).add(id));
  const unhide = (id: string) =>
    setHiddenIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });

  // El aviso se cierra solo; también se reemplaza o se limpia al iniciar otra acción.
  useEffect(() => {
    if (!feedback) return;
    const timer = window.setTimeout(() => setFeedback(null), FEEDBACK_MS);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  const openDerive = useCallback((doc: DocumentListItemResponse) => {
    setFeedback(null);
    setActionError(null);
    setDerivingDoc(doc);
  }, []);

  const openAttend = useCallback((doc: DocumentListItemResponse) => {
    setFeedback(null);
    setActionError(null);
    setAttendTargetCase(doc);
  }, []);

  const handleConfirmAttend = useCallback(async (caseId: string) => {
    const doc = attendTargetCase;
    if (!doc || doc.documento_id !== caseId) return;
    setAttendingId(doc.documento_id);
    setActionError(null);
    setFeedback(null);
    try {
      await documentService.markAttended(doc.documento_id);
      hide(doc.documento_id);
      setFeedback({ kind: 'attended', doc });
      setAttendTargetCase(null);
      reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'No se pudo marcar el caso como atendido');
      throw err;
    } finally {
      setAttendingId(null);
    }
  }, [attendTargetCase, reload]);

  const handleUndo = useCallback(async () => {
    if (feedback?.kind !== 'attended') return;
    setActionError(null);
    try {
      await documentService.unmarkAttended(feedback.doc.documento_id);
      unhide(feedback.doc.documento_id);
      setFeedback(null);
      reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'No se pudo deshacer');
    }
  }, [feedback, reload]);

  const handleDerive = useCallback(async (destino: string, motivo: string): Promise<string | null> => {
    if (!derivingDoc) return null;
    try {
      await documentService.deriveDocument(derivingDoc.documento_id, { destino, motivo });
    } catch (err) {
      return err instanceof Error ? err.message : 'No se pudo derivar el caso';
    }
    // Si la nueva cola no es una de las visibles, el caso sale de la consola.
    if (!queueNames.has(destino)) hide(derivingDoc.documento_id);
    setFeedback({ kind: 'derived', doc: derivingDoc, queueName: queueName(destino) });
    setDerivingDoc(null);
    notificarCambio();
    return null;
  }, [derivingDoc, queueNames, queueName, notificarCambio]);

  const triagedCases = useMemo(() => {
    return cases
      .filter((doc) => !hiddenIds.has(doc.documento_id))
      .filter((doc) => selectedQueue === ALL_QUEUES || doc.destino_enrutamiento === selectedQueue)
      .sort((a, b) => {
        const diff = (SEVERITY_ORDER[normalizePriority(a.nivel_prioridad)] ?? 4) - (SEVERITY_ORDER[normalizePriority(b.nivel_prioridad)] ?? 4);
        if (diff !== 0) return diff;
        return (b.created_at ? new Date(b.created_at).getTime() : 0) - (a.created_at ? new Date(a.created_at).getTime() : 0);
      });
  }, [cases, hiddenIds, selectedQueue]);

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

  const queueOptions = [
    { id: ALL_QUEUES, label: isAdmin ? 'Todas las colas' : 'Todas mis colas' },
    ...colas.map((q) => ({ id: q.codigo, label: q.nombre })),
  ];

  return (
    <div className="max-w-6xl w-full mx-auto p-4 sm:p-6 space-y-5 animate-fade-in">
      <div>
        <div className="flex items-center gap-2.5">
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Consola de Triaje Asistencial</h1>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />Monitoreo en Tiempo Real
          </span>
        </div>
        <p className="text-xs text-slate-400 mt-1">
          {isAdmin ? 'Casos activos de todas las colas asistenciales' : 'Casos activos de tus colas'}, organizados por severidad
        </p>
      </div>

      {loaded && colas.length === 0 ? (
        <div className="p-8 text-center rounded-2xl bg-slate-900/40 border border-slate-800/80 space-y-1">
          <Inbox className="w-8 h-8 text-slate-500 mx-auto mb-2" />
          <p className="text-sm font-medium text-slate-300">
            {isAdmin ? 'No hay colas asistenciales configuradas' : 'No tienes colas asignadas'}
          </p>
          <p className="text-xs text-slate-500">
            {isAdmin
              ? 'Marca "Aparece en la Consola de Triaje" en Catálogos → Colas de Enrutamiento.'
              : 'Pide a un administrador que te asigne colas en Usuarios.'}
          </p>
        </div>
      ) : (
        <>
          <CriticalAlertBanner criticalCount={counts.Urgente} onViewCritical={() => setSelectedFilter('Urgente')} />

          {colas.length > 1 && (
            <div>
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-2">Cola</span>
              <FilterButtonGroup
                options={queueOptions}
                selectedValue={selectedQueue}
                onSelect={setSelectedQueue}
                activeColorClass="bg-sky-500/15 text-sky-300 border border-sky-500/30"
              />
            </div>
          )}

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
            {actionError && (
              <div role="alert" className="flex items-center justify-between gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
                <span>{actionError}</span>
                <button type="button" onClick={() => setActionError(null)} aria-label="Cerrar aviso" className="p-0.5 rounded hover:text-white cursor-pointer">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            {feedback && (
              <div role="status" className="flex items-center justify-between gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs">
                <span className="flex items-center gap-2">
                  {feedback.kind === 'attended' ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                  ) : (
                    <Shuffle className="w-4 h-4 shrink-0 text-emerald-400" />
                  )}
                  {feedback.doc.nombre_paciente || feedback.doc.documento_id}
                  {feedback.kind === 'attended'
                    ? ' marcado como atendido; salió de la consola.'
                    : ` derivado a ${feedback.queueName}.`}
                </span>
                <div className="flex items-center gap-3 shrink-0">
                  {feedback.kind === 'attended' && (
                    <button type="button" onClick={handleUndo} className="flex items-center gap-1 font-medium text-emerald-200 hover:text-white cursor-pointer">
                      <Undo2 className="w-3.5 h-3.5" />Deshacer
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setFeedback(null)}
                    aria-label="Cerrar aviso"
                    className="p-0.5 rounded text-emerald-300/70 hover:text-white cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {!loaded && state === 'loading' ? (
              <div className="space-y-3">{[1, 2].map((i) => <div key={i} className="h-24 rounded-2xl bg-slate-900/50 border border-slate-800 animate-pulse" />)}</div>
            ) : displayedCases.length === 0 ? (
              <div className="p-8 text-center rounded-2xl bg-slate-900/40 border border-slate-800/80">
                <Inbox className="w-8 h-8 text-slate-500 mx-auto mb-2" /><p className="text-sm font-medium text-slate-300">No hay casos en la categoría asistencial seleccionada</p>
              </div>
            ) : (
              <div className={`grid grid-cols-1 md:grid-cols-2 gap-3 transition-opacity ${state === 'loading' ? 'opacity-60' : ''}`}>
                {displayedCases.map((doc) => (
                  <TriageCaseCard
                    key={doc.documento_id}
                    doc={doc}
                    queueName={queueName(doc.destino_enrutamiento)}
                    onAttend={canAct ? openAttend : undefined}
                    onDerive={canAct ? openDerive : undefined}
                    attending={attendingId === doc.documento_id}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {derivingDoc && (
        <DeriveCaseModal
          doc={derivingDoc}
          currentQueueName={queueName(derivingDoc.destino_enrutamiento)}
          onClose={() => setDerivingDoc(null)}
          onDerive={handleDerive}
        />
      )}

      <ConfirmAttendModal
        isOpen={Boolean(attendTargetCase)}
        caseItem={attendTargetCase}
        loading={attendingId === attendTargetCase?.documento_id}
        onClose={() => setAttendTargetCase(null)}
        onConfirm={handleConfirmAttend}
      />
    </div>
  );
};

export default TriagePage;
