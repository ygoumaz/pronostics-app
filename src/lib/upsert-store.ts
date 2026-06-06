/**
 * Modèle en mémoire pur de la sémantique « contrainte d'unicité + upsert »
 * utilisée par les routes pronostics et récompenses.
 *
 * En base de données, Prisma garantit l'unicité via :
 *   - `@@unique([participantId, matchId])` sur les pronostics (Req 4.3)
 *   - `@@unique([participantId, rewardType])` sur les prédictions de récompense (Req 18.4)
 *
 * Les routes utilisent `upsert`, qui crée l'enregistrement s'il n'existe pas
 * ou le remplace sinon. Le résultat est qu'il existe AU PLUS un enregistrement
 * par clé unique, et que sa valeur correspond au dernier upsert appliqué
 * (sémantique de remplacement, Req 4.2/4.3).
 *
 * Ces helpers modélisent cette sémantique sans base de données vivante :
 * une `Map<string, T>` où la clé est la clé unique composite, ce qui garantit
 * naturellement « au plus une entrée par clé ».
 */

/**
 * Applique un upsert sur le store : associe `key` à `value`.
 *
 * Sémantique de mutation : la map fournie est mutée EN PLACE puis retournée
 * (la même référence est renvoyée). Cela reflète le comportement d'une table
 * unique où un upsert sur une clé existante remplace la valeur plutôt que d'en
 * insérer une seconde.
 */
export function applyUpsert<T>(
  store: Map<string, T>,
  key: string,
  value: T
): Map<string, T> {
  store.set(key, value);
  return store;
}

/**
 * Construit la clé unique composite d'un pronostic (participant, match).
 * Modélise la contrainte `@@unique([participantId, matchId])`.
 */
export function pronosticKey(participantId: string, matchId: string): string {
  return `${participantId}::${matchId}`;
}

/**
 * Construit la clé unique composite d'une prédiction de récompense
 * (participant, type de récompense).
 * Modélise la contrainte `@@unique([participantId, rewardType])`.
 */
export function rewardKey(participantId: string, rewardType: string): string {
  return `${participantId}::${rewardType}`;
}
