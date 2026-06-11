'use client';

// Vue en lecture seule des pronostics d'un autre participant (Exigence 11).
//
// Référence : requirements.md - Exigence 11 (critères 11.1 à 11.6),
// Exigence 9.3 (accès depuis le classement). design.md - API Routes
// (GET /api/pronostics/participant/[id], GET /api/matches).
//
// === Sources de données et jointure ===
// 1. GET /api/pronostics/participant/[id] renvoie
//      { participant: { id, displayName },
//        pronostics: [{ id, matchId, homeGoals, awayGoals, points }] }.
//    La confidentialité est appliquée côté serveur : seuls les pronostics des
//    matchs dont le coup d'envoi est atteint sont renvoyés (Exigence 11.4).
//    Cette réponse ne porte PAS les détails des matchs (équipes, étape, heure).
// 2. GET /api/matches renvoie la liste complète des matchs sérialisés (équipes,
//    étape, statut, heure de coup d'envoi, résultat officiel). On joint sur
//    matchId pour afficher les équipes, regrouper par journée/tour et trier
//    chronologiquement (Exigence 11.5).
//
// === Matchs affichés ===
// On affiche uniquement les matchs « clôturés » (coup d'envoi atteint),
// c'est-à-dire ceux dont le statut renvoyé par l'API n'est pas « à venir »
// (Exigence 11.1, 11.4). Pour chaque match clôturé :
//   - le pronostic du participant (buts domicile/extérieur), ou « aucun
//     pronostic » s'il n'a rien enregistré (Exigence 11.2) ;
//   - le résultat officiel s'il existe, sinon aucune zone de résultat ;
//   - les points obtenus lorsque le résultat officiel est disponible.
//
// === En-tête ===
// Nom d'affichage (depuis la réponse participant), score total et rang
// (transmis en paramètres de requête depuis le classement — Exigence 11.3).
//
// === Lecture seule ===
// Aucune commande d'édition n'est rendue (Exigence 11.6).

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';

import type { SerializedMatch } from '@/app/api/matches/serialize';
import { ERROR_MESSAGES } from '@/lib/errors';

interface ParticipantPronostic {
  id: string;
  matchId: string;
  homeGoals: number;
  awayGoals: number;
  points: number | null;
}

interface ParticipantResponse {
  participant: { id: string; displayName: string };
  pronostics: ParticipantPronostic[];
}

interface MatchesResponse {
  matches: SerializedMatch[];
}

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | {
      status: 'ready';
      displayName: string;
      groups: StageGroup[];
    };

/** Un groupe de matchs (une journée de poules ou un tour éliminatoire). */
interface StageGroup {
  stage: SerializedMatch['stage'];
  label: string;
  rows: MatchRow[];
}

/** Une ligne : un match clôturé joint au pronostic du participant. */
interface MatchRow {
  match: SerializedMatch;
  pronostic: ParticipantPronostic | null;
}

// Libellés français et ordre chronologique des étapes (Exigence 11.5).
const STAGE_ORDER: SerializedMatch['stage'][] = [
  'GROUP_DAY_1',
  'GROUP_DAY_2',
  'GROUP_DAY_3',
  'ROUND_OF_32',
  'ROUND_OF_16',
  'QUARTER_FINAL',
  'SEMI_FINAL',
  'THIRD_PLACE',
  'FINAL',
];

const STAGE_LABELS: Record<SerializedMatch['stage'], string> = {
  GROUP_DAY_1: 'Phase de groupes — Journée 1',
  GROUP_DAY_2: 'Phase de groupes — Journée 2',
  GROUP_DAY_3: 'Phase de groupes — Journée 3',
  ROUND_OF_32: 'Seizièmes de finale',
  ROUND_OF_16: 'Huitièmes de finale',
  QUARTER_FINAL: 'Quarts de finale',
  SEMI_FINAL: 'Demi-finales',
  THIRD_PLACE: 'Match pour la troisième place',
  FINAL: 'Finale',
};

/** Nom affichable d'un côté de match (équipe connue ou emplacement). */
function sideName(side: SerializedMatch['homeTeam']): string {
  return side.name ?? side.code ?? side.placeholder ?? 'À déterminer';
}

/**
 * Construit les groupes de matchs dont les pronostics sont visibles, triés
 * chronologiquement, en joignant chaque match au pronostic correspondant du
 * participant.
 */
function buildGroups(
  matches: SerializedMatch[],
  pronostics: ParticipantPronostic[]
): StageGroup[] {
  const pronosticByMatchId = new Map<string, ParticipantPronostic>(
    pronostics.map((p) => [p.matchId, p])
  );

  // Calculer le premier coup d'envoi par stage (même logique que lock.ts).
  const firstKickoffByStage = new Map<string, number>();
  for (const m of matches) {
    const t = new Date(m.kickoffTime).getTime();
    const current = firstKickoffByStage.get(m.stage);
    if (current === undefined || t < current) {
      firstKickoffByStage.set(m.stage, t);
    }
  }

  // Matchs dont les pronos sont visibles : now >= firstKickoffOfStage - 1h.
  const now = Date.now();
  const LOCK_OFFSET = 60 * 60 * 1000; // 1h
  const closed = matches.filter((m) => {
    const first = firstKickoffByStage.get(m.stage);
    return first !== undefined && now >= first - LOCK_OFFSET;
  });

  // Tri chronologique au sein d'un même groupe (par coup d'envoi croissant).
  const byStage = new Map<SerializedMatch['stage'], MatchRow[]>();
  for (const match of closed) {
    const rows = byStage.get(match.stage) ?? [];
    rows.push({ match, pronostic: pronosticByMatchId.get(match.id) ?? null });
    byStage.set(match.stage, rows);
  }

  const groups: StageGroup[] = [];
  for (const stage of STAGE_ORDER) {
    const rows = byStage.get(stage);
    if (!rows || rows.length === 0) {
      continue;
    }
    rows.sort(
      (a, b) =>
        new Date(a.match.kickoffTime).getTime() -
        new Date(b.match.kickoffTime).getTime()
    );
    groups.push({ stage, label: STAGE_LABELS[stage], rows });
  }
  return groups;
}

