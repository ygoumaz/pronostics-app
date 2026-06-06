// Route handler : export Excel (.xlsx) de tous les pronostics et résultats.
//
// GET /api/admin/export
//
// Référence : requirements.md - Exigence 15 (critères 15.1 à 15.7) ;
// design.md - API Routes (GET /api/admin/export, Admin) ; module de classement
// (src/lib/ranking.ts, pur et déjà testé).
//
// Accès : ADMINISTRATEUR UNIQUEMENT (Exigence 15.5 / Property 15).
//   - Non authentifié            → 401 (INVALID_CREDENTIALS)
//   - Authentifié mais non admin → 403 (ADMIN_ONLY)
// L'autorisation est vérifiée AVANT toute lecture en base : aucun fichier n'est
// généré si l'appelant n'est pas l'Administrateur.
//
// Le fichier contient deux feuilles :
//   - « Détail »      : une ligne par (participant × match) avec le nom
//     d'affichage, la phase, la journée/tour, les deux équipes, la date de coup
//     d'envoi, le pronostic (ou « aucun »), le résultat officiel (ou « non
//     saisi ») et les points (Exigence 15.2). Lignes triées par nom
//     d'affichage croissant puis par coup d'envoi croissant.
//   - « Classement »  : le classement complet (rang, nom, score) calculé par la
//     fonction pure `calculateRanking` (Exigence 15.3).
//
// ExcelJS s'appuie sur des API Node (Buffer, streams) : on force donc le
// runtime Node (et non Edge) pour ce handler.

import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';

import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { ERROR_MESSAGES } from '@/lib/errors';
import { calculateRanking } from '@/lib/ranking';
import type { Participant, Pronostic, RewardPrediction, Stage } from '@/types';

// ExcelJS nécessite le runtime Node (Buffer / streams), pas l'Edge runtime.
export const runtime = 'nodejs';

/** Libellés français des phases (Exigence 15.2). */
const PHASE_LABELS: Record<string, string> = {
  GROUP: 'Phase de groupes',
  KNOCKOUT: 'Phase éliminatoire',
};

/** Libellés français de la journée / du tour (Exigence 15.2). */
const STAGE_LABELS: Record<Stage, string> = {
  GROUP_DAY_1: 'Journée 1',
  GROUP_DAY_2: 'Journée 2',
  GROUP_DAY_3: 'Journée 3',
  ROUND_OF_32: 'Seizièmes de finale',
  ROUND_OF_16: 'Huitièmes de finale',
  QUARTER_FINAL: 'Quarts de finale',
  SEMI_FINAL: 'Demi-finales',
  THIRD_PLACE: 'Match pour la troisième place',
  FINAL: 'Finale',
};

/** Nom affichable d'une équipe : nom officiel si connu, sinon emplacement. */
function teamLabel(
  code: string | null,
  placeholder: string | null,
  teamNameByCode: Map<string, string>
): string {
  if (code) {
    return teamNameByCode.get(code) ?? code;
  }
  return placeholder ?? 'À déterminer';
}

/** Formate un score « X-Y » à partir de deux nombres de buts. */
function formatScore(homeGoals: number, awayGoals: number): string {
  return `${homeGoals}-${awayGoals}`;
}

/**
 * Date d'export au format AAAA-MM-JJ dans le fuseau horaire local du serveur
 * (Exigence 15.6). On utilise les composantes locales pour éviter le décalage
 * UTC d'une simple `toISOString()`.
 */
