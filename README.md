# Overlays Twitch

Pages HTML utilisées comme overlays pour mes lives Twitch via OBS.

## Pages

| Fichier | Description |
|---------|-------------|
| `intro.html` | Écran d'intro avec compte à rebours |
| `pause.html` | Écran de pause |
| `outro.html` | Écran de fin de stream |
| `background.html` | Fond animé seul (sans texte) |

## Utilisation

Ajouter une **source Navigateur** dans OBS avec le chemin local du fichier HTML voulu, en **1920×1080**.

## Structure

```
├── intro.html
├── pause.html
├── outro.html
├── background.html
└── assets/
    ├── css/
    │   └── shared.css
    └── js/
        └── shared.js
```

Les styles et l'animation de fond sont partagés via `shared.css` et `shared.js`.