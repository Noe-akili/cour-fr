# 02 — Créer son premier projet

> **Objectifs**
> - Générer un projet Tauri 2 + Vue 3 + TypeScript avec Yarn.
> - Lancer l'application en développement et comprendre le cycle de rechargement.
> - Produire un premier build.
> - Ajouter Tauri à un projet Vue existant.
> - Écrire et appeler sa première commande Rust.

Sommaire : [← Chapitre précédent](./01-installation.md) · [README](../README.md) · [Chapitre suivant →](./03-anatomie-projet.md)

---

## 1. Générer le projet

Placez-vous dans le dossier parent, puis lancez :

```bash
yarn create tauri-app
```

> 🧭 **Explication.** Cette commande télécharge et exécute `create-tauri-app`, l'utilitaire officiel de génération de projet. Elle ne nécessite aucune installation globale : Yarn récupère la dernière version à la volée. Le CLI pose ensuite une série de questions pour choisir le nom, l'identifiant, le framework frontend et le gestionnaire de paquets.

Le CLI `create-tauri-app` pose une série de questions :

```
? Project name › taurinote
? Identifier › com.tauricours.taurinote
? Choose which language to use for your frontend › TypeScript / JavaScript
? Choose your package manager › yarn
? Choose your UI template › Vue
? Choose your UI flavor › TypeScript
```

> 🧭 **Explication.** Ces lignes montrent les réponses à fournir pour obtenir un projet Vue 3 en TypeScript avec Yarn. Le nom `taurinote` devient le dossier du projet, et l'identifiant `com.tauricours.taurinote` sert de nom système unique à l'application. Les choix `Vue` puis `TypeScript` déterminent le template et les fichiers générés.

> L'**identifier** doit être unique et au format inversé d'un nom de domaine (`com.entreprise.app`). Il sert d'identifiant système sur macOS, iOS, Android et pour les stores. Ne le changez pas après publication.

### Version non interactive

Pour scripter la création (utile en CI ou pour aller plus vite) :

```bash
yarn create tauri-app taurinote \
  --manager yarn \
  --template vue-ts \
  --identifier com.tauricours.taurinote \
  --yes
```

> 🧭 **Explication.** Cette variante passe toutes les réponses en options pour éviter les questions interactives, ce qui est pratique en CI ou dans un script. `--manager yarn` impose Yarn, `--template vue-ts` choisit Vue avec TypeScript, et `--yes` accepte les valeurs restantes par défaut. Vérifiez l'identifiant avant de lancer la commande, car il est difficile à changer ensuite.

Options utiles :

| Option | Valeur |
|---|---|
| `-m, --manager` | `yarn`, `npm`, `pnpm`, `bun`, `cargo` |
| `-t, --template` | `vue-ts`, `vue`, `react-ts`, `svelte-ts`… |
| `--identifier` | Identifiant inverse de domaine |
| `-y, --yes` | Accepte les valeurs par défaut |
| `-f, --force` | Écrase un dossier non vide |
| `--tauri-version` | `1` ou `2` (2 par défaut) |

### Résultat attendu

```
taurinote/
├── .gitignore
├── index.html
├── package.json
├── public/
├── src/
│   ├── App.vue
│   ├── assets/
│   ├── components/
│   ├── main.ts
│   └── vite-env.d.ts
├── src-tauri/
│   ├── .gitignore
│   ├── Cargo.toml
│   ├── build.rs
│   ├── capabilities/
│   │   └── default.json
│   ├── icons/
│   ├── src/
│   │   ├── lib.rs
│   │   └── main.rs
│   └── tauri.conf.json
├── tsconfig.json
├── tsconfig.node.json
└── vite.config.ts
```

> 🧭 **Explication.** Cette arborescence montre les deux moitiés du projet : `src/` contient l'application Vue compilée par Vite, et `src-tauri/` contient la crate Rust, sa configuration et ses permissions. Les fichiers `tauri.conf.json`, `Cargo.toml` et `capabilities/default.json` sont les points d'entrée à connaître. Le dossier `public/` est copié tel quel, tandis que `src/assets/` passe par le pipeline Vite.

Le CLI exécute aussi `yarn install` et crée un dépôt Git si le dossier n'en fait pas partie. Vérifiez :

```bash
cd taurinote
git status
yarn -v
```

> 🧭 **Explication.** Ces commandes vérifient que le projet a bien été créé : vous entrez dans le dossier, `git status` confirme l'initialisation du dépôt et `yarn -v` rappelle la version du gestionnaire. Le CLI exécute normalement `yarn install` et initialise Git automatiquement. Si `git status` échoue, le dépôt n'a pas été créé et vous pouvez l'initialiser vous-même.

---

## 2. Lancer l'application

```bash
yarn tauri dev
```

