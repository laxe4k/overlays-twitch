# Overlays Twitch

Overlays Vue.js utilisés pour mes lives Twitch via OBS, hébergés sur [overlays.laxe4k.com](https://overlays.laxe4k.com).

## Pages

| Route              | Description                                 |
| ------------------ | ------------------------------------------- |
| `/intro`           | Écran d'intro avec compte à rebours         |
| `/pause`           | Écran de pause                              |
| `/outro`           | Écran de fin de stream                      |
| `/offline`         | Écran hors-ligne                            |
| `/background`      | Fond animé (sans texte)                     |
| `/background-fixe` | Fond figé après chargement de la couleur    |
| `/couleur`         | Couleur de la pochette en aplat plein écran |

## Utilisation

Ajouter une **source Navigateur** dans OBS avec l'URL de la route voulue, en **1920×1080**.
La couleur est extraite de la pochette fournie par SMTC Bridge, sans connexion directe au lecteur
de musique ni identifiants de service. Le Bridge doit tourner sur la machine qui exécute OBS.
Par défaut, l'overlay interroge `http://127.0.0.1:5000/now-playing`. Pour utiliser une autre
adresse, ajouter `SMTCBridgeUrl` à l'URL de l'overlay, par exemple :
`https://overlays.laxe4k.com/background?SMTCBridgeUrl=http%3A%2F%2F127.0.0.1%3A5000%2Fnow-playing`.
Pour ignorer une ou plusieurs applications, ajouter `excludedApplications` avec leurs noms ou
identifiants `source_app_id`, séparés par des virgules. Par exemple
`?excludedApplications=Brave` ignore les sessions dont l'identifiant contient `Brave`, et
`?excludedApplications=Brave%20%2C%20AppleInc.AppleMusicWin_nzyj5cx40ttqa!App` ignore Brave et
Apple Music. La comparaison ne tient pas compte des majuscules.

## Stack

- [Vue.js 3](https://vuejs.org/) + TypeScript
- [Vite](https://vite.dev/)
- [GSAP](https://gsap.com/) - animations d'entrée du texte
- [SMTC Bridge](https://github.com/nuttylmao/smtc-bridge) - état de lecture Windows et pochette

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

Toutes les secondes, l'overlay lit `/now-playing`, prend la session indiquée par
`current_session_id` (ou, si ce champ manque, une session en lecture avec une pochette) et extrait
la couleur de sa vignette base64. L'extraction regroupe les pixels par couleurs proches, favorise
les tons saturés et éclaircit le résultat pour le rendre visible. Cela fonctionne avec Cider,
Spotify, Apple Music, Deezer, Tidal et tout autre lecteur qui publie sa session via Windows SMTC.
La couleur par défaut, utilisée si aucune pochette exploitable n'est disponible, est `#53ac6a`.

Pour une page servie en HTTPS, le navigateur doit autoriser son accès à l'adresse HTTP locale du
Bridge. SMTC Bridge doit autoriser les requêtes CORS de l'origine de l'overlay.

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
