'use client';

// Formulaire de saisie d'un pronostic pour un match (composant réutilisable).
//
// Référence : requirements.md - Exigences 4.1 (entiers 0-99), 4.2 (modification),
// 4.4 (rejet + conservation des valeurs saisies + message), 4.5 (confirmation),
// 4.6 (pré-remplissage si pronostic existant), 5.7/5.8 (état de verrouillage),
// 10.1-10.6 (affichage résultat + pronostic + points pour match terminé),
// 17.2/17.3 (barème contextuel près des champs). design.md -
// components/pronostic-form.tsx, PUT /api/pronostics/[matchId].
//
// Comportement :
//   - Pré-remplit les champs avec le pronostic existant (Exigence 4.6).
//   - Valide côté client via isValidGoalCount/validateGoals (Exigence 4.4) :
//     en cas d'invalidité, on conserve les valeurs saisies et on affiche le
//     message GOALS_INVALID sans appel réseau.
//   - Soumet via PUT /api/pronostics/[matchId] et affiche une confirmation
//     (Exigence 4.5) ou un message d'erreur français selon le statut HTTP
//     (403 STAGE_LOCKED, 400 GOALS_INVALID/MATCH_NOT_AVAILABLE, 5xx technique).
//   - Quand l'étape est verrouillée (`locked`), les champs sont désactivés et un
//     message indique que les pronostics de l'étape sont clôturés (Exigence 5.x).
//   - Pour un match terminé (officialResult présent), affiche un bloc regroupé :
//     « Mon pronostic » vs « Résultat » + indicateur de réussite (Exigence 10).

import { useEffect, useState } from 'react';

import type { SerializedMatch } from '@/app/api/matches/serialize';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ERROR_MESSAGES } from '@/lib/errors';
import { calculatePoints } from '@/lib/scoring';
import { isValidGoalCount } from '@/lib/validation';
import { cn } from '@/lib/utils';
import { ScoreIndicator } from '@/components/score-indicator';
import { BaremeHint, PointsBreakdown } from '@/components/contextual-rules';

/** Pronostic existant du participant pour ce match. */
export interface ExistingPronostic {
  homeGoals: number;
  awayGoals: number;
  points: number | null;
}

interface PronosticFormProps {
  match: SerializedMatch;
  /** Pronostic déjà enregistré (pour pré-remplissage), ou null. */
  existing: ExistingPronostic | null;
  /** L'étape du match est-elle clôturée ? (Exigence 5.4-5.7). */
  locked: boolean;
  /** Notifie le parent d'un enregistrement réussi (pour rafraîchir l'état). */
  onSaved?: (matchId: string, homeGoals: number, awayGoals: number) => void;
}

type SaveStatus =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'success'; message: string }
  | { kind: 'error'; message: string };

/** Nom affichable d'un côté de match : équipe connue ou emplacement. */
function sideLabel(side: SerializedMatch['homeTeam']): string {
  return side.name ?? side.code ?? side.placeholder ?? 'À déterminer';
}

