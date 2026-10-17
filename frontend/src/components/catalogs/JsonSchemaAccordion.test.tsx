import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { JsonSchemaAccordion } from './JsonSchemaAccordion';
import type { CatalogField } from './catalogConfig';

describe('JsonSchemaAccordion component', () => {
  const jsonField: CatalogField = {
    name: 'campos_extraccion',
    label: 'Campos adicionales (JSON Schema, opcional)',
    kind: 'json',
    placeholder: '{\n  "type": "object"\n}',
    hint: 'Debe ser un objeto con "type": "object". Vacío = sin campos adicionales.',
  };

  it('renders collapsed by default when value has no active schema', () => {
    render(
      <JsonSchemaAccordion
        field={jsonField}
        value=""
        disabled={false}
        error={null}
        onChange={vi.fn()}
      />
    );

    const trigger = screen.getByRole('button', { name: /opciones avanzadas/i });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('initializes open and displays active schema badge when preloaded with a schema', () => {
    const activeSchema = JSON.stringify({
      type: 'object',
      properties: { dias_reposo: { type: 'integer' } },
    });

    render(
      <JsonSchemaAccordion
        field={jsonField}
        value={activeSchema}
        disabled={false}
        error={null}
        onChange={vi.fn()}
      />
    );

    const trigger = screen.getByRole('button', { name: /ocultar opciones avanzadas/i });
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Esquema activo')).toBeInTheDocument();

    const textarea = screen.getByRole('textbox');
    expect(textarea).toBeInTheDocument();
    expect(textarea).toHaveValue(activeSchema);
  });

  it('toggles accordion expansion on button click and calls onChange when typing', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(
      <JsonSchemaAccordion
        field={jsonField}
        value=""
        disabled={false}
        error={null}
        onChange={handleChange}
      />
    );

    const trigger = screen.getByRole('button', { name: /opciones avanzadas/i });

    // 1st click: Expands accordion
    await user.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    const textarea = screen.getByRole('textbox');
    expect(textarea).toBeInTheDocument();

    // Type inside textarea
    fireEvent.change(textarea, { target: { value: '{"type": "object"}' } });
    expect(handleChange).toHaveBeenCalledWith('{"type": "object"}');

    // 2nd click: Collapses accordion
    await user.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('renders visual error feedback and badge when error prop is provided', async () => {
    const user = userEvent.setup();
    const errorMessage = 'Formato JSON inválido: revise comillas, llaves y comas.';

    render(
      <JsonSchemaAccordion
        field={jsonField}
        value="broken json"
        disabled={false}
        error={errorMessage}
        onChange={vi.fn()}
      />
    );

    expect(screen.getByText('JSON inválido')).toBeInTheDocument();

    // Open accordion to inspect message container
    const trigger = screen.getByRole('button');
    await user.click(trigger);

    expect(screen.getByText(errorMessage)).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toHaveClass('border-rose-500/70');
  });

  it('disables trigger and textarea when disabled prop is true', () => {
    const activeSchema = '{"type": "object", "properties": {}}';

    render(
      <JsonSchemaAccordion
        field={jsonField}
        value={activeSchema}
        disabled={true}
        error={null}
        onChange={vi.fn()}
      />
    );

    const trigger = screen.getByRole('button');
    expect(trigger).toBeDisabled();

    const textarea = screen.getByRole('textbox');
    expect(textarea).toBeDisabled();
  });
});
