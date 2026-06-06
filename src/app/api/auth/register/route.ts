// Route handler de création de compte (inscription).
//
// Référence : requirements.md - Exigence 1 (critères 1.1 à 1.11) ;
// design.md - API Routes (POST /api/auth/register) et gestion des transactions.
//
// Le handler reste volontairement mince : il parse le corps JSON, exécute les
// validations pures, vérifie l'ouverture des inscriptions, puis crée le
// participant (unicité de l'e-mail + hachage bcrypt coût 12) dans une
// transaction Prisma.

import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { ERROR_MESSAGES } from '@/lib/errors';
import { validateRegistration } from '@/lib/validation';
import { isRegistrationOpen } from '@/lib/registration';
import { hashPassword } from '@/lib/password';

export async function POST(request: NextRequest) {
  // 1. Parsing du corps de la requête.
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: ERROR_MESSAGES.TECHNICAL_ERROR },
      { status: 500 }
    );
  }

  const { email, displayName, password, passwordConfirmation } =
    (body ?? {}) as Record<string, unknown>;

  // 2. Validation des entrées (e-mail, nom d'affichage, mot de passe,
  // confirmation). Exigence 1.1, 1.3, 1.4, 1.6, 1.7.
  const validation = validateRegistration({
    email,
    displayName,
    password,
    passwordConfirmation,
  });
  if (!validation.valid) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  // À ce stade, la validation garantit que ces champs sont des chaînes.
  const normalizedEmail = (email as string).trim().toLowerCase();
  const cleanDisplayName = (displayName as string).trim();
  const plainPassword = password as string;

  try {
    // 3. Vérification de la fermeture des inscriptions (Exigence 1.10 /
    // Property 10) : calculée directement depuis les données match/résultat.
    const open = await isRegistrationOpen();
    if (!open) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.REGISTRATION_CLOSED },
        { status: 403 }
      );
    }

    // 4. Hachage du mot de passe (bcrypt coût 12). Exigence 1.5.
    const passwordHash = await hashPassword(plainPassword);

    // 5. Vérification d'unicité de l'e-mail + création dans une transaction.
    // Exigence 1.2, 1.1. La contrainte @unique sert de garde-fou contre les
    // courses concurrentes (capturée via l'erreur P2002 ci-dessous).
    const participant = await prisma.$transaction(async (tx) => {
      const existing = await tx.participant.findUnique({
        where: { email: normalizedEmail },
        select: { id: true },
      });
      if (existing) {
        throw new EmailTakenError();
      }
      return tx.participant.create({
        data: {
          email: normalizedEmail,
          displayName: cleanDisplayName,
          passwordHash,
        },
        select: { id: true, email: true, displayName: true, createdAt: true },
      });
    });

    // 6. Confirmation de la création du compte. Exigence 1.8.
    return NextResponse.json(
      {
        message: 'Votre compte a bien été créé.',
        participant,
      },
      { status: 201 }
    );
  } catch (error) {
    // E-mail déjà utilisé : détecté explicitement ou via la contrainte unique.
    if (
      error instanceof EmailTakenError ||
      (error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002')
    ) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.EMAIL_TAKEN },
        { status: 409 }
      );
    }

    // Toute autre erreur est traitée comme une erreur technique. Exigence 1.9.
    console.error('Erreur lors de la création du compte :', error);
    return NextResponse.json(
      { error: ERROR_MESSAGES.TECHNICAL_ERROR },
      { status: 500 }
    );
  }
}

/** Erreur interne signalant un e-mail déjà associé à un compte existant. */
class EmailTakenError extends Error {
  constructor() {
    super('EMAIL_TAKEN');
    this.name = 'EmailTakenError';
  }
}
