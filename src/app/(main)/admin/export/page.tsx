'use client';

// Page : export Excel des pronostics et résultats (Administrateur).
//
// Référence : requirements.md - Exigence 15 (critères 15.1, 15.4, 15.5, 15.7),
// 13.2 (responsive / accessibilité), 17.6 (interface en français) ;
// design.md - (main)/admin/export/page.tsx.
//
// Fonctionnement :
//   - Un bouton « Télécharger l'export Excel » déclenche un GET sur
//     /api/admin/export.
//   - On utilise fetch + Blob plutôt qu'une simple navigation afin de pouvoir
//     détecter les erreurs (403 réservé à l'Administrateur, 500 échec d'export)
//     et afficher un message en français sans quitter la page (Exigences 15.5 /
//     15.7).
//   - En cas de succès, le fichier .xlsx est téléchargé via un lien temporaire ;
//     le nom de fichier (Exigence 15.6) est lu depuis l'en-tête
//     Content-Disposition renvoyé par l'API.
//
// L'autorisation effective est garantie côté serveur par la route (401/403) ;
// cette page se contente de refléter le résultat.

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { ERROR_MESSAGES } from '@/lib/errors';

type Status =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'success' }
  | { kind: 'error'; message: string };

/**
 * Extrait le nom de fichier depuis l'en-tête Content-Disposition, avec une
 * valeur de repli si l'en-tête est absent.
 */
function filenameFromDisposition(header: string | null): string {
  const fallback = 'pronostics-coupe-du-monde-2026.xlsx';
  if (!header) return fallback;
  const match = /filename="?([^"]+)"?/i.exec(header);
  return match?.[1] ?? fallback;
}

export default function AdminExportPage() {
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  async function handleExport() {
    setStatus({ kind: 'loading' });
    try {
      const response = await fetch('/api/admin/export');

      if (!response.ok) {
        let message: string = ERROR_MESSAGES.EXPORT_FAILED;
        if (response.status === 403) {
          message = ERROR_MESSAGES.ADMIN_ONLY;
        } else if (response.status === 401) {
          message = ERROR_MESSAGES.INVALID_CREDENTIALS;
        } else {
          // Tente de lire le message d'erreur renvoyé par l'API (EXPORT_FAILED).
          const data = (await response.json().catch(() => null)) as
            | { error?: string }
            | null;
          if (data?.error) message = data.error;
        }
        setStatus({ kind: 'error', message });
        return;
      }

      // Téléchargement via un Blob : on récupère le nom depuis l'en-tête.
      const filename = filenameFromDisposition(
        response.headers.get('Content-Disposition')
      );
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);

      setStatus({ kind: 'success' });
    } catch {
      setStatus({ kind: 'error', message: ERROR_MESSAGES.EXPORT_FAILED });
    }
  }

  const isLoading = status.kind === 'loading';

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-foreground">
          Export Excel
        </h1>
        <p className="text-sm text-muted-foreground">
          Générez un fichier Excel (.xlsx) contenant tous les pronostics, les
          résultats officiels et le classement complet de tous les
          participants. Le fichier est téléchargé directement dans votre
          navigateur.
        </p>
      </header>

      <Button
        type="button"
        onClick={() => void handleExport()}
        disabled={isLoading}
        aria-busy={isLoading}
        aria-describedby="export-status"
      >
        {isLoading ? 'Génération en cours…' : "Télécharger l'export Excel"}
      </Button>

      <div id="export-status" aria-live="polite">
        {status.kind === 'loading' && (
          <p className="text-sm text-muted-foreground" role="status">
            Génération du fichier Excel… cela peut prendre quelques secondes.
          </p>
        )}
        {status.kind === 'success' && (
          <p className="text-sm text-green-700" role="status">
            Le fichier Excel a été généré et téléchargé.
          </p>
        )}
        {status.kind === 'error' && (
          <p
            role="alert"
            className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          >
            {status.message}
          </p>
        )}
      </div>
    </div>
  );
}
