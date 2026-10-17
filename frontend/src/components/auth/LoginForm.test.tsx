import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LoginForm from './LoginForm';

describe('LoginForm authentication component', () => {
  it('renders username and password inputs with submit button', () => {
    render(<LoginForm onSubmit={vi.fn()} isLoading={false} error={null} />);

    expect(screen.getByRole('textbox', { name: /usuario/i })).toBeInTheDocument();
    expect(screen.getByLabelText('Contraseña', { exact: true })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /iniciar sesión/i })).toBeInTheDocument();
  });

  it('toggles password visibility when clicking the eye icon', async () => {
    const user = userEvent.setup();
    render(<LoginForm onSubmit={vi.fn()} isLoading={false} error={null} />);

    const passwordInput = screen.getByPlaceholderText('••••••••');
    expect(passwordInput).toHaveAttribute('type', 'password');

    const toggleBtn = screen.getByRole('button', { name: /mostrar contraseña/i });
    await user.click(toggleBtn);

    expect(passwordInput).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: /ocultar contraseña/i })).toBeInTheDocument();
  });

  it('blocks submission when fields are empty or only whitespace', () => {
    const handleSubmit = vi.fn();
    render(<LoginForm onSubmit={handleSubmit} isLoading={false} error={null} />);

    const form = screen.getByRole('button', { name: /iniciar sesión/i }).closest('form')!;
    fireEvent.submit(form);

    expect(handleSubmit).not.toHaveBeenCalled();
  });

  it('calls onSubmit with user credentials when form is valid', () => {
    const handleSubmit = vi.fn();
    render(<LoginForm onSubmit={handleSubmit} isLoading={false} error={null} />);

    const usernameInput = screen.getByRole('textbox', { name: /usuario/i });
    const passwordInput = screen.getByPlaceholderText('••••••••');

    fireEvent.change(usernameInput, { target: { value: 'dr_gonzalez' } });
    fireEvent.change(passwordInput, { target: { value: 'Secret123*' } });

    const form = screen.getByRole('button', { name: /iniciar sesión/i }).closest('form')!;
    fireEvent.submit(form);

    expect(handleSubmit).toHaveBeenCalledTimes(1);
    expect(handleSubmit).toHaveBeenCalledWith({
      username: 'dr_gonzalez',
      password: 'Secret123*',
    });
  });

  it('displays loading state and disables inputs while submitting', () => {
    render(<LoginForm onSubmit={vi.fn()} isLoading={true} error={null} />);

    expect(screen.getByRole('textbox', { name: /usuario/i })).toBeDisabled();
    expect(screen.getByPlaceholderText('••••••••')).toBeDisabled();
    expect(screen.getByRole('button', { name: /iniciando sesión/i })).toBeDisabled();
  });

  it('renders error message in alert role when error is provided', () => {
    render(<LoginForm onSubmit={vi.fn()} isLoading={false} error="Credenciales incorrectas" />);

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Credenciales incorrectas');
  });
});
