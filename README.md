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
Pour que le navigateur se connecte directement à Cider, ajouter son adresse et son port à chaque
URL, par exemple :
`https://overlays.laxe4k.com/background?CiderAdress=127.0.0.1&CiderPort=10767`.
`CiderAddress` (orthographe standard) est aussi accepté. Sans ces paramètres, la configuration
`VITE_CIDER_IP` et `VITE_CIDER_PORT` du build est utilisée.

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
Au démarrage de la page, une lecture REST unique vérifie l'état de lecture et récupère la couleur
du morceau en cours ; le WebSocket prend ensuite le relais pour les changements et la pause. Les
couleurs trop sombres sont éclaircies automatiquement. Si Cider ne fournit pas `artwork.bgColor`,
la page échantillonne l'image de pochette pour en extraire une couleur dominante (le serveur d'image
doit autoriser CORS). Si Cider est inaccessible ou qu'aucun token n'est configuré, le fond utilise
`#53ac6a`.

> Les variables `VITE_*` sont intégrées au bundle et visibles dans le navigateur. Ne pas utiliser
> un token Cider sur un overlay public ou partagé ; l'adresse IP indiquée doit être joignable depuis
> l'appareil qui exécute le navigateur OBS. Pour Docker, reconstruire l'image après chaque
> modification du fichier `.env`.

## Build & Déploiement

```sh
npm run build
```

Déployé via Docker sur [Dokploy](https://dokploy.com/) :

```sh
docker compose up -d
```
