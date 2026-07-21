'use client';

// Indicateur visuel du niveau de réussite d'un pronostic (composant réutilisable).
//
// Référence : requirements.md - Exigence 10.3 (indicateur visuel distinct pour
// chacun des 4 niveaux : score exact = 3 pts, bonne différence = 2 pts, bonne
// issue seule = 1 pt, mauvaise prédiction = 0 pt), 17.4 (décomposition des
// points près des résultats), 13.4/13.7 (contrastes AA, accessibilité).
// design.md - components/score-indicator.tsx.
//
// Accessibilité : la différenciation n'est PAS uniquement chromatique. Chaque
// niveau combine une couleur, une icône (caractère lisible) ET un libellé
// textuel explicite, de sorte qu'un utilisateur ne percevant pas les couleurs
// puisse identifier le niveau (WCAG 1.4.1 — Use of Color).

import { cn } from '@/lib/utils';
import { REWARD_CORRECT_POINTS } from '@/lib/reward-scoring';

/** Description visuelle d'un niveau de réussite. */
interface LevelInfo {
  /** Libellé textuel explicite (Exigence 10.3). */
  label: string;
  /** Icône non décorative doublant l'information de couleur. */
  icon: string;
  /** Classes Tailwind (fond + texte + bordure) respectant les contrastes AA. */
  className: string;
}

/**
 * Associe un nombre de points (0 à 3) à son niveau de réussite. Le nombre de
 * points détermine sans ambiguïté le niveau : 3 = score exact, 2 = bonne
 * différence (+ bonne issue), 1 = bonne issue seule, 0 = mauvaise prédiction.
 */
function getLevelInfo(points: number): LevelInfo {
  switch (points) {
    case 3:
      return {
        label: 'Score exact',
        icon: '🎯',
        className: 'border-emerald-300 bg-emerald-100 text-emerald-900',
      };
    case 2:
      return {
        label: 'Bonne différence',
        icon: '➕',
        className: 'border-sky-300 bg-sky-100 text-sky-900',
      };
    case 1:
      return {
        label: 'Bonne issue',
        icon: '✓',
        className: 'border-amber-300 bg-amber-100 text-amber-900',
      };
    default:
      return {
        label: 'Manqué',
        icon: '✗',
        className: 'border-slate-300 bg-slate-100 text-slate-700',
      };
  }
}

interface ScoreIndicatorProps {
  /** Points obtenus pour le pronostic (0 à 3). */
  points: number;
  className?: string;
}

/**
 * Affiche un badge distinctif (couleur + icône + libellé + points) pour le
 * niveau de réussite d'un pronostic évalué (Exigence 10.3).
 */
export function ScoreIndicator({ points, className }: ScoreIndicatorProps) {
  // Borne défensive : on ne traite que la plage [0, 3] définie par le barème.
  const safePoints = Math.max(0, Math.min(3, Math.trunc(points)));
  const level = getLevelInfo(safePoints);
  const pointsLabel = safePoints > 1 ? 'points' : 'point';

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold',
        level.className,
        className
      )}
    >
      <span aria-hidden="true">{level.icon}</span>
      <span>{level.label}</span>
      <span className="tabular-nums">
        ({safePoints}&nbsp;{pointsLabel})
      </span>
    </span>
  );
}

/** Barème de référence affiché de façon contextuelle (Exigence 17.2/17.3). */
export const BAREME_LINES = [
  '3 pts : score exact',
  '2 pts : bonne différence de buts',
  '1 pt : bonne issue · 0 sinon',
] as const;

interface RewardScoreIndicatorProps {
  /** Points obtenus pour le pronostic de récompense (0 ou 5). */
  points: number;
  className?: string;
}

/**
 * Affiche un badge distinctif (couleur + icône + libellé + points) pour le
 * résultat d'un pronostic de récompense individuelle évalué (Exigences 18.9,
 * 18.10 : 5 points bonus si correct, 0 sinon). Ce barème est distinct de celui
 * des pronostics de match (0 à 3 points, voir `ScoreIndicator` ci-dessus) et
 * NE DOIT PAS être bornée à [0, 3] sous peine d'afficher un score erroné.
 */
export function RewardScoreIndicator({
  points,
  className,
}: RewardScoreIndicatorProps) {
  // Borne défensive : le barème récompense ne connaît que 0 ou 5 points.
  const safePoints = points >= REWARD_CORRECT_POINTS ? REWARD_CORRECT_POINTS : 0;
  const isCorrect = safePoints === REWARD_CORRECT_POINTS;
  const level: LevelInfo = isCorrect
    ? {
        label: 'Bon pronostic',
        icon: '🎯',
        className: 'border-emerald-300 bg-emerald-100 text-emerald-900',
      }
    : {
        label: 'Manqué',
        icon: '✗',
        className: 'border-slate-300 bg-slate-100 text-slate-700',
      };
  const pointsLabel = safePoints > 1 ? 'points' : 'point';

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold',
        level.className,
        className
      )}
    >
      <span aria-hidden="true">{level.icon}</span>
      <span>{level.label}</span>
      <span className="tabular-nums">
        ({safePoints}&nbsp;{pointsLabel})
      </span>
    </span>
  );
}
