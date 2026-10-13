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
- Ailleurs (en local, ou hébergé par toi) : sauvegarde dans le `localStorage` du navigateur.
  Pour de vrais comptes hors de Claude, remplace les fonctions de `src/lib/store.ts` par un backend (Supabase, Firebase…).

## Structure

```
src/
  components/ui/      composants shadcn (button, card, select, tabs, toggle-group, table…)
  components/views/   Today, Food, Exercise, Weight, Metabolism
  components/shared.tsx, charts.tsx
  lib/calc.ts         BMR, TDEE, IMC, masse grasse, macros, TDEE adaptatif
  lib/data.ts         aliments, activités (MET), citations
  lib/store.ts        stockage et synchronisation
  index.css           thème (couleurs claires et sombres)
```

Ajouter d'autres composants shadcn : `npx shadcn@latest add dialog` (le fichier `components.json` est déjà configuré).

`scripts/to-artifact.py` transforme `dist/index.html` en page publiable comme artifact claude.ai.
