# Jarvis — planning vocal

Assistant personnel vocal : tu dis ce que tu as à faire, Jarvis le range dans tes créneaux libres.

**Ouvrir :** https://thomas-bsa.github.io/jarvis/

- Voix : Web Speech API du navigateur (gratuite, aucune clé).
- Compréhension des dates en français : [chrono-node](https://github.com/wanasit/chrono) (MIT), inclus dans `vendor/`.
- Planning : échéance la plus proche d'abord, séances de 90 min max avec pauses, dans les créneaux définis dans Réglages.
- Option : clé Gemini gratuite (Google AI Studio) pour comprendre des phrases plus libres.
- Données : uniquement dans le navigateur (localStorage). Rien n'est envoyé ni stocké dans ce dépôt.

Cette branche `gh-pages` contient seulement le site statique. L'application Next.js est sur `main`.
