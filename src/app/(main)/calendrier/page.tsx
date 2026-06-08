// Page calendrier des matchs (composant serveur).
//
// Référence : requirements.md - Exigence 3.6/3.7 (liste triée, équipes, heure
// locale), 3.8/3.9/3.10 (détail, statut, résultat), 12.1-12.8 (navigation par
// journée/tour), 13.3 (drapeaux intégrés, responsive). design.md -
// (main)/calendrier/page.tsx, components/{match-card,navigation-stages}.tsx.
//
// Ce composant serveur charge l'ensemble des matchs une seule fois (lecture
// directe en base, sans appel réseau externe — Exigence 3.1/3.2), les trie et
// les sérialise exactement comme la route GET /api/matches, puis délègue la
// navigation interactive par étape au composant client <CalendrierView />
// (changement d'étape sans rechargement, Exigence 12.4/12.5).
//
// L'accès est protégé par le middleware et le layout (main) ; une vérification
// défensive supplémentaire est appliquée ici.

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowRight } from 'lucide-react';

import { Button } from '@/components/ui/button';

import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { compareMatches } from '@/lib/match-sort';
import { getMatchStatus } from '@/lib/match-status';
import {
  serializeMatch,
  type MatchWithResult,
  type SerializedMatch,
} from '@/app/api/matches/serialize';
import { CalendrierView } from '@/components/calendrier-view';

// Données dynamiques : le statut des matchs dépend de l'heure courante.
export const dynamic = 'force-dynamic';

async function getSerializedMatches(): Promise<SerializedMatch[]> {
  const [matches, teams] = await Promise.all([
    prisma.match.findMany({ include: { officialResult: true } }) as Promise<
      MatchWithResult[]
    >,
    prisma.team.findMany({ select: { code: true, name: true } }),
  ]);

  const teamNameByCode = new Map(teams.map((t) => [t.code, t.name]));
  const now = new Date();

  return [...matches].sort(compareMatches).map((match) =>
    serializeMatch(match, {
      teamNameByCode,
      status: getMatchStatus(
        match.kickoffTime,
        match.officialResult !== null,
        now
      ),
    })
  );
}

export default async function CalendrierPage() {
  // Défense en profondeur (Exigence 2.6) — le middleware/layout protègent déjà.
  const session = await auth();
  if (!session?.user) {
    redirect('/connexion');
  }

  // Les admins sont redirigés vers la page de saisie des résultats.
  if (session.user.isAdmin) {
    redirect('/admin/resultats');
  }

  const matches = await getSerializedMatches();

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Calendrier</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Consultez les matchs par journée et par tour. Les horaires sont
            affichés dans votre fuseau horaire local.
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href="/pronostics" className="gap-1.5">
            Mes pronostics
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </header>

      {matches.length === 0 ? (
        <p className="rounded-md border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
          Le calendrier n’est pas encore disponible.
        </p>
      ) : (
        <CalendrierView matches={matches} />
      )}
    </div>
  );
}
