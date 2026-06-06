// Route handler : liste des participants pour la vue d'administration
// (Exigence 14.1).
//
// GET /api/admin/participants
//
// Référence : requirements.md - Exigence 14 (critères 14.1, 14.5) ;
// design.md - API Routes (GET /api/admin/participants, Admin), Property 15
// (autorisation admin), src/lib/ranking.ts (calcul pur du classement).
//
// Accès : ADMINISTRATEUR UNIQUEMENT (Exigence 14.5 / Property 15).
//   - Non authentifié            → 401 (INVALID_CREDENTIALS)
//   - Authentifié mais non admin → 403 (ADMIN_ONLY)
// L'autorisation est vérifiée AVANT toute lecture en base : aucune donnée de
// participant n'est exposée à un appelant non autorisé. Si le contrôle d'accès
// échoue techniquement, l'exception est capturée et l'accès est refusé (500)
// plutôt que d'exposer la liste (Exigence 14.5, fail-safe).
//
// Sécurité : la réponse ne contient QUE les champs de classement nécessaires
// (participantId, displayName, totalPoints, rank). Aucun hash de mot de passe ni
// adresse e-mail n'est sélectionné ni renvoyé.

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { ERROR_MESSAGES } from '@/lib/errors';
import { calculateRanking } from '@/lib/ranking';
import { canAccessAdminResource } from '@/lib/authorization';
import type { Participant, Pronostic, RewardPrediction } from '@/types';

export async function GET() {
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

  try {
    // 2. Chargement des données minimales nécessaires au calcul du classement.
    //    On ne sélectionne jamais le hash du mot de passe ni l'e-mail.
    const [participants, pronostics, rewardPredictions] = await Promise.all([
      prisma.participant.findMany({
        where: { isAdmin: false },
        select: { id: true, displayName: true },
      }),
      prisma.pronostic.findMany({
        select: { participantId: true, points: true },
      }),
      prisma.rewardPrediction.findMany({
        select: { participantId: true, points: true },
      }),
    ]);

    // 3. Calcul pur du classement (tri par score décroissant, puis nom
    //    d'affichage croissant en cas d'égalité — Exigence 14.1).
    const ranking = calculateRanking(
      participants as unknown as Participant[],
      pronostics as unknown as Pronostic[],
      rewardPredictions as unknown as RewardPrediction[]
    );

    // 4. Réponse : uniquement les champs de classement.
    return NextResponse.json({ participants: ranking }, { status: 200 });
  } catch (error) {
    console.error(
      "Erreur lors du chargement des participants (admin) :",
      error
    );
    return NextResponse.json(
      { error: ERROR_MESSAGES.TECHNICAL_ERROR },
      { status: 500 }
    );
  }
}
