"use client";

// Page d'inscription (création de compte).
//
// Référence : requirements.md - Exigence 1 (critères 1.1, 1.8, 1.9, 1.10),
// 13.2 (responsive / accessibilité), 17.6 (interface en français).
//
// Le formulaire effectue une validation côté client en réutilisant les
// validateurs purs de src/lib/validation.ts (mêmes règles que le serveur),
// affiche les messages d'erreur en français, préserve les données saisies en
// cas d'erreur (Exigence 1.9) et gère la fermeture des inscriptions (1.10).

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  validateEmail,
  validateDisplayName,
  validatePassword,
  validatePasswordConfirmation,
} from "@/lib/validation";

interface FieldErrors {
  email?: string;
  displayName?: string;
  password?: string;
  passwordConfirmation?: string;
}

export default function InscriptionPage() {
  const router = useRouter();

  // Données saisies — conservées telles quelles en cas d'erreur (Exigence 1.9).
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  /** Validation côté client (mêmes règles que le serveur). */
  function validateClient(): FieldErrors {
    const errors: FieldErrors = {};

    const emailResult = validateEmail(email);
    if (!emailResult.valid) errors.email = emailResult.error;

    const displayNameResult = validateDisplayName(displayName);
    if (!displayNameResult.valid) errors.displayName = displayNameResult.error;

    const passwordResult = validatePassword(password);
    if (!passwordResult.valid) errors.password = passwordResult.error;

    const confirmationResult = validatePasswordConfirmation(
      password,
      passwordConfirmation
    );
    if (!confirmationResult.valid)
      errors.passwordConfirmation = confirmationResult.error;

    return errors;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setSuccessMessage(null);

    const errors = validateClient();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          displayName,
          password,
          passwordConfirmation,
        }),
      });

      const data = (await response.json().catch(() => null)) as
        | { message?: string; error?: string }
        | null;

      if (!response.ok) {
        // En cas d'erreur (e-mail déjà pris, inscriptions closes, etc.) on
        // conserve les données saisies et on affiche le message du serveur.
        // Exigence 1.9, 1.10.
        setFormError(
          data?.error ?? "Une erreur technique est survenue. Veuillez réessayer."
        );
        return;
      }

      // Succès : confirmation puis redirection vers la connexion. Exigence 1.8.
      setSuccessMessage(
        data?.message ?? "Votre compte a bien été créé."
      );
      router.push("/connexion");
    } catch {
      setFormError(
        "Une erreur technique est survenue. Veuillez réessayer."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-12">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-sm sm:p-8">
        <h1 className="mb-1 text-2xl font-semibold text-foreground">
          Créer un compte
        </h1>
        <p className="mb-6 text-sm text-muted-foreground">
          Rejoignez les pronostics de la Coupe du Monde 2026.
        </p>

        {successMessage && (
          <div
            role="status"
            className="mb-4 rounded-md border border-green-600/30 bg-green-50 px-4 py-3 text-sm text-green-800"
          >
            {successMessage}
          </div>
        )}

        {formError && (
          <div
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
              aria-invalid={fieldErrors.email ? true : undefined}
              aria-describedby={fieldErrors.email ? "email-error" : undefined}
              disabled={submitting}
            />
            {fieldErrors.email && (
              <p id="email-error" className="text-sm text-destructive">
                {fieldErrors.email}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="displayName"
              className="block text-sm font-medium text-foreground"
            >
              Nom d&apos;affichage
            </label>
            <Input
              id="displayName"
              name="displayName"
              type="text"
              autoComplete="nickname"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              aria-invalid={fieldErrors.displayName ? true : undefined}
              aria-describedby={
                fieldErrors.displayName ? "displayName-error" : undefined
              }
              disabled={submitting}
            />
            {fieldErrors.displayName && (
              <p id="displayName-error" className="text-sm text-destructive">
                {fieldErrors.displayName}
              </p>
            )}
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
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={fieldErrors.password ? true : undefined}
              aria-describedby={
                fieldErrors.password ? "password-error" : undefined
              }
              disabled={submitting}
            />
            {fieldErrors.password && (
              <p id="password-error" className="text-sm text-destructive">
                {fieldErrors.password}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="passwordConfirmation"
              className="block text-sm font-medium text-foreground"
            >
              Confirmation du mot de passe
            </label>
            <Input
              id="passwordConfirmation"
              name="passwordConfirmation"
              type="password"
              autoComplete="new-password"
              value={passwordConfirmation}
              onChange={(e) => setPasswordConfirmation(e.target.value)}
              aria-invalid={fieldErrors.passwordConfirmation ? true : undefined}
              aria-describedby={
                fieldErrors.passwordConfirmation
                  ? "passwordConfirmation-error"
                  : undefined
              }
              disabled={submitting}
            />
            {fieldErrors.passwordConfirmation && (
              <p
                id="passwordConfirmation-error"
                className="text-sm text-destructive"
              >
                {fieldErrors.passwordConfirmation}
              </p>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? "Création en cours…" : "Créer mon compte"}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Déjà inscrit ?{" "}
          <Link
            href="/connexion"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Se connecter
          </Link>
        </p>
      </div>
    </main>
  );
}
