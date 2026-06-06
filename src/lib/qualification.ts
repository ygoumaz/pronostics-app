import type { Prisma } from '@prisma/client';

import { ERROR_MESSAGES } from '@/lib/errors';
import { calculateGroupStandings } from '@/lib/group-ranking';
import { prisma } from '@/lib/prisma';
import type { GroupMatchResult } from '@/types';

/**
 * Module de qualification éliminatoire (Exigences 3.3, 3.4, 3.5, 3.12).
 *
 * Ce module fait le pont entre le calcul PUR du classement de groupe
 * (`calculateGroupStandings`) et la base de données : il détecte quand un groupe
 * est complet, calcule les équipes qualifiées (1er et 2e), puis propage ces
 * équipes vers les matchs de la Phase_Eliminatoire dont l'emplacement
 * (« placeholder ») référence ce groupe.
 *
 * --- LIMITATION DOCUMENTÉE : meilleurs troisièmes -----------------------------
 * Certains matchs de huitièmes (ROUND_OF_32) utilisent des emplacements du type
 * « 3e Groupe A/B/C/D/F », qui désignent l'un des meilleurs troisièmes de phase
 * de groupes. Leur résolution dépend d'un classement TRANSVERSAL des équipes
 * classées troisièmes de TOUS les groupes (les 12 groupes doivent être terminés)
 * et d'un algorithme d'affectation spécifique FIFA. Ce calcul N'EST PAS traité
 * par ce module : `parsePlaceholder` retourne `null` pour ces emplacements et la
 * propagation les laisse intentionnellement inchangés (équipes nulles, pronostics
 * désactivés conformément à l'Exigence 3.4). Une tâche ultérieure dédiée devra
 * implémenter l'affectation des meilleurs troisièmes.
 */

/** Résultat de l'analyse d'un emplacement déterministe « Xer/Xe Groupe Y ». */
export interface PlaceholderRef {
  /** Position dans le groupe : 1 = vainqueur, 2 = deuxième. */
  position: 1 | 2;
  /** Code du groupe référencé (ex. « A »). */
  group: string;
}

/**
 * Analyse une chaîne d'emplacement française en référence structurée.
 *
 * Formats reconnus (déterministes, mono-groupe) :
 *  - « 1er Groupe A » -> { position: 1, group: 'A' }
 *  - « 2e Groupe B »  -> { position: 2, group: 'B' }
 *  - « 2ème Groupe C » -> { position: 2, group: 'C' }
 *
 * Retourne `null` pour tout autre format, notamment les emplacements de
 * meilleurs troisièmes (« 3e Groupe A/B/C/D/F ») qui ne sont pas résolubles ici,
 * ainsi que pour les emplacements faisant référence aux tours éliminatoires
 * (ex. « Vainqueur match 73 »).
 *
 * @param placeholder chaîne d'emplacement (peut être null/undefined)
 * @returns la référence parsée ou `null` si non déterministe / non reconnu
 */
export function parsePlaceholder(
  placeholder: string | null | undefined
): PlaceholderRef | null {
  if (placeholder === null || placeholder === undefined) return null;

  // « 1er Groupe X » (1ère) ou « 2e/2ème Groupe X ». Le groupe est une lettre A-L.
  // On rejette explicitement les listes de groupes (« A/B/C ») via [A-L] unique.
  const match = placeholder
    .trim()
    .match(/^(1er|1ère|2e|2ème|2eme|1)\s+Groupe\s+([A-L])$/i);
  if (match === null) return null;

  const positionToken = match[1].toLowerCase();
  const position: 1 | 2 =
    positionToken === '1' || positionToken === '1er' || positionToken === '1ère'
      ? 1
      : 2;

  return { position, group: match[2].toUpperCase() };
}

/**
 * Indique si tous les matchs de phase de groupes du groupe donné disposent d'un
 * Resultat_Officiel (Exigence 3.3 : déclencheur du calcul du classement).
 *
 * @param groupCode code du groupe (ex. « A »)
 * @returns `true` si au moins un match existe et que tous ont un résultat
 */
export async function isGroupComplete(groupCode: string): Promise<boolean> {
  const matches = await prisma.match.findMany({
    where: { phase: 'GROUP', groupCode },
    select: { officialResult: { select: { id: true } } },
  });

  if (matches.length === 0) return false;
  return matches.every((m) => m.officialResult !== null);
}

/** Équipes qualifiées d'un groupe : vainqueur (1er) et deuxième (2e). */
export interface QualifiedTeams {
  first: string;
  second: string;
}

/**
 * Charge les matchs + résultats d'un groupe, construit les `GroupMatchResult`
 * et calcule le classement pour en extraire les 1er et 2e (Exigence 3.3).
 *
 * @param groupCode code du groupe (ex. « A »)
 * @returns les codes des équipes 1re et 2e, ou `null` si le groupe est
 *          incomplet (un ou plusieurs résultats manquants) ou inexistant
 */
