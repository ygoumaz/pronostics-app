'use client';

// Page d'administration : participants et détail de leurs pronostics
// (Exigence 14).
//
// Référence : requirements.md - Exigence 14 (14.1 liste triée par score puis
// nom, 14.2 tous les matchs avec pronostic/résultat/points, 14.3 regroupement
// par journée/tour chronologique, 14.4 en-tête nom/score/rang, 14.5 accès
// réservé à l'Administrateur, 14.6 tous les pronostics y compris matchs non
// clôturés sans confidentialité). design.md - (main)/admin/participants.
//
// Sources de données :
//   - GET /api/admin/participants
//       → { participants: [{ participantId, displayName, totalPoints, rank }] }
//         déjà trié côté serveur (Exigence 14.1).
//   - GET /api/admin/participants/[id]/pronostics (au clic sur un participant)
//       → { participant: { id, displayName, totalPoints, rank },
//           matches: SerializedMatch[],   // TOUS les matchs, triés chronologiquement
//           pronostics: [{ matchId, homeGoals, awayGoals, points }] }
//     La confidentialité N'EST PAS appliquée : tous les pronostics sont visibles,
//     y compris ceux des matchs non encore joués (Exigence 14.6).
//
// Contrôle d'accès : l'API est l'autorité finale (401/403 avant toute lecture).
// On applique ici une vérification défensive côté client via `useSession` : un
// utilisateur non administrateur voit un message contextuel (Exigence 14.5) et
// aucune donnée n'est chargée.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';

import type { SerializedMatch } from '@/app/api/matches/serialize';
import type { RankingEntry, Stage } from '@/types';
import { ChevronDown } from 'lucide-react';

import { cn } from '@/lib/utils';
import { ERROR_MESSAGES } from '@/lib/errors';
import { ScoreIndicator } from '@/components/score-indicator';
import { STAGE_LABELS, STAGE_ORDER } from '@/components/navigation-stages';

/** Pronostic d'un participant (sans détail du match). */
interface AdminPronostic {
  matchId: string;
  homeGoals: number;
  awayGoals: number;
  points: number | null;
}

/** Pronostic récompense d'un participant. */
interface AdminRewardPrediction {
  rewardType: string;
  playerId: string | null;
  teamCode: string | null;
  points: number | null;
}

/** Vainqueur officiel d'une récompense. */
interface AdminRewardResult {
  rewardType: string;
  playerId: string | null;
  teamCode: string | null;
}

/** En-tête participant renvoyé par la route de détail (Exigence 14.4). */
interface ParticipantHeader {
  id: string;
  displayName: string;
  totalPoints: number;
  rank: number | null;
}

/** Réponse de GET /api/admin/participants/[id]/pronostics. */
interface DetailResponse {
  participant: ParticipantHeader;
  matches: SerializedMatch[];
  pronostics: AdminPronostic[];
  rewardTypes: string[];
  rewardPredictions: AdminRewardPrediction[];
  rewardResults: AdminRewardResult[];
}

/** Un groupe de matchs (journée de poules ou tour éliminatoire). */
interface StageGroup {
  stage: Stage;
  label: string;
  rows: MatchRow[];
}

/** Une ligne : un match joint au pronostic du participant (le cas échéant). */
interface MatchRow {
  match: SerializedMatch;
  pronostic: AdminPronostic | null;
}

/** État de chargement de la liste des participants. */
type ListState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; participants: RankingEntry[] };

/** État de chargement du détail d'un participant. */
type DetailState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | {
      status: 'ready';
      header: ParticipantHeader;
      groups: StageGroup[];
      rewardTypes: string[];
      rewardPredictions: AdminRewardPrediction[];
      rewardResults: AdminRewardResult[];
    };

/** Nom affichable d'un côté de match (équipe connue ou emplacement). */
function sideName(side: SerializedMatch['homeTeam']): string {
  return side.name ?? side.code ?? side.placeholder ?? 'À déterminer';
}

/** Résout les noms des joueurs depuis l'API /api/players. */
async function resolvePlayerLabels(
  ids: string[]
): Promise<Record<string, string>> {
  if (ids.length === 0) return {};
  try {
    const params = new URLSearchParams({ ids: ids.join(',') });
    const response = await fetch(`/api/players?${params.toString()}`);
    if (!response.ok) return {};
    const data = (await response.json()) as { players: { id: string; name: string }[] };
    const labels: Record<string, string> = {};
    for (const player of data.players ?? []) {
      labels[player.id] = player.name;
    }
    return labels;
  } catch {
    return {};
  }
}

