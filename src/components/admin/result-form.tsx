'use client';

// Formulaire administrateur de saisie (et correction) du résultat officiel
// d'un match (composant réutilisable, une instance par match).
//
// Référence : requirements.md - Exigence 7 (critères 7.1 saisie 0-99, 7.2/7.7
// vainqueur aux TAB si nul en éliminatoire, 7.3 correction, 7.5 coup d'envoi
// atteint, 7.6 format des buts, 7.8 confirmation) et 17.6 (message contextuel
// au refus). design.md - components/admin + POST /api/matches/[id]/result.
//
// Comportement :
//   - Pré-remplit les champs avec le Resultat_Officiel existant (cas de
//     correction, Exigence 7.3).
//   - Tant que le Coup_d_envoi n'est pas atteint (status « à venir »), désactive
//     la saisie et affiche la règle contextuelle (Exigence 7.5).
//   - Valide côté client le format des buts via isValidGoalCount/validateGoals
//     (Exigence 7.6) en conservant les valeurs saisies.
//   - Pour un match de la Phase_Eliminatoire dont le score saisi est nul
//     (home === away), exige la sélection du vainqueur aux TAB (Exigence
//     7.2/7.7).
//   - Soumet via POST /api/matches/[id]/result et affiche une confirmation
//     (Exigence 7.8) ou un message d'erreur français selon le statut HTTP
//     (400 GOALS_INVALID/KICKOFF_NOT_REACHED/PENALTY_WINNER_REQUIRED,
//     403 ADMIN_ONLY, 5xx technique).
//
// L'API reste l'autorité finale (re-validation + autorisation admin) ; la
// validation cliente n'est qu'une aide à la saisie.

import { useEffect, useState } from 'react';

import type { SerializedMatch } from '@/app/api/matches/serialize';
import type { PenaltyWinner } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ERROR_MESSAGES } from '@/lib/errors';
import { isValidGoalCount, validateGoals } from '@/lib/validation';
import { cn } from '@/lib/utils';

interface ResultFormProps {
  match: SerializedMatch;
  /** Notifie le parent d'un enregistrement réussi (pour rafraîchir l'état). */
  onSaved?: (
    matchId: string,
    result: {
      homeGoals: number;
      awayGoals: number;
      penaltyWinner: PenaltyWinner | null;
    }
  ) => void;
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

/** Convertit une saisie en nombre de buts si c'est un entier valide, sinon NaN. */
function parseGoals(value: string): number {
  if (!/^\d+$/.test(value.trim())) return NaN;
  return Number(value.trim());
}

export function ResultForm({ match, onSaved }: ResultFormProps) {
  const existing = match.officialResult;
  const isKnockout = match.phase === 'KNOCKOUT';
  // Le Coup_d_envoi est atteint dès que le match n'est plus « à venir »
  // (statut « en cours » ou « terminé ») — Exigence 7.5.
  const kickoffReached = match.status !== 'à venir';

  // Champs contrôlés en chaînes pour conserver une saisie invalide (Exigence 7.6).
  const [home, setHome] = useState<string>(
    existing ? String(existing.homeGoals) : ''
  );
  const [away, setAway] = useState<string>(
    existing ? String(existing.awayGoals) : ''
  );
  const [penaltyWinner, setPenaltyWinner] = useState<PenaltyWinner | ''>(
    existing?.penaltyWinner ?? ''
  );
  const [status, setStatus] = useState<SaveStatus>({ kind: 'idle' });

  // Resynchronise les champs si le résultat existant change (rechargement).
  useEffect(() => {
    setHome(existing ? String(existing.homeGoals) : '');
    setAway(existing ? String(existing.awayGoals) : '');
    setPenaltyWinner(existing?.penaltyWinner ?? '');
  }, [existing]);

  const homeName = sideLabel(match.homeTeam);
  const awayName = sideLabel(match.awayTeam);

  const homeInputId = `result-${match.id}-home`;
  const awayInputId = `result-${match.id}-away`;
  const penaltyName = `result-${match.id}-penalty`;
  const feedbackId = `result-${match.id}-feedback`;

  // Un sélecteur de vainqueur aux TAB est requis pour un match éliminatoire
  // dont le score courant est un nul valide (home === away) — Exigence 7.2/7.7.
  const homeGoalsNum = parseGoals(home);
  const awayGoalsNum = parseGoals(away);
  const isDraw =
    isValidGoalCount(homeGoalsNum) &&
    isValidGoalCount(awayGoalsNum) &&
    homeGoalsNum === awayGoalsNum;
  const requiresPenaltyWinner = isKnockout && isDraw;

  const isSaving = status.kind === 'saving';
  const hasError = status.kind === 'error';
  const disabled = !kickoffReached || isSaving;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!kickoffReached) return;

