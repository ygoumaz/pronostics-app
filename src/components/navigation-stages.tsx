'use client';

// Élément de navigation par étape (journées de groupes + tours éliminatoires).
//
// Référence : requirements.md - Exigences 12.3 (une seule étape à la fois),
// 12.4 (élément de navigation permanent listant dans l'ordre chronologique les
// 3 journées puis les 5 tours, sans rechargement complet), 12.7 (distinction
// visuelle de l'entrée active), 12.8 (distinction des étapes contenant au moins
// un match à venir sans pronostic enregistré), 13.2/13.3 (responsive, zones
// tactiles ≥ 44 px). design.md - components/navigation-stages.tsx.

import type { Stage } from '@/types';
import { cn } from '@/lib/utils';

/** Étapes dans l'ordre chronologique (Exigence 12.4). */
export const STAGE_ORDER: Stage[] = [
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

/** Libellés français courts pour chaque étape. */
export const STAGE_LABELS: Record<Stage, string> = {
  GROUP_DAY_1: 'Journée 1',
  GROUP_DAY_2: 'Journée 2',
  GROUP_DAY_3: 'Journée 3',
  ROUND_OF_32: '16èmes',
  ROUND_OF_16: '8èmes',
  QUARTER_FINAL: 'Quarts',
  SEMI_FINAL: 'Demi-finales',
  THIRD_PLACE: '3e place',
  FINAL: 'Finale',
};

// NOTE — nommage des tours : `ROUND_OF_32` = 32 équipes → 16 matchs → « 16èmes de finale »,
// `ROUND_OF_16` = 16 équipes → 8 matchs → « 8èmes de finale »,
// `QUARTER_FINAL` = 8 équipes → 4 matchs → « Quarts de finale ».

interface NavigationStagesProps {
  /** Étapes réellement présentes dans les données, déjà filtrées par l'appelant. */
  stages: Stage[];
  activeStage: Stage;
  onSelect: (stage: Stage) => void;
  /** Étapes ayant au moins un match à venir sans pronostic (Exigence 12.8). */
  stagesWithMissing?: ReadonlySet<Stage>;
}

export function NavigationStages({
  stages,
  activeStage,
  onSelect,
  stagesWithMissing,
}: NavigationStagesProps) {
  return (
    <nav aria-label="Navigation par étape" className="w-full">
      <ul className="flex gap-1 overflow-x-auto pb-2" role="tablist">
        {stages.map((stage) => {
          const active = stage === activeStage;
          const hasMissing = stagesWithMissing?.has(stage) ?? false;
          return (
            <li key={stage} className="shrink-0">
              <button
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onSelect(stage)}
                className={cn(
                  'relative inline-flex min-h-[44px] items-center whitespace-nowrap rounded-md px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                  active
                    ? 'bg-primary text-primary-foreground'
                    : 'text-foreground hover:bg-accent hover:text-accent-foreground'
                )}
              >
                {STAGE_LABELS[stage]}
                {hasMissing ? (
                  <span
                    className={cn(
                      'ml-1.5 inline-block h-2 w-2 rounded-full',
                      active ? 'bg-primary-foreground' : 'bg-destructive'
                    )}
                    aria-label="Pronostics manquants"
                    title="Pronostics manquants pour cette étape"
                  />
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
