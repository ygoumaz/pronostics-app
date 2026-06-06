// Configuration NextAuth.js (Auth.js v5) — authentification du participant.
//
// Référence : requirements.md - Exigence 2 (critères 2.1, 2.4, 2.5, 2.6) ;
// design.md - Authentification : NextAuth.js (Auth.js v5) avec Credentials
// provider, sessions JWT, gestion des timeouts.
//
// Ce module étend la configuration de base (src/auth.config.ts, compatible
// Edge) en y ajoutant le Credentials provider qui dépend de Prisma + bcrypt
// (Node runtime uniquement). Il exporte :
//   - handlers : pour le route handler /api/auth/[...nextauth]
//   - auth     : helper de session (composants serveur, route handlers)
//   - signIn / signOut : actions d'authentification

import NextAuth, { CredentialsSignin } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { prisma } from '@/lib/prisma';
import { verifyPassword } from '@/lib/password';
import { checkEmailLockout, recordLoginAttempt } from '@/lib/auth-lockout';
import { authConfig, SESSION_MAX_AGE_SECONDS } from '@/auth.config';

export { SESSION_MAX_AGE_SECONDS };

/**
 * Erreur dédiée au verrouillage de compte (Exigence 2.3). NextAuth v5 expose le
 * `code` d'une `CredentialsSignin` via le paramètre `?error=` de la page de
 * connexion, ce qui permet à l'UI (tâche 11.2) d'afficher le message
 * `ACCOUNT_LOCKED` plutôt que le générique « identifiants invalides ». Le
 * blocage prévaut donc sur la validité des identifiants.
 */
class AccountLockedError extends CredentialsSignin {
  code = 'AccountLocked';
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      // Champs attendus par le formulaire de connexion.
      credentials: {
        email: { label: 'Adresse e-mail', type: 'email' },
        password: { label: 'Mot de passe', type: 'password' },
      },

      /**
       * Vérifie les identifiants soumis. Retourne l'utilisateur en cas de
       * succès, ou `null` en cas d'échec (NextAuth traduit `null` en erreur
       * « identifiants invalides », sans révéler quel champ est erroné —
       * Exigence 2.2). Aucune session n'est ouverte si le retour est `null`.
       *
       * NOTE : la logique de verrouillage de compte (5 échecs → blocage de
       * 15 minutes, Exigence 2.3) est implémentée séparément (tâche 3.6).
       * Point d'extension prévu : vérifier le blocage AVANT le contrôle des
       * identifiants, et enregistrer la tentative (succès/échec) APRÈS, en
       * s'appuyant sur le modèle `LoginAttempt`.
       */
      async authorize(credentials) {
        const email =
          typeof credentials?.email === 'string'
            ? credentials.email.trim().toLowerCase()
            : '';
        const password =
          typeof credentials?.password === 'string' ? credentials.password : '';

        // Champs obligatoires (Exigence 2.7). Défense en profondeur ; la
        // validation primaire est faite côté formulaire/route.
        if (!email || !password) {
          return null;
        }

        // --- Verrouillage de compte (Exigence 2.3) : si l'adresse est
        // temporairement bloquée, rejeter la tentative AVANT tout contrôle des
        // identifiants. Le blocage prévaut sur la validité des identifiants. On
        // lève une erreur dédiée pour que l'UI affiche le message ACCOUNT_LOCKED
        // plutôt que le générique « identifiants invalides ». La tentative est
        // tout de même enregistrée (échec) pour traçabilité ; elle n'incrémente
        // pas le compteur tant que le blocage est actif (cf. isLockedOut). ---
        const lockout = await checkEmailLockout(email);
        if (lockout.locked) {
          await recordLoginAttempt(email, false);
          throw new AccountLockedError();
        }

        const participant = await prisma.participant.findUnique({
          where: { email },
          select: {
            id: true,
            email: true,
            displayName: true,
            passwordHash: true,
            isAdmin: true,
          },
        });

        // Compte inexistant : échec sans divulgation (Exigence 2.2).
        if (!participant) {
          await recordLoginAttempt(email, false);
          return null;
        }

        const valid = await verifyPassword(password, participant.passwordHash);
        if (!valid) {
          await recordLoginAttempt(email, false, participant.id);
          return null;
        }

        // Tentative réussie : enregistrée (success=true), ce qui interrompt la
        // suite d'échecs consécutifs pour les évaluations futures (Exigence 2.3).
        await recordLoginAttempt(email, true, participant.id);

        // Objet utilisateur minimal porté dans le JWT (jamais le hash).
        // Exigence 2.1.
        return {
          id: participant.id,
          email: participant.email,
          name: participant.displayName,
          isAdmin: participant.isAdmin,
        };
      },
    }),
  ],
});
