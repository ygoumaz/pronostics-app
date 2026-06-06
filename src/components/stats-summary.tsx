'use client';

// Résumé statistique des pronostics d'un match (composant réutilisable).
//
// Référence : requirements.md - Exigence 16 (critères 16.1, 16.2, 16.3, 16.4,
// 16.5, 16.6) ; 13.2 (responsive / accessibilité). design.md -
// components/stats-summary.tsx, GET /api/stats/[matchId].
//
// Composant client : il interroge GET /api/stats/[matchId] et affiche, pour un
// match dont l'étape est CLÔTURÉE, le nombre total de participants ayant
// pronostiqué (16.1) ainsi que la liste des scores distincts avec leur
// fréquence, déjà triés par popularité côté API (16.2/16.3). La ligne
// correspondant au pronostic du participant connecté est mise en évidence
// (16.4).
//
// L'API protège la confidentialité (16.5/16.6) :
//   - étape encore ouverte        → 403 : on n'affiche AUCUNE statistique, juste
//                                   un message discret indiquant la disponibilité
//                                   après clôture ;
//   - aucun pronostic enregistré  → 200 { total: 0, scores: [] } : message
//                                   « Aucun pronostic » (16.6) ;
//   - succès                      → 200 { total, scores, ownScore }.

import { useEffect, useState } from 'react';

import { cn } from '@/lib/utils';

/** Fréquence d'un score pronostiqué distinct (format « X-Y »). */
interface ScoreStat {
  score: string;
  count: number;
}

/** Forme de la réponse JSON de GET /api/stats/[matchId]. */
interface StatsResponse {
  matchId: string;
  total: number;
  scores: ScoreStat[];
  ownScore?: string | null;
  message?: string;
}

interface StatsSummaryProps {
  /** Identifiant du match dont on veut le résumé statistique. */
  matchId: string;
  className?: string;
}

type LoadState =
  | { kind: 'loading' }
  // L'étape n'est pas clôturée (403) ou la ressource n'est pas disponible :
  // on ne révèle rien (Exigence 16.5).
  | { kind: 'unavailable' }
  // Aucun pronostic enregistré pour ce match clôturé (Exigence 16.6).
  | { kind: 'empty'; message: string }
  // Résumé disponible (Exigence 16.1/16.2/16.3/16.4).
  | { kind: 'ready'; total: number; scores: ScoreStat[]; ownScore: string | null }
  // Erreur technique inattendue : on reste discret, pas de statistiques.
  | { kind: 'error' };

export function StatsSummary({ matchId, className }: StatsSummaryProps) {
  const [state, setState] = useState<LoadState>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;
    setState({ kind: 'loading' });

    async function load() {
      try {
        const response = await fetch(
          `/api/stats/${encodeURIComponent(matchId)}`
        );

        // Étape encore ouverte / ressource non exposée : on n'affiche pas de
        // statistiques (Exigence 16.5).
        if (response.status === 403 || response.status === 404) {
          if (!cancelled) setState({ kind: 'unavailable' });
          return;
        }

        if (!response.ok) {
          if (!cancelled) setState({ kind: 'error' });
          return;
        }

        const data = (await response.json()) as StatsResponse;
        if (cancelled) return;

        // Aucun pronostic saisi pour ce match clôturé (Exigence 16.6).
        if (data.total === 0) {
          setState({
            kind: 'empty',
            message:
              data.message ?? "Aucun pronostic n'a été saisi pour ce match.",
          });
          return;
        }

        setState({
          kind: 'ready',
          total: data.total,
          scores: data.scores ?? [],
          ownScore: data.ownScore ?? null,
        });
      } catch {
        if (!cancelled) setState({ kind: 'error' });
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [matchId]);

  if (state.kind === 'loading') {
    return (
      <div
        className={cn('text-sm text-muted-foreground', className)}
        role="status"
        aria-live="polite"
      >
        Chargement des statistiques…
      </div>
    );
  }

  // Étape non clôturée ou ressource indisponible : message discret, aucune
  // donnée statistique révélée (Exigence 16.5).
  if (state.kind === 'unavailable') {
    return (
      <p className={cn('text-sm text-muted-foreground', className)}>
        Statistiques disponibles après la clôture de l&apos;étape.
      </p>
    );
  }

  // Erreur technique : on reste discret sans bloquer le reste de la page.
  if (state.kind === 'error') {
    return (
      <p className={cn('text-sm text-muted-foreground', className)}>
        Les statistiques ne sont pas disponibles pour le moment.
      </p>
    );
  }

  // Match clôturé mais sans aucun pronostic (Exigence 16.6).
  if (state.kind === 'empty') {
    return (
      <section
        className={cn(
          'rounded-md border border-border bg-card p-4 text-card-foreground',
          className
        )}
        aria-label="Résumé statistique des pronostics"
      >
        <h3 className="text-sm font-semibold">Résumé des pronostics</h3>
        <p className="mt-2 text-sm text-muted-foreground">{state.message}</p>
      </section>
    );
  }

  // Résumé disponible (Exigence 16.1/16.2/16.3/16.4).
  const { total, scores, ownScore } = state;
  const participantsLabel = total > 1 ? 'participants ont' : 'participant a';

  return (
    <section
      className={cn(
        'rounded-md border border-border bg-card p-4 text-card-foreground',
        className
      )}
      aria-label="Résumé statistique des pronostics"
    >
      <h3 className="text-sm font-semibold">Résumé des pronostics</h3>

      {/* Nombre total de participants ayant pronostiqué (Exigence 16.1). */}
      <p className="mt-1 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">{total}</span>{' '}
        {participantsLabel} pronostiqué sur ce match.
      </p>

      {/* Liste des scores distincts triés par popularité (Exigence 16.2/16.3). */}
      <ul className="mt-3 flex flex-col gap-1.5" role="list">
        {scores.map((stat) => {
          const isOwn = ownScore !== null && stat.score === ownScore;
          const ratio = total > 0 ? Math.round((stat.count / total) * 100) : 0;
          const personnesLabel =
            stat.count > 1 ? 'personnes' : 'personne';

          return (
            <li
              key={stat.score}
              className={cn(
                'flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm',
                isOwn
                  ? 'border-primary bg-primary/10 font-medium'
                  : 'border-transparent bg-muted/50'
              )}
            >
              <span className="flex items-center gap-2">
                <span className="tabular-nums">{stat.score}</span>
                {isOwn && (
                  <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
                    Mon pronostic
                  </span>
                )}
              </span>
              <span className="text-muted-foreground">
                <span className="tabular-nums font-medium text-foreground">
                  {stat.count}
                </span>{' '}
                {personnesLabel} ({ratio}%)
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
