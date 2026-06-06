import { subHours } from 'date-fns';
import { prisma } from '@/lib/prisma';
import type { Stage } from '@/types';

/**
 * Module de verrouillage des pronostics par étape.
 *
 * Règles métier (Exigence 5) :
 * - Le verrouillage s'applique par étape : tous les pronostics d'une même étape
 *   sont clôturés simultanément (5.1).
 * - L'heure de clôture d'une étape est fixée à 1 heure avant le coup d'envoi du
 *   premier match de cette étape (5.2).
 * - Tant que l'heure de clôture n'est pas atteinte, la saisie/modification est
 *   permise ; dès qu'elle est atteinte, tout est verrouillé (5.3, 5.4).
 *
 * Les fonctions de calcul pur (computeLockTime, isOpenAt, getTimeRemainingAt)
 * sont volontairement isolées des accès base de données pour être facilement
 * testables (property tests 6.2/6.3).
 */

// === Fonctions pures (testables sans base de données) ===

/**
 * Calcule l'heure de clôture d'une étape à partir du coup d'envoi de son premier
 * match : coup d'envoi - 1 heure.
 */
export function computeLockTime(firstKickoff: Date): Date {
  return subHours(firstKickoff, 1);
}

/**
 * Indique si une étape est ouverte à l'instant `now`.
 * L'étape est ouverte si et seulement si `now` est strictement antérieur à
 * l'heure de clôture (now < lockTime).
 */
export function isOpenAt(lockTime: Date, now: Date): boolean {
  return now.getTime() < lockTime.getTime();
}

/**
 * Retourne le temps restant (en millisecondes) avant la clôture, à l'instant
 * `now`. La valeur est bornée à 0 : une fois l'heure de clôture atteinte ou
 * dépassée, le temps restant est 0.
 */
export function getTimeRemainingAt(lockTime: Date, now: Date): number {
  const remaining = lockTime.getTime() - now.getTime();
  return remaining > 0 ? remaining : 0;
}

// === Fonctions de haut niveau (accès base de données) ===

/**
 * Récupère le coup d'envoi du premier match (le plus tôt) d'une étape.
 * Retourne `null` si l'étape ne contient aucun match.
 */
async function getFirstKickoffOfStage(stage: Stage): Promise<Date | null> {
  const firstMatch = await prisma.match.findFirst({
    where: { stage },
    orderBy: { kickoffTime: 'asc' },
    select: { kickoffTime: true },
  });

  return firstMatch?.kickoffTime ?? null;
}

/**
 * Retourne l'heure de clôture des pronostics d'une étape (1 heure avant le coup
 * d'envoi du premier match de l'étape).
 * Retourne `null` si l'étape ne contient aucun match.
 */
export async function getStageLockTime(stage: Stage): Promise<Date | null> {
  const firstKickoff = await getFirstKickoffOfStage(stage);
  if (firstKickoff === null) {
    return null;
  }
  return computeLockTime(firstKickoff);
}

/**
 * Indique si les pronostics d'une étape sont encore ouverts à la saisie/modification.
 * Retourne `false` si l'étape ne contient aucun match (rien à ouvrir).
 *
 * @param stage étape concernée
 * @param now instant de référence (par défaut : maintenant)
 */
export async function isStageOpen(stage: Stage, now: Date = new Date()): Promise<boolean> {
  const lockTime = await getStageLockTime(stage);
  if (lockTime === null) {
    return false;
  }
  return isOpenAt(lockTime, now);
}

/**
 * Retourne le temps restant (en millisecondes) avant la clôture d'une étape,
 * borné à 0. Retourne `null` si l'étape ne contient aucun match.
 *
 * @param stage étape concernée
 * @param now instant de référence (par défaut : maintenant)
 */
export async function getTimeRemaining(stage: Stage, now: Date = new Date()): Promise<number | null> {
  const lockTime = await getStageLockTime(stage);
  if (lockTime === null) {
    return null;
  }
  return getTimeRemainingAt(lockTime, now);
}
