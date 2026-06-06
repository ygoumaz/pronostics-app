'use client';

// Page d'administration : saisie (et correction) des résultats officiels des
// matchs (Exigence 7, 17.6) + désignation des vainqueurs de récompenses
// individuelles (Exigence 18.15/18.16).
//
// Référence : requirements.md - Exigence 7 (7.1 saisie 0-99, 7.2/7.7 vainqueur
// aux TAB si nul en éliminatoire, 7.3 correction, 7.5 coup d'envoi atteint,
// 7.6 format des buts, 7.8 confirmation), 17.6 (message contextuel de refus
// d'accès), 18.15/18.16 (admin désigne les vainqueurs des récompenses, peut
// corriger).
//
// Stratégie : page cliente avec deux modes d'affichage :
//   - Onglets d'étape (Journée 1 → Finale) : saisie des résultats de matchs
//   - Onglet « Général » (après Finale) : désignation des vainqueurs de
//     récompenses individuelles (même fonctionnalité que l'ancienne page
//     /admin/recompenses, désormais supprimée).
//
// Contrôle d'accès : la fonctionnalité est réservée à l'Administrateur. L'API
// est l'autorité finale (403 ADMIN_ONLY). Vérification défensive côté client
// via `useSession` (Exigence 7.4 / 17.6).

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';

import type { SerializedMatch } from '@/app/api/matches/serialize';
import type { PenaltyWinner, Stage } from '@/types';
import { ERROR_MESSAGES } from '@/lib/errors';
import { MatchCard } from '@/components/match-card';
import {
  STAGE_LABELS,
  STAGE_ORDER,
} from '@/components/navigation-stages';
import { ResultForm } from '@/components/admin/result-form';
import { Button } from '@/components/ui/button';
import { PlayerSelector, type PlayerOption } from '@/components/player-selector';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type LoadState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; matches: SerializedMatch[] };

/** Identifiant virtuel de l'onglet Récompenses / Général. */
const REWARDS_TAB = '__RECOMPENSES__' as const;
type ActiveTab = Stage | typeof REWARDS_TAB;

