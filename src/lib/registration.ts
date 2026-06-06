// Logique de clôture des inscriptions.
//
// Référence : requirements.md - Exigence 1.10 ; design.md - "Règles
// d'inscription" et Property 10.
//
// Les inscriptions sont closes dès que TOUS les matchs de la Journée 1 de la
// phase de groupes (stage GROUP_DAY_1) disposent d'un Resultat_Officiel. Cette
// vérification est calculée directement à partir des données match/résultat et
// non depuis un indicateur en cache (Property 10).

import { prisma } from './prisma';

/**
 * Décision pure de clôture des inscriptions.
 *
 * À partir de l'état « possède un résultat officiel » de chaque match de la
 * Journée 1, calcule si les inscriptions sont ouvertes :
 *   - aucun match de Journée 1 connu (tableau vide) → ouvertes (true) ;
 *   - au moins un match sans résultat officiel → ouvertes (true) ;
 *   - tous les matchs ont un résultat officiel → closes (false).
 *
 * Autrement dit : open === (day1Matches.length === 0 || au moins un match sans
 * résultat). Cette fonction est pure (sans accès base de données) afin d'être
 * exercée par des tests de propriété. Exigence 1.10 / Property 10.
 */
export function computeRegistrationOpen(
  day1Matches: ReadonlyArray<{ hasResult: boolean }>
): boolean {
  if (day1Matches.length === 0) {
    // Pas de matchs de Journée 1 connus : les inscriptions ne sont pas closes.
    return true;
  }

  const allHaveResult = day1Matches.every((m) => m.hasResult);
  return !allHaveResult;
}

/**
 * Indique si les inscriptions sont ouvertes.
 *
 * Retourne false si et seulement si chaque match GROUP_DAY_1 possède un
 * OfficialResult. S'il n'existe aucun match GROUP_DAY_1 (données non encore
 * seedées), les inscriptions sont considérées ouvertes.
 *
 * Exigence 1.10 / Property 10.
 */
export async function isRegistrationOpen(): Promise<boolean> {
  const day1Matches = await prisma.match.findMany({
    where: { stage: 'GROUP_DAY_1' },
    select: { officialResult: { select: { id: true } } },
  });

  return computeRegistrationOpen(
    day1Matches.map((m) => ({ hasResult: m.officialResult !== null }))
  );
}
