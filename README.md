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
Si Cider ne fournit pas `artwork.bgColor`, la page attend 500 ms avant d'échantillonner l'image de
pochette (le serveur d'image doit autoriser CORS), pour laisser à Cider le temps d'envoyer sa
couleur. Les couleurs trop sombres sont éclaircies automatiquement.

### REST depuis une page HTTPS

Les appels REST de secours à `/api/v1/playback/is-playing` et `/api/v1/playback/now-playing`
envoient le token obligatoire dans l'en-tête `apptoken`. Depuis
`https://overlays.laxe4k.com`, cet en-tête déclenche une prérequête CORS `OPTIONS`. Si la version
de Cider utilisée répond `404` à cette prérequête, le navigateur bloque ensuite le `GET` : il
n'existe pas de correctif frontend sûr qui conserve l'authentification et permette de lire la
réponse. L'API v2 documentée actuellement par Cider conserve également l'en-tête `apptoken` et ne
supprime donc pas cette prérequête.

En cas d'échec du REST Cider, l'overlay essaie aussi le secours local
[SMTC Bridge](https://github.com/nuttylmao/smtc-bridge) sur
`http://127.0.0.1:5000/now-playing`. Il fournit l'état de lecture Windows et la pochette encodée en
base64 ; le code `PlaybackStatus` `4` signifie lecture, `5` pause, et `3` arrêt. L'URL du secours
peut être remplacée avec le paramètre `SMTCBridgeUrl`. SMTC Bridge doit être lancé sur la machine
qui exécute le navigateur OBS. L'overlay cherche en priorité l'identifiant
`CiderCollective.Cider_a6qxe093bx5xj!App`, puis une session dont `source_app_id` contient
`Cider` (sans tenir compte de la casse) ; il n'utilise pas les sessions d'autres applications.
Cette alternative ne change ni le WebSocket Cider ni son authentification.

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

Le port HTTP `20169` de l'hôte est publié vers le port `80` du conteneur. Dans OBS, utiliser
`http://<adresse-du-serveur>:20169/<route>` (par exemple `http://<adresse-du-serveur>:20169/intro`).
Vérifier également que le pare-feu et, si nécessaire, le routeur autorisent le port TCP `20169`.
