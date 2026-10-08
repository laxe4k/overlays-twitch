# Overlays Twitch

Overlays Vue.js utilisés pour mes lives Twitch via OBS, hébergés sur [overlays.laxe4k.com](https://overlays.laxe4k.com).

## Pages

| Route | Description |
|-------|-------------|
| `/intro` | Écran d'intro avec compte à rebours |
| `/pause` | Écran de pause |
| `/outro` | Écran de fin de stream |
| `/offline` | Écran hors-ligne |
| `/background` | Fond animé (sans texte) |
| `/background-fixe` | Fond figé après chargement de la couleur |

## Utilisation

Ajouter une **source Navigateur** dans OBS avec l'URL de la route voulue (ex : `https://overlays.laxe4k.com/intro`), en **1920×1080**.

## Stack

- [Vue.js 3](https://vuejs.org/) + TypeScript
- [Vite](https://vite.dev/)
- [GSAP](https://gsap.com/) - animations d'entrée du texte
- [Cider](https://cider.sh/) - couleur dynamique de l'illustration de l'album

## Structure

```
├── src/
│   ├── views/
│   │   ├── IntroView.vue
│   │   ├── PauseView.vue
│   │   ├── OutroView.vue
│   │   ├── OfflineView.vue
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

Copier `.env.example` vers `.env`, puis renseigner le token généré dans Cider via
**Connectivity > Manage External Application Access**. L'adresse IP et le port désignent
l'appareil qui exécute Cider ; pour une connexion locale, garder `127.0.0.1`.

```sh
npm install
npm run dev
```

La couleur `artwork.bgColor` est reçue via le flux Socket.IO de Cider (port `10767` par défaut).
Les couleurs trop sombres sont éclaircies automatiquement ; si Cider est inaccessible ou qu'aucun
token n'est configuré, le fond utilise `#53ac6a`.

> Les variables `VITE_*` sont intégrées au bundle et visibles dans le navigateur. Ne pas utiliser
> un token Cider sur un overlay public ou partagé ; pour Docker, reconstruire l'image après chaque
> modification du fichier `.env`.

## Build & Déploiement

```sh
npm run build
```

Déployé via Docker sur [Dokploy](https://dokploy.com/) :

```sh
docker compose up -d
```
