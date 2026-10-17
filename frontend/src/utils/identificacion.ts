/** Limpia un RUT eliminando puntos, guiones y espacios, en mayúsculas. */
export const cleanRut = (rut: string | null | undefined): string => {
  if (!rut) return '';
  return rut.replace(/[^0-9kK]/g, '').toUpperCase();
};

/** Calcula el dígito verificador para un cuerpo de RUT según Módulo 11 chileno. */
export const calculateDv = (rutBody: number | string): string => {
  const cleanBody = String(rutBody).replace(/\D/g, '');
  if (!cleanBody) return '';
  let sum = 0;
  let multiplier = 2;
  for (let i = cleanBody.length - 1; i >= 0; i--) {
    sum += Number(cleanBody[i]) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }
  const remainder = 11 - (sum % 11);
  if (remainder === 11) return '0';
  if (remainder === 10) return 'K';
  return String(remainder);
};

/** Valida un RUT chileno completo (con o sin formato) contra el Módulo 11. */
export const validateRut = (rut: string | null | undefined): boolean => {
  const cleaned = cleanRut(rut);
  if (cleaned.length < 2) return false;
  const body = cleaned.slice(0, -1);
  const dv = cleaned.slice(-1);
  if (!/^\d+$/.test(body)) return false;
  return calculateDv(body) === dv;
};

/** Formatea un RUT con guion y opcionalmente con puntos separadores de miles. */
export const formatRut = (rut: string | null | undefined, withDots = true): string => {
  const cleaned = cleanRut(rut);
  if (cleaned.length < 2) return rut?.trim() ?? '';
  const body = cleaned.slice(0, -1);
  const dv = cleaned.slice(-1);
  const formattedBody = withDots ? body.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : body;
  return `${formattedBody}-${dv}`;
};

// Alias en español para convención clínica
export const validarRut = validateRut;
export const formatearRut = formatRut;
export const limpiarRut = cleanRut;
export const calcularDv = calculateDv;

/** Identificación del paciente con su tipo, para mostrar: `RUT 12345678-5`, `DNI 30123456`. */
export const formatIdentificacion = (
  numero: string | null | undefined,
  tipo?: string | null,
  sinDato = 'Sin identificación'
): string => {
  if (!numero) return sinDato;
  return tipo && tipo !== 'OTRO' ? `${tipo} ${numero}` : numero;
};

