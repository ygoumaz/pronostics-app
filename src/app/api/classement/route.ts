// Route handler du classement global (Exigence 9).
//
// Référence : requirements.md - Exigence 9 (critères 9.1, 9.2, 9.3, 9.4) ;
// design.md - API Routes (GET /api/classement) et module de classement
// (src/lib/ranking.ts, pur et déjà testé).
//
// Le handler charge les participants, l'ensemble des pronostics (avec points)
// et l'ensemble des prédictions de récompenses (avec points), délègue le calcul
// à la fonction pure `calculateRanking`, puis retourne le classement trié.
//
// Sécurité : la réponse ne contient QUE les champs de classement
// (participantId, displayName, totalPoints, rank). Aucun hash de mot de passe
// ni adresse e-mail n'est exposé (les requêtes Prisma sélectionnent
// explicitement les champs minimaux nécessaires).

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { ERROR_MESSAGES } from '@/lib/errors';
import { calculateRanking } from '@/lib/ranking';
import type { Participant, Pronostic, RewardPrediction } from '@/types';

export async function GET() {
  // 1. Authentification requise : aucun classement n'est exposé sans session.
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { error: ERROR_MESSAGES.INVALID_CREDENTIALS },
      { status: 401 }
    );
  }

  try {
    // 2. Chargement des données nécessaires au calcul. On ne sélectionne que
    // les champs réellement utilisés par `calculateRanking` afin de ne jamais
    // charger ni exposer le hash du mot de passe ou l'e-mail.
    const [participants, pronostics, rewardPredictions] = await Promise.all([
      prisma.participant.findMany({
        where: { isAdmin: false },
        select: { id: true, displayName: true },
      }),
      prisma.pronostic.findMany({
        select: { participantId: true, points: true },
      }),
      prisma.rewardPrediction.findMany({
        select: { participantId: true, points: true },
      }),
    ]);

    // 3. Calcul pur du classement (tri par rang croissant, puis nom
    // d'affichage croissant en cas d'égalité — Exigences 9.2 et 9.4).
    // Les lignes Prisma partielles sont adaptées aux types de domaine attendus
    // par la fonction, qui n'utilise que les champs sélectionnés ci-dessus.
    const ranking = calculateRanking(
      participants as unknown as Participant[],
      pronostics as unknown as Pronostic[],
      rewardPredictions as unknown as RewardPrediction[]
    );

    // 4. Réponse : uniquement les champs de classement (Exigence 9.3).
    return NextResponse.json({ ranking }, { status: 200 });
  } catch (error) {
    console.error('Erreur lors du calcul du classement :', error);
    return NextResponse.json(
      { error: ERROR_MESSAGES.TECHNICAL_ERROR },
      { status: 500 }
    );
  }
}
