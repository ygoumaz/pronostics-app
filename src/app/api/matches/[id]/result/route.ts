// Route handler : saisie (et correction) du résultat officiel d'un match.
//
// POST /api/matches/[id]/result
//   Body JSON : { homeGoals: number, awayGoals: number, penaltyWinner?: 'HOME' | 'AWAY' | null }
//
// Référence : requirements.md - Exigence 7 (critères 7.1 à 7.9) et Exigence 8
// (critère 8.1) ; design.md - API Routes (POST /api/matches/[id]/result, Admin),
// Property 12 (validation des buts), Property 15 (autorisation admin).
//
// Accès : ADMINISTRATEUR UNIQUEMENT (Exigence 7.4 / Property 15).
//   - Non authentifié            → 401
//   - Authentifié mais non admin → 403 (ADMIN_ONLY)
// L'autorisation est vérifiée AVANT toute lecture/écriture : aucune donnée n'est
// enregistrée si l'appelant n'est pas l'Administrateur.

import { NextRequest, NextResponse } from 'next/server';
import type { PenaltyWinner } from '@prisma/client';

import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { ERROR_MESSAGES } from '@/lib/errors';
import { validateGoals } from '@/lib/validation';
import { calculatePoints } from '@/lib/scoring';
import { propagateQualifiedTeams } from '@/lib/qualification';
import { canAccessAdminResource } from '@/lib/authorization';

interface ResultRequestBody {
  homeGoals?: unknown;
  awayGoals?: unknown;
  penaltyWinner?: unknown;
}