export async function getQualifiedTeams(
  groupCode: string
): Promise<QualifiedTeams | null> {
  const matches = await prisma.match.findMany({
    where: { phase: 'GROUP', groupCode },
    select: {
      homeTeamCode: true,
      awayTeamCode: true,
      officialResult: { select: { homeGoals: true, awayGoals: true } },
    },
  });

  if (matches.length === 0) return null;

  const results: GroupMatchResult[] = [];
  for (const m of matches) {
    // Un groupe ne peut être classé que si tous ses matchs ont un résultat et
    // que les équipes sont connues (toujours le cas en phase de groupes).
    if (
      m.officialResult === null ||
      m.homeTeamCode === null ||
      m.awayTeamCode === null
    ) {
      return null;
    }
    results.push({
      homeTeam: m.homeTeamCode,
      awayTeam: m.awayTeamCode,
      homeGoals: m.officialResult.homeGoals,
      awayGoals: m.officialResult.awayGoals,
    });
  }

  const standings = calculateGroupStandings(groupCode, results);
  if (standings.length < 2) return null;

  return { first: standings[0].team, second: standings[1].team };
}

/**
 * Calcule le classement d'un groupe et propage les équipes qualifiées (1er/2e)
 * vers les matchs de la Phase_Eliminatoire qui les référencent (Exigences 3.3,
 * 3.4, 3.12).
 *
 * Comportement transactionnel (Exigence 3.12) : l'ensemble du calcul et des
 * mises à jour s'exécute dans une seule `prisma.$transaction`. En cas d'erreur,
 * la transaction est annulée — aucun match éliminatoire n'est partiellement mis
 * à jour — et une erreur portant le message `GROUP_CALC_FAILED` est levée pour
 * que l'appelant l'affiche à l'Administrateur.
 *
 * Conformément à l'Exigence 3.4, un emplacement d'équipe n'est rempli que
 * lorsque l'équipe qualifiée est déterminée ; tant que la mise à jour n'a pas
 * réussi, le code d'équipe reste `null` (pronostics désactivés).
 *
 * Les emplacements de meilleurs troisièmes (« 3e Groupe ... ») ne sont jamais
 * affectés ici (voir la limitation documentée en tête de fichier).
 *
 * @param groupCode code du groupe terminé (ex. « A »)
 * @returns le nombre d'emplacements de match mis à jour ; 0 si le groupe est
 *          incomplet (aucune qualification possible pour l'instant)
 * @throws Error(ERROR_MESSAGES.GROUP_CALC_FAILED) si une erreur technique
 *         survient pendant le calcul ou la mise à jour
 */
export async function propagateQualifiedTeams(
  groupCode: string
): Promise<number> {
  try {
    return await prisma.$transaction(async (tx) => {
      // 1. Charger les matchs du groupe avec leurs résultats.
      const groupMatches = await tx.match.findMany({
        where: { phase: 'GROUP', groupCode },
        select: {
          homeTeamCode: true,
          awayTeamCode: true,
          officialResult: { select: { homeGoals: true, awayGoals: true } },
        },
      });

      // Groupe inexistant ou incomplet : on ne qualifie aucune équipe.
      if (groupMatches.length === 0) return 0;

      const results: GroupMatchResult[] = [];
      for (const m of groupMatches) {
        if (
          m.officialResult === null ||
          m.homeTeamCode === null ||
          m.awayTeamCode === null
        ) {
          return 0; // Tous les résultats ne sont pas encore saisis.
        }
        results.push({
          homeTeam: m.homeTeamCode,
          awayTeam: m.awayTeamCode,
          homeGoals: m.officialResult.homeGoals,
          awayGoals: m.officialResult.awayGoals,
        });
      }

      // 2. Calculer le classement et identifier 1er / 2e.
      const standings = calculateGroupStandings(groupCode, results);
      if (standings.length < 2) return 0;

      const teamByPosition: Record<1 | 2, string> = {
        1: standings[0].team,
        2: standings[1].team,
      };

      // 3. Charger les matchs éliminatoires non encore affectés susceptibles de
      //    référencer ce groupe via leurs emplacements.
      const knockoutMatches = await tx.match.findMany({
        where: { phase: 'KNOCKOUT' },
        select: {
          id: true,
          homeTeamCode: true,
          awayTeamCode: true,
          homePlaceholder: true,
          awayPlaceholder: true,
        },
      });

      let updatedSlots = 0;

      for (const km of knockoutMatches) {
        const data: Prisma.MatchUpdateInput = {};

        const homeRef = parsePlaceholder(km.homePlaceholder);
        if (
          homeRef !== null &&
          homeRef.group === groupCode &&
          km.homeTeamCode === null
        ) {
          data.homeTeamCode = teamByPosition[homeRef.position];
        }

        const awayRef = parsePlaceholder(km.awayPlaceholder);
        if (
          awayRef !== null &&
          awayRef.group === groupCode &&
          km.awayTeamCode === null
        ) {
          data.awayTeamCode = teamByPosition[awayRef.position];
        }

        if (data.homeTeamCode !== undefined || data.awayTeamCode !== undefined) {
          await tx.match.update({ where: { id: km.id }, data });
          updatedSlots +=
            (data.homeTeamCode !== undefined ? 1 : 0) +
            (data.awayTeamCode !== undefined ? 1 : 0);
        }
      }

      return updatedSlots;
    });
  } catch (error) {
    // Exigence 3.12 : en cas d'erreur, la transaction est annulée (aucun match
    // partiellement mis à jour) et on surface une erreur dédiée.
    throw new Error(ERROR_MESSAGES.GROUP_CALC_FAILED, { cause: error });
  }
}
