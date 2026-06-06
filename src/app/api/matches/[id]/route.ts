// Route handler : détail d'un match.
//
// GET /api/matches/[id]
//
// Référence : requirements.md - Exigence 3 (critères 3.8, 3.9, 3.10) ;
// design.md - API Routes (GET /api/matches/[id], Authentifié), Property 20.
//
// Accès : authentifié uniquement (401 sinon). Renvoie 404 si le match
// n'existe pas.

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { ERROR_MESSAGES } from '@/lib/errors';
import { getMatchStatus } from '@/lib/match-status';
import { serializeMatch, type MatchWithResult } from '../serialize';

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  // 1. Authentification (design.md : route authentifiée).
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { error: ERROR_MESSAGES.INVALID_CREDENTIALS },
      { status: 401 }
    );
  }

  try {
    // 2. Lecture du match avec son résultat officiel éventuel.
    const match = (await prisma.match.findUnique({
      where: { id: params.id },
      include: { officialResult: true },
    })) as MatchWithResult | null;

    if (!match) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.MATCH_NOT_AVAILABLE },
        { status: 404 }
      );
    }

    // 3. Résolution des noms d'équipes (limitée aux codes du match).
    const teamNameByCode = await getTeamNamesForMatch(match);

    // 4. Statut (Exigence 3.9 / Property 20) + sérialisation (3.8, 3.10).
    const status = getMatchStatus(
      match.kickoffTime,
      match.officialResult !== null,
      new Date()
    );

    return NextResponse.json(
      { match: serializeMatch(match, { teamNameByCode, status }) },
      { status: 200 }
    );
  } catch (error) {
    console.error('Erreur lors de la récupération du match :', error);
    return NextResponse.json(
      { error: ERROR_MESSAGES.TECHNICAL_ERROR },
      { status: 500 }
    );
  }
}

/** Table code ISO → nom, restreinte aux équipes effectivement présentes. */
async function getTeamNamesForMatch(
  match: MatchWithResult
): Promise<Map<string, string>> {
  const codes = [match.homeTeamCode, match.awayTeamCode].filter(
    (c): c is string => typeof c === 'string'
  );
  if (codes.length === 0) {
    return new Map();
  }
  const teams = await prisma.team.findMany({
    where: { code: { in: codes } },
    select: { code: true, name: true },
  });
  return new Map(teams.map((t) => [t.code, t.name]));
}
