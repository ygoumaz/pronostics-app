// Route handler : liste des matchs (avec filtrage optionnel par étape).
//
// GET /api/matches[?stage=GROUP_DAY_1]
//
// Référence : requirements.md - Exigence 3 (critères 3.6, 3.7, 3.9, 3.10) ;
// design.md - API Routes (GET /api/matches, Authentifié), Property 5 (tri),
// Property 20 (statut).
//
// Accès : authentifié uniquement (401 sinon).
//
// Le handler reste mince : authentification → lecture des matchs (filtrés par
// étape si demandé) → enrichissement (noms d'équipes, statut) → tri pur via le
// comparateur partagé `compareMatches`.

import { NextRequest, NextResponse } from 'next/server';
import { Stage } from '@prisma/client';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { ERROR_MESSAGES } from '@/lib/errors';
import { compareMatches } from '@/lib/match-sort';
import { getMatchStatus } from '@/lib/match-status';
import { serializeMatch, type MatchWithResult } from './serialize';

/** Ensemble des valeurs d'étape valides (issu de l'enum Prisma). */
const VALID_STAGES = new Set<string>(Object.values(Stage));

export async function GET(request: NextRequest) {
  // 1. Authentification (design.md : route authentifiée).
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { error: ERROR_MESSAGES.INVALID_CREDENTIALS },
      { status: 401 }
    );
  }

  try {
    // 2. Filtrage optionnel par étape. Un paramètre `stage` invalide est
    // rejeté pour éviter une requête silencieusement vide.
    const stageParam = request.nextUrl.searchParams.get('stage');
    if (stageParam !== null && !VALID_STAGES.has(stageParam)) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.TECHNICAL_ERROR },
        { status: 400 }
      );
    }

    const matches = (await prisma.match.findMany({
      where: stageParam ? { stage: stageParam as Stage } : undefined,
      include: { officialResult: true },
    })) as MatchWithResult[];

    // 3. Résolution des noms d'équipes (code ISO → nom affichable).
    const teamNameByCode = await getTeamNameMap();

    // 4. Tri pur (coup d'envoi croissant, puis équipe à domicile alphabétique).
    // Exigence 3.7 / Property 5.
    const sorted = [...matches].sort(compareMatches);

    // 5. Sérialisation + statut (Exigence 3.9 / Property 20).
    const now = new Date();
    const payload = sorted.map((match) =>
      serializeMatch(match, {
        teamNameByCode,
        status: getMatchStatus(
          match.kickoffTime,
          match.officialResult !== null,
          now
        ),
      })
    );

    return NextResponse.json({ matches: payload }, { status: 200 });
  } catch (error) {
    console.error('Erreur lors de la récupération des matchs :', error);
    return NextResponse.json(
      { error: ERROR_MESSAGES.TECHNICAL_ERROR },
      { status: 500 }
    );
  }
}

/** Construit une table code ISO → nom d'équipe pour l'affichage. */
async function getTeamNameMap(): Promise<Map<string, string>> {
  const teams = await prisma.team.findMany({ select: { code: true, name: true } });
  return new Map(teams.map((t) => [t.code, t.name]));
}