export default function ParticipantPronosticsPage() {
  const params = useParams<{ participantId: string }>();
  const searchParams = useSearchParams();
  const participantId = params.participantId;

  const rankParam = searchParams.get('rank');
  const pointsParam = searchParams.get('points');

  const [state, setState] = useState<LoadState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [participantRes, matchesRes] = await Promise.all([
          fetch(`/api/pronostics/participant/${participantId}`, {
            headers: { Accept: 'application/json' },
          }),
          fetch('/api/matches', { headers: { Accept: 'application/json' } }),
        ]);

        if (!participantRes.ok || !matchesRes.ok) {
          if (!cancelled) {
            setState({
              status: 'error',
              message: ERROR_MESSAGES.TECHNICAL_ERROR,
            });
          }
          return;
        }

        const participantData =
          (await participantRes.json()) as ParticipantResponse;
        const matchesData = (await matchesRes.json()) as MatchesResponse;

        if (!cancelled) {
          setState({
            status: 'ready',
            displayName: participantData.participant.displayName,
            groups: buildGroups(
              matchesData.matches ?? [],
              participantData.pronostics ?? []
            ),
          });
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
  }, [participantId]);

  return (
    <section aria-labelledby="participant-titre" className="space-y-6">
      <nav aria-label="Fil d'Ariane">
        <Link
          href="/classement"
          className="text-sm text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          ← Retour au classement
        </Link>
      </nav>

      {state.status === 'loading' && (
        <p role="status" className="text-sm text-muted-foreground">
          Chargement des pronostics…
        </p>
      )}

      {state.status === 'error' && (
        <p
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {state.message}
        </p>
      )}

      {state.status === 'ready' && (
        <>
          <header className="space-y-2 rounded-lg border border-border bg-card p-4">
            <h1
              id="participant-titre"
              className="text-2xl font-semibold text-foreground"
            >
              Pronostics de {state.displayName}
            </h1>
            <dl className="flex flex-wrap gap-x-8 gap-y-1 text-sm">
              <div className="flex gap-1.5">
                <dt className="text-muted-foreground">Rang :</dt>
                <dd className="font-medium text-foreground">
                  {rankParam ?? '—'}
                </dd>
              </div>
              <div className="flex gap-1.5">
                <dt className="text-muted-foreground">Score total :</dt>
                <dd className="font-medium text-foreground">
                  {pointsParam ?? '—'}
                </dd>
              </div>
            </dl>
            <p className="text-xs text-muted-foreground">
              Vue en lecture seule. Seuls les matchs dont le coup d&apos;envoi est
              atteint sont affichés.
            </p>
          </header>

          {state.groups.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucun match clôturé pour le moment.
            </p>
          ) : (
            <div className="space-y-8">
              {state.groups.map((group) => (
                <section
                  key={group.stage}
                  aria-labelledby={`stage-${group.stage}`}
                  className="space-y-3"
                >
                  <h2
                    id={`stage-${group.stage}`}
                    className="text-lg font-semibold text-foreground"
                  >
                    {group.label}
                  </h2>
                  <div className="overflow-x-auto rounded-lg border border-border">
                    <table className="w-full border-collapse text-sm">
                      <caption className="sr-only">
                        Pronostics de {state.displayName} pour {group.label}
                      </caption>
                      <thead>
                        <tr className="border-b border-border bg-muted/50 text-left">
                          <th
                            scope="col"
                            className="px-4 py-3 font-medium text-foreground"
                          >
                            Match
                          </th>
                          <th
                            scope="col"
                            className="px-4 py-3 font-medium text-foreground"
                          >
                            Pronostic
                          </th>
                          <th
                            scope="col"
                            className="px-4 py-3 font-medium text-foreground"
                          >
                            Résultat
                          </th>
                          <th
                            scope="col"
                            className="px-4 py-3 text-right font-medium text-foreground"
                          >
                            Points
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.rows.map(({ match, pronostic }) => {
                          const result = match.officialResult;
                          return (
                            <tr
                              key={match.id}
                              className="border-b border-border last:border-0"
                            >
                              <th
                                scope="row"
                                className="px-4 py-3 text-left font-normal text-foreground"
                              >
                                {sideName(match.homeTeam)} –{' '}
                                {sideName(match.awayTeam)}
                              </th>
                              <td className="px-4 py-3 tabular-nums text-foreground">
                                {pronostic ? (
                                  `${pronostic.homeGoals} – ${pronostic.awayGoals}`
                                ) : (
                                  <span className="text-muted-foreground">
                                    aucun pronostic
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3 tabular-nums text-foreground">
                                {result ? (
                                  `${result.homeGoals} – ${result.awayGoals}`
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-right tabular-nums text-foreground">
                                {result && pronostic?.points != null
                                  ? pronostic.points
                                  : '—'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </section>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
