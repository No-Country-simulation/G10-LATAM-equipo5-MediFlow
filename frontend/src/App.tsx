import { ClipboardList, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import AuditEditor from "./components/AuditEditor";
import FileUpload from "./components/FileUpload";
import { listarPendientes, type RegistroAuditoria, type TriajeFinalSchema } from "./services/api";

const UMBRAL_CONFIANZA_AUDITORIA = 0.85;

export default function App() {
  const [ultimoResultado, setUltimoResultado] = useState<TriajeFinalSchema | null>(null);
  const [pendientes, setPendientes] = useState<RegistroAuditoria[]>([]);
  const [registroSeleccionado, setRegistroSeleccionado] = useState<RegistroAuditoria | null>(null);

  const refrescarPendientes = useCallback(async () => {
    try {
      const lista = await listarPendientes();
      setPendientes(lista);
    } catch {
      // El backend puede no estar disponible aun; se ignora silenciosamente.
    }
  }, []);

  useEffect(() => {
    void refrescarPendientes();
  }, [refrescarPendientes]);

  const handleProcesado = useCallback(
    (resultado: TriajeFinalSchema) => {
      setUltimoResultado(resultado);
      if (resultado.score_confianza < UMBRAL_CONFIANZA_AUDITORIA) {
        void refrescarPendientes();
      }
    },
    [refrescarPendientes],
  );

  const handleAprobado = useCallback(
    (_registroActualizado: RegistroAuditoria) => {
      setRegistroSeleccionado(null);
      void refrescarPendientes();
    },
    [refrescarPendientes],
  );

  return (
    <div className="app">
      <header className="app__header">
        <ShieldCheck size={28} />
        <div>
          <h1>MediFlow</h1>
          <p>Triaje, extraccion y enrutamiento de documentos clinicos</p>
        </div>
      </header>

      <main className="app__main">
        <section className="app__section">
          <h2>Ingesta de documentos</h2>
          <FileUpload onProcessed={handleProcesado} />

          {ultimoResultado && (
            <div className="app__result-card">
              <h3>Resultado del ultimo documento</h3>
              <dl>
                <dt>Estado</dt>
                <dd>{ultimoResultado.status}</dd>
                <dt>Tipo</dt>
                <dd>{ultimoResultado.tipo_documento}</dd>
                <dt>Prioridad</dt>
                <dd>{ultimoResultado.nivel_prioridad}</dd>
                <dt>Confianza</dt>
                <dd>{(ultimoResultado.score_confianza * 100).toFixed(0)}%</dd>
                <dt>Destino</dt>
                <dd>{ultimoResultado.destino_enrutamiento}</dd>
              </dl>
              <p className="app__justificacion">{ultimoResultado.justificacion_decision}</p>
            </div>
          )}
        </section>

        <section className="app__section">
          <h2>
            <ClipboardList size={20} /> Cola de auditoria manual ({pendientes.length})
          </h2>

          {pendientes.length === 0 && (
            <p className="app__empty">No hay documentos pendientes de revision.</p>
          )}

          <ul className="app__pendientes-list">
            {pendientes.map((registro) => (
              <li key={registro.id}>
                <button
                  type="button"
                  className="app__pendiente-item"
                  onClick={() => setRegistroSeleccionado(registro)}
                >
                  <span>{registro.paciente_nombre}</span>
                  <span>{registro.diagnostico}</span>
                  <span>{(registro.score_confianza * 100).toFixed(0)}%</span>
                </button>
              </li>
            ))}
          </ul>

          {registroSeleccionado && (
            <AuditEditor registro={registroSeleccionado} onAprobado={handleAprobado} />
          )}
        </section>
      </main>
    </div>
  );
}
