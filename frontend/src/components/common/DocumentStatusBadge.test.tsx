import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import DocumentStatusBadge from './DocumentStatusBadge';

describe('DocumentStatusBadge lifecycle and clinical review override', () => {
  it('renders PROCESADO status with sky blue styling and check icon', () => {
    render(<DocumentStatusBadge estado="PROCESADO" />);

    expect(screen.getByText('Procesado')).toBeInTheDocument();
    const badge = screen.getByText('Procesado');
    expect(badge.className).toContain('text-sky-400');
    expect(badge.className).toContain('border-sky-500/30');
    expect(badge).toHaveAttribute('title', 'Estado: Procesado');
  });

  it('renders AUDITADO status with emerald styling and shield check icon', () => {
    render(<DocumentStatusBadge estado="AUDITADO" />);

    expect(screen.getByText('Auditado')).toBeInTheDocument();
    const badge = screen.getByText('Auditado');
    expect(badge.className).toContain('text-emerald-400');
    expect(badge.className).toContain('border-emerald-500/30');
    expect(badge).toHaveAttribute('title', 'Estado: Auditado');
  });

  it('renders PENDIENTE_AUDITORIA status with amber styling and alert icon', () => {
    render(<DocumentStatusBadge estado="PENDIENTE_AUDITORIA" />);

    expect(screen.getByText('Auditoría Requerida')).toBeInTheDocument();
    const badge = screen.getByText('Auditoría Requerida');
    expect(badge.className).toContain('text-amber-400');
    expect(badge.className).toContain('border-amber-500/30');
    expect(badge).toHaveAttribute('title', 'Estado: Auditoría Requerida');
  });

  it('renders DESCARTADO and ELIMINADO states with respective palette styling', () => {
    const { rerender } = render(<DocumentStatusBadge estado="DESCARTADO" />);
    expect(screen.getByText('Descartado')).toBeInTheDocument();
    let badge = screen.getByText('Descartado');
    expect(badge.className).toContain('text-slate-400');

    rerender(<DocumentStatusBadge estado="ELIMINADO" />);
    expect(screen.getByText('Eliminado')).toBeInTheDocument();
    badge = screen.getByText('Eliminado');
    expect(badge.className).toContain('text-rose-400');
  });

  it('dynamically displays Auditoría Requerida when PROCESADO has requiereAuditoria true', () => {
    const { rerender } = render(
      <DocumentStatusBadge estado="PROCESADO" requiereAuditoria={true} />
    );

    expect(screen.getByText('Auditoría Requerida')).toBeInTheDocument();
    let badge = screen.getByText('Auditoría Requerida');
    expect(badge.className).toContain('text-amber-400');

    rerender(<DocumentStatusBadge estado="PROCESADO" requiereAuditoria={false} />);
    expect(screen.getByText('Procesado')).toBeInTheDocument();
    badge = screen.getByText('Procesado');
    expect(badge.className).toContain('text-sky-400');
  });

  it('preserves AUDITADO status even if requiereAuditoria is true', () => {
    render(<DocumentStatusBadge estado="AUDITADO" requiereAuditoria={true} />);

    // Once audited by human physician, status stays AUDITADO
    expect(screen.getByText('Auditado')).toBeInTheDocument();
    const badge = screen.getByText('Auditado');
    expect(badge.className).toContain('text-emerald-400');
  });
});
