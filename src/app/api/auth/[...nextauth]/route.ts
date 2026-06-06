// Route handler NextAuth.js (Auth.js v5) — connexion / déconnexion / session.
//
// Référence : design.md - API Routes (POST /api/auth/[...nextauth]) ;
// requirements.md - Exigence 2.
//
// Toute la configuration vit dans src/auth.ts ; on se contente ici de
// réexporter les handlers GET/POST générés par NextAuth.

import { handlers } from '@/auth';

export const { GET, POST } = handlers;
