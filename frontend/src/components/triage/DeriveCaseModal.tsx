import { useState, type FormEvent } from 'react';
import { Loader2, Shuffle } from 'lucide-react';
import type { DocumentListItemResponse } from '../../types/medical';
import { useQueuesSummary } from '../../hooks/useQueuesSummary';
import { ModalShell } from '../common/ModalShell';
import { StatusBanner } from '../common/StatusBanner';
import { BUTTON_GHOST, BUTTON_PRIMARY, HINT, INPUT_BASE, LABEL } from '../common/formStyles';

const MIN_MOTIVO = 5;

interface DeriveCaseModalProps {
  doc: DocumentListItemResponse;
  /** Nombre de la cola actual (para el subtítulo). */
  currentQueueName: string;
  onClose: () => void;
  /** Devuelve un mensaje de error, o `null` si la derivación se guardó. */
  onDerive: (destino: string, motivo: string) => Promise<string | null>;
}

/** Deriva un caso a otra cola con un motivo, que queda en el historial del documento. */
const DeriveCaseModal = ({ doc, currentQueueName, onClose, onDerive }: DeriveCaseModalProps) => {
  const { queues, error: queuesError } = useQueuesSummary(true);
  const [destino, setDestino] = useState('');
  const [motivo, setMotivo] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const opciones = queues.filter((q) => q.codigo !== doc.destino_enrutamiento);
  const destinoElegido = opciones.find((q) => q.codigo === destino);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!destino) return setError('Elige la cola de destino');
    if (motivo.trim().length < MIN_MOTIVO) return setError(`El motivo debe tener al menos ${MIN_MOTIVO} caracteres`);
    setSubmitting(true);
    setError(null);
    const failure = await onDerive(destino, motivo.trim());
    setSubmitting(false);
    if (failure) setError(failure);
  };

  return (
    <ModalShell
      titleId="derivar-caso-titulo"
      title="Derivar caso"
      subtitle={`${doc.nombre_paciente || doc.documento_id} · hoy en ${currentQueueName}`}
      icon={Shuffle}
      onClose={onClose}
      closeDisabled={submitting}
    >
      <div className="mt-4 space-y-2 empty:hidden">
        <StatusBanner tone="error" message={error} />
        <StatusBanner tone="error" message={queuesError} />
      </div>

      <form onSubmit={(e) => void handleSubmit(e)} className="mt-4 space-y-3.5">
        <div>
          <label htmlFor="derivar-destino" className={LABEL}>Derivar a</label>
          <select
            id="derivar-destino"
            required
            value={destino}
            onChange={(e) => setDestino(e.target.value)}
            className={`w-full px-3 cursor-pointer ${INPUT_BASE}`}
          >
            <option value="" disabled className="bg-slate-900 text-slate-500">Seleccionar cola...</option>
            {opciones.map((q) => (
              <option key={q.id} value={q.codigo} className="bg-slate-900 text-white">
                {q.nombre}{q.es_asistencial ? '' : ' (fuera de Triaje)'}
              </option>
            ))}
          </select>
          {destinoElegido && !destinoElegido.es_asistencial && (
            <p className={HINT}>Esta cola no aparece en la Consola de Triaje: el caso saldrá de la consola.</p>
          )}
        </div>

        <div>
          <label htmlFor="derivar-motivo" className={LABEL}>Motivo</label>
          <textarea
            id="derivar-motivo"
            required
            rows={4}
            minLength={MIN_MOTIVO}
            maxLength={1000}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ej.: la biopsia confirma malignidad, corresponde a Oncología."
            className={`w-full px-3 resize-y ${INPUT_BASE}`}
          />
          <p className={HINT}>Queda registrado en el historial del documento.</p>
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800/80">
          <button type="button" onClick={onClose} disabled={submitting} className={BUTTON_GHOST}>Cancelar</button>
          <button type="submit" disabled={submitting} className={BUTTON_PRIMARY}>
            {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Shuffle className="w-3.5 h-3.5" />}
            <span>Derivar</span>
          </button>
        </div>
      </form>
    </ModalShell>
  );
};

export default DeriveCaseModal;
