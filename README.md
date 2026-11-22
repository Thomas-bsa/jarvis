# Centrale — révisions + assistant vocal

**Ouvrir :** https://thomas-bsa.github.io/jarvis/

Version web autonome de Centrale (cartes de révision type Anki, classeur de cours, tableau de bord) avec l'assistant vocal Jarvis qui organise le planning.

- Données : enregistrées dans le navigateur (localStorage + IndexedDB). Au premier lancement, le site charge `data/centrale.json` (cartes et progression au 22/11/2026).
- Fichiers de cours et schémas : `blob/`.
- Voix : Web Speech API du navigateur. Dates en français : [chrono-node](https://github.com/wanasit/chrono) (MIT), dans `vendor/`.
- Option : clé Gemini gratuite (Google AI Studio) pour les phrases libres et la génération de cartes depuis un PDF.

Cette branche `gh-pages` contient uniquement le site statique ; l'application Next.js est sur `main`.
