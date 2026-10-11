/** Identificación del paciente con su tipo, para mostrar: `RUT 12345678-5`, `DNI 30123456`. */
export const formatIdentificacion = (
  numero: string | null | undefined,
  tipo?: string | null,
  sinDato = 'Sin identificación'
): string => {
  if (!numero) return sinDato;
  return tipo && tipo !== 'OTRO' ? `${tipo} ${numero}` : numero;
};
