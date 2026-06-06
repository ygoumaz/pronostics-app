// Comparateur pur pour le tri des matchs.
//
// Référence : requirements.md - Exigence 3, critère 3.7 ;
// design.md - Property 5 (Match sorting invariant).
//
// Règle de tri (3.7 / Property 5) :
//   1. par heure de coup d'envoi (kickoffTime) croissante ;
//   2. à coup d'envoi égal, par ordre alphabétique croissant du nom de
//      l'équipe à domicile (ou de l'emplacement à déterminer).
//
// Le « nom de l'équipe à domicile ou emplacement » utilisé pour le départage
// est défini par `homeSortKey` : on prend `homeTeamCode` s'il est présent,
// sinon `homePlaceholder`, sinon une chaîne vide. Cette règle est volontairement
// explicite et partagée pour rester cohérente avec le property test (tâche 8.2).
//
// La fonction est pure (aucun effet de bord) afin d'être testable.

/** Sous-ensemble d'un match nécessaire au tri. */
export interface SortableMatch {
  kickoffTime: Date;
  homeTeamCode?: string | null;
  homePlaceholder?: string | null;
}

/**
 * Clé de tri secondaire : nom/code de l'équipe à domicile, ou emplacement à
 * déterminer. Renvoie `homeTeamCode` si présent, sinon `homePlaceholder`,
 * sinon une chaîne vide.
 */
export function homeSortKey(match: SortableMatch): string {
  return match.homeTeamCode ?? match.homePlaceholder ?? '';
}

/**
 * Comparateur de matchs : tri par coup d'envoi croissant, puis par clé
 * alphabétique de l'équipe à domicile (ou emplacement). Convient à
 * `Array.prototype.sort`.
 *
 * @returns valeur négative si `a` précède `b`, positive si `a` suit `b`, 0 sinon
 */
export function compareMatches(a: SortableMatch, b: SortableMatch): number {
  const timeDiff = a.kickoffTime.getTime() - b.kickoffTime.getTime();
  if (timeDiff !== 0) {
    return timeDiff < 0 ? -1 : 1;
  }

  const keyA = homeSortKey(a);
  const keyB = homeSortKey(b);
  if (keyA < keyB) {
    return -1;
  }
  if (keyA > keyB) {
    return 1;
  }
  return 0;
}
