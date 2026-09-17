import axios from "axios";

const API_BASE_URL: string =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api/v1";

const httpClient = axios.create({
  baseURL: API_BASE_URL,
});

export type NivelPrioridad = "CRITICO" | "ALTO" | "MEDIO" | "BAJO";
export type TipoDocumento =
  | "RECETA"
  | "LABORATORIO"
  | "RADIOLOGIA"
  | "CERTIFICADO"
  | "DESCONOCIDO";
export type EstadoTriaje =
  | "PROCESADO"
  | "PENDIENTE_AUDITORIA"
  | "APROBADO"
  | "RECHAZADO";

export interface MedicamentoItem {
  nombre: string;
  dosis: string;
  frecuencia: string;
}

export interface DatosClinicosSchema {
  paciente_nombre: string;
  paciente_edad: number | null;
  medico_solicitante: string | null;
  diagnostico_principal: string;
  cie10_sugerido: string | null;
  medicamentos: MedicamentoItem[];
}

export interface TriajeFinalSchema {
  documento_id: string;
  status: EstadoTriaje;
  tipo_documento: TipoDocumento;
  nivel_prioridad: NivelPrioridad;
  score_confianza: number;
  datos_extraidos: DatosClinicosSchema;
  justificacion_decision: string;
  destino_enrutamiento: string;
  ruta_oci: string | null;
}

export interface RegistroAuditoria {
  id: number;
  paciente_nombre: string;
  diagnostico: string;
  score_confianza: number;
  estado: string;
  payload_json: TriajeFinalSchema;
  creado_en: string;
}

export async function procesarDocumento(file: File): Promise<TriajeFinalSchema> {
  const formData = new FormData();
  formData.append("file", file);

  const { data } = await httpClient.post<TriajeFinalSchema>(
    "/documentos/procesar",
    formData,
    { headers: { "Content-Type": "multipart/form-data" } },
  );
  return data;
}

export async function listarPendientes(): Promise<RegistroAuditoria[]> {
  const { data } = await httpClient.get<RegistroAuditoria[]>(
    "/auditoria/pendientes",
  );
  return data;
}

export async function aprobarRegistro(
  registroId: number,
): Promise<RegistroAuditoria> {
  const { data } = await httpClient.put<RegistroAuditoria>(
    `/auditoria/${registroId}/aprobar`,
  );
  return data;
}
