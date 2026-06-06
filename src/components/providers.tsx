'use client';

// Fournisseurs côté client de l'application.
//
// Référence : design.md - Authentification (NextAuth.js v5). Les hooks client
// de NextAuth (`useSession`, `signOut`) requièrent un `SessionProvider` placé
// au-dessus des composants qui les consomment. Ce composant est volontairement
// minimal et générique afin de rester réutilisable et de ne pas entrer en
// conflit avec d'autres tâches qui pourraient en avoir besoin.

import { SessionProvider } from 'next-auth/react';
import type { ReactNode } from 'react';

export function Providers({ children }: { children: ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
