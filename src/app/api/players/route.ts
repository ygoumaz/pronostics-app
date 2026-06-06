// Route handler : liste des joueurs pré-chargés (sélecteur de récompenses).
//
// GET /api/players[?q=texte][&limit=50]
//   - Authentification requise (401 sinon).
//   - Retourne les joueurs (id, name, teamCode, position) issus de la table
//     `Player` pré-chargée (Exigence 18.1). Aucun appel réseau externe.
//   - Paramètre optionnel `q` : filtre de recherche insensible à la casse sur
//     le nom du joueur (utilisé par le sélecteur filtrable — Exigence 18.3).
//   - Paramètre optionnel `limit` : borne le nombre de résultats (défaut 50,
//     maximum 200) pour garder la réponse légère côté sélecteur.
//   - Paramètre optionnel `ids` : liste d'identifiants séparés par des virgules.
//     Lorsqu'il est fourni, la réponse ne contient que ces joueurs (utilisé
//     pour résoudre les libellés des pronostics/vainqueurs déjà enregistrés —
//     Exigences 18.12/18.13). `ids` est prioritaire sur `q`.
//
// Sécurité / confidentialité : la réponse ne contient que des données
// publiques de joueurs (aucune donnée de participant). L'accès reste néanmoins
// réservé aux utilisateurs authentifiés, comme les autres routes de données.
//
// Référence : requirements.md - Exigence 18 (critères 18.1, 18.2, 18.3) ;
// design.md - API Routes (données authentifiées).

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { ERROR_MESSAGES } from '@/lib/errors';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

export async function GET(request: NextRequest) {
  // 1. Authentification requise (401 si pas de session).
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { error: ERROR_MESSAGES.INVALID_CREDENTIALS },
      { status: 401 }
    );
  }

  try {
    const params = request.nextUrl.searchParams;

    // 2a. Résolution par identifiants (prioritaire) : utilisée pour pré-afficher
    //     les joueurs déjà pronostiqués / désignés vainqueurs.
    const idsParam = params.get('ids');
    if (idsParam !== null) {
      const ids = idsParam
        .split(',')
        .map((id) => id.trim())
        .filter((id) => id.length > 0)
        .slice(0, MAX_LIMIT);

      const playersByIds = ids.length
        ? await prisma.player.findMany({
            where: { id: { in: ids } },
            select: { id: true, name: true, teamCode: true, position: true },
          })
        : [];

      return NextResponse.json({ players: playersByIds }, { status: 200 });
    }

    // 2b. Filtre de recherche optionnel (insensible à la casse) sur le nom.
    const q = params.get('q')?.trim() ?? '';

    // 3. Limite optionnelle bornée à [1, MAX_LIMIT].
    const limitParam = Number.parseInt(params.get('limit') ?? '', 10);
    const limit = Number.isFinite(limitParam)
      ? Math.min(Math.max(limitParam, 1), MAX_LIMIT)
      : DEFAULT_LIMIT;

    // SQLite ne supporte pas `mode: 'insensitive'` (spécifique à PostgreSQL).
    // Le `contains` de SQLite est déjà insensible à la casse pour les caractères ASCII.
    // Sans recherche active, on ne limite pas les résultats pour afficher tous les joueurs
    // dans le menu déroulant (la BDD est de taille raisonnable pour un groupe d'amis).
    const players = await prisma.player.findMany({
      where: q
        ? { name: { contains: q } }
        : undefined,
      select: { id: true, name: true, teamCode: true, position: true },
      orderBy: [{ name: 'asc' }],
      ...(q ? { take: limit } : {}),
    });

    return NextResponse.json({ players }, { status: 200 });
  } catch (error) {
    console.error('Erreur lors de la récupération des joueurs :', error);
    return NextResponse.json(
      { error: ERROR_MESSAGES.TECHNICAL_ERROR },
      { status: 500 }
    );
  }
}
