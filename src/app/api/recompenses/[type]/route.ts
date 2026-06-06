// Route handler : saisie / modification d'un pronostic de récompense.
//
// PUT /api/recompenses/[type]
//   Corps attendu : { playerId: string }
//   - Authentification requise (401 sinon).
//   - `type` doit être un RewardType valide ; sinon 400 (Exigence 18.2).
//   - `playerId` doit exister dans la table Player ; sinon 400 (Exigence 18.3).
//   - Verrouillage (Exigences 18.5 / 18.6 / 18.7) : les pronostics de
//     récompenses se clôturent à la clôture de la Journée 1, au même moment que
//     les inscriptions. On réutilise donc `isRegistrationOpen()` comme signal
//     de verrouillage : si les inscriptions sont closes (Journée 1 terminée),
//     les récompenses sont VERROUILLÉES → 403 + REWARDS_LOCKED.
//
//     Remarque sur la réutilisation : la clôture de la Journée 1 est un même
//     événement métier partagé par l'inscription (Exigence 1.10) et les
//     récompenses (Exigences 18.5 / 18.6). `isRegistrationOpen()` calcule cet
//     événement à partir des résultats officiels des matchs GROUP_DAY_1 ; il
//     constitue donc le signal de verrouillage correct ici.
//   - Upsert sur la contrainte d'unicité (participantId, rewardType) : crée ou
//     remplace le pronostic existant (Exigence 18.4). Les points sont remis à
//     null car le vainqueur n'est pas encore (re)désigné.
//   - Retourne une confirmation.
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
  // 1. Authentification requise (401 si pas de session).
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: ERROR_MESSAGES.INVALID_CREDENTIALS },
      { status: 401 }
    );
  }
  const participantId = session.user.id;

  // 2. Validation du type de récompense (Exigence 18.2).
  const { type } = context.params;
  if (!isValidRewardType(type)) {
    return NextResponse.json(
      { error: 'Type de récompense invalide.' },
      { status: 400 }
    );
  }
  const rewardType = type;

  // 3. Parsing du corps de la requête.
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
    // 4. Verrouillage (Exigences 18.5 / 18.6 / 18.7) : si la Journée 1 est
    //    terminée (inscriptions closes), les récompenses sont verrouillées.
    const open = await isRegistrationOpen();
    if (!open) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.REWARDS_LOCKED },
        { status: 403 }
      );
    }

    // 5. Le joueur pronostiqué doit exister dans la liste pré-chargée
    //    (Exigence 18.3).
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

    // 6. Upsert sur la contrainte d'unicité (participantId, rewardType).
    //    Crée le pronostic ou remplace le joueur sélectionné (Exigence 18.4).
    //    Les points sont remis à null : ils seront calculés à la désignation
    //    du vainqueur officiel.
    const prediction = await prisma.rewardPrediction.upsert({
      where: {
        participantId_rewardType: { participantId, rewardType },
      },
      create: {
        participantId,
        rewardType,
        playerId,
      },
      update: {
        playerId,
        points: null,
      },
      select: {
        id: true,
        rewardType: true,
        playerId: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(
      {
        message: 'Votre pronostic de récompense a bien été enregistré.',
        prediction,
      },
      { status: 200 }
    );
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
