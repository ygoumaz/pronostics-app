// Augmentation des types NextAuth pour exposer l'identifiant et le rôle admin
// sur la session et le token JWT (cf. callbacks dans src/auth.ts).
//
// Référence : requirements.md - Exigence 2.1 ; design.md - Authentification.

import { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      isAdmin: boolean;
    } & DefaultSession['user'];
  }

  // Objet renvoyé par authorize() / présent dans le callback jwt.
  interface User {
    isAdmin?: boolean;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string;
    isAdmin?: boolean;
  }
}
