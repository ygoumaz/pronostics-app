'use client';

// Vue calendrier interactive (composant client).
//
// Référence : requirements.md - Exigence 3.6/3.7 (matchs triés, équipes, heure
// locale), 12.3 (une seule étape affichée), 12.4/12.5 (navigation permanente,
// changement sans rechargement, < 1 s), 12.6 (étape par défaut = celle du
// prochain match à venir, sinon finale), 12.7 (entrée active), 12.8 (étapes à
// pronostics manquants), 13.3 (responsive). design.md - calendrier/page.tsx.
//
// Stratégie de chargement : tous les matchs sont récupérés une seule fois via
// GET /api/matches puis groupés par étape côté client. Le changement d'étape se
// fait alors purement en mémoire (aucun rechargement réseau, Exigence 12.5).
// Les pronostics du participant (GET /api/pronostics) servent à marquer les
// étapes contenant des matchs à venir sans pronostic (Exigence 12.8) ; cet
// enrichissement est best-effort : un échec n'empêche pas l'affichage.

import { useEffect, useMemo, useState } from 'react';

import type { SerializedMatch } from '@/app/api/matches/serialize';
import type { Stage } from '@/types';
import { MatchCard } from '@/components/match-card';
import {
  NavigationStages,
  STAGE_LABELS,
  STAGE_ORDER,
} from '@/components/navigation-stages';

/** Forme minimale d'un pronostic renvoyé par GET /api/pronostics. */
interface PronosticSummary {
  matchId: string;
}

interface CalendrierViewProps {
  matches: SerializedMatch[];
}

/** Index de tri d'une étape dans l'ordre chronologique. */
function stageIndex(stage: string): number {
  const idx = STAGE_ORDER.indexOf(stage as Stage);
  return idx === -1 ? Number.MAX_SAFE_INTEGER : idx;
}

/**
 * Détermine l'étape à afficher par défaut (Exigence 12.6) : celle qui contient
 * le prochain match dont le statut est « à venir » (les matchs arrivent déjà
 * triés par Coup_d_envoi croissant depuis l'API). En l'absence de match à
 * venir, on retombe sur la dernière étape chronologique présente (la finale).
 */
function pickDefaultStage(matches: SerializedMatch[], presentStages: Stage[]): Stage {
  const upcoming = matches.find((m) => m.status === 'à venir');
  if (upcoming) {
    return upcoming.stage as Stage;
  }
  return presentStages[presentStages.length - 1] ?? 'FINAL';
}

export function CalendrierView({ matches }: CalendrierViewProps) {
  // Groupement par étape (mémoïsé : dépend uniquement des matchs reçus).
  const matchesByStage = useMemo(() => {
    const map = new Map<Stage, SerializedMatch[]>();
    for (const match of matches) {
      const stage = match.stage as Stage;
      const list = map.get(stage);
      if (list) {
        list.push(match);
      } else {
        map.set(stage, [match]);
      }
    }
    return map;
  }, [matches]);

  // Étapes présentes dans les données, ordonnées chronologiquement.
  const presentStages = useMemo(
    () =>
      STAGE_ORDER.filter((stage) => matchesByStage.has(stage)),
    [matchesByStage]
  );

  const [activeStage, setActiveStage] = useState<Stage>(() =>
    pickDefaultStage(matches, presentStages)
  );

  // Étapes contenant au moins un match à venir sans pronostic (Exigence 12.8).
  const [stagesWithMissing, setStagesWithMissing] = useState<ReadonlySet<Stage>>(
    () => new Set()
  );

  useEffect(() => {
    let cancelled = false;

    async function loadMissing() {
      try {
        const res = await fetch('/api/pronostics');
        if (!res.ok) return;
        const data: { pronostics?: PronosticSummary[] } = await res.json();
        const predicted = new Set(
          (data.pronostics ?? []).map((p) => p.matchId)
        );

        const missing = new Set<Stage>();
        for (const match of matches) {
          // Un match « à venir » sans pronostic enregistré marque son étape.
          if (match.status === 'à venir' && !predicted.has(match.id)) {
            missing.add(match.stage as Stage);
          }
        }
        if (!cancelled) {
          setStagesWithMissing(missing);
        }
      } catch {
        // Best-effort : en cas d'échec, aucune étape n'est marquée.
      }
    }

    void loadMissing();
    return () => {
      cancelled = true;
    };
  }, [matches]);

  const visibleMatches = matchesByStage.get(activeStage) ?? [];

  return (
    <div className="space-y-4">
      <NavigationStages
        stages={presentStages}
        activeStage={activeStage}
        onSelect={setActiveStage}
        stagesWithMissing={stagesWithMissing}
      />

      <section aria-label={`Matchs — ${STAGE_LABELS[activeStage]}`}>
        <h2 className="mb-3 text-lg font-semibold text-foreground">
          {STAGE_LABELS[activeStage]}
        </h2>

        {visibleMatches.length === 0 ? (
          <p className="rounded-md border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
            Aucun match à afficher pour cette étape.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {visibleMatches.map((match) => (
              <MatchCard key={match.id} match={match} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
