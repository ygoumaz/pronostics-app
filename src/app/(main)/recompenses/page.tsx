// Redirection : les récompenses individuelles sont désormais intégrées dans
// l'onglet « Récompenses » de la page Pronostics.
// Cette page redirige côté serveur pour éviter tout accès direct.

import { redirect } from 'next/navigation';

export default function RecompensesPage() {
  redirect('/pronostics');
}
