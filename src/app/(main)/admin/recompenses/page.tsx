// Redirection permanente vers /admin/resultats#Général.
// La gestion des récompenses a été intégrée dans l'onglet « Général »
// de la page de saisie des résultats.

import { redirect } from 'next/navigation';

export default function AdminRecompensesRedirect() {
  redirect('/admin/resultats');
}
