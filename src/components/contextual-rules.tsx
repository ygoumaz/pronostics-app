'use client';

// Composants présentationnels réutilisables pour l'affichage contextuel des
// règles (Exigence 17). Ils standardisent la manière dont les règles et
// explications sont rendues « là où l'action a lieu », sans page de règles
// dédiée (Exigence 17.1) et en privilégiant l'affichage en ligne (Exigence 17.2/17.7).
//
// Référence : requirements.md - Exigence 17 (critères 17.1 à 17.7),
// Exigence 5.2 (clôture 1 h avant le premier match), Exigence 8 (barème).
// design.md - composants d'affichage contextuel.
//
// Contenu :
//   - BaremeHint : barème compact (≤ 3 lignes) près des champs de score
//     (Exigence 17.2/17.3), réutilise BAREME_LINES.
//   - LockRuleHint : règle de clôture près des indicateurs de verrouillage
//     (Exigence 17.4), texte statique.
//   - PointsBreakdown : décomposition critère par critère des points obtenus
//     près d'un résultat (Exigence 17.5).

import { cn } from '@/lib/utils';
import { calculatePoints } from '@/lib/scoring';
import { BAREME_LINES } from '@/components/score-indicator';

/** Règle de clôture des étapes, formulée de façon contextuelle (Exigence 5.2/17.4). */
export const LOCK_RULE_TEXT =
  "Les pronostics d'une étape sont clôturés 1 heure avant le coup d'envoi du premier match de l'étape." as const;

interface BaremeHintProps {
  className?: string;
}

/**
 * Barème applicable affiché à proximité immédiate des champs de score, sous
 * forme d'un texte statique de 3 lignes maximum (Exigence 17.2/17.3).
 */
export function BaremeHint({ className }: BaremeHintProps) {
  return (
    <p className={cn('text-xs leading-relaxed text-muted-foreground', className)}>
      {BAREME_LINES.map((line) => (
        <span key={line} className="block">
          {line}
        </span>
      ))}
    </p>
  );
}

interface LockRuleHintProps {
  className?: string;
}

/**
 * Règle de clôture affichée à proximité d'un indicateur de verrouillage
 * d'étape (Exigence 17.4). Texte statique, sans navigation requise.
 */
export function LockRuleHint({ className }: LockRuleHintProps) {
  return (
    <p className={cn('text-xs leading-relaxed text-muted-foreground', className)}>
      {LOCK_RULE_TEXT}
    </p>
  );
}

interface PointsBreakdownProps {
  /** Pronostic enregistré du participant. */
  pronostic: { homeGoals: number; awayGoals: number };
  /** Résultat officiel du match. */
  result: { homeGoals: number; awayGoals: number };
  className?: string;
}

/** Un critère du barème et son état (satisfait ou non). */
interface CriterionRow {
  label: string;
  satisfied: boolean;
}

/**
 * Décomposition des points près d'un résultat (Exigence 17.5) : pour chacun des
 * trois critères du barème (issue, différence de buts, score exact), indique
 * s'il est satisfait, ainsi que le total de points résultant. Permet au
 * participant d'identifier quel critère a contribué à son score.
 */
export function PointsBreakdown({
  pronostic,
  result,
  className,
}: PointsBreakdownProps) {
  const scoring = calculatePoints(pronostic, result);

  const criteria: CriterionRow[] = [
    { label: 'Bonne issue (1 pt)', satisfied: scoring.correctOutcome },
    { label: 'Bonne différence de buts (1 pt)', satisfied: scoring.correctDifference },
    { label: 'Score exact (1 pt)', satisfied: scoring.exactScore },
  ];

  const totalLabel = scoring.totalPoints > 1 ? 'points' : 'point';

  return (
    <div
      className={cn('rounded-md border border-border bg-muted/30 p-3', className)}
      aria-label="Décomposition des points"
    >
      <p className="mb-2 text-xs font-medium text-foreground">
        Comment ces points sont calculés
      </p>
      <ul className="space-y-1 text-xs">
        {criteria.map((c) => (
          <li key={c.label} className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className={cn(
                'font-semibold',
                c.satisfied ? 'text-emerald-700' : 'text-muted-foreground'
              )}
            >
              {c.satisfied ? '✓' : '✗'}
            </span>
            <span
              className={cn(
                c.satisfied ? 'text-foreground' : 'text-muted-foreground'
              )}
            >
              {c.label} — {c.satisfied ? 'satisfait' : 'non satisfait'}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs font-semibold tabular-nums text-foreground">
        Total : {scoring.totalPoints}&nbsp;{totalLabel}
      </p>
    </div>
  );
}
