# Body Ledger

Suivi diététique et sportif : calculs métaboliques, journal alimentaire, entraînements, courbe de poids et objectif calorique adaptatif.

Stack : React 19 · Vite 6 · TypeScript · Tailwind CSS v4 · composants shadcn/ui (Radix) · Recharts · Sonner.

## Lancer en local

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # un seul fichier : dist/index.html
```

## Où sont les données

- Dans claude.ai (artifact) : chaque compte a un espace privé `data/users/<id>/profile`, avec `/days/<date>` et `/foods/<id>`.
- Avec Firebase configuré : connexion Google et synchronisation Firestore dans `users/<uid>`.
- Sans Firebase : sauvegarde dans le `localStorage` de ce navigateur. Les données locales ne sont pas transférées automatiquement lors de la première connexion Google.

## Activer Google

1. Crée un projet Firebase, ajoute une application Web et active **Authentication > Sign-in method > Google**.
2. Crée une base Cloud Firestore et ajoute le domaine de l’application dans **Authentication > Settings > Authorized domains**.
3. Crée `.env.local` à la racine du projet avec la configuration de l’application Web Firebase :

```env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project
VITE_FIREBASE_APP_ID=...
```

Les valeurs `VITE_*` sont intégrées au JavaScript livré au navigateur ; la sécurité des données repose sur les règles Firestore. Le fichier [`firestore.rules`](firestore.rules) limite chaque compte à ses propres documents et vérifie la forme des données de cycle. À publier avec `firebase deploy --only firestore:rules`, ou à coller dans la console Firebase (Firestore → Règles).

Organisation des données (`users/<uid>`) :

| Chemin | Contenu |
| --- | --- |
| `users/<uid>` | profil et réglages : objectifs par type de journée, plan (poids de référence, date cible, rythme), réglages du cycle, ajustements caloriques confirmés |
| `users/<uid>/days/<date>` | repas (dont pré- et post-entraînement), séances, eau, pesée, tour de taille, type de journée (`rest`, `gym`, `run`) |
| `users/<uid>/foods/<id>` | aliments personnels |
| `users/<uid>/cycles/<id>` | règles enregistrées `{ id, start, end }`, uniquement dans le compte connecté (jamais dans le `localStorage`) |

Redémarre le serveur après avoir modifié `.env.local`. Pour GitHub Pages, les mêmes variables doivent être présentes dans l’environnement au moment du build (`npm run deploy`).

## Structure

```
src/
  components/ui/      composants shadcn (button, card, select, tabs, toggle-group, table…)
  components/views/   Today, Food, Exercise, Weight, Cycle, Metabolism
  components/shared.tsx, charts.tsx
  lib/calc.ts         BMR, TDEE, IMC, masse grasse, macros, TDEE adaptatif
  lib/data.ts         aliments, activités (MET), citations
  lib/cycle.ts        cycle : durées, prédictions, phases estimées, poids par cycle
  lib/adjust.ts       bilan calorique sur 3–4 semaines (suggestions, jamais appliquées sans confirmation)
  lib/store.ts        stockage et synchronisation
  index.css           thème (couleurs claires et sombres)
```

Ajouter d'autres composants shadcn : `npx shadcn@latest add dialog` (le fichier `components.json` est déjà configuré).

`scripts/to-artifact.py` transforme `dist/index.html` en page publiable comme artifact claude.ai.
