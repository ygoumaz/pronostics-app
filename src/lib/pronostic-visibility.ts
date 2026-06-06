// Logique pure de confidentialité des pronostics (Exigence 6 / Property 8).
//
// Cette fonction est volontairement pure et isolée des accès base de données
// afin d'être exercée directement par le property test 8.6 (Property 8 :
// confidentialité des pronostics).
//
// Référence : requirements.md - Exigence 6 (critères 6.1, 6.2) ;
// design.md - Property 8 : Pronostic confidentiality.

/**
 * Indique si le pronostic d'un AUTRE participant pour un match donné peut être
 * révélé à l'instant `now`.
 *
 * Règle (Exigence 6.1, 6.2 / Property 8) : le pronostic d'autrui n'est visible
 * que si et seulement si le coup d'envoi du match est atteint, c'est-à-dire
 * `now >= kickoffTime`. Avant le coup d'envoi, ni les buts ni l'existence même
 * d'un pronostic ne doivent être révélés.
 *
 * Note : cette règle ne s'applique PAS à la consultation de ses propres
 * pronostics, toujours visibles (Exigence 6.3).
 *
 * @param kickoffTime coup d'envoi du match (UTC)
 * @param now instant de référence
 * @returns true si et seulement si now >= kickoffTime
 */
export function canViewOthersPronostic(kickoffTime: Date, now: Date): boolean {
  return now.getTime() >= kickoffTime.getTime();
}
