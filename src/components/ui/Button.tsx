import type { ButtonHTMLAttributes, Ref } from 'react';

type Variant = 'primary' | 'secondary' | 'danger' | 'link';

const VARIANT: Record<Variant, string> = {
  primary: 'bg-accent text-on-accent',
  secondary: 'border border-accent text-accent bg-surface',
  danger: 'bg-aqi-very-poor text-aqi-on-very-poor',
  link: 'text-accent underline px-0',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  ref?: Ref<HTMLButtonElement>;
}

/** 44 px minimum target (WCAG 2.5.8 aim); type="button" unless set. */
export function Button({
  variant = 'primary',
  className = '',
  type = 'button',
  ref,
  ...props
}: ButtonProps) {
  return (
    <button
      ref={ref}
      type={type}
      className={`inline-flex min-h-11 items-center justify-center rounded-md px-4 font-medium ${VARIANT[variant]} ${className}`}
      {...props}
    />
  );
}
