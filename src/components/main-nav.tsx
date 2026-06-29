'use client';

// Navigation principale de l'application (composant client).
//
// Référence : requirements.md - Exigences 12.4/12.7 (élément de navigation
// permanent, distinction visuelle de l'entrée active), 13.6 (menu permanent sur
// bureau/tablette, menu hamburger rétractable sur mobile, zones tactiles de
// 44 px), 2.4 (déconnexion).
//
// Le layout (composant serveur) calcule `isAdmin` et `displayName` à partir de
// la session puis les transmet ici. On utilise `usePathname` pour mettre en
// évidence l'entrée active, et un état local pour le menu hamburger mobile.

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { Menu, X, LogOut } from 'lucide-react';

import { cn } from '@/lib/utils';

interface NavLink {
  href: string;
  label: string;
  /** Visible uniquement pour les administrateurs. */
  adminOnly?: boolean;
  /** Visible uniquement pour les non-administrateurs (participants). */
  participantOnly?: boolean;
}

const NAV_LINKS: NavLink[] = [
  { href: '/calendrier', label: 'Calendrier', participantOnly: true },
  { href: '/pronostics', label: 'Pronostics', participantOnly: true },
  { href: '/classement', label: 'Classement', participantOnly: true },
  // Récompenses individuelles intégrées dans l'onglet Pronostics (premier onglet).
  // Entrées d'administration (visibles uniquement pour l'Administrateur). Chaque
  // page admin dispose de son propre lien afin qu'aucune ne reste orpheline de
  // la navigation (Exigence 14.5/18.15 : pages réservées, mais accessibles).
  { href: '/admin/resultats', label: 'Résultats (admin)', adminOnly: true },
  { href: '/admin/participants', label: 'Participants (admin)', adminOnly: true },
  { href: '/admin/export', label: 'Export (admin)', adminOnly: true },
];

interface MainNavProps {
  isAdmin: boolean;
  displayName: string | null;
}

/**
 * Détermine si un lien correspond au chemin courant. La correspondance se fait
 * par préfixe afin que les sous-pages (ex. `/classement/[id]`) conservent
 * l'entrée parente en surbrillance. Chaque entrée admin pointe vers une page
 * distincte, donc la correspondance par préfixe suffit à n'activer que l'entrée
 * réellement consultée.
 */
function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function MainNav({ isAdmin, displayName }: MainNavProps) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  const visibleLinks = NAV_LINKS.filter(
    (link) =>
      (!link.adminOnly || isAdmin) &&
      (!link.participantOnly || !isAdmin)
  );

  function handleLogout() {
    void signOut({ callbackUrl: '/connexion' });
  }

  return (
    <header className="border-b border-border bg-background">
      <nav
        aria-label="Navigation principale"
        className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3"
      >
        <div className="flex items-center gap-2">
          <Image src="/favicon.svg" alt="" width={28} height={28} aria-hidden="true" />
          <Link
            href="/calendrier"
            className="rounded-md text-base font-bold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            Pronostics CDM 2026
          </Link>
        </div>

        {/* Menu permanent : bureau et tablette (>= 768 px). */}
        <ul className="hidden items-center gap-1 md:flex">
          {visibleLinks.map((link) => {
            const active = isActive(pathname, link.href);
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'inline-flex h-11 items-center rounded-md px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                    active
                      ? 'bg-primary text-primary-foreground'
                      : 'text-foreground hover:bg-accent hover:text-accent-foreground'
                  )}
                >
                  {link.label}
                </Link>
              </li>
            );
          })}
        </ul>

        {/* Zone compte : nom + déconnexion (bureau/tablette). */}
        <div className="hidden items-center gap-3 md:flex">
          {displayName ? (
            <span className="max-w-[12rem] truncate text-sm text-muted-foreground">
              {displayName}
            </span>
          ) : null}
          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex h-11 items-center gap-1.5 rounded-md px-3 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            Déconnexion
          </button>
        </div>

        {/* Bouton hamburger : mobile uniquement (< 768 px). */}
        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-expanded={menuOpen}
          aria-controls="menu-mobile"
          aria-label={menuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
          className="inline-flex h-11 w-11 items-center justify-center rounded-md text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:hidden"
        >
          {menuOpen ? (
            <X className="h-6 w-6" aria-hidden="true" />
          ) : (
            <Menu className="h-6 w-6" aria-hidden="true" />
          )}
        </button>
      </nav>

      {/* Panneau de navigation mobile rétractable. */}
      {menuOpen ? (
        <div id="menu-mobile" className="border-t border-border md:hidden">
          <ul className="mx-auto flex max-w-5xl flex-col gap-1 px-4 py-3">
            {visibleLinks.map((link) => {
              const active = isActive(pathname, link.href);
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    aria-current={active ? 'page' : undefined}
                    onClick={() => setMenuOpen(false)}
                    className={cn(
                      'flex min-h-[44px] items-center rounded-md px-3 text-base font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                      active
                        ? 'bg-primary text-primary-foreground'
                        : 'text-foreground hover:bg-accent hover:text-accent-foreground'
                    )}
                  >
                    {link.label}
                  </Link>
                </li>
              );
            })}
            <li className="mt-2 border-t border-border pt-2">
              {displayName ? (
                <p className="truncate px-3 py-1 text-sm text-muted-foreground">
                  Connecté en tant que {displayName}
                </p>
              ) : null}
              <button
                type="button"
                onClick={handleLogout}
                className="flex min-h-[44px] w-full items-center gap-1.5 rounded-md px-3 text-base font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <LogOut className="h-5 w-5" aria-hidden="true" />
                Déconnexion
              </button>
            </li>
          </ul>
        </div>
      ) : null}
    </header>
  );
}
