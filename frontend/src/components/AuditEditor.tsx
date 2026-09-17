import { CheckCircle2, Loader2, Pill, Trash2 } from "lucide-react";
import { useState } from "react";

import {
  aprobarRegistro,
  type DatosClinicosSchema,
  type MedicamentoItem,
  type RegistroAuditoria,
} from "../services/api";

interface AuditEditorProps {
  registro: RegistroAuditoria;
  onAprobado: (registroActualizado: RegistroAuditoria) => void;
}

const CAMPO_VACIO: MedicamentoItem = { nombre: "", dosis: "", frecuencia: "" };

export default function AuditEditor({ registro, onAprobado }: AuditEditorProps) {
  const [datos, setDatos] = useState<DatosClinicosSchema>(
    registro.payload_json.datos_extraidos,
  );
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const actualizarCampo = <K extends keyof DatosClinicosSchema>(
    campo: K,
    valor: DatosClinicosSchema[K],
  ) => {
    setDatos((previo) => ({ ...previo, [campo]: valor }));
  };

  const actualizarMedicamento = (indice: number, campo: keyof MedicamentoItem, valor: string) => {
    setDatos((previo) => {
      const medicamentos = [...previo.medicamentos];
      medicamentos[indice] = { ...medicamentos[indice], [campo]: valor };
      return { ...previo, medicamentos };
    });
  };

  const agregarMedicamento = () => {
    setDatos((previo) => ({
      ...previo,
      medicamentos: [...previo.medicamentos, { ...CAMPO_VACIO }],
    }));
  };

  const eliminarMedicamento = (indice: number) => {
    setDatos((previo) => ({
      ...previo,
      medicamentos: previo.medicamentos.filter((_, i) => i !== indice),
    }));
  };

  const handleAprobar = async () => {
    setIsSaving(true);
    setError(null);
    try {
      const actualizado = await aprobarRegistro(registro.id);
      onAprobado(actualizado);
    } catch {
      setError("No se pudo aprobar el registro. Intenta nuevamente.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="audit-editor">
      <header className="audit-editor__header">
        <h3>Revision manual requerida</h3>
        <span className="audit-editor__score">
          Confianza: {(registro.score_confianza * 100).toFixed(0)}%
        </span>
      </header>

      <div className="audit-editor__grid">
        <label className="audit-editor__field">
          Paciente
          <input
            value={datos.paciente_nombre}
            onChange={(event) => actualizarCampo("paciente_nombre", event.target.value)}
          />
        </label>

        <label className="audit-editor__field">
          Edad
          <input
            type="number"
            value={datos.paciente_edad ?? ""}
            onChange={(event) =>
              actualizarCampo(
                "paciente_edad",
                event.target.value === "" ? null : Number(event.target.value),
              )
            }
          />
        </label>

        <label className="audit-editor__field">
          Medico solicitante
          <input
            value={datos.medico_solicitante ?? ""}
            onChange={(event) => actualizarCampo("medico_solicitante", event.target.value)}
          />
        </label>

        <label className="audit-editor__field">
          CIE-10 sugerido
          <input
            value={datos.cie10_sugerido ?? ""}
            onChange={(event) => actualizarCampo("cie10_sugerido", event.target.value)}
          />
        </label>

        <label className="audit-editor__field audit-editor__field--full">
          Diagnostico principal
          <textarea
            value={datos.diagnostico_principal}
            onChange={(event) => actualizarCampo("diagnostico_principal", event.target.value)}
          />
        </label>
      </div>

      <div className="audit-editor__medicamentos">
        <div className="audit-editor__medicamentos-header">
          <Pill size={16} />
          <span>Medicamentos</span>
        </div>

        {datos.medicamentos.map((medicamento, indice) => (
          <div className="audit-editor__medicamento-row" key={indice}>
            <input
              placeholder="Nombre"
              value={medicamento.nombre}
              onChange={(event) => actualizarMedicamento(indice, "nombre", event.target.value)}
            />
            <input
              placeholder="Dosis"
              value={medicamento.dosis}
              onChange={(event) => actualizarMedicamento(indice, "dosis", event.target.value)}
            />
            <input
              placeholder="Frecuencia"
              value={medicamento.frecuencia}
              onChange={(event) => actualizarMedicamento(indice, "frecuencia", event.target.value)}
            />
            <button
              type="button"
              className="audit-editor__icon-button"
              onClick={() => eliminarMedicamento(indice)}
              aria-label="Eliminar medicamento"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}

        <button type="button" className="audit-editor__link-button" onClick={agregarMedicamento}>
          + Agregar medicamento
        </button>
      </div>

      {error && <p className="audit-editor__error">{error}</p>}

      <button
        type="button"
        className="audit-editor__submit"
        onClick={handleAprobar}
        disabled={isSaving}
      >
        {isSaving ? <Loader2 size={16} className="file-upload__icon--spin" /> : <CheckCircle2 size={16} />}
        Aprobar y enrutar
      </button>
    </div>
  );
}