    // Validation cliente du format des buts (Exigence 7.6).
    const goalsValidation = validateGoals(homeGoalsNum, awayGoalsNum);
    if (!goalsValidation.valid) {
      setStatus({ kind: 'error', message: goalsValidation.error });
      return;
    }

    // Vainqueur aux TAB requis pour un nul éliminatoire (Exigence 7.7).
    if (requiresPenaltyWinner && penaltyWinner === '') {
      setStatus({
        kind: 'error',
        message: ERROR_MESSAGES.PENALTY_WINNER_REQUIRED,
      });
      return;
    }

    setStatus({ kind: 'saving' });

    const payload: {
      homeGoals: number;
      awayGoals: number;
      penaltyWinner?: PenaltyWinner;
    } = {
      homeGoals: homeGoalsNum,
      awayGoals: awayGoalsNum,
    };
    if (requiresPenaltyWinner && penaltyWinner !== '') {
      payload.penaltyWinner = penaltyWinner;
    }

    try {
      const response = await fetch(
        `/api/matches/${encodeURIComponent(match.id)}/result`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
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
        message: data?.message ?? 'Le résultat officiel a été enregistré.',
      });
      onSaved?.(match.id, {
        homeGoals: homeGoalsNum,
        awayGoals: awayGoalsNum,
        penaltyWinner: requiresPenaltyWinner && penaltyWinner !== '' ? penaltyWinner : null,
      });
    } catch {
      setStatus({ kind: 'error', message: ERROR_MESSAGES.TECHNICAL_ERROR });
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3" noValidate>
      {/* Règles contextuelles près des champs (Exigence 17.6) : conditions de
          saisie d'un résultat officiel. */}
      <p className="text-xs leading-relaxed text-muted-foreground">
        <span className="block">
          Saisissez un score entier (0 à 99) pour chaque équipe.
        </span>
        {isKnockout && (
          <span className="block">
            Match à élimination directe : en cas de score nul, désignez le
            vainqueur aux tirs au but.
          </span>
        )}
        <span className="block">
          La saisie n’est possible qu’une fois le coup d’envoi atteint.
        </span>
      </p>

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
            disabled={disabled}
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
            disabled={disabled}
            aria-invalid={hasError}
            aria-describedby={hasError ? feedbackId : undefined}
            className="w-20"
          />
        </div>

        <Button type="submit" disabled={disabled} className="ml-auto">
          {isSaving
            ? 'Enregistrement…'
            : existing
              ? 'Corriger le résultat'
              : 'Enregistrer le résultat'}
        </Button>
      </div>

      {/* Sélecteur de vainqueur aux TAB (Exigence 7.2/7.7), affiché uniquement
          pour un nul en phase éliminatoire. */}
      {requiresPenaltyWinner && (
        <fieldset className="space-y-2 rounded-md border border-border p-3">
          <legend className="px-1 text-xs font-medium text-foreground">
            Vainqueur aux tirs au but
          </legend>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="radio"
                name={penaltyName}
                value="HOME"
                checked={penaltyWinner === 'HOME'}
                onChange={() => setPenaltyWinner('HOME')}
                disabled={disabled}
                className="h-4 w-4"
              />
              {homeName}
            </label>
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="radio"
                name={penaltyName}
                value="AWAY"
                checked={penaltyWinner === 'AWAY'}
                onChange={() => setPenaltyWinner('AWAY')}
                disabled={disabled}
                className="h-4 w-4"
              />
              {awayName}
            </label>
          </div>
        </fieldset>
      )}

      {/* Règle contextuelle de refus si le coup d'envoi n'est pas atteint
          (Exigence 7.5 / 17.6). */}
      {!kickoffReached && (
        <p className="text-sm text-muted-foreground">
          {ERROR_MESSAGES.KICKOFF_NOT_REACHED}
        </p>
      )}

      {/* Retour de saisie : confirmation (7.8) ou erreur (7.5/7.6/7.7/403). */}
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
