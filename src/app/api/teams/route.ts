// Route handler : liste des équipes participantes.
//
// GET /api/teams
//   - Authentification requise (401 sinon).
//   - Paramètre optionnel `q` : filtre par nom d'équipe (insensible à la casse).
//   - Retourne la liste des équipes triées par nom.

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { ERROR_MESSAGES } from '@/lib/errors';

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: ERROR_MESSAGES.INVALID_CREDENTIALS },
      { status: 401 }
    );
  }

  const { searchParams } = request.nextUrl;
  const q = searchParams.get('q')?.trim() ?? '';

  try {
    const teams = await prisma.team.findMany({
      where: q
        ? { name: { contains: q } }
        : undefined,
      orderBy: { name: 'asc' },
      select: { id: true, name: true, code: true, group: true, flagUrl: true },
    });

    return NextResponse.json({ teams }, { status: 200 });
  } catch (error) {
    console.error('Erreur lors de la récupération des équipes :', error);
    return NextResponse.json(
      { error: ERROR_MESSAGES.TECHNICAL_ERROR },
      { status: 500 }
    );
  }
}
