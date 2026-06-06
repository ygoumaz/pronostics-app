import type {
  Participant,
  Pronostic,
  RewardPrediction,
  RankingEntry,
} from '@/types';

/**
 * Module de calcul du classement global (Exigence 9).
 *
 * La fonction `calculateRanking` est volontairement PURE : elle prend en entrée
 * la liste des participants, l'ensemble des pronostics et l'ensemble des
 * prédictions de récompenses, et retourne le classement trié sans aucun accès
 * base de données. Cela la rend directement testable (property test 6.5 /
 * Property 9).
 *
 * Règles appliquées (Exigences 9.1, 9.2, 9.4, 9.6) :
 *  - Score_Participant = somme des points de tous les pronostics du participant
 *    + somme des points de toutes ses prédictions de récompenses. Un champ
 *    `points` absent (null/undefined) est compté comme 0. Un participant sans
 *    aucun pronostic ni récompense obtient donc un score de 0 (Exigence 9.1).
 *  - Tri par Score_Participant décroissant (Exigence 9.2).
 *  - En cas d'égalité de score, les participants sont triés par ordre
 *    alphabétique croissant de nom d'affichage (Exigence 9.4).
 *  - Le rang d'un participant vaut 1 + le nombre de participants ayant un score
 *    strictement supérieur. Les participants à égalité partagent donc le même
 *    rang, et deux scores différents donnent toujours des rangs différents
 *    (Exigences 9.4 et 9.6).
 */

/**
 * Normalise un champ de points optionnel : un score absent (null/undefined)
 * est traité comme 0.
 */
function pointsOrZero(points: number | null | undefined): number {
  return points ?? 0;
}

/**
 * Calcule le classement global de tous les participants.
 *
 * @param participants liste des participants à classer
 * @param pronostics ensemble des pronostics (tous participants confondus)
 * @param rewardPredictions ensemble des prédictions de récompenses (tous participants confondus)
 * @returns le tableau des `RankingEntry` trié par rang, puis par nom d'affichage
 */
export function calculateRanking(
  participants: Participant[],
  pronostics: Pronostic[],
  rewardPredictions: RewardPrediction[]
): RankingEntry[] {
  // Cumul des points de matchs par participant.
  const totalByParticipant = new Map<string, number>();
  for (const participant of participants) {
    totalByParticipant.set(participant.id, 0);
  }

  const addPoints = (participantId: string, points: number): void => {
    // On n'ajoute des points que pour les participants connus afin d'ignorer
    // d'éventuels pronostics orphelins ne correspondant à aucun participant.
    if (totalByParticipant.has(participantId)) {
      totalByParticipant.set(
        participantId,
        (totalByParticipant.get(participantId) ?? 0) + points
      );
    }
  };

  for (const pronostic of pronostics) {
    addPoints(pronostic.participantId, pointsOrZero(pronostic.points));
  }

  for (const reward of rewardPredictions) {
    addPoints(reward.participantId, pointsOrZero(reward.points));
  }

  // Construction des entrées avec le score cumulé.
  const entries = participants.map((participant) => ({
    participantId: participant.id,
    displayName: participant.displayName,
    totalPoints: totalByParticipant.get(participant.id) ?? 0,
    rank: 0, // attribué après le tri
  }));

  // Tri par score décroissant, puis par nom d'affichage alphabétique croissant.
  entries.sort((a, b) => {
    if (a.totalPoints !== b.totalPoints) {
      return b.totalPoints - a.totalPoints;
    }
    return a.displayName.localeCompare(b.displayName);
  });

  // Attribution des rangs : rang = 1 + nombre de participants au score
  // strictement supérieur. Les ex-aequo partagent le même rang.
  return entries.map((entry, index) => {
    if (index > 0 && entry.totalPoints === entries[index - 1].totalPoints) {
      // Même score que le précédent : même rang.
      entry.rank = entries[index - 1].rank;
    } else {
      // Score strictement inférieur (ou premier élément) : le rang correspond à
      // la position 1-indexée, soit 1 + le nombre de participants devant lui.
      entry.rank = index + 1;
    }
    return entry;
  });
}
