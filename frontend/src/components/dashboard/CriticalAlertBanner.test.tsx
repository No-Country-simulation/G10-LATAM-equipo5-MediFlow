import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CriticalAlertBanner from './CriticalAlertBanner';

describe('CriticalAlertBanner vital risk detection and priority reaction', () => {
  it('does not render anything when criticalCount is 0 or negative', () => {
    const { container, rerender } = render(
      <CriticalAlertBanner criticalCount={0} onViewCritical={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();

    rerender(<CriticalAlertBanner criticalCount={-1} onViewCritical={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders critical urgency banner with singular badge for 1 active case', () => {
    render(<CriticalAlertBanner criticalCount={1} onViewCritical={vi.fn()} />);

    expect(screen.getByText('Alerta de Urgencia Crítica')).toBeInTheDocument();
    expect(screen.getByText('1 ACTIVA')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Protocolo TEP Agudo activado: compromiso vital detectado por IA con enrutamiento prioritario.'
      )
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /atender urgencias/i })).toBeInTheDocument();
  });

  it('renders plural badge when there are multiple critical active cases', () => {
    render(<CriticalAlertBanner criticalCount={3} onViewCritical={vi.fn()} />);

    expect(screen.getByText('3 ACTIVAS')).toBeInTheDocument();
  });

  it('triggers onViewCritical callback when user clicks the action button', () => {
    const handleViewCritical = vi.fn();
    render(<CriticalAlertBanner criticalCount={2} onViewCritical={handleViewCritical} />);

    const actionButton = screen.getByRole('button', { name: /atender urgencias/i });
    fireEvent.click(actionButton);

    expect(handleViewCritical).toHaveBeenCalledTimes(1);
  });
});