function isPenaltyWinner(value: unknown): value is PenaltyWinner {
  return value === 'HOME' || value === 'AWAY';
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // 1. Authentification + AUTORISATION ADMIN (Exigence 7.4 / Property 15).
  //    On rejette tout appel non administrateur AVANT toute opération en base,
  //    de sorte qu'aucun Resultat_Officiel ne soit enregistré.
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: ERROR_MESSAGES.INVALID_CREDENTIALS },
      { status: 401 }
    );
  }
  // Autorisation admin modélisée par le helper pur testé (Property 15).
  if (!canAccessAdminResource(session)) {
    return NextResponse.json(
      { error: ERROR_MESSAGES.ADMIN_ONLY },
      { status: 403 }
    );
  }

  const matchId = params.id;

  // 2. Lecture du corps de la requête.
  let body: ResultRequestBody;
  try {
    body = (await request.json()) as ResultRequestBody;
  } catch {
    return NextResponse.json(
      { error: ERROR_MESSAGES.GOALS_INVALID },
      { status: 400 }
    );
  }

  const { homeGoals, awayGoals } = body;

  // 3. Validation du format des buts : entiers dans [0, 99] (Exigence 7.1, 7.6 /
  //    Property 12). Toute valeur manquante, non entière, négative ou > 99 → 400.
  const goalsValidation = validateGoals(homeGoals, awayGoals);
  if (!goalsValidation.valid) {
    return NextResponse.json(
      { error: goalsValidation.error },
      { status: 400 }
    );
  }
  // À ce stade homeGoals/awayGoals sont des entiers valides.
  const home = homeGoals as number;
  const away = awayGoals as number;

  try {
    // 4. Chargement du match cible.
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      select: {
        id: true,
        phase: true,
        groupCode: true,
        kickoffTime: true,
      },
    });

    if (!match) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.MATCH_NOT_AVAILABLE },
        { status: 404 }
      );
    }

    // 5. Coup d'envoi atteint (Exigence 7.5). On conserve l'éventuel résultat
    //    déjà enregistré (rien n'est écrit ici).
    if (Date.now() < match.kickoffTime.getTime()) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.KICKOFF_NOT_REACHED },
        { status: 400 }
      );
    }

    // 6. Vainqueur aux tirs au but en cas de nul en phase éliminatoire
    //    (Exigence 7.2, 7.7). Pour les matchs de groupe ou les scores non nuls,
    //    le penaltyWinner est ignoré et stocké à null.
    const isKnockoutDraw = match.phase === 'KNOCKOUT' && home === away;
    let penaltyWinner: PenaltyWinner | null = null;
    if (isKnockoutDraw) {
      if (!isPenaltyWinner(body.penaltyWinner)) {
        return NextResponse.json(
          { error: ERROR_MESSAGES.PENALTY_WINNER_REQUIRED },
          { status: 400 }
        );
      }
      penaltyWinner = body.penaltyWinner;
    }

    // 7. TRANSACTION (Exigence 7.3, 8.1) : enregistrement/remplacement du
    //    résultat ET recalcul des points de TOUS les pronostics du match dans
    //    une seule transaction atomique. En cas de correction (Exigence 7.3),
    //    l'upsert remplace le résultat précédent et le recalcul remplace toute
    //    valeur de points déjà attribuée pour ce match (Exigence 8.1).
    //
    //    Le recalcul est synchrone et porte sur ~50 pronostics au maximum :
    //    largement sous la limite de 5 secondes de l'Exigence 8.1.
    //
    //    Remarque sur le CLASSEMENT : le classement global est dérivé à la
    //    demande à partir des points (cf. /api/classement). Il n'existe donc
    //    aucun classement stocké à mettre à jour ici ; il sera recalculé
    //    automatiquement à la prochaine consultation.
    await prisma.$transaction(async (tx) => {
      // 7a. Upsert du Resultat_Officiel (création ou remplacement).
      await tx.officialResult.upsert({
        where: { matchId },
        create: {
          matchId,
          homeGoals: home,
          awayGoals: away,
          penaltyWinner,
        },
        update: {
          homeGoals: home,
          awayGoals: away,
          penaltyWinner,
        },
      });

      // 7b. Recalcul des points de tous les pronostics de ce match. Le
      //     vainqueur aux TAB n'entre pas dans le barème : on évalue sur le
      //     score (nul après prolongations le cas échéant — Exigence 8.9/8.10).
      const pronostics = await tx.pronostic.findMany({
        where: { matchId },
        select: { id: true, homeGoals: true, awayGoals: true },
      });

      for (const p of pronostics) {
        const { totalPoints } = calculatePoints(
          { homeGoals: p.homeGoals, awayGoals: p.awayGoals },
          { homeGoals: home, awayGoals: away }
        );
        await tx.pronostic.update({
          where: { id: p.id },
          data: { points: totalPoints },
        });
      }
    });

    // 8. Propagation de la qualification éliminatoire (Exigence 7.9 → Exigence 3)
    //    pour les matchs de phase de groupes uniquement.
    //
    //    DÉCISION D'ORDONNANCEMENT : `propagateQualifiedTeams` ouvre SA PROPRE
    //    transaction. Pour éviter une transaction imbriquée (non supportée
    //    proprement), on l'appelle SÉQUENTIELLEMENT, APRÈS le commit de la
    //    transaction du résultat. Le résultat officiel et le recalcul des points
    //    sont donc déjà durablement enregistrés ; une éventuelle erreur de
    //    qualification ne peut PAS corrompre le résultat sauvegardé. Elle est
    //    capturée et remontée sous forme de GROUP_CALC_FAILED.
    if (match.phase === 'GROUP' && match.groupCode) {
      try {
        await propagateQualifiedTeams(match.groupCode);
      } catch (qualifError) {
        console.error(
          'Échec de la propagation de la qualification du groupe :',
          qualifError
        );
        return NextResponse.json(
          { error: ERROR_MESSAGES.GROUP_CALC_FAILED },
          { status: 500 }
        );
      }
    }

    // 9. Confirmation de l'enregistrement (Exigence 7.8).
    return NextResponse.json(
      {
        message: 'Le résultat officiel a été enregistré.',
        result: {
          matchId,
          homeGoals: home,
          awayGoals: away,
          penaltyWinner,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Erreur lors de l'enregistrement du résultat :", error);
    return NextResponse.json(
      { error: ERROR_MESSAGES.TECHNICAL_ERROR },
      { status: 500 }
    );
  }
}
