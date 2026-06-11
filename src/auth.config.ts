// Configuration NextAuth.js de base, compatible Edge Runtime.
//
// Référence : requirements.md - Exigence 2 (2.5, 2.6) ; design.md -
// Authentification (NextAuth.js v5, middleware).
//
// Ce fichier NE DOIT importer aucune dépendance « Node-only » (Prisma,
// bcrypt...) : il est consommé par le middleware qui s'exécute sur l'Edge
// Runtime. Le Credentials provider (qui utilise Prisma/bcrypt) est ajouté
// uniquement dans src/auth.ts, exécuté côté serveur Node.

import type { NextAuthConfig } from 'next-auth';

/**
 * Durée maximale d'une session, en secondes (Exigence 2.5).
 *
 * Fixée à 7 jours pour éviter les déconnexions intempestives durant
 * la Coupe du Monde. Le token JWT est renouvelé toutes les 24h d'activité
 * (updateAge), ce qui maintient la session active tant que l'utilisateur
 * revient régulièrement.
 */
export const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60; // 7 jours

/**
 * Préfixes de chemins publics, accessibles sans authentification.
 * Tout le reste est protégé (Exigence 2.6).
 */
const PUBLIC_PATH_PREFIXES = ['/connexion', '/inscription'];

function isPublicPath(pathname: string): boolean {
  // Les routes NextAuth (/api/auth/*) sont toujours publiques.
  if (pathname.startsWith('/api/auth')) {
    return true;
  }
  // La page d'accueil reste publique (présentation / point d'entrée).
  if (pathname === '/') {
    return true;
  }
  return PUBLIC_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export const authConfig = {
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,

  // Requis en production derrière un proxy (Fly.io, Vercel, etc.)
  // Fait confiance au header Host transmis par le reverse proxy.
  trustHost: true,

  pages: {
    signIn: '/connexion',
  },

  session: {
    strategy: 'jwt',
    maxAge: SESSION_MAX_AGE_SECONDS,
    updateAge: 24 * 60 * 60, // renouvelle le token toutes les 24h d'activité
  },

  // Le(s) provider(s) réel(s) sont ajoutés dans src/auth.ts (Node runtime).
  providers: [],

  callbacks: {
    /**
     * Contrôle d'accès appliqué par le middleware (Exigence 2.6).
     *
     * - Visiteur non authentifié sur page protégée → redirigé vers /connexion.
     * - Utilisateur authentifié sur page publique (/, /connexion, /inscription)
     *   → redirigé vers /calendrier (évite de revoir la page d'accueil/login).
     * - Utilisateur non-admin sur /admin/* → redirigé vers /calendrier.
     */
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = Boolean(auth?.user);
      const isAdmin = (auth?.user as { isAdmin?: boolean } | undefined)?.isAdmin ?? false;
      const { pathname } = nextUrl;

      // Utilisateur authentifié sur une page publique (accueil, login, inscription)
      // → redirection vers /calendrier.
      if (isLoggedIn && isPublicPath(pathname) && !pathname.startsWith('/api/auth')) {
        return Response.redirect(new URL('/calendrier', nextUrl));
      }

      if (isPublicPath(pathname)) {
        return true;
      }

      // Page protégée : exige une session valide.
      if (!isLoggedIn) {
        return false;
      }

      // Pages admin : accès réservé à l'Administrateur.
      if (pathname.startsWith('/admin') && !isAdmin) {
        return Response.redirect(new URL('/calendrier', nextUrl));
      }

      return true;
    },

    // Persiste l'identifiant et le rôle admin dans le token JWT.
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.isAdmin = (user as { isAdmin?: boolean }).isAdmin ?? false;
      }
      return token;
    },

    // Expose l'identifiant et le rôle admin sur `session.user`.
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.isAdmin = (token.isAdmin as boolean) ?? false;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
