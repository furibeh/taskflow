import type { ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: 'primary' | 'secondary' | 'danger';
}

/** Botón con área táctil mínima de 44×44 px (FR-033) y foco visible. */
export const Button = ({ variant = 'secondary', className, type = 'button', ...props }: ButtonProps) => (
  <button type={type} className={['btn', `btn--${variant}`, className].filter(Boolean).join(' ')} {...props} />
);
