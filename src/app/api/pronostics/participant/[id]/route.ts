// Route handler : consultation des pronostics d'un AUTRE participant.
//
// GET /api/pronostics/participant/[id]
//   Retourne les pronostics du participant ciblé, en appliquant la règle de
//   confidentialité (Exigence 6.1, 6.2 / Property 8) :
//   - Avant le coup d'envoi d'un match, le pronostic d'autrui n'est PAS révélé,
//     et l'on ne révèle pas non plus s'il existe ou non.
//   - À partir du coup d'envoi, on révèle les buts prédits du participant pour
//     ce match (ou l'absence de pronostic uniquement pour ce cas).
//
//   Cas particulier : si le participant connecté consulte son PROPRE identifiant,
//   on renvoie tous ses pronostics sans restriction (Exigence 6.3).
//
// Référence : requirements.md - Exigence 6.1, 6.2, 6.3 ; design.md - Property 8.

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { ERROR_MESSAGES } from '@/lib/errors';
import { canViewOthersPronostic } from '@/lib/pronostic-visibility';

interface RouteContext {
  params: { id: string };
}

export async function GET(_request: Request, context: RouteContext) {
  // 1. Authentification requise (401 si pas de session).
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: ERROR_MESSAGES.INVALID_CREDENTIALS },
      { status: 401 }
    );
  }

  const targetParticipantId = context.params.id;
  const isOwn = session.user.id === targetParticipantId;
  const now = new Date();

  try {
    // 2. Vérifier que le participant ciblé existe.
    const target = await prisma.participant.findUnique({
      where: { id: targetParticipantId },
      select: { id: true, displayName: true },
    });
    if (!target) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.TECHNICAL_ERROR },
        { status: 404 }
      );
    }

    // 3. Récupérer les pronostics du participant ciblé avec le coup d'envoi du
    //    match associé (nécessaire pour appliquer la confidentialité).
    const pronostics = await prisma.pronostic.findMany({
      where: { participantId: targetParticipantId },
      select: {
        id: true,
        matchId: true,
        homeGoals: true,
        awayGoals: true,
        points: true,
        match: { select: { kickoffTime: true } },
      },
    });

    // 4. Appliquer la confidentialité (Exigence 6.1, 6.2). Lorsqu'on consulte
    //    ses propres pronostics, tout est visible (Exigence 6.3).
    const visible = pronostics
      .filter(
        (p) => isOwn || canViewOthersPronostic(p.match.kickoffTime, now)
      )
      .map((p) => ({
        id: p.id,
        matchId: p.matchId,
        homeGoals: p.homeGoals,
        awayGoals: p.awayGoals,
        points: p.points,
      }));

    return NextResponse.json(
      {
        participant: { id: target.id, displayName: target.displayName },
        pronostics: visible,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(
      "Erreur lors de la récupération des pronostics du participant :",
      error
    );
    return NextResponse.json(
      { error: ERROR_MESSAGES.TECHNICAL_ERROR },
      { status: 500 }
    );
  }
}
