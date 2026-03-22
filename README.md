# Overlays Twitch

Pages HTML utilisées comme overlays pour mes lives Twitch via OBS.

## Pages

| Fichier | Description |
|---------|-------------|
| `Pages/intro.html` | Écran d'intro avec compte à rebours |
| `Pages/pause.html` | Écran de pause |
| `Pages/outro.html` | Écran de fin de stream |
| `Pages/background.html` | Fond animé (sans texte) |
| `Pages/background-fixe.html` | Fond figé après chargement de la couleur |

## Utilisation

Ajouter une **source Navigateur** dans OBS avec le chemin local du fichier HTML voulu, en **1920×1080**.

## Structure

```
├── Pages/
│   ├── intro.html
│   ├── pause.html
│   ├── outro.html
│   ├── background.html
│   ├── background-fixe.html
│   └── assets/
│       ├── css/
│       │   └── shared.css
│       └── js/
│           └── shared.js
├── LICENSE
└── README.md
```

Les styles et l'animation de fond sont partagés via `shared.css` et `shared.js`.