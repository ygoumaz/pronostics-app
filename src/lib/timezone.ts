// Utilitaires de fuseau horaire (tâche 15.1).
//
// Référence : requirements.md - Exigences 3.6 (afficher la date et l'heure de
// Coup_d_envoi dans le fuseau horaire LOCAL du participant) et 12.5 (navigation
// réactive entre journées/tours). design.md - lib/timezone.ts, conversion
// fiable des fuseaux horaires côté client via `date-fns-tz`.
//
// Les instants de Coup_d_envoi sont stockés et sérialisés en UTC (chaîne ISO
// 8601, cf. src/app/api/matches/serialize.ts). Ces helpers convertissent un
// instant UTC vers une représentation lisible dans le fuseau horaire local du
// navigateur, en français.
//
// ⚠️ Sécurité d'hydratation (SSR) : le serveur ne connaît pas le fuseau horaire
// du participant. Le rendu serveur et le rendu client peuvent donc diverger si
// l'on formate une date pendant le rendu. Les composants DOIVENT appeler ces
// helpers APRÈS le montage (par ex. dans un `useEffect`, comme le fait
// `src/components/match-card.tsx`) afin d'éviter toute divergence
// d'hydratation. Les fonctions ci-dessous sont pures et sûres côté client.

import { fr } from 'date-fns/locale';
import { formatInTimeZone } from 'date-fns-tz';

/**
 * Format par défaut : date complète + heure courte, équivalent à
 * `toLocaleString('fr-FR', { dateStyle: 'full', timeStyle: 'short' })`.
 * Exemple : « samedi 11 juin 2026 à 18:00 ».
 */
const DEFAULT_FORMAT = "EEEE d MMMM yyyy 'à' HH:mm";

/**
 * Format compact : date courte + heure. Exemple : « 11/06/2026 18:00 ».
 */
const SHORT_FORMAT = 'dd/MM/yyyy HH:mm';

/**
 * Retourne le fuseau horaire IANA local du navigateur
 * (ex. « Europe/Paris »). Côté serveur, retourne le fuseau de l'environnement
 * d'exécution — à utiliser avec prudence (cf. note d'hydratation ci-dessus).
 */
export function getLocalTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

interface FormatKickoffOptions {
  /** Modèle de format `date-fns` (par défaut : date complète + heure courte). */
  format?: string;
  /**
   * Fuseau horaire IANA cible. Par défaut, le fuseau local du navigateur.
   * Permet de surcharger explicitement (tests, rendu côté serveur maîtrisé).
   */
  timeZone?: string;
}

/**
 * Formate un instant UTC dans le fuseau horaire local, en français.
 *
 * @param utcIso instant de Coup_d_envoi en UTC (chaîne ISO 8601 ou `Date`)
 * @param opts   options de formatage (modèle, fuseau cible)
 * @returns chaîne formatée, ex. « samedi 11 juin 2026 à 18:00 »
 */
export function formatKickoffLocal(
  utcIso: string | Date,
  opts: FormatKickoffOptions = {}
): string {
  const timeZone = opts.timeZone ?? getLocalTimeZone();
  const format = opts.format ?? DEFAULT_FORMAT;
  const instant = typeof utcIso === 'string' ? new Date(utcIso) : utcIso;
  return formatInTimeZone(instant, timeZone, format, { locale: fr });
}

/**
 * Variante compacte de {@link formatKickoffLocal} (date courte + heure).
 *
 * @param utcIso instant de Coup_d_envoi en UTC (chaîne ISO 8601 ou `Date`)
 * @param opts   options de formatage (le modèle par défaut est compact)
 * @returns chaîne formatée, ex. « 11/06/2026 18:00 »
 */
export function formatKickoffShort(
  utcIso: string | Date,
  opts: FormatKickoffOptions = {}
): string {
  return formatKickoffLocal(utcIso, { format: SHORT_FORMAT, ...opts });
}
