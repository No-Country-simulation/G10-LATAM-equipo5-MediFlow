export interface QueueActiveForLLM {
  codigo: string;
  nombre: string;
  descripcion_semantica: string;
}

export interface DocumentTypeActiveForLLM {
  codigo: string;
  nombre: string;
  descripcion: string | null;
}
