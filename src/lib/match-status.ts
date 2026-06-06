// Détermination pure du statut d'un match.
//
// Référence : requirements.md - Exigence 3, critère 3.9 ;
// design.md - Property 20 (Match status determination).
//
// Règles (3.9 / Property 20) :
//   - « à venir »  : tant que le coup d'envoi n'est pas atteint (now < kickoffTime)
//   - « en cours » : coup d'envoi atteint (now >= kickoffTime) ET aucun
//                    Resultat_Officiel saisi
//   - « terminé »  : un Resultat_Officiel a été saisi (prioritaire)
//
// La fonction est volontairement pure (aucun accès base de données ni horloge
// implicite) afin d'être testable par property test (tâche 8.3).

import type { MatchStatus } from '@/types';

/**
 * Calcule le statut d'un match.
 *
 * @param kickoffTime heure de coup d'envoi (UTC)
 * @param hasResult   vrai si un Resultat_Officiel existe pour ce match
 * @param now         instant de référence
 * @returns le statut « à venir », « en cours » ou « terminé »
 */
export function getMatchStatus(
  kickoffTime: Date,
  hasResult: boolean,
  now: Date
): MatchStatus {
  // Un résultat officiel rend le match « terminé » quel que soit l'instant.
  if (hasResult) {
    return 'terminé';
  }
  // Sans résultat : « à venir » avant le coup d'envoi, « en cours » dès qu'il
  // est atteint.
  if (now.getTime() < kickoffTime.getTime()) {
    return 'à venir';
  }
  return 'en cours';
}
