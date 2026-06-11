// Logique pure de confidentialité des pronostics (Exigence 6 / Property 8).
//
// Cette fonction est volontairement pure et isolée des accès base de données
// afin d'être exercée directement par le property test 8.6 (Property 8 :
// confidentialité des pronostics).
//
// Référence : requirements.md - Exigence 6 (critères 6.1, 6.2) ;
// design.md - Property 8 : Pronostic confidentiality.

/**
 * Indique si les pronostics d'un AUTRE participant pour une étape donnée peuvent
 * être révélés à l'instant `now`.
 *
 * Règle (Exigence 6.1, 6.2 / Property 8) : les pronostics d'autrui pour une
 * étape ne sont visibles que lorsque les pronostics de cette étape sont clôturés,
 * c'est-à-dire `now >= stageFirstKickoff - 1h`. Cela suit la même logique que
 * le verrouillage des saisies (lock.ts : computeLockTime).
 *
 * Note : cette règle ne s'applique PAS à la consultation de ses propres
 * pronostics, toujours visibles (Exigence 6.3).
 *
 * @param stageFirstKickoff coup d'envoi du premier match de l'étape (UTC)
 * @param now instant de référence
 * @returns true si et seulement si now >= stageFirstKickoff - 1h
 */
export function canViewOthersPronostic(stageFirstKickoff: Date, now: Date): boolean {
  const lockTime = stageFirstKickoff.getTime() - 60 * 60 * 1000; // -1h
  return now.getTime() >= lockTime;
}
