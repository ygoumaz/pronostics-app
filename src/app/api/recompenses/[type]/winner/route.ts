// Route handler : désignation du vainqueur officiel d'une récompense (ADMIN).
//
// POST /api/recompenses/[type]/winner
//   Corps attendu :
//     - { playerId: string }  pour toutes les récompenses sauf FAIR_PLAY
//     - { teamCode: string }  pour FAIR_PLAY (récompense d'équipe)
//   - Authentification + rôle Admin requis.
//   - Dans une transaction : upsert du RewardResult, puis recalcul des points
//     de tous les RewardPrediction de ce type.
//
// Référence : requirements.md - Exigence 18 (18.8-18.10, 18.15, 18.16).

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { ERROR_MESSAGES } from '@/lib/errors';
import { isValidRewardType } from '@/lib/reward-types';
import { scoreRewardPrediction, scoreTeamRewardPrediction } from '@/lib/reward-scoring';
import { canAccessAdminResource } from '@/lib/authorization';

interface RouteContext {
  params: { type: string };
}

export async function POST(request: NextRequest, context: RouteContext) {
  // 1. Authentification requise.
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: ERROR_MESSAGES.INVALID_CREDENTIALS },
      { status: 401 }
    );
  }

  // 2. Contrôle d'accès admin.
  if (!canAccessAdminResource(session)) {
    return NextResponse.json(
      { error: ERROR_MESSAGES.ADMIN_ONLY },
      { status: 403 }
    );
  }

  // 3. Validation du type de récompense.
  const { type } = context.params;
  if (!isValidRewardType(type)) {
    return NextResponse.json(
      { error: 'Type de récompense invalide.' },
      { status: 400 }
    );
  }
  const rewardType = type;
  const isFairPlay = rewardType === 'FAIR_PLAY';

  // 4. Parsing du corps.
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Le corps de la requête est invalide.' },
      { status: 400 }
    );
  }

  const { playerId, teamCode } = (body ?? {}) as Record<string, unknown>;

  if (isFairPlay) {
    if (typeof teamCode !== 'string' || teamCode.length === 0) {
      return NextResponse.json(
        { error: 'Une équipe valide doit être sélectionnée.' },
        { status: 400 }
      );
    }
  } else {
    if (typeof playerId !== 'string' || playerId.length === 0) {
      return NextResponse.json(
        { error: 'Un joueur valide doit être sélectionné.' },
        { status: 400 }
      );
    }
  }

  try {
    if (isFairPlay) {
      // 5a. L'équipe désignée doit exister dans la liste pré-chargée.
      const team = await prisma.team.findUnique({
        where: { code: teamCode as string },
        select: { code: true },
      });
      if (!team) {
        return NextResponse.json(
          { error: 'Une équipe valide doit être sélectionnée.' },
          { status: 400 }
        );
      }

      const { updatedCount } = await prisma.$transaction(async (tx) => {
        await tx.rewardResult.upsert({
          where: { rewardType },
          create: { rewardType, teamCode: teamCode as string },
          update: { teamCode: teamCode as string, playerId: null },
        });

        const predictions = await tx.rewardPrediction.findMany({
          where: { rewardType },
          select: { id: true, teamCode: true },
        });

        await Promise.all(
          predictions.map((prediction) =>
            tx.rewardPrediction.update({
              where: { id: prediction.id },
              data: {
                points: scoreTeamRewardPrediction(
                  prediction.teamCode ?? '',
                  teamCode as string
                ),
              },
            })
          )
        );

        return { updatedCount: predictions.length };
      });

      return NextResponse.json(
        {
          message: 'Le vainqueur a été enregistré et les points ont été calculés.',
          rewardType,
          teamCode,
          updatedPredictions: updatedCount,
        },
        { status: 200 }
      );
    } else {
      // 5b. Le joueur désigné doit exister dans la liste pré-chargée.
      const player = await prisma.player.findUnique({
        where: { id: playerId as string },
        select: { id: true },
      });
      if (!player) {
        return NextResponse.json(
          { error: 'Un joueur valide doit être sélectionné.' },
          { status: 400 }
        );
      }

      const { updatedCount } = await prisma.$transaction(async (tx) => {
        await tx.rewardResult.upsert({
          where: { rewardType },
          create: { rewardType, playerId: playerId as string },
          update: { playerId: playerId as string, teamCode: null },
        });

        const predictions = await tx.rewardPrediction.findMany({
          where: { rewardType },
          select: { id: true, playerId: true },
        });

        await Promise.all(
          predictions.map((prediction) =>
            tx.rewardPrediction.update({
              where: { id: prediction.id },
              data: {
                points: scoreRewardPrediction(
                  prediction.playerId ?? '',
                  playerId as string
                ),
              },
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
    }
  } catch (error) {
    console.error('Erreur lors de la désignation du vainqueur :', error);
    return NextResponse.json(
      { error: ERROR_MESSAGES.TECHNICAL_ERROR },
      { status: 500 }
    );
  }
}
