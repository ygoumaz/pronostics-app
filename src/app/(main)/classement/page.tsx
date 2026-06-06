'use client';

// Page du classement global (Exigence 9).
//
// Référence : requirements.md - Exigence 9 (critères 9.2, 9.3, 9.4),
// Exigence 13 (responsive / accessibilité). design.md - API Routes
// (GET /api/classement).
//
// La page récupère GET /api/classement qui renvoie
// { ranking: [{ participantId, displayName, totalPoints, rank }] } déjà trié
// (rang croissant, puis nom d'affichage croissant en cas d'égalité — la logique
// de tri vit côté serveur dans src/lib/ranking.ts, Exigences 9.2/9.4). La page
// se contente donc d'afficher les entrées dans l'ordre reçu.
//
// Chaque ligne est cliquable et mène à la vue en lecture seule des pronostics
// du participant : /classement/[participantId] (Exigence 9.3). Pour conserver un
// tableau sémantique tout en offrant un lien navigable au clavier, chaque ligne
// contient un <Link> couvrant la cellule du nom ; le rang et le score restent de
// simples cellules. Le score et le rang sont passés en paramètres de requête
// afin que la page de détail puisse afficher l'en-tête (Exigence 11.3) sans
// dépendre d'un nouvel appel au classement.

import { useEffect, useState } from 'react';
import Link from 'next/link';

import type { RankingEntry } from '@/types';
import { ERROR_MESSAGES } from '@/lib/errors';
import { LoadingIndicator } from '@/components/ui/loading-indicator';

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; ranking: RankingEntry[] };

export default function ClassementPage() {
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch('/api/classement', {
          headers: { Accept: 'application/json' },
        });
        if (!response.ok) {
          if (!cancelled) {
            setState({ status: 'error', message: ERROR_MESSAGES.TECHNICAL_ERROR });
          }
          return;
        }
        const data = (await response.json()) as { ranking: RankingEntry[] };
        if (!cancelled) {
          setState({ status: 'ready', ranking: data.ranking ?? [] });
        }
      } catch {
        if (!cancelled) {
          setState({ status: 'error', message: ERROR_MESSAGES.TECHNICAL_ERROR });
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section aria-labelledby="classement-titre" className="space-y-6">
      <header className="space-y-1">
        <h1 id="classement-titre" className="text-2xl font-semibold text-foreground">
          Classement
        </h1>
        <p className="text-sm text-muted-foreground">
          Comparez votre score à celui des autres participants. Sélectionnez un
          participant pour consulter ses pronostics.
        </p>
      </header>

      {state.status === 'loading' && (
        <LoadingIndicator label="Chargement du classement…" />
      )}

      {state.status === 'error' && (
        <p
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {state.message}
        </p>
      )}

      {state.status === 'ready' && state.ranking.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Aucun participant à afficher pour le moment.
        </p>
      )}

      {state.status === 'ready' && state.ranking.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">
              Classement des participants par score total décroissant
            </caption>
            <thead>
              <tr className="border-b border-border bg-muted/50 text-left">
                <th scope="col" className="px-4 py-3 font-medium text-foreground">
                  Rang
                </th>
                <th scope="col" className="px-4 py-3 font-medium text-foreground">
                  Participant
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-right font-medium text-foreground"
                >
                  Score total
                </th>
              </tr>
            </thead>
            <tbody>
              {state.ranking.map((entry) => {
                const href = {
                  pathname: `/classement/${entry.participantId}`,
                  query: {
                    rank: String(entry.rank),
                    points: String(entry.totalPoints),
                  },
                };
                return (
                  <tr
                    key={entry.participantId}
                    className="border-b border-border last:border-0 hover:bg-accent/50"
                  >
                    <td className="px-4 py-3 text-foreground">{entry.rank}</td>
                    <td className="px-4 py-3">
                      <Link
                        href={href}
                        className="inline-flex font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      >
                        {entry.displayName}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-foreground">
                      {entry.totalPoints}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
