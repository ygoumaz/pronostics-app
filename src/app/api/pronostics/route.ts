// Route handler : pronostics du participant authentifié.
//
// GET /api/pronostics
//   Retourne l'ensemble des pronostics du participant connecté, quel que soit
//   l'état de verrouillage des matchs (Exigence 6.3 : un participant voit
//   toujours ses propres pronostics).
//
// Référence : requirements.md - Exigence 6.3 ; design.md - API Routes.

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { ERROR_MESSAGES } from '@/lib/errors';

export async function GET() {
  // Authentification requise (401 si pas de session).
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: ERROR_MESSAGES.INVALID_CREDENTIALS },
      { status: 401 }
    );
  }

  try {
    const pronostics = await prisma.pronostic.findMany({
      where: { participantId: session.user.id },
      select: {
        id: true,
        matchId: true,
        homeGoals: true,
        awayGoals: true,
        points: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ pronostics }, { status: 200 });
  } catch (error) {
    console.error('Erreur lors de la récupération des pronostics :', error);
    return NextResponse.json(
      { error: ERROR_MESSAGES.TECHNICAL_ERROR },
      { status: 500 }
    );
  }
}
