import Link from 'next/link';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-muted/30 px-4 py-12">
      <div className="w-full max-w-lg space-y-8 text-center">
        {/* Logo / titre */}
        <div className="space-y-2">
          <h1 className="text-4xl font-bold text-foreground sm:text-5xl">
            ⚽ Pronostics CDM 2026
          </h1>
          <p className="text-lg text-muted-foreground">
            Pronostique les matchs de la Coupe du Monde 2026 et affronte tes
            amis au classement !
          </p>
        </div>

        {/* Comment ça marche */}
        <div className="mx-auto max-w-md space-y-3 rounded-lg border border-border bg-card p-6 text-left text-sm text-muted-foreground shadow-sm">
          <p className="font-medium text-foreground">Comment ça marche ?</p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>Crée ton compte et connecte-toi</li>
            <li>Pronostique le score de chaque match avant le coup d&apos;envoi</li>
            <li>Gagne des points : 3 pts score exact, 2 pts bonne différence, 1 pt bonne issue</li>
            <li>Consulte le classement en temps réel et compare-toi à tes amis</li>
          </ul>
        </div>

        {/* Actions principales */}
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/inscription"
            className="inline-flex h-12 w-full items-center justify-center rounded-md bg-primary px-8 text-base font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:w-auto"
          >
            Créer mon compte
          </Link>
          <Link
            href="/connexion"
            className="inline-flex h-12 w-full items-center justify-center rounded-md border border-input bg-background px-8 text-base font-medium text-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:w-auto"
          >
            Se connecter
          </Link>
        </div>

        <p className="text-xs text-muted-foreground">
          Inscriptions ouvertes jusqu&apos;au début de la Journée 1 de la phase
          de groupes.
        </p>
      </div>
    </main>
  );
}
