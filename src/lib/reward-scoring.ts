// Barème des points bonus pour les pronostics de récompenses individuelles.
//
// Référence : requirements.md - Exigence 18 (critères 18.9, 18.10) ;
// design.md - Property 17 (barème des récompenses).
//
// Un pronostic de récompense vaut exactement 5 points bonus si et seulement si
// la valeur pronostiquée (joueur ou équipe) correspond strictement à celle
// désignée par l'Administrateur, sinon 0 point (Exigences 18.9 / 18.10).
//
// Ces fonctions sont PURES (sans accès base de données ni effet de bord) afin
// de pouvoir être exercées par des tests de propriété (tâche 9.2 / Property 17).

/** Points attribués à un pronostic de récompense correct. */
export const REWARD_CORRECT_POINTS = 5;

/** Points attribués à un pronostic de récompense incorrect. */
export const REWARD_INCORRECT_POINTS = 0;

/**
 * Calcule les points bonus d'un pronostic de récompense joueur par comparaison
 * stricte des identifiants.
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

/**
 * Calcule les points bonus d'un pronostic de récompense d'équipe (Fair-Play)
 * par comparaison stricte des codes équipe.
 *
 * @param predictionTeamCode Code de l'équipe pronostiquée par le participant.
 * @param winnerTeamCode     Code de l'équipe vainqueur officiel de la récompense.
 * @returns 5 si les codes correspondent exactement, 0 sinon.
 */
export function scoreTeamRewardPrediction(
  predictionTeamCode: string,
  winnerTeamCode: string
): number {
  return predictionTeamCode === winnerTeamCode
    ? REWARD_CORRECT_POINTS
    : REWARD_INCORRECT_POINTS;
}
