// Layout des pages authentifiées (calendrier, pronostics, classement,
// récompenses, admin).
//
// Référence : requirements.md - Exigences 12.4/12.7 (navigation permanente et
// distinction de l'entrée active), 13.6 (menu responsive), 2.6 (accès protégé),
// 2.4 (déconnexion). design.md - Structure du projet : groupe de routes
// `(main)`.
//
// Composant serveur : il lit la session via `auth()` pour déterminer le rôle
// administrateur et le nom affiché, puis délègue le rendu interactif au
// composant client <MainNav />. Le contrôle d'accès primaire est assuré par le
// middleware (redirection vers /connexion si non authentifié) ; on applique ici
// une vérification défensive supplémentaire.

import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';

import { auth } from '@/auth';
import { Providers } from '@/components/providers';
import { MainNav } from '@/components/main-nav';

export default async function MainLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await auth();

  // Défense en profondeur : le middleware redirige déjà les visiteurs non
  // authentifiés, mais on protège aussi le rendu serveur.
  if (!session?.user) {
    redirect('/connexion');
  }

  const isAdmin = session.user.isAdmin ?? false;
  const displayName = session.user.name ?? null;

  return (
    <Providers>
      <div className="flex min-h-screen flex-col">
        <MainNav isAdmin={isAdmin} displayName={displayName} />
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
          {children}
        </main>
      </div>
    </Providers>
  );
}
