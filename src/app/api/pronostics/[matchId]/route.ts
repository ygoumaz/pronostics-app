// Route handler : saisie / modification d'un pronostic pour un match.
//
// PUT /api/pronostics/[matchId]
//   Corps attendu : { homeGoals: number, awayGoals: number }
//   - Authentification requise (401 sinon).
//   - Validation : chaque score est un entier dans [0, 99] (Exigence 4.1, 4.4),
//     sinon 400 + ERROR_MESSAGES.GOALS_INVALID.
//   - Disponibilité : le match doit exister et avoir des équipes déterminées
//     (homeTeamCode non null) ; sinon 400 + MATCH_NOT_AVAILABLE (Exigence 3.4).
//   - Verrouillage : l'étape du match doit être ouverte (isStageOpen) ; sinon
//     403 + STAGE_LOCKED (Exigence 5.3-5.6).
//   - Upsert sur la contrainte d'unicité (participantId, matchId) : crée ou
//     remplace le pronostic existant (Exigence 4.2, 4.3).
//   - Retourne une confirmation (Exigence 4.5).
//
// Référence : requirements.md - Exigences 4.1-4.5, 5.3-5.6 ; design.md.

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { ERROR_MESSAGES } from '@/lib/errors';
import { validateGoals } from '@/lib/validation';
import { isStageOpen } from '@/lib/lock';

interface RouteContext {
  params: { matchId: string };
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
  const { matchId } = context.params;

  // 2. Parsing du corps de la requête.
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: ERROR_MESSAGES.GOALS_INVALID },
      { status: 400 }
    );
  }

  const { homeGoals, awayGoals } = (body ?? {}) as Record<string, unknown>;

  // 3. Validation des scores : entiers dans [0, 99] (Exigence 4.1, 4.4).
  const goalsValidation = validateGoals(homeGoals, awayGoals);
  if (!goalsValidation.valid) {
    return NextResponse.json({ error: goalsValidation.error }, { status: 400 });
  }
  // À ce stade, homeGoals et awayGoals sont des entiers valides.
  const home = homeGoals as number;
  const away = awayGoals as number;

  try {
    // 4. Récupération du match et de son étape.
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      select: { id: true, stage: true, homeTeamCode: true, awayTeamCode: true },
    });

    // Match inexistant ou équipes non encore déterminées (placeholders de la
    // phase éliminatoire) : pas de saisie possible (Exigence 3.4).
    if (!match || match.homeTeamCode === null || match.awayTeamCode === null) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.MATCH_NOT_AVAILABLE },
        { status: 400 }
      );
    }

    // 5. Vérification du verrouillage de l'étape (Exigence 5.3-5.6).
    const open = await isStageOpen(match.stage);
    if (!open) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.STAGE_LOCKED },
        { status: 403 }
      );
    }

    // 6. Upsert sur la contrainte d'unicité (participantId, matchId).
    //    Crée le pronostic ou remplace les buts existants (Exigence 4.2, 4.3).
    //    Les points sont remis à null : ils seront recalculés à la saisie du
    //    résultat officiel.
    const pronostic = await prisma.pronostic.upsert({
      where: {
        participantId_matchId: { participantId, matchId },
      },
      create: {
        participantId,
        matchId,
        homeGoals: home,
        awayGoals: away,
      },
      update: {
        homeGoals: home,
        awayGoals: away,
        points: null,
      },
      select: {
        id: true,
        matchId: true,
        homeGoals: true,
        awayGoals: true,
        updatedAt: true,
      },
    });

    // 7. Confirmation de la prise en compte du pronostic (Exigence 4.5).
    return NextResponse.json(
      { message: 'Votre pronostic a bien été enregistré.', pronostic },
      { status: 200 }
    );
  } catch (error) {
    console.error("Erreur lors de l'enregistrement du pronostic :", error);
    return NextResponse.json(
      { error: ERROR_MESSAGES.TECHNICAL_ERROR },
      { status: 500 }
    );
  }
}