Ce qui se passe :

1. Tauri lit `src-tauri/tauri.conf.json`.
2. Il exécute `beforeDevCommand` (`yarn dev`) dans un processus séparé.
3. Vite démarre sur `http://localhost:1420`.
4. Tauri attend que `devUrl` réponde.
5. Cargo compile le backend Rust (la première fois : plusieurs minutes).
6. Une fenêtre native s'ouvre, pointant vers le serveur Vite.

```
  VITE v7.x  ready in 312 ms
  ➜  Local:   http://localhost:1420/

  Compiling tauri-app v0.1.0
  Finished dev [unoptimized + debuginfo] target(s) in 1m 42s
  Running `target/debug/tauricours`
```

> 🧭 **Explication.** Cette sortie illustre le démarrage réussi : Vite indique l'URL locale, puis Cargo affiche la compilation de la crate et le lancement du binaire. Les mentions `unoptimized + debuginfo` signifient que le build de développement n'est pas optimisé, ce qui accélère les itérations. La fenêtre native ne s'ouvre qu'après la fin de cette compilation.

> ⚠️ La **première** compilation est longue. Les suivantes sont incrémentales. Ne tuez pas le processus : vous verriez une fenêtre blanche tant que Rust n'a pas fini.

### Cycle de rechargement

| Modification | Comportement |
|---|---|
| Fichier `.vue`, `.ts`, `.css` dans `src/` | HMR Vite, instantané |
| `src-tauri/src/*.rs` | Recompilation Rust + redémarrage de la fenêtre |
| `src-tauri/tauri.conf.json` | Redémarrage |
| `src-tauri/Cargo.toml` | Recompilation |
| `src-tauri/capabilities/*.json` | Rechargement des permissions |

Pour les changements Rust, attendez la fin de la compilation avant d'interagir avec la fenêtre.

### Si le port 1420 est occupé

```bash
lsof -i :1420        # macOS/Linux
# Windows PowerShell : Get-NetTCPConnection -LocalPort 1420
kill <PID>
```

> 🧭 **Explication.** `lsof -i :1420` liste le processus qui occupe le port 1420 ; `kill <PID>` l'arrête en remplaçant `<PID>` par l'identifiant affiché. Sous Windows, la commande PowerShell équivalente est donnée en commentaire. Vous pouvez aussi changer de port, mais il faut alors modifier `vite.config.ts` et `devUrl` dans `tauri.conf.json` de façon cohérente.

Ou modifiez le port **des deux côtés** : `vite.config.ts` et `tauri.conf.json` (`devUrl`).

---

## 3. Le premier code : `greet`

Le template génère déjà un exemple complet. Regardons-le.

### 3.1 Le backend — `src-tauri/src/lib.rs`

```rust
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![greet])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

Décryptage :

- `#[tauri::command]` transforme une fonction Rust en commande appelable depuis le frontend.
- `tauri::generate_handler![greet]` enregistre la commande dans le routeur IPC. **Sans cette ligne, l'appel échoue.**
- `.plugin(tauri_plugin_opener::init())` initialise le plugin `opener` (ouverture de liens).
- `generate_context!()` embarque la configuration, les icônes et les assets.
- `run()` démarre la boucle d'événements native.

### 3.2 Le frontend — `src/App.vue`

```vue
<script setup lang="ts">
import { ref } from "vue";
import { invoke } from "@tauri-apps/api/core";

const greetMsg = ref("");
const name = ref("");

async function greet() {
  // Apprendre plus sur les commandes Tauri :
  // https://v2.tauri.app/develop/calling-rust/
  greetMsg.value = await invoke<string>("greet", { name: name.value });
}
</script>

<template>
  <main class="container">
    <h1>Bienvenue dans Tauri + Vue</h1>

    <form class="row" @submit.prevent="greet">
      <input v-model="name" placeholder="Entrez un nom…" />
      <button type="submit">Saluer</button>
    </form>

    <p v-if="greetMsg">{{ greetMsg }}</p>
  </main>
</template>
```

- `invoke<string>("greet", { name })` : le premier type est le type de retour attendu.
- Le second argument est un objet contenant les paramètres de la commande.
- **Par défaut, les clés JS sont en `camelCase`** et Tauri les convertit en `snake_case` côté Rust. `{ userName: "Ada" }` correspond à `user_name: String`.

### 3.3 Tester

```bash
yarn tauri dev
```

> 🧭 **Explication.** Relancez `yarn tauri dev` après avoir modifié le backend : Tauri recompile la crate Rust et rouvre la fenêtre. Le frontend, lui, est rechargé par Vite sans redémarrage complet. Saisissez un nom dans le champ pour vérifier que l'aller-retour IPC fonctionne.

