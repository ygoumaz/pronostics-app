// Route handler : saisie / modification d'un pronostic de récompense.
//
// PUT /api/recompenses/[type]
//   Corps attendu :
//     - { playerId: string }  pour toutes les récompenses sauf FAIR_PLAY
//     - { teamCode: string }  pour FAIR_PLAY (récompense d'équipe)
//   - Authentification requise (401 sinon).
//   - `type` doit être un RewardType valide ; sinon 400.
//   - Verrouillage : si inscriptions closes → 403 + REWARDS_LOCKED.
//   - Upsert sur (participantId, rewardType).
//
// Référence : requirements.md - Exigence 18 (18.2-18.7) ; design.md.

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { ERROR_MESSAGES } from '@/lib/errors';
import { isRegistrationOpen } from '@/lib/registration';
import { isValidRewardType } from '@/lib/reward-types';

interface RouteContext {
  params: { type: string };
}

export async function PUT(request: NextRequest, context: RouteContext) {
  // 1. Authentification requise.
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: ERROR_MESSAGES.INVALID_CREDENTIALS },
      { status: 401 }
    );
  }
  const participantId = session.user.id;

  // 2. Validation du type de récompense.
  const { type } = context.params;
  if (!isValidRewardType(type)) {
    return NextResponse.json(
      { error: 'Type de récompense invalide.' },
      { status: 400 }
    );
  }
  const rewardType = type;
  const isFairPlay = rewardType === 'FAIR_PLAY';

  // 3. Parsing du corps.
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
    // 4. Verrouillage.
    const open = await isRegistrationOpen();
    if (!open) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.REWARDS_LOCKED },
        { status: 403 }
      );
    }

    if (isFairPlay) {
      // 5a. L'équipe pronostiquée doit exister dans la liste pré-chargée.
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

      const prediction = await prisma.rewardPrediction.upsert({
        where: { participantId_rewardType: { participantId, rewardType } },
        create: { participantId, rewardType, teamCode: teamCode as string, points: null },
        update: { teamCode: teamCode as string, playerId: null, points: null },
        select: { id: true, rewardType: true, teamCode: true, updatedAt: true },
      });

      return NextResponse.json(
        {
          message: 'Votre pronostic de récompense a bien été enregistré.',
          prediction,
        },
        { status: 200 }
      );
    } else {
      // 5b. Le joueur pronostiqué doit exister dans la liste pré-chargée.
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

      const prediction = await prisma.rewardPrediction.upsert({
        where: { participantId_rewardType: { participantId, rewardType } },
        create: { participantId, rewardType, playerId: playerId as string, points: null },
        update: { playerId: playerId as string, teamCode: null, points: null },
        select: { id: true, rewardType: true, playerId: true, updatedAt: true },
      });

      return NextResponse.json(
        {
          message: 'Votre pronostic de récompense a bien été enregistré.',
          prediction,
        },
        { status: 200 }
      );
    }
  } catch (error) {
    console.error(
      "Erreur lors de l'enregistrement du pronostic de récompense :",
      error
    );
    return NextResponse.json(
      { error: ERROR_MESSAGES.TECHNICAL_ERROR },
      { status: 500 }
    );
  }
}
