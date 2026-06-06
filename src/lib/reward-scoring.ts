// Barème des points bonus pour les pronostics de récompenses individuelles.
//
// Référence : requirements.md - Exigence 18 (critères 18.9, 18.10) ;
// design.md - Property 17 (barème des récompenses).
//
// Un pronostic de récompense vaut exactement 5 points bonus si et seulement si
// le joueur pronostiqué correspond strictement (par identifiant) au vainqueur
// officiel désigné par l'Administrateur, sinon 0 point (Exigences 18.9 / 18.10).
//
// Cette fonction est PURE (sans accès base de données ni effet de bord) afin de
// pouvoir être exercée par des tests de propriété (tâche 9.2 / Property 17).

/** Points attribués à un pronostic de récompense correct. */
export const REWARD_CORRECT_POINTS = 5;

/** Points attribués à un pronostic de récompense incorrect. */
export const REWARD_INCORRECT_POINTS = 0;

/**
 * Calcule les points bonus d'un pronostic de récompense par comparaison stricte
 * des identifiants de joueur.
 *
 * @param predictionPlayerId Identifiant du joueur pronostiqué par le participant.
 * @param winnerPlayerId     Identifiant du vainqueur officiel de la récompense.
 * @returns 5 si les identifiants correspondent exactement, 0 sinon.
 */
export function scoreRewardPrediction(
  predictionPlayerId: string,
  winnerPlayerId: string
): number {
  return predictionPlayerId === winnerPlayerId
    ? REWARD_CORRECT_POINTS
    : REWARD_INCORRECT_POINTS;
}