Saisissez un nom, cliquez sur « Saluer » : le message vient de Rust.

### 3.4 Exercice guidé : modifier la commande

Remplacez la commande par un retour structuré.

`src-tauri/src/lib.rs` :

```rust
use serde::Serialize;

#[derive(Serialize)]
struct Greeting {
    message: String,
    app_version: String,
}

#[tauri::command]
fn greet(name: &str, app: tauri::AppHandle) -> Greeting {
    Greeting {
        message: format!("Bonjour {name} !"),
        app_version: app.package_info().version.to_string(),
    }
}
```

> 🧭 **Explication.** Cet exemple remplace la chaîne de retour par une structure `Greeting` sérialisable en JSON. `#[derive(Serialize)]` permet à Tauri d'envoyer les champs au frontend, et le paramètre `app: tauri::AppHandle` donne accès aux informations de l'application, ici sa version. La commande conserve le nom `greet`, donc seul le type de retour change côté JavaScript.

`src/App.vue` :

```vue
<script setup lang="ts">
import { ref } from "vue";
import { invoke } from "@tauri-apps/api/core";

interface Greeting {
  message: string;
  appVersion: string; // ⚠️ serde garde snake_case par défaut
}

const result = ref<Greeting | null>(null);

async function greet() {
  result.value = await invoke<Greeting>("greet", { name: "Vue" });
}
</script>

<template>
  <button @click="greet">Saluer</button>
  <p v-if="result">{{ result.message }} (v{{ result.app_version }})</p>
</template>
```

> 🧭 **Explication.** Le frontend déclare une interface `Greeting` qui décrit la forme des données attendues, puis stocke le résultat dans une `ref`. L'appel `invoke<Greeting>("greet", { name: "Vue" })` envoie un argument et type la promesse. Notez que l'interface déclare `appVersion` alors que le template lit `app_version` : alignez ces deux noms selon le nommage choisi côté Rust.

> ⚠️ **Piège classique :** `#[derive(Serialize)]` conserve les noms de champs Rust (`app_version`) sauf si vous ajoutez `#[serde(rename_all = "camelCase")]`. Faites ce choix consciemment et documentez-le. Nous y revenons au chapitre 05.

---

## 4. Produire un build

```bash
yarn tauri build
```

Étapes :

1. `beforeBuildCommand` exécute `yarn build` → `dist/`.
2. Cargo compile en mode `release` (plus long, plus optimisé).
3. Tauri empaquette le binaire et les installateurs.

Sorties typiques :

| OS | Fichiers |
|---|---|
| Linux | `src-tauri/target/release/bundle/deb/*.deb`, `rpm/*.rpm`, `appimage/*.AppImage` |
| macOS | `src-tauri/target/release/bundle/dmg/*.dmg`, `macos/*.app` |
| Windows | `src-tauri/target/release/bundle/msi/*.msi`, `nsis/*.exe` |

Le binaire brut se trouve dans `src-tauri/target/release/` (nom du binaire = `productName` ou nom du package).

Pour un build plus rapide (non optimisé) :

```bash
yarn tauri build --debug
```

> 🧭 **Explication.** L'option `--debug` produit un build non optimisé, plus rapide à compiler et plus facile à déboguer. Il ne faut pas le distribuer : les performances et la taille ne sont pas représentatives d'une version de production. Utilisez-le pour tester l'empaquetage sans attendre une compilation release complète.

Pour ne produire qu'un type de paquet :

```bash
yarn tauri build --bundles deb
yarn tauri build --bundles appimage
```

> 🔒 Un build de production ne doit jamais embarquer de DevTools ouverts ni de secrets. Nous verrons la configuration au chapitre 14.

---

## 5. Scripts `package.json`

