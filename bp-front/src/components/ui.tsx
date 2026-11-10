import React from 'react';
import { Link } from 'react-router-dom';
import { cn } from '../lib/utils';

/** Small mono label used above headings and inside cards. Never below 12px. */
export const Eyebrow: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className,
}) => (
  <p className={cn('font-mono text-xs uppercase tracking-[0.2em] text-fog', className)}>
    <span className="mr-2 text-accent">/</span>
    {children}
  </p>
);

type ButtonVariant = 'primary' | 'outline' | 'ghost';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: 'sm' | 'md' | 'lg';
  block?: boolean;
}

const buttonVariants: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-ink hover:bg-[#ff7358] active:bg-[#e04a2c] border border-accent',
  outline: 'bg-transparent text-paper border border-line hover:border-fog hover:bg-white/[0.04]',
  ghost: 'bg-transparent text-fog hover:text-paper border border-transparent',
};

const buttonSizes = {
  sm: 'h-9 px-3.5 text-sm',
  md: 'h-11 px-5 text-[15px]',
  lg: 'h-13 px-7 text-base',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', block, className, ...rest }, ref) => (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-full font-medium tracking-tight transition-[background-color,border-color,color,transform] duration-150 active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-55',
        buttonVariants[variant],
        buttonSizes[size],
        block && 'w-full',
        className,
      )}
      {...rest}
    />
  ),
);
Button.displayName = 'Button';

interface LinkButtonProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  to: string;
  variant?: ButtonVariant;
  size?: 'sm' | 'md' | 'lg';
}

export const LinkButton = React.forwardRef<HTMLAnchorElement, LinkButtonProps>(
  ({ to, variant = 'primary', size = 'md', className, ...rest }, ref) => (
    <Link
      to={to}
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-full font-medium tracking-tight transition-[background-color,border-color,color,transform] duration-150 active:scale-[0.985]',
        buttonVariants[variant],
        buttonSizes[size],
        className,
      )}
      {...rest}
    />
  ),
);
LinkButton.displayName = 'LinkButton';

export const Card: React.FC<{
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
} & React.HTMLAttributes<HTMLDivElement>> = ({ children, className, hover, ...rest }) => (
  <div
    className={cn(
      'rounded-2xl border border-line bg-ink-soft shadow-[0_1px_0_0_rgba(255,255,255,0.04)_inset]',
      hover && 'hover-lift',
      className,
    )}
    {...rest}
  >
    {children}
  </div>
);

export const Section = React.forwardRef<HTMLElement, {
  id?: string;
  children: React.ReactNode;
  className?: string;
}>(({ id, children, className }, ref) => (
  <section
    ref={ref}
    id={id}
    className={cn('mx-auto w-full max-w-6xl px-5 py-20 md:px-8 md:py-28', className)}
  >
    {children}
  </section>
));
Section.displayName = 'Section';