/** Résout les noms des équipes depuis l'API /api/teams. */
async function resolveTeamLabels(): Promise<Record<string, string>> {
  try {
    const response = await fetch('/api/teams');
    if (!response.ok) return {};
    const data = (await response.json()) as { teams: { code: string; name: string }[] };
    const labels: Record<string, string> = {};
    for (const team of data.teams ?? []) {
      labels[team.code] = team.name;
    }
    return labels;
  } catch {
    return {};
  }
}

/** Libellés français des 5 récompenses individuelles. */
const REWARD_LABELS: Record<string, string> = {
  GOLDEN_BOOT: "Soulier d'Or (meilleur buteur)",
  GOLDEN_BALL: "Ballon d'Or (meilleur joueur)",
  GOLDEN_GLOVE: "Gant d'Or (meilleur gardien)",
  BEST_YOUNG: 'Meilleur Jeune Joueur (21 ans ou moins au 1er janvier 2026)',
  FAIR_PLAY: 'Prix du Fair-Play',
};

/** Emojis associés à chaque récompense individuelle. */
const REWARD_EMOJIS: Record<string, string> = {
  GOLDEN_BOOT: '👟',
  GOLDEN_BALL: '🏆',
  GOLDEN_GLOVE: '🧤',
  BEST_YOUNG: '🌟',
  FAIR_PLAY: '🤝',
};

/**
 * Regroupe TOUS les matchs (Exigence 14.2/14.6) par étape dans l'ordre
 * chronologique (STAGE_ORDER), puis trie chaque groupe par coup d'envoi
 * croissant (Exigence 14.3). Chaque match est joint au pronostic correspondant.
 */
