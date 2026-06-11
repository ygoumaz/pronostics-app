'use client';

// Page de saisie des pronostics (Exigence 4, 5, 10, 12, 17, 18).
//
// Référence : requirements.md - Exigences 4.1/4.2/4.4/4.5/4.6 (saisie,
// modification, validation, confirmation, pré-remplissage), 5.7/5.8 (état de
// verrouillage et temps restant par étape), 10.1-10.6 (résultat + pronostic +
// points + score total), 12.3/12.4/12.7 (une seule étape à la fois,
// navigation), 17.2-17.5 (règles contextuelles), 18 (récompenses individuelles
// intégrées comme premier onglet avant la Journée 1).
//
// Stratégie : page cliente. Elle charge en parallèle :
//   - GET /api/matches (tous les matchs, déjà triés et sérialisés)
//   - GET /api/pronostics (pronostics du participant connecté)
//   - GET /api/recompenses (récompenses individuelles)
//
// La navigation par étape est purement en mémoire. Un onglet synthétique
// « Récompenses » est inséré en première position avant « Journée 1 ».
// Le compte à rebours des récompenses utilise le même seuil que la clôture
// de la Journée 1 : coup d'envoi du premier match GROUP_DAY_1 − 1 heure.

import { useCallback, useEffect, useMemo, useState } from 'react';

import type { SerializedMatch } from '@/app/api/matches/serialize';
import type { Stage } from '@/types';
import { ERROR_MESSAGES } from '@/lib/errors';
import { cn } from '@/lib/utils';
import { MatchCard } from '@/components/match-card';
import {
  STAGE_LABELS,
  STAGE_ORDER,
} from '@/components/navigation-stages';
import {
  PronosticForm,
  type ExistingPronostic,
} from '@/components/pronostic-form';
import { LockRuleHint } from '@/components/contextual-rules';
import { PlayerSelector, type PlayerOption } from '@/components/player-selector';
import { TeamSelector, type TeamOption } from '@/components/team-selector';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Pronostic du participant tel que renvoyé par GET /api/pronostics. */
interface PronosticDTO {
  matchId: string;
  homeGoals: number;
  awayGoals: number;
  points: number | null;
}

/** Libellés français des 5 récompenses individuelles (Exigence 18.2). */
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

interface RewardPrediction {
  rewardType: string;
  playerId: string | null;
  teamCode: string | null;
  points: number | null;
}

interface RewardResult {
  rewardType: string;
  playerId: string | null;
  teamCode: string | null;
}

interface RecompensesState {
  rewardTypes: string[];
  locked: boolean;
  predictions: RewardPrediction[];
  results: RewardResult[];
}

interface RewardSaveState {
  status: 'idle' | 'saving' | 'success' | 'error';
  message?: string;
}

type LoadState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; matches: SerializedMatch[] };

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

/** Une heure en millisecondes : marge de clôture avant le premier coup d'envoi. */
const LOCK_OFFSET_MS = 60 * 60 * 1000;

/** Identifiant virtuel de l'onglet Récompenses. */
const REWARDS_TAB = '__RECOMPENSES__' as const;
type ActiveTab = Stage | typeof REWARDS_TAB;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Étape affichée par défaut (Exigence 12.6) : si les récompenses ne sont pas
 * encore clôturées, on affiche l'onglet Récompenses en premier ; sinon on
 * sélectionne le prochain match « à venir », ou la dernière étape présente.
 */
function pickDefaultTab(
  matches: SerializedMatch[],
  presentStages: Stage[],
  rewardsLocked: boolean
): ActiveTab {
  if (!rewardsLocked) return REWARDS_TAB;
  const upcoming = matches.find((m) => m.status === 'à venir');
  if (upcoming) return upcoming.stage as Stage;
  return presentStages[presentStages.length - 1] ?? 'FINAL';
}

/** Formate une durée (ms) en compte à rebours « Xj Yh Zmin Zs » (Exigence 5.8). */
function formatCountdown(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) return `${days} j ${hours} h ${minutes} min`;
  if (hours > 0) return `${hours} h ${minutes} min`;
  if (minutes > 0) return `${minutes} min ${seconds} s`;
  return `${seconds} s`;
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

