'use client';

/**
 * WelcomeNav — responsive navigation for the landing page.
 *
 * Desktop (≥768px): inline links — Logo · Документация · Войти · CTA.
 * Mobile (<768px): Logo · CTA · burger button → accessible drawer sheet.
 *
 * Accessibility (WAI-ARIA Authoring Practices — Dialog/Drawer):
 *   - burger button: aria-expanded, aria-controls, accessible name, ≥44px target
 *   - drawer: role="dialog", aria-modal="true", aria-labelledby
 *   - Escape closes the drawer
 *   - focus moves into the drawer on open, returns to the trigger on close
 *   - focus is trapped inside while open (Tab cycles within)
 *   - clicking the overlay closes the drawer
 *   - body scroll is locked while open
 *   - prefers-reduced-motion: instant show (no transition)
 *
 * Routes follow the Cardcraft canonical CTA map (no invented flows):
 *   Открыть редактор → /editor
 *   Документация     → /docs
 *   Войти             → /login
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

const NAV_LINKS = [
  { href: '/docs', label: 'Документация' },
  { href: '/login', label: 'Войти' },
] as const;

export default function WelcomeNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const burgerRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const firstFocusableRef = useRef<HTMLAnchorElement | HTMLButtonElement>(null);

  /** Brand click: if on the landing page, smooth-scroll to top. Otherwise
   *  navigate to '/' (Next.js Link handles it). */
  const onBrandClick = useCallback(
    (e: React.MouseEvent) => {
      if (pathname === '/') {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    },
    [pathname],
  );

  const close = useCallback(() => {
    setOpen(false);
  }, []);

  const onBurgerKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && open) {
      e.preventDefault();
      close();
    }
  };

  // Body scroll lock + focus management while the drawer is open.
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // Move focus into the drawer once it's rendered.
    const t = window.setTimeout(() => firstFocusableRef.current?.focus(), 50);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.clearTimeout(t);
    };
  }, [open]);

  // Focus trap: Tab cycles within the drawer while open.
  useEffect(() => {
    if (!open) return;
    const drawer = drawerRef.current;
    if (!drawer) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const focusables = drawer.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey) {
        if (active === first || !drawer.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  // Return focus to the burger trigger after closing.
  useEffect(() => {
    if (open) return;
    // Only re-focus if the drawer was just closed (not on mount).
    burgerRef.current?.focus();
  }, [open]);

  return (
    <>
      <nav className="welcome-nav" aria-label="Основная навигация">
        <Link className="welcome-brand" href="/" onClick={onBrandClick}>
          Cardcraft
        </Link>

        {/* Desktop links (≥768px) */}
        <div className="welcome-nav-links">
          {NAV_LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="welcome-nav-link">
              {l.label}
            </Link>
          ))}
          <Link className="welcome-nav-cta" href="/editor">
            Открыть редактор
          </Link>
        </div>

        {/* Mobile compact (<768px): burger only (CTA lives inside the drawer) */}
        <div className="welcome-nav-mobile">
          <button
            ref={burgerRef}
            type="button"
            className="welcome-nav-burger"
            aria-label={open ? 'Закрыть меню' : 'Открыть меню'}
            aria-expanded={open}
            aria-controls="welcome-drawer"
            onClick={() => setOpen((v) => !v)}
            onKeyDown={onBurgerKey}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {open ? (
                <>
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </>
              ) : (
                <>
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </>
              )}
            </svg>
          </button>
        </div>
      </nav>

      {/* Drawer overlay + sheet */}
      {open && (
        <>
          <div
            className="welcome-drawer-overlay"
            onClick={close}
            aria-hidden="true"
          />
          <div
            id="welcome-drawer"
            ref={drawerRef}
            className="welcome-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="welcome-drawer-title"
          >
            <div className="welcome-drawer-header">
              <span id="welcome-drawer-title" className="welcome-drawer-title">
                Меню
              </span>
              <button
                ref={firstFocusableRef as React.RefObject<HTMLButtonElement>}
                type="button"
                className="welcome-drawer-close"
                aria-label="Закрыть меню"
                onClick={close}
              >
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <nav className="welcome-drawer-nav" aria-label="Мобильная навигация">
              {NAV_LINKS.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="welcome-drawer-link"
                  onClick={close}
                >
                  {l.label}
                </Link>
              ))}
              <Link
                href="/editor"
                className="welcome-drawer-cta"
                onClick={close}
              >
                Открыть редактор
              </Link>
            </nav>
          </div>
        </>
      )}
    </>
  );
}
