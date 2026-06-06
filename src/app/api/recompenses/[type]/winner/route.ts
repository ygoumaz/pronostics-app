// Route handler : désignation du vainqueur officiel d'une récompense (ADMIN).
//
// POST /api/recompenses/[type]/winner
//   Corps attendu : { playerId: string }
//   - Authentification requise (401 sinon).
//   - RÉSERVÉ À L'ADMINISTRATEUR (Exigence 18.15 / Property 15) : tout
//     participant non administrateur reçoit 403 + ADMIN_ONLY.
//   - `type` doit être un RewardType valide ; sinon 400 (Exigence 18.2).
//   - `playerId` doit exister dans la table Player ; sinon 400.
//   - Dans une transaction (Exigences 18.8 / 18.9 / 18.10 / 18.16) :
//       1. Upsert du RewardResult (désignation initiale OU correction) ;
//       2. Recalcul des points de TOUS les RewardPrediction de ce type :
//          5 points si playerId == vainqueur, 0 sinon (via scoreRewardPrediction).
//     L'opération est triviale en charge et s'exécute bien en deçà des 5 s
//     exigées (Exigences 18.8 / 18.16).
//
// Référence : requirements.md - Exigence 18 (18.8-18.10, 18.15, 18.16) ;
// design.md - Property 15 (admin-only) et Property 17 (barème récompenses).

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { ERROR_MESSAGES } from '@/lib/errors';
import { isValidRewardType } from '@/lib/reward-types';
import { scoreRewardPrediction } from '@/lib/reward-scoring';
import { canAccessAdminResource } from '@/lib/authorization';

interface RouteContext {
  params: { type: string };
}

export async function POST(request: NextRequest, context: RouteContext) {
  // 1. Authentification requise (401 si pas de session).
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: ERROR_MESSAGES.INVALID_CREDENTIALS },
      { status: 401 }
    );
  }

  // 2. Contrôle d'accès : opération RÉSERVÉE à l'Administrateur
  //    (Exigence 18.15 / Property 15). Un participant non admin → 403.
  //    L'autorisation est modélisée par le helper pur testé.
  if (!canAccessAdminResource(session)) {
    return NextResponse.json(
      { error: ERROR_MESSAGES.ADMIN_ONLY },
      { status: 403 }
    );
  }

  // 3. Validation du type de récompense (Exigence 18.2).
  const { type } = context.params;
  if (!isValidRewardType(type)) {
    return NextResponse.json(
      { error: 'Type de récompense invalide.' },
      { status: 400 }
    );
  }
  const rewardType = type;

  // 4. Parsing du corps de la requête.
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Le corps de la requête est invalide.' },
      { status: 400 }
    );
  }

  const { playerId } = (body ?? {}) as Record<string, unknown>;
  if (typeof playerId !== 'string' || playerId.length === 0) {
    return NextResponse.json(
      { error: 'Un joueur valide doit être sélectionné.' },
      { status: 400 }
    );
  }

  try {
    // 5. Le vainqueur désigné doit exister dans la liste pré-chargée.
    const player = await prisma.player.findUnique({
      where: { id: playerId },
      select: { id: true },
    });
    if (!player) {
      return NextResponse.json(
        { error: 'Un joueur valide doit être sélectionné.' },
        { status: 400 }
      );
    }

    // 6. Transaction (Exigences 18.8 / 18.16) : désigner / corriger le
    //    vainqueur, puis recalculer les points de tous les pronostics de ce
    //    type. Le tout est atomique afin de garantir la cohérence des points.
    const { updatedCount } = await prisma.$transaction(async (tx) => {
      // Désignation initiale OU correction du vainqueur (Exigence 18.16).
      await tx.rewardResult.upsert({
        where: { rewardType },
        create: { rewardType, playerId },
        update: { playerId },
      });

      // Recalcul des points de TOUS les pronostics de ce type
      // (Exigences 18.9 / 18.10), via le barème pur scoreRewardPrediction.
      const predictions = await tx.rewardPrediction.findMany({
        where: { rewardType },
        select: { id: true, playerId: true },
      });

      await Promise.all(
        predictions.map((prediction) =>
          tx.rewardPrediction.update({
            where: { id: prediction.id },
            data: { points: scoreRewardPrediction(prediction.playerId, playerId) },
          })
        )
      );

      return { updatedCount: predictions.length };
    });

    return NextResponse.json(
      {
        message: 'Le vainqueur a été enregistré et les points ont été calculés.',
        rewardType,
        playerId,
        updatedPredictions: updatedCount,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Erreur lors de la désignation du vainqueur :', error);
    return NextResponse.json(
      { error: ERROR_MESSAGES.TECHNICAL_ERROR },
      { status: 500 }
    );
  }
}