export default function PronosticsPage() {
  // ── État matchs / pronostics ──────────────────────────────────────────────
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [pronostics, setPronostics] = useState<Map<string, PronosticDTO>>(
    () => new Map()
  );

  // ── État récompenses ──────────────────────────────────────────────────────
  const [recompenses, setRecompenses] = useState<RecompensesState | null>(null);
  const [rewardSelections, setRewardSelections] = useState<
    Record<string, { id: string; label: string } | null>
  >({});
  const [rewardSaveStates, setRewardSaveStates] = useState<
    Record<string, RewardSaveState>
  >({});
  const [winnerLabels, setWinnerLabels] = useState<Record<string, string>>({});

  // ── Navigation ────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<ActiveTab | null>(null);

  // ── Horloge (compte à rebours) ────────────────────────────────────────────
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // ── Chargement ────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setState({ kind: 'loading' });
    try {
      const [matchesRes, pronosticsRes, recompensesRes] = await Promise.all([
        fetch('/api/matches', { headers: { Accept: 'application/json' } }),
        fetch('/api/pronostics', { headers: { Accept: 'application/json' } }),
        fetch('/api/recompenses', { headers: { Accept: 'application/json' } }),
      ]);

      if (!matchesRes.ok) {
        setState({ kind: 'error', message: ERROR_MESSAGES.TECHNICAL_ERROR });
        return;
      }

      const matchesData = (await matchesRes.json()) as {
        matches: SerializedMatch[];
      };
      const matches = matchesData.matches ?? [];

      if (pronosticsRes.ok) {
        const pronosticsData = (await pronosticsRes.json()) as {
          pronostics: PronosticDTO[];
        };
        const map = new Map<string, PronosticDTO>();
        for (const p of pronosticsData.pronostics ?? []) {
          map.set(p.matchId, p);
        }
        setPronostics(map);
      }

      if (recompensesRes.ok) {
        const data = (await recompensesRes.json()) as RecompensesState;
        setRecompenses(data);

        // Pré-remplissage des sélecteurs joueurs pour les pronostics existants.
        const playerIds = new Set<string>();
        data.predictions.forEach((p) => { if (p.playerId) playerIds.add(p.playerId); });
        data.results.forEach((r) => { if (r.playerId) playerIds.add(r.playerId); });
        const labelById = await resolvePlayerLabels(Array.from(playerIds));

        // Pré-remplissage des sélecteurs équipe (Fair-Play).
        const teamCodes = new Set<string>();
        data.predictions.forEach((p) => { if (p.teamCode) teamCodes.add(p.teamCode); });
        data.results.forEach((r) => { if (r.teamCode) teamCodes.add(r.teamCode); });
        const teamLabelByCode: Record<string, string> = {};
        if (teamCodes.size > 0) {
          try {
            const teamsRes = await fetch('/api/teams');
            if (teamsRes.ok) {
              const teamsData = (await teamsRes.json()) as { teams: TeamOption[] };
              for (const t of teamsData.teams ?? []) {
                teamLabelByCode[t.code] = t.name;
              }
            }
          } catch { /* silent */ }
        }

        const initialSelections: Record<
          string,
          { id: string; label: string } | null
        > = {};
        data.predictions.forEach((p) => {
          if (p.rewardType === 'FAIR_PLAY' && p.teamCode) {
            initialSelections[p.rewardType] = {
              id: p.teamCode,
              label: teamLabelByCode[p.teamCode] ?? p.teamCode,
            };
          } else if (p.playerId) {
            initialSelections[p.rewardType] = {
              id: p.playerId,
              label: labelById[p.playerId] ?? p.playerId,
            };
          }
        });
        setRewardSelections(initialSelections);
        setWinnerLabels(
          Object.fromEntries(
            data.results.map((r) => {
              if (r.rewardType === 'FAIR_PLAY' && r.teamCode) {
                return [r.rewardType, teamLabelByCode[r.teamCode] ?? r.teamCode];
              }
              return [r.rewardType, r.playerId ? (labelById[r.playerId] ?? r.playerId) : ''];
            })
          )
        );
      }

      setState({ kind: 'ready', matches });
    } catch {
      setState({ kind: 'error', message: ERROR_MESSAGES.TECHNICAL_ERROR });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // ── Groupement par étape ──────────────────────────────────────────────────
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

  // ── Sélection de l'onglet par défaut une fois les données chargées ────────
  useEffect(() => {
    if (
      state.kind === 'ready' &&
      activeTab === null
    ) {
      // Par défaut : onglet Récompenses si pas encore clôturé, sinon prochain
      // match à venir, sinon dernière étape présente.
      setActiveTab(
        pickDefaultTab(state.matches, presentStages, rewardsEffectiveLocked)
      );
    }
  }, [state, activeTab, presentStages, rewardsEffectiveLocked]);

  // ── Pronostics manquants par étape ───────────────────────────────────────
  const missingByStage = useMemo(() => {
    const map = new Map<Stage, number>();
    for (const [stage, matches] of Array.from(matchesByStage.entries())) {
      const missing = matches.filter(
        (m) =>
          m.homeTeam.code !== null &&
          m.awayTeam.code !== null &&
          !pronostics.has(m.id)
      ).length;
      map.set(stage, missing);
    }
    return map;
  }, [matchesByStage, pronostics]);

  // ── Verrou effectif des récompenses (temps écoulé OU API locked) ─────────
  // Calculé en useMemo pour être partagé avec missingRewards.
  const rewardsEffectiveLocked = useMemo(() => {
    if (recompenses?.locked) return true;
    if (rewardsLockTime !== null && now >= rewardsLockTime) return true;
    return false;
  }, [recompenses, rewardsLockTime, now]);

  const missingRewards = useMemo(() => {
    if (!recompenses || rewardsEffectiveLocked) return 0;
    return recompenses.rewardTypes.filter(
      (rt) => !rewardSelections[rt]
    ).length;
  }, [recompenses, rewardsEffectiveLocked, rewardSelections]);

  // ── Score total cumulé (Exigence 10.4) ───────────────────────────────────
  const totalScore = useMemo(() => {
    let total = 0;
    for (const p of Array.from(pronostics.values())) {
      if (typeof p.points === 'number') total += p.points;
    }
    // Ajouter les points des récompenses
    if (recompenses) {
      for (const p of recompenses.predictions) {
        if (typeof p.points === 'number') total += p.points;
      }
    }
    return total;
  }, [pronostics, recompenses]);

  // ── Compte à rebours des récompenses (clôture = 1er match J1 − 1h) ───────
  const rewardsLockTime = useMemo(() => {
    if (state.kind !== 'ready') return null;
    const day1Matches = matchesByStage.get('GROUP_DAY_1') ?? [];
    if (day1Matches.length === 0) return null;
    const earliest = Math.min(
      ...day1Matches.map((m) => new Date(m.kickoffTime).getTime())
    );
    return earliest - LOCK_OFFSET_MS;
  }, [state, matchesByStage]);

  const rewardsOpen =
    recompenses !== null &&
    !rewardsEffectiveLocked &&
    rewardsLockTime !== null;
  const rewardsRemainingMs =
    rewardsLockTime !== null ? Math.max(0, rewardsLockTime - now) : 0;

  // ── Mise à jour optimiste des pronostics match (Exigence 4.5) ────────────
  const handleSaved = useCallback(
    (matchId: string, homeGoals: number, awayGoals: number) => {
      setPronostics((prev) => {
        const next = new Map(prev);
        const existing = next.get(matchId);
        next.set(matchId, {
          matchId,
          homeGoals,
          awayGoals,
          points: existing?.points ?? null,
        });
        return next;
      });
    },
    []
  );

  // ── Enregistrement d'un pronostic récompense joueur ──────────────────────
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
      const response = await fetch(`/api/recompenses/${rewardType}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId: player.id }),
      });
      const data = (await response.json().catch(() => null)) as
        | { message?: string; error?: string }
        | null;

      if (!response.ok) {
        if (response.status === 403) {
          setRecompenses((prev) => (prev ? { ...prev, locked: true } : prev));
        }
        setRewardSaveStates((prev) => ({
          ...prev,
          [rewardType]: {
            status: 'error',
            message:
              data?.error ??
              'Une erreur technique est survenue. Veuillez réessayer.',
          },
        }));
        return;
      }

      setRewardSaveStates((prev) => ({
        ...prev,
        [rewardType]: {
          status: 'success',
          message: data?.message ?? 'Pronostic enregistré.',
        },
      }));
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

  // ── Enregistrement d'un pronostic récompense équipe (Fair-Play) ───────────
  async function handleFairPlayTeamSelect(team: TeamOption) {
    const rewardType = 'FAIR_PLAY';
    setRewardSelections((prev) => ({
      ...prev,
      [rewardType]: { id: team.code, label: team.name },
    }));
    setRewardSaveStates((prev) => ({
      ...prev,
      [rewardType]: { status: 'saving' },
    }));

    try {
      const response = await fetch(`/api/recompenses/${rewardType}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamCode: team.code }),
      });
      const data = (await response.json().catch(() => null)) as
        | { message?: string; error?: string }
        | null;

      if (!response.ok) {
        if (response.status === 403) {
          setRecompenses((prev) => (prev ? { ...prev, locked: true } : prev));
        }
        setRewardSaveStates((prev) => ({
          ...prev,
          [rewardType]: {
            status: 'error',
            message:
              data?.error ??
              'Une erreur technique est survenue. Veuillez réessayer.',
          },
        }));
        return;
      }

      setRewardSaveStates((prev) => ({
        ...prev,
        [rewardType]: {
          status: 'success',
          message: data?.message ?? 'Pronostic enregistré.',
        },
      }));
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

  // ── Rendu ─────────────────────────────────────────────────────────────────
  if (state.kind === 'loading') {
    return (
      <p role="status" className="text-sm text-muted-foreground">
        Chargement des pronostics…
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
          onClick={() => void load()}
          className="inline-flex min-h-[44px] items-center rounded-md border border-input bg-background px-4 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
        >
          Réessayer
        </button>
      </div>
    );
  }

  const tab = activeTab ?? REWARDS_TAB;
  const isRewardsTab = tab === REWARDS_TAB;

  // Pour l'onglet match actif
  const stageTab = isRewardsTab ? null : (tab as Stage | null);
  const visibleMatches = stageTab ? matchesByStage.get(stageTab) ?? [] : [];

  // Calcul du verrou + compte à rebours pour l'étape de matchs active
  let stageLockTime: number | null = null;
  if (visibleMatches.length > 0) {
    const earliestKickoff = Math.min(
      ...visibleMatches.map((m) => new Date(m.kickoffTime).getTime())
    );
    stageLockTime = earliestKickoff - LOCK_OFFSET_MS;
  }
  const stageOpen = stageLockTime !== null && now < stageLockTime;
  const stageRemainingMs =
    stageLockTime !== null ? Math.max(0, stageLockTime - now) : 0;

  // L'onglet Récompenses est toujours présent (même si l'API a échoué).
  const hasRewardsTab = true;

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-foreground">Pronostics</h1>
        <p className="text-sm text-muted-foreground">
          Saisissez vos pronostics avant la clôture de chaque étape. Les
          pronostics sont privés jusqu&apos;au coup d&apos;envoi.
        </p>
      </header>

      {/* Score total cumulé (Exigence 10.4). */}
      <div className="rounded-md border border-border bg-card px-4 py-3 text-sm">
        <span className="text-muted-foreground">Mon score total : </span>
        <span className="font-semibold tabular-nums text-foreground">
          {totalScore} {totalScore > 1 ? 'points' : 'point'}
        </span>
      </div>

      {presentStages.length === 0 && recompenses === null ? (
        <p className="rounded-md border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
          Aucun match n&apos;est disponible pour le moment.
        </p>
      ) : (
        <>
          {/* Barre de navigation unifiée : Récompenses + étapes */}
          <nav aria-label="Navigation par étape" className="w-full">
            <ul className="flex gap-1 overflow-x-auto pb-2" role="tablist">
              {hasRewardsTab && (
                <li className="shrink-0">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={isRewardsTab}
                    onClick={() => setActiveTab(REWARDS_TAB)}
                    className={`relative inline-flex min-h-[44px] items-center gap-1.5 whitespace-nowrap rounded-md px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                      isRewardsTab
                        ? 'bg-primary text-primary-foreground'
                        : 'text-foreground hover:bg-accent hover:text-accent-foreground'
                    }`}
                  >
                    Général
                    {missingRewards > 0 && (
                      <span
                        aria-label={`${missingRewards} pronostic${missingRewards > 1 ? 's' : ''} manquant${missingRewards > 1 ? 's' : ''}`}
                        className={`inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full px-1 text-[10px] font-bold leading-none ${
                          isRewardsTab
                            ? 'bg-primary-foreground text-primary'
                            : 'bg-orange-500 text-white'
                        }`}
                      >
                        {missingRewards}
                      </span>
                    )}
                  </button>
                </li>
              )}
              {presentStages.map((stage) => {
                const active = !isRewardsTab && stage === stageTab;
                const missing = missingByStage.get(stage) ?? 0;
                return (
                  <li key={stage} className="shrink-0">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setActiveTab(stage)}
                      className={`relative inline-flex min-h-[44px] items-center gap-1.5 whitespace-nowrap rounded-md px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                        active
                          ? 'bg-primary text-primary-foreground'
                          : 'text-foreground hover:bg-accent hover:text-accent-foreground'
                      }`}
                    >
                      {STAGE_LABELS[stage]}
                      {missing > 0 && (
                        <span
                          aria-label={`${missing} pronostic${missing > 1 ? 's' : ''} manquant${missing > 1 ? 's' : ''}`}
                          className={`inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full px-1 text-[10px] font-bold leading-none ${
                            active
                              ? 'bg-primary-foreground text-primary'
                              : 'bg-orange-500 text-white'
                          }`}
                        >
                          {missing}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* ── Onglet Récompenses ── */}
          {isRewardsTab && (
            <section aria-label="Général" className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-semibold text-foreground">
                  Général
                </h2>

                {/* Compte à rebours récompenses */}
                {rewardsLockTime !== null &&
                  (rewardsOpen ? (
                    <span
                      role="status"
                      className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-900"
                    >
                      <span aria-hidden="true">🔓</span>
                      Ouvert · clôture dans {formatCountdown(rewardsRemainingMs)}
                    </span>
                  ) : (
                    <span
                      role="status"
                      className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900"
                    >
                      <span aria-hidden="true">🔒</span>
                      Clôturé
                    </span>
                  ))}
              </div>

              <p className="text-sm text-muted-foreground">
                Pronostiquez les vainqueurs des 5 récompenses pour gagner des
                points bonus (5 points par bon pronostic). Pour les récompenses
                individuelles, sélectionnez un joueur ; pour le Prix du
                Fair-Play, sélectionnez une équipe. Les pronostics sont
                clôturés au coup d&apos;envoi de la Journée 1.
              </p>

              {recompenses === null ? (
                <p role="status" className="text-sm text-muted-foreground">
                  Chargement des récompenses…
                </p>
              ) : (
                <>
                  {rewardsEffectiveLocked && (
                    <div
                      role="status"
                      className="flex items-center gap-2 rounded-md border border-amber-500/40 bg-amber-50 px-4 py-3 text-sm text-amber-800"
                    >
                      <span aria-hidden="true">🔒</span>
                      <span>
                        Les pronostics de récompenses sont clôturés. Vous ne
                        pouvez plus les modifier.
                      </span>
                    </div>
                  )}

                  <ul className="space-y-4">
                    {recompenses.rewardTypes.map((rewardType) => {
                      const label = `${REWARD_EMOJIS[rewardType] ?? ''} ${REWARD_LABELS[rewardType] ?? rewardType}`.trim();
                      const selection = rewardSelections[rewardType] ?? null;
                      const saveState = rewardSaveStates[rewardType];
                      const result = recompenses.results.find(
                        (r) => r.rewardType === rewardType
                      );
                      const prediction = recompenses.predictions.find(
                        (p) => p.rewardType === rewardType
                      );
                      const inputId = `reward-${rewardType}`;
                      const describedById = saveState?.message
                        ? `reward-${rewardType}-status`
                        : undefined;

                      return (
                        <li
                          key={rewardType}
                          className={cn(
                            'rounded-lg border p-4 shadow-sm',
                            selection
                              ? 'border-green-200 bg-green-50'
                              : rewardsEffectiveLocked
                                ? 'border-border bg-card'
                                : 'border-amber-200 bg-amber-50'
                          )}
                        >
                          <label
                            htmlFor={inputId}
                            className="block text-sm font-medium text-foreground"
                          >
                            {label}
                          </label>

                          <div className="mt-2">
                            {rewardType === 'FAIR_PLAY' ? (
                              <TeamSelector
                                inputId={inputId}
                                value={selection?.id ?? null}
                                valueLabel={selection?.label ?? null}
                                onSelect={(team) =>
                                  void handleFairPlayTeamSelect(team)
                                }
                                disabled={rewardsEffectiveLocked}
                                describedById={describedById}
                              />
                            ) : (
                              <PlayerSelector
                                inputId={inputId}
                                value={selection?.id ?? null}
                                valueLabel={selection?.label ?? null}
                                onSelect={(player) =>
                                  void handleRewardSelect(rewardType, player)
                                }
                                disabled={rewardsEffectiveLocked}
                                describedById={describedById}
                              />
                            )}
                          </div>

                          {saveState?.message && (
                            <p
                              id={`reward-${rewardType}-status`}
                              role={
                                saveState.status === 'error' ? 'alert' : 'status'
                              }
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

                          {/* Résultat officiel + points bonus (Exigences 18.13/18.14). */}
                          {result && (
                            <div className="mt-3 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
                              <p className="text-foreground">
                                Vainqueur officiel :{' '}
                                <span className="font-medium">
                                  {winnerLabels[rewardType] ?? result.playerId}
                                </span>
                              </p>
                              <p className="text-muted-foreground">
                                {prediction
                                  ? `Points bonus obtenus : ${prediction.points ?? 0} / 5`
                                  : "Vous n'aviez pas enregistré de pronostic pour cette récompense."}
                              </p>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
            </section>
          )}

          {/* ── Onglets matchs ── */}
          {!isRewardsTab && stageTab && (
            <section
              aria-label={`Pronostics — ${STAGE_LABELS[stageTab]}`}
              className="space-y-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-semibold text-foreground">
                  {STAGE_LABELS[stageTab]}
                </h2>

                {/* Indicateur de verrouillage + compte à rebours (Exigence 5.7/5.8). */}
                {stageLockTime !== null &&
                  (stageOpen ? (
                    <span
                      role="status"
                      className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-900"
                    >
                      <span aria-hidden="true">🔓</span>
                      Ouvert · clôture dans {formatCountdown(stageRemainingMs)}
                    </span>
                  ) : (
                    <span
                      role="status"
                      className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900"
                    >
                      <span aria-hidden="true">🔒</span>
                      Clôturé
                    </span>
                  ))}
              </div>

              {/* Règle de clôture (Exigence 17.4). */}
              {stageLockTime !== null && <LockRuleHint />}

              {!stageOpen && stageLockTime !== null && (
                <p className="text-sm text-muted-foreground">
                  {ERROR_MESSAGES.STAGE_LOCKED}
                </p>
              )}

              {visibleMatches.length === 0 ? (
                <p className="rounded-md border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
                  Aucun match à afficher pour cette étape.
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                  {visibleMatches.map((match) => {
                    const p = pronostics.get(match.id);
                    const existing: ExistingPronostic | null = p
                      ? {
                          homeGoals: p.homeGoals,
                          awayGoals: p.awayGoals,
                          points: p.points,
                        }
                      : null;

                    const teamsKnown =
                      match.homeTeam.code !== null &&
                      match.awayTeam.code !== null;

                    return (
                      <MatchCard
                        key={match.id}
                        match={match}
                        pronosticStatus={
                          teamsKnown
                            ? existing
                              ? 'saved'
                              : stageOpen
                                ? 'none'
                                : undefined
                            : undefined
                        }
                        footer={
                          teamsKnown ? (
                            <PronosticForm
                              match={match}
                              existing={existing}
                              locked={!stageOpen}
                              onSaved={handleSaved}
                            />
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
        </>
      )}
    </div>
  );
}
