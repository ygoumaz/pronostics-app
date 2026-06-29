// Messages d'erreur en français partagés par l'application.
// Référence : design.md - section "Messages d'erreur en français".

export const ERROR_MESSAGES = {
  // Inscription
  EMAIL_INVALID: "Le format de l'adresse e-mail est invalide.",
  EMAIL_TAKEN: "Cette adresse e-mail est déjà utilisée.",
  PASSWORD_LENGTH: "Le mot de passe doit contenir entre 8 et 64 caractères.",
  PASSWORD_MISMATCH: "Les deux champs mot de passe doivent être identiques.",
  DISPLAY_NAME_INVALID:
    "Le nom d'affichage doit contenir entre 3 et 30 caractères (lettres, chiffres, espaces, tirets ou underscores uniquement).",
  REGISTRATION_CLOSED: "Les inscriptions sont closes.",

  // Connexion
  INVALID_CREDENTIALS: "Identifiants invalides.",
  ACCOUNT_LOCKED:
    "Tentatives de connexion temporairement bloquées. Réessayez dans 15 minutes.",
  FIELDS_REQUIRED: "L'adresse e-mail et le mot de passe sont obligatoires.",

  // Pronostics
  GOALS_INVALID:
    "Veuillez saisir un nombre entier compris entre 0 et 99 pour chaque équipe.",
  STAGE_LOCKED: "Les pronostics de cette étape sont clôturés.",
  MATCH_NOT_AVAILABLE:
    "Ce match n'est pas encore disponible pour la saisie de pronostics.",

  // Résultats
  ADMIN_ONLY: "Cette opération est réservée à l'Administrateur.",
  KICKOFF_NOT_REACHED: "Le coup d'envoi de ce match n'est pas encore atteint.",
  PENALTY_WINNER_REQUIRED:
    "Le vainqueur aux tirs au but doit être sélectionné.",

  // Récompenses
  REWARDS_LOCKED: "Les pronostics de récompenses sont clôturés.",

  // Technique
  TECHNICAL_ERROR: "Une erreur technique est survenue. Veuillez réessayer.",
  GROUP_CALC_FAILED:
    "Le calcul du classement du groupe a échoué. Veuillez vérifier les résultats saisis.",
  KNOCKOUT_PROPAGATION_FAILED:
    "La propagation du vainqueur éliminatoire a échoué. Veuillez vérifier les résultats saisis.",
  EXPORT_FAILED: "L'export a échoué. Veuillez réessayer.",
} as const;

export type ErrorMessageKey = keyof typeof ERROR_MESSAGES;
