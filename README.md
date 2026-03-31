# Overlays Twitch

Overlays Vue.js utilisés pour mes lives Twitch via OBS, hébergés sur [overlays.laxe4k.com](https://overlays.laxe4k.com).

## Pages

| Route | Description |
|-------|-------------|
| `/intro` | Écran d'intro avec compte à rebours |
| `/pause` | Écran de pause |
| `/outro` | Écran de fin de stream |
| `/background` | Fond animé (sans texte) |
| `/background-fixe` | Fond figé après chargement de la couleur |

## Utilisation

Ajouter une **source Navigateur** dans OBS avec l'URL de la route voulue (ex : `https://overlays.laxe4k.com/intro`), en **1920×1080**.

## Stack

- [Vue.js 3](https://vuejs.org/) + TypeScript
- [Vite](https://vite.dev/)
- [GSAP](https://gsap.com/) — animations d'entrée du texte
- [MelodyHue](https://melodyhue.com/) — couleur dynamique du fond

## Structure

```
├── src/
│   ├── views/
│   │   ├── IntroView.vue
│   │   ├── PauseView.vue
│   │   ├── OutroView.vue
│   │   ├── BackgroundView.vue
│   │   └── BackgroundFixeView.vue
│   ├── components/
│   │   ├── DotField.vue
│   │   └── OverlayContent.vue
│   ├── composables/
│   │   └── useDotField.ts
│   ├── router/
│   │   └── index.ts
│   └── assets/
│       └── main.css
├── public/
│   └── fonts/
├── Dockerfile
├── docker-compose.yml
└── nginx.conf
```

## Développement

```sh
npm install
npm run dev
```

## Build & Déploiement

```sh
npm run build
```

Déployé via Docker sur [Dokploy](https://dokploy.com/) :

```sh
docker compose up -d
```
