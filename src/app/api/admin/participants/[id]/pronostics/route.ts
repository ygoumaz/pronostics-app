// Route handler : détail des pronostics d'un participant pour l'administration
// (Exigences 14.2, 14.3, 14.4, 14.6).
//
// GET /api/admin/participants/[id]/pronostics
//
// Référence : requirements.md - Exigence 14 (critères 14.2, 14.3, 14.4, 14.5,
// 14.6) ; design.md - API Routes (GET /api/admin/participants/[id]/pronostics,
// Admin), Property 15 (autorisation admin).
//
// Accès : ADMINISTRATEUR UNIQUEMENT (Exigence 14.5 / Property 15).
//   - Non authentifié            → 401 (INVALID_CREDENTIALS)
//   - Authentifié mais non admin → 403 (ADMIN_ONLY)
// L'autorisation est vérifiée AVANT toute lecture en base. En cas d'échec
// technique du contrôle, l'accès est refusé (500) plutôt qu'autorisé.
//
// Particularité (Exigence 14.6) : contrairement à la vue publique d'un autre
// participant (/api/pronostics/participant/[id]), l'administrateur voit TOUS les
// pronostics, y compris ceux des matchs dont le coup d'envoi n'est pas encore
// atteint. AUCUNE règle de confidentialité n'est appliquée ici.
//
// Sécurité : seuls le nom d'affichage et l'identifiant du participant sont
// exposés ; jamais le hash du mot de passe ni l'e-mail.
//
// Réponse :
//   {
//     participant: { id, displayName, totalPoints, rank },
//     matches: SerializedMatch[],   // tous les matchs, triés chronologiquement
//     pronostics: [{ matchId, homeGoals, awayGoals, points }]
//   }
// Le client joint `pronostics` sur `matches` via matchId, regroupe par
// `match.stage` (journée/tour) et trie chronologiquement (Exigence 14.3).

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { ERROR_MESSAGES } from '@/lib/errors';
import { calculateRanking } from '@/lib/ranking';
import { canAccessAdminResource } from '@/lib/authorization';
import { compareMatches } from '@/lib/match-sort';
import { getMatchStatus } from '@/lib/match-status';
import { serializeMatch, type MatchWithResult } from '@/app/api/matches/serialize';
import { REWARD_TYPES } from '@/lib/reward-types';
import type { Participant, Pronostic, RewardPrediction } from '@/types';

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  // 1. Authentification + AUTORISATION ADMIN (Exigence 14.5 / Property 15).
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { error: ERROR_MESSAGES.INVALID_CREDENTIALS },
      { status: 401 }
    );
  }
  if (!canAccessAdminResource(session)) {
    return NextResponse.json(
      { error: ERROR_MESSAGES.ADMIN_ONLY },
      { status: 403 }
    );
  }

  const participantId = params.id;

  try {
    // 2. Vérification de l'existence du participant ciblé. On ne sélectionne
    //    que les champs publics (id, displayName).
    const participant = await prisma.participant.findUnique({
      where: { id: participantId },
      select: { id: true, displayName: true },
    });

    if (!participant) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.TECHNICAL_ERROR },
        { status: 404 }
      );
    }

    // 3. Chargement en parallèle de :
    //    - tous les matchs (avec résultat officiel) pour l'affichage complet ;
    //    - les pronostics du participant ciblé (TOUS, sans confidentialité) ;
    //    - les données nécessaires au calcul du rang (classement global) ;
    //    - les pronostics récompenses du participant + les vainqueurs officiels.
    const [matches, participantPronostics, allParticipants, allPronostics, rewardPredictions, participantRewardPredictions, rewardResults] =
      await Promise.all([
        prisma.match.findMany({
          include: { officialResult: true },
        }) as Promise<MatchWithResult[]>,
        prisma.pronostic.findMany({
          where: { participantId },
          select: {
            matchId: true,
            homeGoals: true,
            awayGoals: true,
            points: true,
          },
        }),
        prisma.participant.findMany({
          select: { id: true, displayName: true },
        }),
        prisma.pronostic.findMany({
          select: { participantId: true, points: true },
        }),
        prisma.rewardPrediction.findMany({
          select: { participantId: true, points: true },
        }),
        prisma.rewardPrediction.findMany({
          where: { participantId },
          select: { rewardType: true, playerId: true, points: true },
        }),
        prisma.rewardResult.findMany({
          select: { rewardType: true, playerId: true },
        }),
      ]);

    // 4. Calcul du classement global pour en extraire le score total et le rang
    //    du participant ciblé (Exigence 14.4).
    const ranking = calculateRanking(
      allParticipants as unknown as Participant[],
      allPronostics as unknown as Pronostic[],
      rewardPredictions as unknown as RewardPrediction[]
    );    const entry = ranking.find((r) => r.participantId === participantId);

    // 5. Résolution des noms d'équipes + tri chronologique + sérialisation.
    const teamNameByCode = await getTeamNameMap();
    const sorted = [...matches].sort(compareMatches);
    const now = new Date();
    const serializedMatches = sorted.map((match) =>
      serializeMatch(match, {
        teamNameByCode,
        status: getMatchStatus(
          match.kickoffTime,
          match.officialResult !== null,
          now
        ),
      })
    );

    // 6. Réponse complète. AUCUNE confidentialité appliquée (Exigence 14.6).
    return NextResponse.json(
      {
        participant: {
          id: participant.id,
          displayName: participant.displayName,
          totalPoints: entry?.totalPoints ?? 0,
          rank: entry?.rank ?? null,
        },
        matches: serializedMatches,
        pronostics: participantPronostics,
        rewardTypes: REWARD_TYPES,
        rewardPredictions: participantRewardPredictions,
        rewardResults,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(
      "Erreur lors du chargement des pronostics du participant (admin) :",
      error
    );
    return NextResponse.json(
      { error: ERROR_MESSAGES.TECHNICAL_ERROR },
      { status: 500 }
    );
  }
}

/** Construit une table code ISO → nom d'équipe pour l'affichage. */
async function getTeamNameMap(): Promise<Map<string, string>> {
  const teams = await prisma.team.findMany({
    select: { code: true, name: true },
  });
  return new Map(teams.map((t) => [t.code, t.name]));
}
