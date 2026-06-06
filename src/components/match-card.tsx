'use client';

// Carte d'affichage d'un match (composant réutilisable).
//
// Référence : requirements.md - Exigences 3.6 (équipes/emplacements + heure de
// Coup_d_envoi en fuseau local), 3.8/3.9 (statut « à venir » / « en cours » /
// « terminé »), 3.10 (buts du résultat officiel), 13.3 (drapeaux intégrés),
// 13.4 (charte cohérente, contrastes AA). design.md - components/match-card.tsx.
//
// Composant client : l'heure de Coup_d_envoi est formatée dans le fuseau
// horaire LOCAL du navigateur via l'utilitaire `src/lib/timezone.ts`. Le
// formatage est effectué après montage (`useEffect`) pour éviter toute
// divergence d'hydratation entre le rendu serveur (fuseau du serveur) et le
// client.
//
// NOTE — drapeaux : l'API /api/matches renvoie le code ISO et le nom de chaque
// équipe (pas le `flagUrl`). On reconstruit le chemin du drapeau intégré à
// partir du code (`/flags/<code>.svg`, cf. data/teams.json). Si l'image est
// absente, on masque gracieusement le drapeau et on conserve le nom/texte.

import { useEffect, useState, type ReactNode } from 'react';

import type { SerializedMatch } from '@/app/api/matches/serialize';
import type { MatchStatus } from '@/types';
import { cn } from '@/lib/utils';
import { formatKickoffLocal } from '@/lib/timezone';

interface MatchCardProps {
  match: SerializedMatch;
  /**
   * Contenu additionnel rendu en pied de carte (par ex. formulaire de
   * pronostic, indicateur de points). Permet la réutilisation par d'autres
   * vues sans coupler la carte à une fonctionnalité précise.
   */
  footer?: ReactNode;
  /**
   * État du pronostic pour ce match :
   * - 'none'  : aucun pronostic enregistré (fond ambre clair pour attirer l'œil)
   * - 'saved' : pronostic enregistré (fond vert clair)
   * - undefined : pas d'indicateur (vue sans pronostics, ex. calendrier)
   */
  pronosticStatus?: 'none' | 'saved';
  className?: string;
}

/** Libellé + style du badge de statut (Exigence 3.9). */
const STATUS_STYLES: Record<MatchStatus, string> = {
  'à venir': 'bg-blue-100 text-blue-800',
  'en cours': 'bg-amber-100 text-amber-900',
  terminé: 'bg-emerald-100 text-emerald-900',
};

/** Drapeau d'une équipe à partir de son code ISO, avec repli gracieux. */
function TeamFlag({ code, name }: { code: string | null; name: string }) {
  const [failed, setFailed] = useState(false);

  if (!code || failed) {
    // Repli : aucun drapeau exploitable, l'espace reste neutre (le nom porte
    // déjà l'information). On réserve la largeur pour préserver l'alignement.
    return (
      <span
        aria-hidden="true"
        className="inline-block h-4 w-6 shrink-0 rounded-sm bg-muted"
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- drapeau SVG statique local
    <img
      src={`/flags/${code.toLowerCase()}.svg`}
      alt={`Drapeau ${name}`}
      width={24}
      height={16}
      className="h-4 w-6 shrink-0 rounded-sm object-cover"
      onError={() => setFailed(true)}
    />
  );
}

/** Nom affichable d'un côté de match : équipe connue ou emplacement à déterminer. */
function sideLabel(side: SerializedMatch['homeTeam']): string {
  return side.name ?? side.code ?? side.placeholder ?? 'À déterminer';
}

function TeamRow({ side }: { side: SerializedMatch['homeTeam'] }) {
  const label = sideLabel(side);
  const isPlaceholder = !side.code && !side.name;
  return (
    <div className="flex items-center gap-2">
      <TeamFlag code={side.code} name={label} />
      <span
        className={cn(
          'text-sm font-medium text-foreground sm:text-base',
          isPlaceholder && 'italic text-muted-foreground'
        )}
      >
        {label}
      </span>
    </div>
  );
}

export function MatchCard({ match, footer, pronosticStatus, className }: MatchCardProps) {
  const result = match.officialResult;

  // Heure locale calculée côté client uniquement (évite la divergence
  // d'hydratation : le serveur n'a pas le fuseau du participant).
  const [localKickoff, setLocalKickoff] = useState<string>('');
  useEffect(() => {
    // Délégué à l'utilitaire fuseau horaire (tâche 15.1) : conversion UTC →
    // fuseau local du navigateur, en français (date complète + heure courte).
    setLocalKickoff(formatKickoffLocal(match.kickoffTime));
  }, [match.kickoffTime]);

  return (
    <article
      className={cn(
        'rounded-lg border p-4 shadow-sm',
        pronosticStatus === 'saved'
          ? 'border-green-200 bg-green-50'
          : pronosticStatus === 'none'
            ? 'border-amber-200 bg-amber-50'
            : 'border-border bg-card',
        className
      )}
    >
      <header className="mb-3 flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">
          Match {match.matchNumber}
          {match.group ? ` · Groupe ${match.group}` : ''}
        </span>
        <span
          className={cn(
            'rounded-full px-2 py-0.5 text-xs font-semibold',
            STATUS_STYLES[match.status]
          )}
        >
          {match.status}
        </span>
      </header>

      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col gap-2">
          <TeamRow side={match.homeTeam} />
          <TeamRow side={match.awayTeam} />
        </div>

        {result ? (
          <div
            className="flex flex-col items-end gap-2 text-lg font-bold tabular-nums text-foreground"
            aria-label="Résultat officiel"
          >
            <span>{result.homeGoals}</span>
            <span>{result.awayGoals}</span>
          </div>
        ) : null}
      </div>

      {result?.penaltyWinner ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Vainqueur aux tirs au but :{' '}
          {result.penaltyWinner === 'HOME'
            ? sideLabel(match.homeTeam)
            : sideLabel(match.awayTeam)}
        </p>
      ) : null}

      <p className="mt-3 text-sm text-muted-foreground">
        {/* suppressHydrationWarning : le contenu est rempli côté client avec le
            fuseau du navigateur ; le rendu serveur initial est volontairement
            vide. */}
        <time dateTime={match.kickoffTime} suppressHydrationWarning>
          {localKickoff || 'Chargement de l’horaire…'}
        </time>
      </p>

      {footer ? <div className="mt-3 border-t border-border pt-3">{footer}</div> : null}
    </article>
  );
}
