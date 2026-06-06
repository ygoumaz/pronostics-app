// Middleware d'authentification (NextAuth.js v5).
//
// Référence : requirements.md - Exigence 2.6 (« TANT QU'un participant n'est
// pas authentifié, LE Système DOIT refuser l'affichage des pages de
// pronostics et de classement et le rediriger vers la page de connexion ») ;
// design.md - NextAuth.js Middleware.
//
// On utilise la configuration de base compatible Edge (src/auth.config.ts) —
// sans le Credentials provider (Prisma/bcrypt) qui n'est pas exécutable sur
// l'Edge Runtime. Le callback `authorized` décide de l'accès ; NextAuth
// redirige automatiquement vers la page `signIn` (/connexion) en cas de refus.

import NextAuth from 'next-auth';
import { authConfig } from '@/auth.config';

export const { auth: middleware } = NextAuth(authConfig);

export default middleware((req) => {
  // La logique d'autorisation/redirection est gérée par le callback
  // `authorized` de authConfig. Aucun traitement supplémentaire requis ici.
  void req;
});

export const config = {
  // Applique le middleware à toutes les routes SAUF :
  //   - les assets statiques Next (_next/static, _next/image)
  //   - le favicon et les fichiers d'images/icônes publics
  // Les routes /api/auth/* et les pages publiques sont gérées (autorisées)
  // par le callback `authorized`.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
