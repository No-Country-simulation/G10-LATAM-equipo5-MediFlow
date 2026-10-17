import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import PriorityBadge from './PriorityBadge';

describe('PriorityBadge clinical severity and visual mapping', () => {
  it('maps Urgente priority to Rose/Red styling with pulsing dot', () => {
    const { container } = render(<PriorityBadge prioridad="Urgente" />);

    expect(screen.getByText('Urgente')).toBeInTheDocument();
    const badge = screen.getByText('Urgente').closest('span.inline-flex')!;
    expect(badge.className).toContain('text-rose-400');
    expect(badge.className).toContain('border-rose-500/30');

    // Pulsing dot indicator
    const dot = container.querySelector('.animate-pulse');
    expect(dot).toBeInTheDocument();
    expect(dot?.className).toContain('bg-rose-500');
  });

  it('normalizes diacritics and accents (crítica / CRÍTICA / alta) to Urgente Rose', () => {
    const { rerender } = render(<PriorityBadge prioridad="crítica" />);
    expect(screen.getByText('Urgente')).toBeInTheDocument();
    const badge = screen.getByText('Urgente').closest('span.inline-flex')!;
    expect(badge.className).toContain('text-rose-400');

    rerender(<PriorityBadge prioridad="CRÍTICA" />);
    expect(screen.getByText('Urgente')).toBeInTheDocument();

    rerender(<PriorityBadge prioridad="critica" />);
    expect(screen.getByText('Urgente')).toBeInTheDocument();

    rerender(<PriorityBadge prioridad="alta" />);
    expect(screen.getByText('Urgente')).toBeInTheDocument();
  });

  it('maps Prioritario / media to Amber styling', () => {
    const { rerender } = render(<PriorityBadge prioridad="Prioritario" />);
    expect(screen.getByText('Prioritario')).toBeInTheDocument();
    let badge = screen.getByText('Prioritario').closest('span.inline-flex')!;
    expect(badge.className).toContain('text-amber-400');
    expect(badge.className).toContain('border-amber-500/30');

    rerender(<PriorityBadge prioridad="media" />);
    expect(screen.getByText('Prioritario')).toBeInTheDocument();
    badge = screen.getByText('Prioritario').closest('span.inline-flex')!;
    expect(badge.className).toContain('text-amber-400');
  });

  it('maps Rutina / empty / fallback values to Emerald styling', () => {
    const { rerender } = render(<PriorityBadge prioridad="Rutina" />);
    expect(screen.getByText('Rutina')).toBeInTheDocument();
    let badge = screen.getByText('Rutina').closest('span.inline-flex')!;
    expect(badge.className).toContain('text-emerald-400');
    expect(badge.className).toContain('border-emerald-500/30');

    rerender(<PriorityBadge prioridad="" />);
    expect(screen.getByText('Rutina')).toBeInTheDocument();
    badge = screen.getByText('Rutina').closest('span.inline-flex')!;
    expect(badge.className).toContain('text-emerald-400');

    rerender(<PriorityBadge prioridad="estándar" />);
    expect(screen.getByText('Rutina')).toBeInTheDocument();
  });

  it('conditionally hides the status dot when showDot is false', () => {
    const { container, rerender } = render(<PriorityBadge prioridad="Urgente" showDot={true} />);
    expect(container.querySelector('.bg-rose-500')).toBeInTheDocument();

    rerender(<PriorityBadge prioridad="Urgente" showDot={false} />);
    expect(container.querySelector('.bg-rose-500')).not.toBeInTheDocument();
  });

  it('merges custom className prop with base badge styles', () => {
    render(<PriorityBadge prioridad="Prioritario" className="custom-shadow extra-margin" />);
    const badge = screen.getByText('Prioritario').closest('span.inline-flex')!;
    expect(badge.className).toContain('custom-shadow');
    expect(badge.className).toContain('extra-margin');
    expect(badge.className).toContain('text-amber-400');
  });
});