function localDateStamp(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export async function GET() {
  // 1. Authentification + AUTORISATION ADMIN (Exigence 15.5 / Property 15).
  //    Rejet de tout appel non administrateur AVANT toute lecture en base, de
  //    sorte qu'aucun fichier ne soit généré pour un appelant non autorisé.
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { error: ERROR_MESSAGES.INVALID_CREDENTIALS },
      { status: 401 }
    );
  }
  if (session.user.isAdmin !== true) {
    return NextResponse.json(
      { error: ERROR_MESSAGES.ADMIN_ONLY },
      { status: 403 }
    );
  }

  try {
    // 2. Chargement des données nécessaires aux deux feuilles.
    const [participants, matches, pronostics, rewardPredictions, teams] =
      await Promise.all([
        prisma.participant.findMany({
          select: { id: true, displayName: true },
        }),
        prisma.match.findMany({
          select: {
            id: true,
            phase: true,
            stage: true,
            homeTeamCode: true,
            awayTeamCode: true,
            homePlaceholder: true,
            awayPlaceholder: true,
            kickoffTime: true,
            officialResult: {
              select: { homeGoals: true, awayGoals: true },
            },
          },
        }),
        prisma.pronostic.findMany({
          select: {
            participantId: true,
            matchId: true,
            homeGoals: true,
            awayGoals: true,
            points: true,
          },
        }),
        prisma.rewardPrediction.findMany({
          select: { participantId: true, points: true },
        }),
        prisma.team.findMany({ select: { code: true, name: true } }),
      ]);

    const teamNameByCode = new Map(teams.map((t) => [t.code, t.name]));

    // Index des pronostics par (participantId|matchId) pour un accès O(1).
    const pronosticByKey = new Map(
      pronostics.map((p) => [`${p.participantId}|${p.matchId}`, p])
    );

    // 3. Construction du classeur ExcelJS.
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Pronostics Coupe du Monde 2026';
    workbook.created = new Date();

    // --- Feuille « Détail » (Exigence 15.2) ---
    const detailSheet = workbook.addWorksheet('Détail');
    detailSheet.columns = [
      { header: 'Participant', key: 'participant', width: 24 },
      { header: 'Phase', key: 'phase', width: 18 },
      { header: 'Journée / Tour', key: 'stage', width: 24 },
      { header: 'Équipe domicile', key: 'homeTeam', width: 22 },
      { header: 'Équipe extérieur', key: 'awayTeam', width: 22 },
      { header: 'Coup d\u2019envoi', key: 'kickoff', width: 20 },
      { header: 'Pronostic', key: 'pronostic', width: 14 },
      { header: 'Résultat officiel', key: 'result', width: 18 },
      { header: 'Points', key: 'points', width: 10 },
    ];
    detailSheet.getRow(1).font = { bold: true };

    // Tri : nom d'affichage croissant, puis coup d'envoi croissant
    // (Exigence 15.2). On trie les participants une fois et les matchs une fois,
    // puis on génère le produit cartésien dans l'ordre voulu.
    const sortedParticipants = [...participants].sort((a, b) =>
      a.displayName.localeCompare(b.displayName)
    );
    const sortedMatches = [...matches].sort(
      (a, b) => a.kickoffTime.getTime() - b.kickoffTime.getTime()
    );

    for (const participant of sortedParticipants) {
      for (const match of sortedMatches) {
        const pronostic = pronosticByKey.get(`${participant.id}|${match.id}`);
        const officialResult = match.officialResult;

        detailSheet.addRow({
          participant: participant.displayName,
          phase: PHASE_LABELS[match.phase] ?? match.phase,
          stage: STAGE_LABELS[match.stage as Stage] ?? match.stage,
          homeTeam: teamLabel(
            match.homeTeamCode,
            match.homePlaceholder,
            teamNameByCode
          ),
          awayTeam: teamLabel(
            match.awayTeamCode,
            match.awayPlaceholder,
            teamNameByCode
          ),
          kickoff: match.kickoffTime,
          pronostic: pronostic
            ? formatScore(pronostic.homeGoals, pronostic.awayGoals)
            : 'aucun',
          result: officialResult
            ? formatScore(officialResult.homeGoals, officialResult.awayGoals)
            : 'non saisi',
          // Points : valeur évaluée si disponible, sinon vide (pas encore évalué).
          points: pronostic && pronostic.points != null ? pronostic.points : '',
        });
      }
    }

    // --- Feuille « Classement » (Exigence 15.3) ---
    const ranking = calculateRanking(
      participants as unknown as Participant[],
      pronostics as unknown as Pronostic[],
      rewardPredictions as unknown as RewardPrediction[]
    );

    const rankingSheet = workbook.addWorksheet('Classement');
    rankingSheet.columns = [
      { header: 'Rang', key: 'rank', width: 10 },
      { header: 'Nom', key: 'displayName', width: 28 },
      { header: 'Score total', key: 'totalPoints', width: 14 },
    ];
    rankingSheet.getRow(1).font = { bold: true };

    for (const entry of ranking) {
      rankingSheet.addRow({
        rank: entry.rank,
        displayName: entry.displayName,
        totalPoints: entry.totalPoints,
      });
    }

    // 4. Sérialisation en buffer puis réponse en téléchargement (Exigences
    //    15.4 / 15.6). Le fichier n'est jamais écrit sur le serveur.
    const buffer = await workbook.xlsx.writeBuffer();
    const filename = `pronostics-coupe-du-monde-2026_${localDateStamp(
      new Date()
    )}.xlsx`;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    // 5. Exigence 15.7 : aucune génération de fichier, message d'échec.
    console.error("Erreur lors de l'export Excel :", error);
    return NextResponse.json(
      { error: ERROR_MESSAGES.EXPORT_FAILED },
      { status: 500 }
    );
  }
}
