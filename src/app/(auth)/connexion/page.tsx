"use client";

// Page de connexion (authentification du participant).
//
// Référence : requirements.md - Exigence 2 (critères 2.1, 2.2, 2.3, 2.6, 2.7),
// 13.2 (responsive / accessibilité), 17.6 (interface en français).
//
// Le formulaire :
//   - valide la présence des champs côté client (Exigence 2.7) ;
//   - appelle NextAuth v5 via `signIn('credentials', …, { redirect: false })`
//     puis interprète le résultat ;
//   - en cas de succès, redirige vers la page calendrier (Exigence 2.1) ;
//   - en cas d'échec, affiche un message en français :
//       * compte temporairement bloqué (Exigence 2.3) ;
//       * identifiants invalides, sans préciser le champ erroné (Exigence 2.2).
//
// NOTE — pas de SessionProvider requis : le helper client `signIn` de
// `next-auth/react` n'a pas besoin du contexte de session (contrairement à
// `useSession`). Aucun wiring de provider n'est donc nécessaire pour cette page.

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ERROR_MESSAGES } from "@/lib/errors";

/** Destination après une connexion réussie (Exigence 2.1). */
const REDIRECT_AFTER_LOGIN = "/calendrier";

/**
 * Détermine le message d'erreur français à partir du résultat renvoyé par
 * `signIn(..., { redirect: false })`.
 *
 * NextAuth v5 (beta) peut exposer le code d'une `CredentialsSignin` de
 * plusieurs façons selon la version : champ `code`, champ `error`, ou
 * paramètre `?code=` / `?error=` dans `url`. Le provider (src/auth.ts) lève une
 * `AccountLockedError` portant le code `AccountLocked` lorsqu'une adresse est
 * temporairement bloquée (Exigence 2.3) ; on mappe ce code vers ACCOUNT_LOCKED
 * et tout autre échec vers INVALID_CREDENTIALS (Exigence 2.2). La détection est
 * volontairement tolérante (recherche de la sous-chaîne « AccountLocked ») pour
 * rester robuste face aux variations de format entre versions.
 */
function mapSignInError(result: {
  error?: string | null;
  code?: string | null;
  url?: string | null;
}): string {
  const haystack = [result.code, result.error, result.url]
    .filter((value): value is string => typeof value === "string")
    .join(" ");

  if (haystack.includes("AccountLocked")) {
    return ERROR_MESSAGES.ACCOUNT_LOCKED;
  }
  return ERROR_MESSAGES.INVALID_CREDENTIALS;
}

export default function ConnexionPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    // Champs obligatoires (Exigence 2.7) — vérification côté client.
    if (email.trim() === "" || password === "") {
      setFormError(ERROR_MESSAGES.FIELDS_REQUIRED);
      return;
    }

    setSubmitting(true);
    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      // `signIn` avec redirect:false renvoie un objet ; en cas d'échec il porte
      // une erreur/code. En l'absence d'objet (cas inattendu) on traite comme
      // un échec générique.
      if (!result || result.error || result.code) {
        setFormError(mapSignInError(result ?? {}));
        return;
      }

      // Succès : ouverture de session et redirection vers le calendrier
      // (Exigence 2.1). `refresh` garantit la prise en compte de la session
      // côté serveur pour les pages protégées.
      router.push(REDIRECT_AFTER_LOGIN);
      router.refresh();
    } catch {
      setFormError(ERROR_MESSAGES.TECHNICAL_ERROR);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-12">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-sm sm:p-8">
        <h1 className="mb-1 text-2xl font-semibold text-foreground">
          Se connecter
        </h1>
        <p className="mb-6 text-sm text-muted-foreground">
          Accédez à vos pronostics de la Coupe du Monde 2026.
        </p>

        {formError && (
          <div
            id="form-error"
            role="alert"
            className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          >
            {formError}
          </div>
        )}

        <form noValidate onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label
              htmlFor="email"
              className="block text-sm font-medium text-foreground"
            >
              Adresse e-mail
            </label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-describedby={formError ? "form-error" : undefined}
              disabled={submitting}
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="password"
              className="block text-sm font-medium text-foreground"
            >
              Mot de passe
            </label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-describedby={formError ? "form-error" : undefined}
              disabled={submitting}
            />
          </div>

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? "Connexion en cours…" : "Se connecter"}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Pas encore de compte ?{" "}
          <Link
            href="/inscription"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Créer un compte
          </Link>
        </p>
      </div>
    </main>
  );
}