Le template fournit :

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vue-tsc --noEmit && vite build",
    "preview": "vite preview",
    "tauri": "tauri"
  },
  "dependencies": {
    "vue": "^3.5.13",
    "@tauri-apps/api": "^2",
    "@tauri-apps/plugin-opener": "^2"
  },
  "devDependencies": {
    "@vitejs/plugin-vue": "^5.2.1",
    "@tauri-apps/cli": "^2",
    "typescript": "~5.6.2",
    "vite": "^6.0.3",
    "vue-tsc": "^2.1.10"
  }
}
```

Commandes usuelles :

```bash
yarn dev              # frontend seul (navigateur)
yarn build            # typecheck + build frontend
yarn tauri dev        # app native en dev
yarn tauri build      # app native en production
yarn tauri info       # diagnostic de l'environnement
yarn tauri icon ...   # génération des icônes
yarn tauri add <plugin>
```

`yarn tauri info` est précieux en cas de problème : il affiche les versions de Node, Rust, WebView, les dépendances système et la configuration détectée.

---

## 6. Ajouter Tauri à un projet Vue existant

Vous avez déjà une application Vue 3 + Vite et vous voulez la transformer en app de bureau.

### 6.1 Installer le CLI et l'API

```bash
yarn add -D @tauri-apps/cli@^2
yarn add @tauri-apps/api@^2
```

### 6.2 Initialiser `src-tauri`

```bash
yarn tauri init
```

Réponses :

```
? What is your app name? › Taurinote
? What should the window title be? › Taurinote
? Where are your web assets located? › ../dist
? What is the url of your dev server? › http://localhost:1420
? What is your frontend dev command? › yarn dev
? What is your frontend build command? › yarn build
```

Cela crée `src-tauri/` avec une configuration adaptée.

### 6.3 Configurer Vite

`vite.config.ts` doit exposer un port fixe et ne pas effacer le terminal :

```ts
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
  plugins: [vue()],

  // Tauri attend un port fixe.
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? { protocol: "ws", host, port: 1421 }
      : undefined,
    watch: {
      // Rust gère ses propres rechargements.
      ignored: ["**/src-tauri/**"],
    },
  },

  // Exposer les variables d'environnement Tauri au frontend.
  envPrefix: ["VITE_", "TAURI_ENV_*"],
});
```

> 💡 `strictPort: true` évite le scénario où Vite bascule sur 1421 alors que Tauri attend 1420.

### 6.4 Adapter `tauri.conf.json`

Vérifiez la cohérence :

```json
{
  "build": {
    "beforeDevCommand": "yarn dev",
    "devUrl": "http://localhost:1420",
    "beforeBuildCommand": "yarn build",
    "frontendDist": "../dist"
  }
}
```

### 6.5 Lancer

```bash
yarn tauri dev
```

Si vous voyez une page blanche : ouvrez les DevTools (clic droit → Inspecter, ou `F12` en dev), vérifiez l'URL et la console.

---

## 7. Organisation recommandée dès le départ

Même pour un petit projet, adoptez ces conventions :

```
src/
├── api/            # appels invoke typés, regroupés par domaine
├── components/     # composants réutilisables
├── composables/    # logique Vue réutilisable (useTauriEvent…)
├── router/
├── stores/         # Pinia
├── types/          # types partagés côté front
├── views/
├── App.vue
└── main.ts

src-tauri/src/
├── commands/       # une commande = un fichier ou un module
├── db/             # migrations, accès données
├── error.rs        # type d'erreur sérialisable
├── lib.rs          # assemblage
└── main.rs
```

Cette séparation évite le `lib.rs` de 800 lignes et facilite les tests.

---

## 8. Dépannage express

| Problème | Piste |
|---|---|
| Fenêtre blanche | DevTools, vérifier `devUrl`, erreur Vite |
| `failed to connect to localhost:1420` | Vite n'a pas démarré ; lancer `yarn dev` seul |
| `Command greet not found` | `generate_handler!` incomplet ou faute de nom |
| `invalid args 'name'` | Clé mal nommée (`camelCase` vs `snake_case`) |
| Rebuild Rust permanent | Boucle de watch ; vérifier `server.watch.ignored` |
| `tauri: command not found` | Utiliser `yarn tauri …`, pas `tauri …` |
| Build très long | Normal en release ; `--debug` pour itérer |

---

## À retenir

- `yarn create tauri-app` génère un projet Vue 3 + TS + Tauri 2.
- `yarn tauri dev` orchestre Vite, Cargo et la fenêtre native.
- Le HMR est instantané côté Vue ; Rust déclenche une recompilation.
- Une commande doit être décorée **et** enregistrée dans `generate_handler!`.
- Les arguments passent en `camelCase` depuis JS, les champs Rust restent en `snake_case` sauf `serde(rename_all)`.
- `yarn tauri build` produit les installateurs natifs.

---

## Exercices

1. **Création.** Générez le projet `taurinote` avec le template `vue-ts`, puis lancez-le. Notez le temps de la première compilation.
2. **Commande.** Ajoutez une commande `ping()` qui retourne `"pong"`, et un bouton dans Vue pour l'appeler.
3. **Structuré.** Modifiez `greet` pour retourner `{ message, timestamp }` où `timestamp` est l'heure Unix en secondes côté Rust. Affichez-la formatée dans Vue.
4. **Build.** Produisez un build debug et localisez le binaire généré. Quelle est sa taille ?
5. **Intégration.** Prenez un projet Vue existant et ajoutez-lui Tauri sans utiliser `create-tauri-app`. Listez les fichiers créés.

Solutions : [annexe D](../annexes/d-solutions.md#chapitre-02).

---

[← Chapitre précédent](./01-installation.md) · [README](../README.md) · [Chapitre suivant : anatomie du projet →](./03-anatomie-projet.md)
