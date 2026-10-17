import { describe, it, expect } from 'vitest';
import {
  buildPayload,
  hasConfiguredSchema,
  initialValues,
  validateJsonSyntax,
} from './catalogForm';
import { CATALOGS } from './catalogConfig';
import type { DocumentTypeRecord } from '../../types/catalog';

describe('catalogForm logic and transformations', () => {
  const docTypeDefinition = CATALOGS.find((c) => c.key === 'documentTypes')!;
  const fields = docTypeDefinition.fields;

  describe('Empty payload normalization (FastAPI 422 prevention)', () => {
    it('sets campos_extraccion to null when json input is empty or whitespace', () => {
      const values = {
        codigo: 'DEFUNCION',
        nombre: 'Certificado de Defunción',
        descripcion: 'Certificado emitido tras el fallecimiento de un paciente',
        campos_extraccion: '   ',
      };

      const result = buildPayload(fields, values, false);

      expect(result.error).toBeUndefined();
      expect(result.payload).toBeDefined();
      expect(result.payload?.campos_extraccion).toBeNull();
      // Guarantees it is null and never empty string "" which triggers 422 Unprocessable Entity
      expect(result.payload?.campos_extraccion).not.toBe('');
    });

    it('sets campos_extraccion to null when json input is an empty object string "{}"', () => {
      const values = {
        codigo: 'DEFUNCION',
        nombre: 'Certificado de Defunción',
        descripcion: 'Certificado emitido tras el fallecimiento de un paciente',
        campos_extraccion: '{}',
      };

      const result = buildPayload(fields, values, false);

      expect(result.error).toBeUndefined();
      expect(result.payload?.campos_extraccion).toBeNull();
    });
  });

  describe('Valid JSON Schema validation and parsing', () => {
    const validSchema = {
      type: 'object',
      properties: {
        dias_reposo: { type: 'integer', title: 'Días de reposo' },
      },
    };
    const validSchemaString = JSON.stringify(validSchema, null, 2);

    it('passes syntax validation with null error', () => {
      const error = validateJsonSyntax(validSchemaString);
      expect(error).toBeNull();
    });

    it('identifies schema as active and configured', () => {
      expect(hasConfiguredSchema(validSchemaString)).toBe(true);
      expect(hasConfiguredSchema(validSchema)).toBe(true);
    });

    it('builds payload parsing the schema string into a real object', () => {
      const values = {
        codigo: 'LICENCIA_MEDICA',
        nombre: 'Licencia Médica',
        descripcion: 'Reposo laboral',
        campos_extraccion: validSchemaString,
      };

      const result = buildPayload(fields, values, false);

      expect(result.error).toBeUndefined();
      expect(result.payload?.campos_extraccion).toEqual(validSchema);
    });
  });

  describe('Corrupted JSON and invalid root structure rejection', () => {
    it('detects syntax errors in JSON before submission', () => {
      const brokenJson = '{"type": "object",';

      const syntaxError = validateJsonSyntax(brokenJson);
      expect(syntaxError).toBe('Formato JSON inválido: revise comillas, llaves y comas.');

      const result = buildPayload(fields, {
        codigo: 'TEST',
        nombre: 'Test',
        descripcion: 'Desc',
        campos_extraccion: brokenJson,
      }, false);

      expect(result.payload).toBeUndefined();
      expect(result.error).toContain('el JSON no es válido');
    });

    it('rejects array root structure since an object schema is required', () => {
      const arrayJson = '[1, 2, 3]';

      const syntaxError = validateJsonSyntax(arrayJson);
      expect(syntaxError).toBe('Formato JSON inválido: revise comillas, llaves y comas.');

      const result = buildPayload(fields, {
        codigo: 'TEST',
        nombre: 'Test',
        descripcion: 'Desc',
        campos_extraccion: arrayJson,
      }, false);

      expect(result.payload).toBeUndefined();
      expect(result.error).toContain('debe ser un objeto JSON');
    });

    it('rejects primitive root values', () => {
      const primitiveJson = '"simple string"';

      const syntaxError = validateJsonSyntax(primitiveJson);
      expect(syntaxError).toBe('Formato JSON inválido: revise comillas, llaves y comas.');
    });
  });

  describe('Immutable codigo in edit mode', () => {
    it('includes codigo on creation but omits it on update', () => {
      const values = {
        codigo: 'CERTIFICADO',
        nombre: 'Certificado Médico',
        descripcion: 'Documento general',
        campos_extraccion: '',
      };

      const createResult = buildPayload(fields, values, false);
      expect(createResult.payload).toHaveProperty('codigo', 'CERTIFICADO');

      const editResult = buildPayload(fields, values, true);
      expect(editResult.payload).not.toHaveProperty('codigo');
      expect(editResult.payload?.nombre).toBe('Certificado Médico');
    });
  });

  describe('hasConfiguredSchema edge cases', () => {
    it('returns false for falsy or empty inputs', () => {
      expect(hasConfiguredSchema('')).toBe(false);
      expect(hasConfiguredSchema('   ')).toBe(false);
      expect(hasConfiguredSchema('{}')).toBe(false);
      expect(hasConfiguredSchema(null)).toBe(false);
      expect(hasConfiguredSchema(undefined)).toBe(false);
      expect(hasConfiguredSchema({})).toBe(false);
      expect(hasConfiguredSchema([])).toBe(false);
      expect(hasConfiguredSchema('{ invalid json')).toBe(false);
    });
  });

  describe('initialValues helper', () => {
    it('returns empty strings when record is undefined', () => {
      const initial = initialValues(fields, undefined);
      expect(initial.codigo).toBe('');
      expect(initial.nombre).toBe('');
      expect(initial.descripcion).toBe('');
      expect(initial.campos_extraccion).toBe('');
    });

    it('populates fields from record and serializes json objects', () => {
      const record: DocumentTypeRecord = {
        id: '1',
        codigo: 'RECETA',
        nombre: 'Receta Médica',
        descripcion: 'Prescripción de fármacos',
        campos_extraccion: { type: 'object', properties: { medicamento: { type: 'string' } } },
        is_active: true,
        es_sistema: false,
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
      };

      const initial = initialValues(fields, record);
      expect(initial.codigo).toBe('RECETA');
      expect(initial.nombre).toBe('Receta Médica');
      expect(typeof initial.campos_extraccion).toBe('string');
      expect(JSON.parse(initial.campos_extraccion as string)).toEqual(record.campos_extraccion);
    });
  });
});
