import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FieldInput } from './FieldInput';
import type { CatalogField } from './catalogConfig';

describe('FieldInput component', () => {
  it('renders a text input and transforms input to uppercase when uppercase is true', () => {
    const handleChange = vi.fn();
    const field: CatalogField = {
      name: 'codigo',
      label: 'Código',
      kind: 'text',
      required: true,
      uppercase: true,
      placeholder: 'LICENCIA_MEDICA',
      hint: 'No se puede modificar después',
    };

    render(
      <FieldInput
        field={field}
        value=""
        disabled={false}
        onChange={handleChange}
      />
    );

    const input = screen.getByRole('textbox', { name: 'Código' });
    expect(input).toBeInTheDocument();
    expect(screen.getByText('No se puede modificar después')).toBeInTheDocument();

    fireEvent.change(input, { target: { value: 'receta' } });
    expect(handleChange).toHaveBeenCalledWith('RECETA');
  });

  it('renders a textarea for multiline fields', () => {
    const handleChange = vi.fn();
    const field: CatalogField = {
      name: 'descripcion',
      label: 'Descripción para la IA',
      kind: 'textarea',
      required: true,
      placeholder: 'Describir el tipo...',
    };

    render(
      <FieldInput
        field={field}
        value="Texto previo"
        disabled={false}
        onChange={handleChange}
      />
    );

    const textarea = screen.getByRole('textbox', { name: 'Descripción para la IA' });
    expect(textarea.tagName).toBe('TEXTAREA');
    expect(textarea).toHaveValue('Texto previo');

    fireEvent.change(textarea, { target: { value: 'Nueva descripción' } });
    expect(handleChange).toHaveBeenCalledWith('Nueva descripción');
  });

  it('renders a checkbox and triggers onChange with boolean value', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    const field: CatalogField = {
      name: 'es_asistencial',
      label: 'Aparece en la Consola de Triaje',
      kind: 'checkbox',
      hint: 'Cola de atención directa',
    };

    render(
      <FieldInput
        field={field}
        value={false}
        disabled={false}
        onChange={handleChange}
      />
    );

    const checkbox = screen.getByRole('checkbox', { name: /aparece en la consola de triaje/i });
    expect(checkbox).not.toBeChecked();

    await user.click(checkbox);
    expect(handleChange).toHaveBeenCalledWith(true);
  });

  it('disables input when disabled prop is true', () => {
    const field: CatalogField = {
      name: 'codigo',
      label: 'Código',
      kind: 'text',
      createOnly: true,
    };

    render(
      <FieldInput
        field={field}
        value="RECETA_MEDICA"
        disabled={true}
        onChange={vi.fn()}
      />
    );

    const input = screen.getByRole('textbox', { name: 'Código' });
    expect(input).toBeDisabled();
  });
});
