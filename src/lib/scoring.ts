import type { ScoringResult } from "@/types";

/**
 * Issue d'un match du point de vue de l'équipe à domicile.
 */
type Outcome = "HOME_WIN" | "DRAW" | "AWAY_WIN";

interface Score {
  homeGoals: number;
  awayGoals: number;
}

/**
 * Détermine l'issue d'un score (Exigence 8.8).
 * - HOME_WIN si les buts à domicile > buts à l'extérieur
 * - DRAW si les deux nombres de buts sont égaux
 * - AWAY_WIN si les buts à l'extérieur > buts à domicile
 */
function getOutcome({ homeGoals, awayGoals }: Score): Outcome {
  if (homeGoals > awayGoals) return "HOME_WIN";
  if (homeGoals < awayGoals) return "AWAY_WIN";
  return "DRAW";
}

/**
 * Calcule les points d'un pronostic selon le Barème (Exigence 8).
 *
 * Barème :
 * - 1 point si la bonne issue est trouvée (bon vainqueur, ou nul trouvé si le
 *   résultat officiel est nul) — Exigence 8.2
 * - 1 point si la bonne différence de buts est trouvée — Exigence 8.3
 * - 1 point si le score exact est trouvé — Exigence 8.4
 *
 * Le total est compris entre 0 et 3 inclus (Exigence 8.5).
 *
 * Cas des matchs éliminatoires terminés aux tirs au but : le résultat officiel
 * enregistré est le nul après prolongations (Exigence 8.9). Un pronostic
 * prédisant un score nul a donc la bonne issue (Exigence 8.10). Ce cas est géré
 * naturellement par la comparaison d'issues (DRAW == DRAW) sans traitement
 * spécifique, le vainqueur aux tirs au but n'entrant pas dans le calcul.
 */
export function calculatePoints(
  pronostic: Score,
  result: Score
): ScoringResult {
  const correctOutcome = getOutcome(pronostic) === getOutcome(result);

  const correctDifference =
    pronostic.homeGoals - pronostic.awayGoals ===
    result.homeGoals - result.awayGoals;

  const exactScore =
    pronostic.homeGoals === result.homeGoals &&
    pronostic.awayGoals === result.awayGoals;

  const totalPoints =
    (correctOutcome ? 1 : 0) +
    (correctDifference ? 1 : 0) +
    (exactScore ? 1 : 0);

  return { correctOutcome, correctDifference, exactScore, totalPoints };
}