/** Libellés français des 5 récompenses individuelles (Exigence 18.2). */
const REWARD_LABELS: Record<string, string> = {
  GOLDEN_BOOT: "Soulier d'Or (meilleur buteur)",
  GOLDEN_BALL: "Ballon d'Or (meilleur joueur)",
  GOLDEN_GLOVE: "Gant d'Or (meilleur gardien)",
  BEST_YOUNG: 'Meilleur Jeune Joueur',
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

interface RewardResult {
  rewardType: string;
  playerId: string;
}

interface RecompensesState {
  rewardTypes: string[];
  locked: boolean;
  predictions: { rewardType: string; playerId: string; points: number | null }[];
  results: RewardResult[];
}

interface RewardSaveState {
  status: 'idle' | 'saving' | 'success' | 'error';
  message?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Étape affichée par défaut : celle du prochain match « à venir » ; à défaut,
 * la première étape chronologique présente.
 */
function pickDefaultStage(
  matches: SerializedMatch[],
  presentStages: Stage[]
): Stage {
  const upcoming = matches.find((m) => m.status === 'à venir');
  if (upcoming) return upcoming.stage as Stage;
  return presentStages[0] ?? 'GROUP_DAY_1';
}

/** Résout les libellés (noms) des joueurs par id depuis l'API. */
async function resolvePlayerLabels(
  ids: string[]
): Promise<Record<string, string>> {
  if (ids.length === 0) return {};
  try {
    const params = new URLSearchParams({ ids: ids.join(',') });
    const response = await fetch(`/api/players?${params.toString()}`);
    if (!response.ok) return {};
    const data = (await response.json()) as { players: PlayerOption[] };
    const labels: Record<string, string> = {};
    for (const player of data.players ?? []) {
      labels[player.id] = player.name;
    }
    return labels;
  } catch {
    return {};
  }
}

// ---------------------------------------------------------------------------
// Composant principal
// ---------------------------------------------------------------------------

export default function AdminResultatsPage() {
  const { data: session, status: sessionStatus } = useSession();
  const isAdmin = session?.user?.isAdmin ?? false;

  // ── État matchs ───────────────────────────────────────────────────────────
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [activeTab, setActiveTab] = useState<ActiveTab | null>(null);

  // ── État récompenses ──────────────────────────────────────────────────────
  const [recompenses, setRecompenses] = useState<RecompensesState | null>(null);
  const [recompensesLoading, setRecompensesLoading] = useState(false);
  const [recompensesError, setRecompensesError] = useState<string | null>(null);
  const [rewardSelections, setRewardSelections] = useState<
    Record<string, { id: string; label: string } | null>
  >({});
  const [rewardSaveStates, setRewardSaveStates] = useState<
    Record<string, RewardSaveState>
  >({});
  const [winnerLabels, setWinnerLabels] = useState<Record<string, string>>({});

  // ── Chargement des matchs ─────────────────────────────────────────────────
  const loadMatches = useCallback(async () => {
    setState({ kind: 'loading' });
    try {
      const response = await fetch('/api/matches', {
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) {
        setState({ kind: 'error', message: ERROR_MESSAGES.TECHNICAL_ERROR });
        return;
      }
      const data = (await response.json()) as { matches: SerializedMatch[] };
      setState({ kind: 'ready', matches: data.matches ?? [] });
    } catch {
      setState({ kind: 'error', message: ERROR_MESSAGES.TECHNICAL_ERROR });
    }
  }, []);

  // ── Chargement des récompenses ────────────────────────────────────────────
  const loadRecompenses = useCallback(async () => {
    setRecompensesLoading(true);
    setRecompensesError(null);
    try {
      const response = await fetch('/api/recompenses');
      if (!response.ok) {
        setRecompensesError(
          'Impossible de charger les récompenses. Veuillez réessayer.'
        );
        return;
      }
      const data = (await response.json()) as RecompensesState;
      setRecompenses(data);

      const playerIds = Array.from(
        new Set(data.results.map((r) => r.playerId))
      );
      const labelById = await resolvePlayerLabels(playerIds);

      const initialSelections: Record<
        string,
        { id: string; label: string } | null
      > = {};
      data.results.forEach((r) => {
        initialSelections[r.rewardType] = {
          id: r.playerId,
          label: labelById[r.playerId] ?? r.playerId,
        };
      });
      setRewardSelections(initialSelections);
      setWinnerLabels(
        Object.fromEntries(
          data.results.map((r) => [
            r.rewardType,
            labelById[r.playerId] ?? r.playerId,
          ])
        )
      );
    } catch {
      setRecompensesError('Une erreur technique est survenue. Veuillez réessayer.');
    } finally {
      setRecompensesLoading(false);
    }
  }, []);

  // On ne charge que pour un administrateur authentifié.
  useEffect(() => {
    if (sessionStatus === 'authenticated' && isAdmin) {
      void loadMatches();
      void loadRecompenses();
    }
  }, [sessionStatus, isAdmin, loadMatches, loadRecompenses]);

  // ── Groupement des matchs par étape ───────────────────────────────────────
  const matchesByStage = useMemo(() => {
    const map = new Map<Stage, SerializedMatch[]>();
    if (state.kind !== 'ready') return map;
    for (const match of state.matches) {
      const stage = match.stage as Stage;
      const list = map.get(stage);
      if (list) list.push(match);
      else map.set(stage, [match]);
    }
    return map;
  }, [state]);

  const presentStages = useMemo(
    () => STAGE_ORDER.filter((stage) => matchesByStage.has(stage)),
    [matchesByStage]
  );

  // Sélection de l'onglet par défaut une fois les données chargées.
  useEffect(() => {
    if (
      state.kind === 'ready' &&
      activeTab === null &&
      presentStages.length > 0
    ) {
      setActiveTab(pickDefaultStage(state.matches, presentStages));
    }
  }, [state, activeTab, presentStages]);

  // ── Mise à jour optimiste après saisie d'un résultat ─────────────────────
  const handleSaved = useCallback(
    (
      matchId: string,
      result: {
        homeGoals: number;
        awayGoals: number;
        penaltyWinner: PenaltyWinner | null;
      }
    ) => {
      setState((prev) => {
        if (prev.kind !== 'ready') return prev;
        return {
          kind: 'ready',
          matches: prev.matches.map((m) =>
            m.id === matchId
              ? {
                  ...m,
                  officialResult: {
                    homeGoals: result.homeGoals,
                    awayGoals: result.awayGoals,
                    penaltyWinner: result.penaltyWinner,
                  },
                }
              : m
          ),
        };
      });
    },
    []
  );

  // ── Enregistrement d'un vainqueur de récompense ───────────────────────────
  async function handleRewardSelect(rewardType: string, player: PlayerOption) {
    setRewardSelections((prev) => ({
      ...prev,
      [rewardType]: { id: player.id, label: player.name },
    }));
    setRewardSaveStates((prev) => ({
      ...prev,
      [rewardType]: { status: 'saving' },
    }));

    try {
      const response = await fetch(`/api/recompenses/${rewardType}/winner`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId: player.id }),
      });
      const data = (await response.json().catch(() => null)) as
        | { message?: string; error?: string; updatedPredictions?: number }
        | null;

      if (!response.ok) {
        setRewardSaveStates((prev) => ({
          ...prev,
          [rewardType]: {
            status: 'error',
            message:
              data?.error ??
              (response.status === 403
                ? "Cette fonctionnalité est réservée à l'Administrateur."
                : 'Une erreur technique est survenue. Veuillez réessayer.'),
          },
        }));
        return;
      }

      const updated = data?.updatedPredictions ?? 0;
      const confirmation = data?.message ?? 'Le vainqueur a été enregistré.';
      setRewardSaveStates((prev) => ({
        ...prev,
        [rewardType]: {
          status: 'success',
          message: `${confirmation} (${updated} pronostic${updated > 1 ? 's' : ''} recalculé${updated > 1 ? 's' : ''}).`,
        },
      }));
      setWinnerLabels((prev) => ({ ...prev, [rewardType]: player.name }));
      setRecompenses((prev) => {
        if (!prev) return prev;
        const others = prev.results.filter((r) => r.rewardType !== rewardType);
        return {
          ...prev,
          results: [...others, { rewardType, playerId: player.id }],
        };
      });
    } catch {
      setRewardSaveStates((prev) => ({
        ...prev,
        [rewardType]: {
          status: 'error',
          message: 'Une erreur technique est survenue. Veuillez réessayer.',
        },
      }));
    }
  }

  // ── Contrôle d'accès défensif (Exigence 7.4 / 17.6) ─────────────────────
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
          Saisie des résultats
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

  if (state.kind === 'loading') {
    return (
      <p role="status" className="text-sm text-muted-foreground">
        Chargement des matchs…
      </p>
    );
  }

  if (state.kind === 'error') {
    return (
      <div className="space-y-4">
        <p
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {state.message}
        </p>
        <button
          type="button"
          onClick={() => void loadMatches()}
          className="inline-flex min-h-[44px] items-center rounded-md border border-input bg-background px-4 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
        >
          Réessayer
        </button>
      </div>
    );
  }

  const tab = activeTab ?? (presentStages[0] as ActiveTab | null) ?? REWARDS_TAB;
  const isRewardsTab = tab === REWARDS_TAB;
  const stageTab = isRewardsTab ? null : (tab as Stage);
  const visibleMatches = stageTab ? matchesByStage.get(stageTab) ?? [] : [];

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-foreground">
          Saisie des résultats
        </h1>
        <p className="text-sm text-muted-foreground">
          Saisissez les résultats officiels des matchs et désignez les
          vainqueurs des récompenses individuelles.
        </p>
      </header>

      {presentStages.length === 0 ? (
        <p className="rounded-md border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
          Aucun match n'est disponible pour le moment.
        </p>
      ) : (
        <>
          {/* Barre de navigation unifiée : étapes + Général (récompenses) */}
          <nav aria-label="Navigation par étape" className="w-full">
            <ul className="flex gap-1 overflow-x-auto pb-2" role="tablist">
              {presentStages.map((stage) => {
                const active = !isRewardsTab && stage === stageTab;
                return (
                  <li key={stage} className="shrink-0">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setActiveTab(stage)}
                      className={`inline-flex min-h-[44px] items-center whitespace-nowrap rounded-md px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                        active
                          ? 'bg-primary text-primary-foreground'
                          : 'text-foreground hover:bg-accent hover:text-accent-foreground'
                      }`}
                    >
                      {STAGE_LABELS[stage]}
                    </button>
                  </li>
                );
              })}
              {/* Onglet Général (récompenses) — toujours en dernière position */}
              <li className="shrink-0">
                <button
                  type="button"
                  role="tab"
                  aria-selected={isRewardsTab}
                  onClick={() => setActiveTab(REWARDS_TAB)}
                  className={`inline-flex min-h-[44px] items-center whitespace-nowrap rounded-md px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                    isRewardsTab
                      ? 'bg-primary text-primary-foreground'
                      : 'text-foreground hover:bg-accent hover:text-accent-foreground'
                  }`}
                >
                  Général
                </button>
              </li>
            </ul>
          </nav>

          {/* ── Onglets matchs ── */}
          {!isRewardsTab && stageTab && (
            <section
              aria-label={`Résultats — ${STAGE_LABELS[stageTab]}`}
              className="space-y-4"
            >
              <h2 className="text-lg font-semibold text-foreground">
                {STAGE_LABELS[stageTab]}
              </h2>

              {/* Règles contextuelles de la saisie (Exigence 17.6). */}
              <div className="rounded-md border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
                <p className="font-medium text-foreground">Règles de saisie</p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  <li>
                    La saisie n'est possible qu'une fois le coup d'envoi du match
                    atteint.
                  </li>
                  <li>Chaque score est un nombre entier compris entre 0 et 99.</li>
                  <li>
                    Pour un match à élimination directe terminé sur un score nul,
                    vous devez désigner le vainqueur aux tirs au but.
                  </li>
                  <li>
                    Vous pouvez corriger un résultat déjà saisi : les points des
                    participants seront recalculés.
                  </li>
                </ul>
              </div>

              {visibleMatches.length === 0 ? (
                <p className="rounded-md border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
                  Aucun match à afficher pour cette étape.
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                  {visibleMatches.map((match) => {
                    const teamsKnown =
                      match.homeTeam.code !== null &&
                      match.awayTeam.code !== null;

                    return (
                      <MatchCard
                        key={match.id}
                        match={match}
                        footer={
                          teamsKnown ? (
                            <ResultForm match={match} onSaved={handleSaved} />
                          ) : (
                            <p className="text-sm italic text-muted-foreground">
                              {ERROR_MESSAGES.MATCH_NOT_AVAILABLE}
                            </p>
                          )
                        }
                      />
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {/* ── Onglet Général (récompenses individuelles) ── */}
          {isRewardsTab && (
            <section aria-label="Général — Récompenses individuelles" className="space-y-4">
              <header className="space-y-1">
                <h2 className="text-lg font-semibold text-foreground">
                  Général
                </h2>
                <p className="text-sm text-muted-foreground">
                  Désignez le vainqueur officiel de chaque récompense parmi la
                  liste des joueurs. À l'enregistrement, les points bonus de tous
                  les participants sont recalculés automatiquement (5 points par
                  bon pronostic). Vous pouvez corriger un vainqueur déjà désigné
                  à tout moment.
                </p>
              </header>

              {recompensesLoading ? (
                <p role="status" className="text-sm text-muted-foreground">
                  Chargement des récompenses…
                </p>
              ) : recompensesError || !recompenses ? (
                <div className="space-y-4">
                  <div
                    role="alert"
                    className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
                  >
                    {recompensesError ?? 'Une erreur est survenue.'}
                  </div>
                  <Button variant="outline" onClick={() => void loadRecompenses()}>
                    Réessayer
                  </Button>
                </div>
              ) : (
                <ul className="space-y-4">
                  {recompenses.rewardTypes.map((rewardType) => {
                    const label = `${REWARD_EMOJIS[rewardType] ?? ''} ${REWARD_LABELS[rewardType] ?? rewardType}`.trim();
                    const selection = rewardSelections[rewardType] ?? null;
                    const saveState = rewardSaveStates[rewardType];
                    const result = recompenses.results.find(
                      (r) => r.rewardType === rewardType
                    );

                    const inputId = `admin-reward-${rewardType}`;
                    const describedById = saveState?.message
                      ? `admin-reward-${rewardType}-status`
                      : undefined;

                    return (
                      <li
                        key={rewardType}
                        className="rounded-lg border border-border bg-card p-4 shadow-sm"
                      >
                        <label
                          htmlFor={inputId}
                          className="block text-sm font-medium text-foreground"
                        >
                          {label}
                        </label>

                        <p className="mt-1 text-sm text-muted-foreground">
                          {result ? (
                            <>
                              Vainqueur actuel :{' '}
                              <span className="font-medium text-foreground">
                                {winnerLabels[rewardType] ?? result.playerId}
                              </span>
                            </>
                          ) : (
                            'Aucun vainqueur désigné pour le moment.'
                          )}
                        </p>

                        <div className="mt-2">
                          <PlayerSelector
                            inputId={inputId}
                            value={selection?.id ?? null}
                            valueLabel={selection?.label ?? null}
                            onSelect={(player) =>
                              void handleRewardSelect(rewardType, player)
                            }
                            describedById={describedById}
                          />
                        </div>

                        {saveState?.message && (
                          <p
                            id={`admin-reward-${rewardType}-status`}
                            role={saveState.status === 'error' ? 'alert' : 'status'}
                            className={
                              saveState.status === 'error'
                                ? 'mt-2 text-sm text-destructive'
                                : 'mt-2 text-sm text-green-700'
                            }
                          >
                            {saveState.status === 'saving'
                              ? 'Enregistrement…'
                              : saveState.message}
                          </p>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}
