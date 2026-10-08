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
| `/couleur` | Couleur Cider en aplat plein écran |

## Utilisation

Ajouter une **source Navigateur** dans OBS avec l'URL de la route voulue, en **1920×1080**.
Le navigateur se connecte directement à Cider. Ajouter son adresse, son port et son token à chaque
URL, par exemple :
`https://overlays.laxe4k.com/background?CiderAdress=127.0.0.1&CiderPort=10767&CiderToken=VOTRE_TOKEN`.
`CiderAddress` (orthographe standard) est aussi accepté à la place de `CiderAdress`.

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

```sh
npm install
npm run dev
```

La couleur `artwork.bgColor` est reçue via le flux Socket.IO de Cider (port `10767` par défaut).
Le WebSocket Socket.IO est la source principale : il fournit la couleur au démarrage, lors des
changements de morceau et à la pause/reprise, avec reconnexion automatique. REST est uniquement
utilisé en secours si le WebSocket échoue ou ne fournit pas l'état initial dans les 2 secondes.
Si Cider ne
fournit pas `artwork.bgColor`, la page échantillonne l'image de pochette (le serveur d'image doit
autoriser CORS). Les couleurs trop sombres sont éclaircies automatiquement.

> Le token dans `CiderToken` est visible dans l'URL, l'historique du navigateur et potentiellement
> les journaux OBS. Utiliser cette URL uniquement dans un navigateur de confiance et révoquer le
> token s'il a été exposé. L'adresse IP doit être joignable depuis l'appareil qui exécute OBS.
> Sans connexion valide ou sans token, la couleur par défaut est `#53ac6a`.

## Build & Déploiement

```sh
npm run build
```

Déployé via Docker sur [Dokploy](https://dokploy.com/) :

```sh
docker compose up -d
```