function buildGroups(
  matches: SerializedMatch[],
  pronostics: AdminPronostic[]
): StageGroup[] {
  const pronosticByMatchId = new Map<string, AdminPronostic>(
    pronostics.map((p) => [p.matchId, p])
  );

  const byStage = new Map<Stage, MatchRow[]>();
  for (const match of matches) {
    const stage = match.stage as Stage;
    const rows = byStage.get(stage) ?? [];
    rows.push({ match, pronostic: pronosticByMatchId.get(match.id) ?? null });
    byStage.set(stage, rows);
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

/**
 * Détermine l'étape active par défaut : la première étape qui contient encore
 * au moins un match sans résultat officiel ; sinon la dernière étape.
 */
function pickActiveStage(groups: StageGroup[]): string | null {
  if (groups.length === 0) return null;
  for (const group of groups) {
    if (group.rows.some(({ match }) => match.officialResult === null)) {
      return group.stage;
    }
  }
  return groups[groups.length - 1].stage;
}

export default function AdminParticipantsPage() {
  const { data: session, status: sessionStatus } = useSession();
  const isAdmin = session?.user?.isAdmin ?? false;

  const [listState, setListState] = useState<ListState>({ status: 'loading' });
  const [detailState, setDetailState] = useState<DetailState>({ status: 'idle' });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [playerLabels, setPlayerLabels] = useState<Record<string, string>>({});
  const [teamLabels, setTeamLabels] = useState<Record<string, string>>({});
  const [openSections, setOpenSections] = useState<Set<string>>(() => new Set());

  const toggleSection = useCallback((key: string) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  // Chargement de la liste des participants (administrateur uniquement).
  const loadList = useCallback(async () => {
    setListState({ status: 'loading' });
    try {
      const response = await fetch('/api/admin/participants', {
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) {
        setListState({ status: 'error', message: ERROR_MESSAGES.TECHNICAL_ERROR });
        return;
      }
      const data = (await response.json()) as { participants: RankingEntry[] };
      setListState({ status: 'ready', participants: data.participants ?? [] });
    } catch {
      setListState({ status: 'error', message: ERROR_MESSAGES.TECHNICAL_ERROR });
    }
  }, []);

  useEffect(() => {
    if (sessionStatus === 'authenticated' && isAdmin) {
      void loadList();
    }
  }, [sessionStatus, isAdmin, loadList]);

  // Chargement du détail des pronostics d'un participant (au clic).
  const selectParticipant = useCallback(async (participantId: string) => {
    setSelectedId(participantId);
    setDetailState({ status: 'loading' });
    try {
      const response = await fetch(
        `/api/admin/participants/${participantId}/pronostics`,
        { headers: { Accept: 'application/json' } }
      );
      if (!response.ok) {
        setDetailState({ status: 'error', message: ERROR_MESSAGES.TECHNICAL_ERROR });
        return;
      }
      const data = (await response.json()) as DetailResponse;

      // Résolution des noms de joueurs pour les récompenses joueur.
      const allPlayerIds = Array.from(
        new Set([
          ...(data.rewardPredictions ?? []).filter((p) => p.playerId).map((p) => p.playerId!),
          ...(data.rewardResults ?? []).filter((r) => r.playerId).map((r) => r.playerId!),
        ])
      );
      const labels = await resolvePlayerLabels(allPlayerIds);
      setPlayerLabels(labels);

      // Résolution des noms d'équipes pour le Fair-Play.
      const needsTeams =
        (data.rewardPredictions ?? []).some((p) => p.teamCode) ||
        (data.rewardResults ?? []).some((r) => r.teamCode);
      if (needsTeams) {
        const tLabels = await resolveTeamLabels();
        setTeamLabels(tLabels);
      }

      const groups = buildGroups(data.matches ?? [], data.pronostics ?? []);
      const active = pickActiveStage(groups);
      const rewardTypes = data.rewardTypes ?? [];
      const rewardResults = data.rewardResults ?? [];
      const rewardsIncomplete =
        rewardTypes.length > 0 &&
        rewardTypes.some((t) => !rewardResults.find((r) => r.rewardType === t));
      const initialOpen = new Set<string>();
      if (rewardsIncomplete) initialOpen.add('__REWARDS__');
      if (active) initialOpen.add(active);
      setOpenSections(initialOpen);
      setDetailState({
        status: 'ready',
        header: data.participant,
        groups,
        rewardTypes,
        rewardPredictions: data.rewardPredictions ?? [],
        rewardResults,
      });
    } catch {
      setDetailState({ status: 'error', message: ERROR_MESSAGES.TECHNICAL_ERROR });
    }
  }, []);

  const selectedDisplayName = useMemo(() => {
    if (detailState.status === 'ready') return detailState.header.displayName;
    if (listState.status === 'ready' && selectedId) {
      return (
        listState.participants.find((p) => p.participantId === selectedId)
          ?.displayName ?? null
      );
    }
    return null;
  }, [detailState, listState, selectedId]);

  // === Contrôle d'accès défensif (Exigence 14.5) ===
  if (sessionStatus === 'loading') {
    return (
      <p role="status" className="text-sm text-muted-foreground">
        Chargement…
      </p>
    );
  }

  if (!isAdmin) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold text-foreground">
          Pronostics des participants
        </h1>
        <p
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {ERROR_MESSAGES.ADMIN_ONLY}
        </p>
      </div>
    );
  }

  return (
    <section aria-labelledby="admin-participants-titre" className="space-y-6">
      <header className="space-y-1">
        <h1
          id="admin-participants-titre"
          className="text-2xl font-semibold text-foreground"
        >
          Pronostics des participants
        </h1>
        <p className="text-sm text-muted-foreground">
          Consultez le détail des pronostics de chaque participant (passés, en
          cours et à venir). Sélectionnez un participant pour afficher tous ses
          pronostics.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,20rem)_1fr]">
        {/* ===== Liste des participants (Exigence 14.1) ===== */}
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">Participants</h2>

          {listState.status === 'loading' && (
            <p role="status" className="text-sm text-muted-foreground">
              Chargement des participants…
            </p>
          )}

          {listState.status === 'error' && (
            <div className="space-y-3">
              <p
                role="alert"
                className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
              >
                {listState.message}
              </p>
              <button
                type="button"
                onClick={() => void loadList()}
                className="inline-flex min-h-[44px] items-center rounded-md border border-input bg-background px-4 text-sm font-medium hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                Réessayer
              </button>
            </div>
          )}

          {listState.status === 'ready' && listState.participants.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Aucun participant à afficher pour le moment.
            </p>
          )}

          {listState.status === 'ready' && listState.participants.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full border-collapse text-sm">
                <caption className="sr-only">
                  Liste des participants triés par score total décroissant
                </caption>
                <thead>
                  <tr className="border-b border-border bg-muted/50 text-left">
                    <th scope="col" className="px-3 py-3 font-medium text-foreground">
                      Rang
                    </th>
                    <th scope="col" className="px-3 py-3 font-medium text-foreground">
                      Participant
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-3 text-right font-medium text-foreground"
                    >
                      Score
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {listState.participants.map((entry) => {
                    const active = entry.participantId === selectedId;
                    return (
                      <tr
                        key={entry.participantId}
                        className="border-b border-border last:border-0"
                      >
                        <td className="px-3 py-2 text-foreground tabular-nums">
                          {entry.rank}
                        </td>
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            onClick={() => void selectParticipant(entry.participantId)}
                            aria-pressed={active}
                            className={
                              'inline-flex min-h-[44px] items-center text-left font-medium underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ' +
                              (active ? 'text-primary' : 'text-foreground')
                            }
                          >
                            {entry.displayName}
                          </button>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-foreground">
                          {entry.totalPoints}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ===== Détail des pronostics du participant sélectionné ===== */}
        <div className="space-y-4">
          {detailState.status === 'idle' && (
            <p className="rounded-md border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
              Sélectionnez un participant pour afficher ses pronostics.
            </p>
          )}

          {detailState.status === 'loading' && (
            <p role="status" className="text-sm text-muted-foreground">
              Chargement des pronostics
              {selectedDisplayName ? ` de ${selectedDisplayName}` : ''}…
            </p>
          )}

          {detailState.status === 'error' && (
            <div className="space-y-3">
              <p
                role="alert"
                className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
              >
                {detailState.message}
              </p>
              {selectedId && (
                <button
                  type="button"
                  onClick={() => void selectParticipant(selectedId)}
                  className="inline-flex min-h-[44px] items-center rounded-md border border-input bg-background px-4 text-sm font-medium hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  Réessayer
                </button>
              )}
            </div>
          )}

          {detailState.status === 'ready' && (
            <>
              {/* En-tête : nom, score total, rang (Exigence 14.4) */}
              <header className="space-y-2 rounded-lg border border-border bg-card p-4">
                <h2 className="text-xl font-semibold text-foreground">
                  Pronostics de {detailState.header.displayName}
                </h2>
                <dl className="flex flex-wrap gap-x-8 gap-y-1 text-sm">
                  <div className="flex gap-1.5">
                    <dt className="text-muted-foreground">Rang :</dt>
                    <dd className="font-medium text-foreground tabular-nums">
                      {detailState.header.rank ?? '—'}
                    </dd>
                  </div>
                  <div className="flex gap-1.5">
                    <dt className="text-muted-foreground">Score total :</dt>
                    <dd className="font-medium text-foreground tabular-nums">
                      {detailState.header.totalPoints}
                    </dd>
                  </div>
                </dl>
                <p className="text-xs text-muted-foreground">
                  Vue administrateur : tous les pronostics sont affichés, y
                  compris ceux des matchs non encore joués.
                </p>
              </header>

              {/* ── Section Général (récompenses individuelles) ── */}
              {detailState.rewardTypes.length > 0 && (
                <section
                  aria-labelledby="admin-detail-general"
                  className="overflow-hidden rounded-lg border border-border"
                >
                  <button
                    type="button"
                    onClick={() => toggleSection('__REWARDS__')}
                    aria-expanded={openSections.has('__REWARDS__')}
                    aria-controls="admin-detail-general-content"
                    className="flex w-full items-center justify-between bg-muted/30 px-4 py-3 text-left hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <h3
                      id="admin-detail-general"
                      className="text-lg font-semibold text-foreground"
                    >
                      Général
                    </h3>
                    <ChevronDown
                      className={cn(
                        'h-5 w-5 text-muted-foreground transition-transform duration-200',
                        openSections.has('__REWARDS__') && 'rotate-180'
                      )}
                      aria-hidden="true"
                    />
                  </button>
                  {openSections.has('__REWARDS__') && (
                    <div
                      id="admin-detail-general-content"
                      className="overflow-x-auto border-t border-border"
                    >
                      <table className="w-full border-collapse text-sm">
                        <caption className="sr-only">
                          Pronostics récompenses de {detailState.header.displayName}
                        </caption>
                        <thead>
                          <tr className="border-b border-border bg-muted/50 text-left">
                            <th scope="col" className="px-4 py-3 font-medium text-foreground">
                              Récompense
                            </th>
                            <th scope="col" className="px-4 py-3 font-medium text-foreground">
                              Pronostic
                            </th>
                            <th scope="col" className="px-4 py-3 font-medium text-foreground">
                              Vainqueur officiel
                            </th>
                            <th scope="col" className="px-4 py-3 font-medium text-foreground">
                              Points
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {detailState.rewardTypes.map((rewardType) => {
                            const emoji = REWARD_EMOJIS[rewardType] ?? '';
                            const label = `${emoji} ${REWARD_LABELS[rewardType] ?? rewardType}`.trim();
                            const prediction = detailState.rewardPredictions.find(
                              (p) => p.rewardType === rewardType
                            );
                            const result = detailState.rewardResults.find(
                              (r) => r.rewardType === rewardType
                            );
                            const hasPoints =
                              result !== undefined && prediction?.points != null;

                            return (
                              <tr
                                key={rewardType}
                                className="border-b border-border last:border-0"
                              >
                                <th
                                  scope="row"
                                  className="px-4 py-3 text-left font-normal text-foreground"
                                >
                                  {label}
                                </th>
                                <td className="px-4 py-3 text-foreground">
                                  {prediction ? (
                                    <span className="font-medium">
                                      {prediction.teamCode
                                        ? (teamLabels[prediction.teamCode] ?? prediction.teamCode)
                                        : prediction.playerId
                                          ? (playerLabels[prediction.playerId] ?? prediction.playerId)
                                          : '—'}
                                    </span>
                                  ) : (
                                    <span className="text-muted-foreground">
                                      aucun pronostic
                                    </span>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-foreground">
                                  {result ? (
                                    <span className="font-medium">
                                      {result.teamCode
                                        ? (teamLabels[result.teamCode] ?? result.teamCode)
                                        : result.playerId
                                          ? (playerLabels[result.playerId] ?? result.playerId)
                                          : '—'}
                                    </span>
                                  ) : (
                                    <span className="text-muted-foreground">
                                      non désigné
                                    </span>
                                  )}
                                </td>
                                <td className="px-4 py-3">
                                  {hasPoints ? (
                                    <ScoreIndicator points={prediction!.points!} />
                                  ) : (
                                    <span className="text-muted-foreground">—</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              )}

              {detailState.groups.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Aucun match à afficher.
                </p>
              ) : (
                <div className="space-y-3">
                  {detailState.groups.map((group) => {
                    const isOpen = openSections.has(group.stage);
                    return (
                      <section
                        key={group.stage}
                        aria-labelledby={`admin-stage-${group.stage}`}
                        className="overflow-hidden rounded-lg border border-border"
                      >
                        <button
                          type="button"
                          onClick={() => toggleSection(group.stage)}
                          aria-expanded={isOpen}
                          aria-controls={`admin-stage-${group.stage}-content`}
                          className="flex w-full items-center justify-between bg-muted/30 px-4 py-3 text-left hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        >
                          <h3
                            id={`admin-stage-${group.stage}`}
                            className="text-lg font-semibold text-foreground"
                          >
                            {group.label}
                          </h3>
                          <ChevronDown
                            className={cn(
                              'h-5 w-5 text-muted-foreground transition-transform duration-200',
                              isOpen && 'rotate-180'
                            )}
                            aria-hidden="true"
                          />
                        </button>
                        {isOpen && (
                          <div
                            id={`admin-stage-${group.stage}-content`}
                            className="overflow-x-auto border-t border-border"
                          >
                            <table className="w-full border-collapse text-sm">
                              <caption className="sr-only">
                                Pronostics de {detailState.header.displayName} pour{' '}
                                {group.label}
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
                                    className="px-4 py-3 font-medium text-foreground"
                                  >
                                    Points
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {group.rows.map(({ match, pronostic }) => {
                                  const result = match.officialResult;
                                  const hasResult = result !== null;
                                  const hasPoints =
                                    hasResult && pronostic?.points != null;
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
                                          <>
                                            {result.homeGoals} – {result.awayGoals}
                                            {result.penaltyWinner && (
                                              <span className="ml-1 text-xs text-muted-foreground">
                                                (TAB :{' '}
                                                {result.penaltyWinner === 'HOME'
                                                  ? sideName(match.homeTeam)
                                                  : sideName(match.awayTeam)}
                                                )
                                              </span>
                                            )}
                                          </>
                                        ) : (
                                          <span className="text-muted-foreground">
                                            non disponible
                                          </span>
                                        )}
                                      </td>
                                      <td className="px-4 py-3">
                                        {hasPoints ? (
                                          <ScoreIndicator points={pronostic!.points!} />
                                        ) : (
                                          <span className="text-muted-foreground">
                                            —
                                          </span>
                                        )}
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
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
