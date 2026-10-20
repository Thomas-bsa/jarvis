# Jarvis

Assistant personnel de Thomas (PTSI) : suivi du **travail**, du **sommeil** et du **sport**, et un **bilan vocal chaque soir à 23 h** avec Jarvis.

## Ce que fait l'application

- **Accueil** : trois jauges (travail du jour, nuit dernière, sport de la semaine), le travail des 7 derniers jours, le sommeil moyen.
- **Saisie** : minuteur par matière, ajout de travail après coup, « je me couche » / « je suis réveillé », séances de sport.
- **Jarvis** : bilan du soir à la voix (ou au clavier). Jarvis enregistre lui-même le travail, le sport et l'heure de coucher.
- **Réglages** : objectifs, mode vacances (4 h ou 8 h de travail par jour), notifications.

## Technique

- Next.js 16 (App Router), TypeScript, Tailwind CSS 4.
- Données : Postgres (Supabase) si `POSTGRES_URL` est défini, sinon un fichier local `.data/jarvis.json`. Les tables se créent toutes seules au premier lancement.
- Voix : Web Speech API du navigateur (reconnaissance et synthèse), gratuite.
- Cerveau : Gemini (offre gratuite) si `GEMINI_API_KEY` est défini ; sinon un bilan guidé sans IA.
- Notifications : Web Push (PWA). Les clés sont générées automatiquement et stockées en base.
- Accès protégé par un code choisi à la première visite.

## Variables d'environnement

| Variable | Obligatoire | Rôle |
| --- | --- | --- |
| `POSTGRES_URL` | oui en ligne | Base Supabase (ajoutée automatiquement par l'intégration Supabase de Vercel) |
| `GEMINI_API_KEY` | non | Rend Jarvis vraiment conversationnel |
| `GEMINI_MODEL` | non | Modèle Gemini (par défaut `gemini-2.5-flash`) |

## Notification de 23 h

Un service gratuit (cron-job.org) appelle chaque soir à 23:00, heure de Paris, l'adresse affichée dans **Réglages › Adresse du réveil de 23 h**.

## Développement

```bash
npm install
npm run dev
```
