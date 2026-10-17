import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SchemaField } from './SchemaField';
import type { JsonSchema, JsonValue } from '../../../types/forms';

describe('Cross-contract test: Catálogos JSON Schema <-> SchemaField', () => {
  // Real JSON Schema defined following the Catalogs Accordion structure
  const catalogGeneratedSchema: JsonSchema = {
    type: 'object',
    title: 'Extracción Licencia Médica',
    properties: {
      dias_reposo: {
        type: 'integer',
        title: 'Días de reposo',
      },
      lugar_reposo: {
        type: 'string',
        title: 'Lugar de reposo',
      },
      es_prorroga: {
        type: 'boolean',
        title: 'Es prórroga',
      },
      tipo_reposo: {
        type: 'string',
        title: 'Tipo de reposo',
        enum: ['TOTAL', 'PARCIAL'],
      },
      fecha_inicio: {
        type: 'string',
        title: 'Fecha de inicio',
        format: 'date',
      },
    },
  };

  it('dynamically renders all scalar types without runtime exceptions', () => {
    const initialValue: Record<string, JsonValue> = {
      dias_reposo: 15,
      lugar_reposo: 'Domicilio particular',
      es_prorroga: true,
      tipo_reposo: 'TOTAL',
      fecha_inicio: '2026-10-17',
    };

    render(
      <SchemaField
        schema={catalogGeneratedSchema}
        value={initialValue}
        onChange={vi.fn()}
        path="campos_extraccion"
        label="Datos Específicos"
      />
    );

    // Number / integer field
    const numberInput = screen.getByRole('spinbutton', { name: 'Días de reposo' });
    expect(numberInput).toBeInTheDocument();
    expect(numberInput).toHaveValue(15);

    // String field
    const textInput = screen.getByRole('textbox', { name: 'Lugar de reposo' });
    expect(textInput).toBeInTheDocument();
    expect(textInput).toHaveValue('Domicilio particular');

    // Boolean field (select Sí/No)
    const boolSelect = screen.getByRole('combobox', { name: 'Es prórroga' });
    expect(boolSelect).toBeInTheDocument();
    expect(boolSelect).toHaveValue('si');

    // Enum field (select with options)
    const enumSelect = screen.getByRole('combobox', { name: 'Tipo de reposo' });
    expect(enumSelect).toBeInTheDocument();
    expect(enumSelect).toHaveValue('TOTAL');

    // Date field (input type="date")
    const dateInput = screen.getByLabelText('Fecha de inicio');
    expect(dateInput).toBeInTheDocument();
    expect(dateInput).toHaveAttribute('type', 'date');
    expect(dateInput).toHaveValue('2026-10-17');
  });

  it('triggers onChange with updated object values when modifying inputs', () => {
    const handleChange = vi.fn();
    const initialValue: Record<string, JsonValue> = {
      dias_reposo: 10,
      lugar_reposo: '',
    };

    render(
      <SchemaField
        schema={catalogGeneratedSchema}
        value={initialValue}
        onChange={handleChange}
        path="campos_extraccion"
        label="Datos Específicos"
      />
    );

    // 1. Modify integer input
    const numberInput = screen.getByRole('spinbutton', { name: 'Días de reposo' });
    fireEvent.change(numberInput, { target: { value: '20' } });
    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({ dias_reposo: 20 })
    );

    // 2. Modify text input
    const textInput = screen.getByRole('textbox', { name: 'Lugar de reposo' });
    fireEvent.change(textInput, { target: { value: 'Hospital Clínico' } });
    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({ lugar_reposo: 'Hospital Clínico' })
    );

    // 3. Modify boolean input
    const boolSelect = screen.getByRole('combobox', { name: 'Es prórroga' });
    fireEvent.change(boolSelect, { target: { value: 'no' } });
    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({ es_prorroga: false })
    );

    // 4. Modify enum input
    const enumSelect = screen.getByRole('combobox', { name: 'Tipo de reposo' });
    fireEvent.change(enumSelect, { target: { value: 'PARCIAL' } });
    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({ tipo_reposo: 'PARCIAL' })
    );

    // 5. Modify date input
    const dateInput = screen.getByLabelText('Fecha de inicio');
    fireEvent.change(dateInput, { target: { value: '2026-11-01' } });
    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({ fecha_inicio: '2026-11-01' })
    );
  });
});
