"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

// Indicateur de chargement accessible — Exigence 13.7 : toute opération
// dépassant 300 ms doit afficher un indicateur de chargement visuel.
//
// Accessibilité (Exigence 13.4) :
// - role="status" + aria-live="polite" annoncent l'état de chargement aux
//   lecteurs d'écran sans voler le focus.
// - Un libellé textuel (« Chargement… » par défaut) est rendu en classe
//   « sr-only » pour rester perceptible par les technologies d'assistance tout
//   en laissant le spinner purement décoratif (aria-hidden).
// - Le spinner s'appuie sur les jetons de thème (currentColor) afin de garantir
//   un contraste cohérent avec le texte environnant (contraste AA ≥ 3:1 pour les
//   éléments graphiques).

type SpinnerSize = "sm" | "md" | "lg";

const SPINNER_SIZE: Record<SpinnerSize, string> = {
  sm: "h-4 w-4 border-2",
  md: "h-6 w-6 border-2",
  lg: "h-8 w-8 border-[3px]",
};

/** Spinner purement visuel, masqué aux lecteurs d'écran. */
function Spinner({
  size = "md",
  className,
}: {
  size?: SpinnerSize;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-block animate-spin rounded-full border-current border-t-transparent text-muted-foreground",
        SPINNER_SIZE[size],
        className
      )}
    />
  );
}

export interface LoadingIndicatorProps
  extends React.HTMLAttributes<HTMLDivElement> {
  /** Libellé annoncé aux lecteurs d'écran et (si `inline`) affiché à l'écran. */
  label?: string;
  /** Taille du spinner. */
  size?: SpinnerSize;
  /**
   * Variante d'affichage :
   * - `block` (défaut) : conteneur centré, hauteur minimale ≥ 44 px adaptée aux
   *   zones de contenu en cours de chargement.
   * - `inline` : spinner + texte alignés horizontalement, pour les boutons ou
   *   les lignes de statut.
   */
  variant?: "block" | "inline";
}

/**
 * Indicateur de chargement réutilisable et accessible.
 *
 * @example
 * // Zone de contenu (page en cours de chargement)
 * {isLoading && <LoadingIndicator label="Chargement du classement…" />}
 *
 * @example
 * // En ligne, dans un bouton ou une phrase
 * <LoadingIndicator variant="inline" size="sm" label="Enregistrement…" />
 */
const LoadingIndicator = React.forwardRef<HTMLDivElement, LoadingIndicatorProps>(
  (
    { label = "Chargement…", size = "md", variant = "block", className, ...props },
    ref
  ) => {
    if (variant === "inline") {
      return (
        <span
          ref={ref as React.Ref<HTMLSpanElement>}
          role="status"
          aria-live="polite"
          className={cn(
            "inline-flex items-center gap-2 text-sm text-muted-foreground",
            className
          )}
          {...props}
        >
          <Spinner size={size} />
          <span>{label}</span>
        </span>
      );
    }

    return (
      <div
        ref={ref}
        role="status"
        aria-live="polite"
        className={cn(
          "flex min-h-[44px] flex-col items-center justify-center gap-2 py-6 text-sm text-muted-foreground",
          className
        )}
        {...props}
      >
        <Spinner size={size} />
        {/* Texte perceptible par les lecteurs d'écran (Exigence 13.4). */}
        <span className="sr-only">{label}</span>
      </div>
    );
  }
);
LoadingIndicator.displayName = "LoadingIndicator";

/**
 * Hook qui ne signale un état de chargement qu'au-delà d'un délai (300 ms par
 * défaut), conformément à l'Exigence 13.7. Cela évite le « flash » d'un spinner
 * pour les opérations rapides (< 300 ms) tout en garantissant un retour visuel
 * pour les opérations plus lentes.
 *
 * @param isLoading état brut de chargement de l'opération
 * @param delayMs délai avant d'afficher l'indicateur (défaut : 300 ms)
 * @returns `true` uniquement lorsque l'opération charge depuis plus de `delayMs`
 *
 * @example
 * const showSpinner = useDelayedLoading(isLoading);
 * {showSpinner && <LoadingIndicator label="Chargement…" />}
 */
export function useDelayedLoading(isLoading: boolean, delayMs = 300): boolean {
  const [showLoading, setShowLoading] = React.useState(false);

  React.useEffect(() => {
    if (!isLoading) {
      setShowLoading(false);
      return;
    }

    const timer = setTimeout(() => setShowLoading(true), delayMs);
    return () => clearTimeout(timer);
  }, [isLoading, delayMs]);

  return showLoading;
}

export { LoadingIndicator };
