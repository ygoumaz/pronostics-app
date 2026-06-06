// Module d'agrégation statistique des pronostics par match.
//
// Référence : requirements.md - Exigence 16 (critères 16.1, 16.2, 16.3) ;
// design.md - Property 18 (Statistics aggregation correctness).
//
// La logique d'agrégation est volontairement PURE (aucun accès base de données)
// afin d'être testable par property test (tâche 8.12 / Property 18). Le route
// handler /api/stats/[matchId] charge les pronostics depuis Prisma puis délègue
// le calcul à `aggregatePronosticStats`.

/** Buts pronostiqués pour un match (entrée minimale de l'agrégation). */
export interface PronosticGoals {
  homeGoals: number;
  awayGoals: number;
}

/** Fréquence d'un score pronostiqué distinct. */
export interface ScoreStat {
  /** Score au format « X-Y » (X buts domicile, Y buts extérieur). */
  score: string;
  /** Nombre de participants ayant pronostiqué ce score. */
  count: number;
}

/** Résumé statistique complet d'un match. */
export interface PronosticStatsSummary {
  /** Nombre total de pronostics enregistrés pour le match. */
  total: number;
  /** Liste des scores distincts triés (cf. `aggregatePronosticStats`). */
  scores: ScoreStat[];
}

/**
 * Construit la chaîne de score canonique « X-Y » à partir des buts pronostiqués.
 * Ce format unique garantit que le tri lexicographique (départage des égalités,
 * Exigence 16.2) est bien défini et cohérent avec ce qu'attend le test de la
 * Property 18.
 */
export function formatScore(homeGoals: number, awayGoals: number): string {
  return `${homeGoals}-${awayGoals}`;
}

/**
 * Agrège une liste de pronostics en un résumé statistique (Exigence 16.1/16.2/16.3,
 * Property 18) :
 * - compte chaque score distinct (« homeGoals-awayGoals ») ;
 * - la somme des `count` est toujours égale au nombre total de pronostics ;
 * - tri par `count` décroissant, puis, en cas d'égalité, par `score` en ordre
 *   lexicographique croissant (caractère par caractère).
 *
 * Fonction pure : aucune mutation des entrées, aucun effet de bord.
 */
export function aggregatePronosticStats(
  pronostics: PronosticGoals[]
): PronosticStatsSummary {
  const counts = new Map<string, number>();

  for (const { homeGoals, awayGoals } of pronostics) {
    const score = formatScore(homeGoals, awayGoals);
    counts.set(score, (counts.get(score) ?? 0) + 1);
  }

  const scores: ScoreStat[] = Array.from(counts, ([score, count]) => ({
    score,
    count,
  }));

  scores.sort((a, b) => {
    // Tri principal : fréquence décroissante.
    if (b.count !== a.count) {
      return b.count - a.count;
    }
    // Départage : score en ordre lexicographique croissant.
    return a.score < b.score ? -1 : a.score > b.score ? 1 : 0;
  });

  return { total: pronostics.length, scores };
}
