// Route handler du résumé statistique des pronostics d'un match.
//
// Référence : requirements.md - Exigence 16 (critères 16.1, 16.2, 16.3, 16.5,
// 16.6) ; design.md - GET /api/stats/[matchId] (Authentifié), Property 18.
//
// GET /api/stats/[matchId] : renvoie le résumé statistique des pronostics d'un
// match dont l'étape est clôturée — nombre total de participants ayant misé et
// liste des scores distincts (« X-Y ») avec leur fréquence, triés par fréquence
// décroissante puis par score en ordre lexicographique croissant.
//
// Le handler reste mince : il authentifie, charge le match puis ses pronostics
// depuis Prisma, et délègue le calcul à la fonction pure
// `aggregatePronosticStats` (src/lib/stats.ts).

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { ERROR_MESSAGES } from '@/lib/errors';
import { isStageOpen } from '@/lib/lock';
import { aggregatePronosticStats, formatScore } from '@/lib/stats';

export async function GET(
  _request: Request,
  { params }: { params: { matchId: string } }
) {
  const { matchId } = params;

  // 1. Authentification obligatoire (Exigence 16 : consultation réservée aux
  // participants connectés).
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { error: ERROR_MESSAGES.INVALID_CREDENTIALS },
      { status: 401 }
    );
  }

  try {
    // 2. Chargement du match pour connaître son étape.
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      select: { id: true, stage: true },
    });

    if (!match) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.MATCH_NOT_AVAILABLE },
        { status: 404 }
      );
    }

    // 3. Les statistiques ne sont exposées que pour les matchs dont l'étape est
    // clôturée (Exigence 16.5 / 16.6). Tant que l'étape est ouverte, on ne
    // révèle rien.
    const stageOpen = await isStageOpen(match.stage);
    if (stageOpen) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.MATCH_NOT_AVAILABLE },
        { status: 403 }
      );
    }

    // 4. Chargement des pronostics du match.
    const pronostics = await prisma.pronostic.findMany({
      where: { matchId },
      select: { participantId: true, homeGoals: true, awayGoals: true },
    });

    // 5. Cas « aucun pronostic » (Exigence 16.6) : pas de résumé, message clair.
    if (pronostics.length === 0) {
      return NextResponse.json(
        {
          matchId,
          total: 0,
          scores: [],
          ownScore: null,
          message: "Aucun pronostic n'a été saisi pour ce match.",
        },
        { status: 200 }
      );
    }

    // 6. Agrégation pure (Exigence 16.1/16.2/16.3, Property 18).
    const summary = aggregatePronosticStats(pronostics);

    // 7. Score du participant connecté, pour permettre à l'interface de le
    // distinguer visuellement (Exigence 16.4). `null` s'il n'a pas pronostiqué.
    const own = pronostics.find((p) => p.participantId === session.user!.id);
    const ownScore = own ? formatScore(own.homeGoals, own.awayGoals) : null;

    return NextResponse.json(
      {
        matchId,
        total: summary.total,
        scores: summary.scores,
        ownScore,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Erreur lors du calcul des statistiques de match :', error);
    return NextResponse.json(
      { error: ERROR_MESSAGES.TECHNICAL_ERROR },
      { status: 500 }
    );
  }
}