export function PronosticForm({
  match,
  existing,
  locked,
  onSaved,
}: PronosticFormProps) {
  // Champs contrôlés : on garde des chaînes pour pouvoir conserver une saisie
  // invalide (Exigence 4.4) sans la coercer prématurément en nombre.
  const [home, setHome] = useState<string>(
    existing ? String(existing.homeGoals) : ''
  );
  const [away, setAway] = useState<string>(
    existing ? String(existing.awayGoals) : ''
  );
  const [status, setStatus] = useState<SaveStatus>({ kind: 'idle' });

  // Resynchronise les champs uniquement quand le match change (navigation
  // d'étape), PAS à chaque re-render du parent. Cela évite d'écraser la saisie
  // en cours de l'utilisateur quand il modifie un pronostic existant.
  // Exigence 4.6 : pré-remplissage à l'ouverture du formulaire.
  const matchId = match.id;
  useEffect(() => {
    setHome(existing ? String(existing.homeGoals) : '');
    setAway(existing ? String(existing.awayGoals) : '');
    setStatus({ kind: 'idle' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId]);

  const result = match.officialResult;
  const homeName = sideLabel(match.homeTeam);
  const awayName = sideLabel(match.awayTeam);

  const homeInputId = `prono-${match.id}-home`;
  const awayInputId = `prono-${match.id}-away`;
  const feedbackId = `prono-${match.id}-feedback`;

  // Conversion d'une saisie en nombre de buts si (et seulement si) elle
  // représente un entier valide ; sinon NaN.
  function parseGoals(value: string): number {
    if (!/^\d+$/.test(value.trim())) return NaN;
    return Number(value.trim());
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (locked) return;

    const homeGoals = parseGoals(home);
    const awayGoals = parseGoals(away);

    // Validation côté client (Exigence 4.4) : on conserve les valeurs saisies.
    if (!isValidGoalCount(homeGoals) || !isValidGoalCount(awayGoals)) {
      setStatus({ kind: 'error', message: ERROR_MESSAGES.GOALS_INVALID });
      return;
    }

    setStatus({ kind: 'saving' });

    try {
      const response = await fetch(
        `/api/pronostics/${encodeURIComponent(match.id)}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ homeGoals, awayGoals }),
        }
      );

      const data = (await response.json().catch(() => null)) as
        | { message?: string; error?: string }
        | null;

      if (!response.ok) {
        setStatus({
          kind: 'error',
          message: data?.error ?? ERROR_MESSAGES.TECHNICAL_ERROR,
        });
        return;
      }

      setStatus({
        kind: 'success',
        message: data?.message ?? 'Votre pronostic a bien été enregistré.',
      });
      onSaved?.(match.id, homeGoals, awayGoals);
    } catch {
      setStatus({ kind: 'error', message: ERROR_MESSAGES.TECHNICAL_ERROR });
    }
  }

  // === Match terminé : affichage regroupé résultat + pronostic + points ===
  // (Exigence 10.1-10.6). Pas de saisie possible.
  if (result) {
    const points = existing
      ? calculatePoints(
          { homeGoals: existing.homeGoals, awayGoals: existing.awayGoals },
          { homeGoals: result.homeGoals, awayGoals: result.awayGoals }
        ).totalPoints
      : 0;

    return (
      <div className="space-y-3" aria-label="Résultat et pronostic">
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-md border border-border bg-muted/40 p-3">
            <dt className="text-xs font-medium text-muted-foreground">
              Mon pronostic
            </dt>
            <dd className="mt-1 font-semibold tabular-nums text-foreground">
              {existing
                ? `${existing.homeGoals} – ${existing.awayGoals}`
                : 'Aucun pronostic'}
            </dd>
          </div>
          <div className="rounded-md border border-border bg-muted/40 p-3">
            <dt className="text-xs font-medium text-muted-foreground">
              Résultat
            </dt>
            <dd className="mt-1 font-semibold tabular-nums text-foreground">
              {result.homeGoals} – {result.awayGoals}
            </dd>
          </div>
        </dl>

        {/* Indicateur de réussite uniquement si un pronostic a été enregistré
            (Exigence 10.3). Sans pronostic, le participant marque 0 (Exigence
            10.1) sans présenter de « niveau » trompeur. */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Points obtenus :</span>
          {existing ? (
            <ScoreIndicator points={points} />
          ) : (
            <span className="text-sm font-semibold tabular-nums text-foreground">
              0 point
            </span>
          )}
        </div>

        {/* Décomposition critère par critère des points obtenus, près du
            résultat (Exigence 17.5). Affichée uniquement si un pronostic existe. */}
        {existing && (
          <PointsBreakdown
            pronostic={{
              homeGoals: existing.homeGoals,
              awayGoals: existing.awayGoals,
            }}
            result={{ homeGoals: result.homeGoals, awayGoals: result.awayGoals }}
          />
        )}
      </div>
    );
  }

  // === Match à venir / en cours : formulaire de saisie ===
  const isSaving = status.kind === 'saving';
  const hasError = status.kind === 'error';

  return (
    <form onSubmit={handleSubmit} className="space-y-3" noValidate>
      {/* Barème contextuel à proximité des champs, 3 lignes max (Exigence 17.2/17.3). */}
      <BaremeHint />

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label
            htmlFor={homeInputId}
            className="text-xs font-medium text-foreground"
          >
            {homeName}
          </label>
          <Input
            id={homeInputId}
            type="number"
            inputMode="numeric"
            min={0}
            max={99}
            step={1}
            value={home}
            onChange={(e) => setHome(e.target.value)}
            disabled={locked || isSaving}
            aria-invalid={hasError}
            aria-describedby={hasError ? feedbackId : undefined}
            className="w-20"
          />
        </div>

        <span aria-hidden="true" className="pb-2 text-lg text-muted-foreground">
          –
        </span>

        <div className="flex flex-col gap-1">
          <label
            htmlFor={awayInputId}
            className="text-xs font-medium text-foreground"
          >
            {awayName}
          </label>
          <Input
            id={awayInputId}
            type="number"
            inputMode="numeric"
            min={0}
            max={99}
            step={1}
            value={away}
            onChange={(e) => setAway(e.target.value)}
            disabled={locked || isSaving}
            aria-invalid={hasError}
            aria-describedby={hasError ? feedbackId : undefined}
            className="w-20"
          />
        </div>

        <Button type="submit" disabled={locked || isSaving} className="ml-auto">
          {isSaving ? 'Enregistrement…' : 'Enregistrer'}
        </Button>
      </div>

      {/* Verrouillage : message explicite, saisie impossible (Exigence 5.x). */}
      {locked && (
        <p className="text-sm text-muted-foreground">
          {ERROR_MESSAGES.STAGE_LOCKED}
        </p>
      )}

      {/* Retour de saisie : confirmation (4.5) ou erreur (4.4). */}
      {(status.kind === 'success' || status.kind === 'error') && (
        <p
          id={feedbackId}
          role={status.kind === 'error' ? 'alert' : 'status'}
          className={cn(
            'text-sm',
            status.kind === 'error' ? 'text-destructive' : 'text-green-700'
          )}
        >
          {status.message}
        </p>
      )}
    </form>
  );
}
