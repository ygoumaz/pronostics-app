// Route handler : état des pronostics de récompenses individuelles.
//
// GET /api/recompenses
//   - Authentification requise (401 sinon).
//   - Retourne :
//       * la liste des 5 types de récompenses (RewardType) ;
//       * les pronostics du participant authentifié (playerId + points si
//         déjà évalués) — Exigence 18.2 / 18.4 ;
//       * les vainqueurs officiels (RewardResult) déjà désignés — Exigence 18.8 ;
//       * l'état de verrouillage des récompenses (locked).
//
// Note de confidentialité (Exigences 18.13 / 18.14) : cette route ne renvoie
// que les pronostics du participant authentifié. La visibilité des pronostics
// des AUTRES participants après clôture est gérée par une route distincte
// (profil / classement), afin de ne pas révéler les pronostics avant clôture.
//
// Référence : requirements.md - Exigence 18 (18.2-18.14) ; design.md.

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { ERROR_MESSAGES } from '@/lib/errors';
import { isRegistrationOpen } from '@/lib/registration';
import { REWARD_TYPES } from '@/lib/reward-types';

export async function GET() {
  // 1. Authentification requise (401 si pas de session).
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: ERROR_MESSAGES.INVALID_CREDENTIALS },
      { status: 401 }
    );
  }
  const participantId = session.user.id;

  try {
    // 2. Récupération en parallèle : pronostics du participant, vainqueurs
    //    officiels, état de verrouillage (clôture Journée 1).
    const [predictions, results, registrationOpen] = await Promise.all([
      prisma.rewardPrediction.findMany({
        where: { participantId },
        select: { rewardType: true, playerId: true, teamCode: true, points: true },
      }),
      prisma.rewardResult.findMany({
        select: { rewardType: true, playerId: true, teamCode: true },
      }),
      isRegistrationOpen(),
    ]);

    // 3. Verrouillage des récompenses : aligné sur la clôture de la Journée 1,
    //    identique à la clôture des inscriptions (Exigences 18.5 / 18.6).
    const locked = !registrationOpen;

    return NextResponse.json(
      {
        rewardTypes: REWARD_TYPES,
        locked,
        predictions,
        results,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Erreur lors de la récupération des récompenses :', error);
    return NextResponse.json(
      { error: ERROR_MESSAGES.TECHNICAL_ERROR },
      { status: 500 }
    );
  }
}
