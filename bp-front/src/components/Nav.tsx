import React from 'react';
import { Link, NavLink } from 'react-router-dom';
import gsap from 'gsap';
import { Mark } from './Mark';
import { Button } from './ui';
import { useAuth } from '../lib/auth';
import { cn } from '../lib/utils';

const NAV_LINKS = [
  { to: '/#product', label: 'Product' },
  { to: '/#how', label: 'How it works' },
  { to: '/pricing', label: 'Pricing' },
  { to: '/agent', label: 'Ask the graph' },
  { to: '/#faq', label: 'FAQ' },
];

export const Nav: React.FC = () => {
  const { me } = useAuth();
  const [open, setOpen] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const el = menuRef.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.style.height = open ? 'auto' : '0px';
      el.style.opacity = open ? '1' : '0';
      return;
    }
    gsap.to(el, {
      height: open ? el.scrollHeight : 0,
      opacity: open ? 1 : 0,
      duration: 0.3,
      ease: 'power2.inOut',
      overwrite: true,
    });
  }, [open]);

  return (
    <header className="fixed inset-x-0 top-0 z-40 border-b border-line/60 bg-ink/80 backdrop-blur-md">
      <nav className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-5 md:px-8">
        <Link
          to="/"
          className="flex items-center gap-2"
          aria-label="Helio home"
          onClick={() => setOpen(false)}
        >
          <Mark className="relative h-9 w-12 shrink-0" />
          <span className="text-lg font-semibold tracking-tight text-paper">helio</span>
        </Link>

        <div className="hidden items-center gap-7 lg:flex">
          {NAV_LINKS.map((link) => (
            <NavLink
              key={link.label}
              to={link.to}
              className={({ isActive }) =>
                cn(
                  'text-sm text-fog transition-colors hover:text-paper',
                  isActive && !link.to.includes('#') && 'text-paper',
                )
              }
            >
              {link.label}
            </NavLink>
          ))}
        </div>

        <div className="hidden items-center gap-2 lg:flex">
          {me?.authenticated ? (
            <Link to="/account">
              <Button variant="outline" size="sm">
                Your account
              </Button>
            </Link>
          ) : (
            <>
              <Link to="/auth">
                <Button variant="ghost" size="sm">
                  Sign in
                </Button>
              </Link>
              <Link to="/auth?plan=starter">
                <Button size="sm">Start free</Button>
              </Link>
            </>
          )}
        </div>

        <button
          type="button"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-line text-paper lg:hidden"
          aria-expanded={open}
          aria-label={open ? 'Close menu' : 'Open menu'}
          onClick={() => setOpen((value) => !value)}
        >
          <span className="relative block h-3 w-4">
            <span
              className={cn(
                'absolute left-0 top-0 block h-0.5 w-4 bg-current transition-transform',
                open && 'translate-y-[5px] rotate-45',
              )}
            />
            <span
              className={cn(
                'absolute bottom-0 left-0 block h-0.5 w-4 bg-current transition-transform',
                open && '-translate-y-[5px] -rotate-45',
              )}
            />
          </span>
        </button>
      </nav>

      <div
        ref={menuRef}
        className="overflow-hidden border-t border-line/60 bg-ink lg:hidden"
        style={{ height: 0, opacity: 0 }}
      >
        <div className="flex flex-col gap-1 px-5 pb-6 pt-3">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.label}
                to={link.to}
                className="rounded-lg px-2 py-2.5 text-base text-paper hover:bg-white/[0.04]"
                onClick={() => setOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <Link
              to={me?.authenticated ? '/account' : '/auth'}
              className="mt-2"
              onClick={() => setOpen(false)}
            >
              <Button block>
                {me?.authenticated ? 'Your account' : 'Start free'}
              </Button>
            </Link>
          </div>
      </div>
    </header>
  );
};
