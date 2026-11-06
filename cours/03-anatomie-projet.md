# 03 — Anatomie d'un projet Tauri + Vue

> **Objectifs**
> - Connaître le rôle de chaque fichier généré.
> - Lire et modifier `tauri.conf.json` sans casser le projet.
> - Comprendre `Cargo.toml`, `main.rs`, `lib.rs` et `build.rs`.
> - Savoir où placer les assets, les ressources et les fichiers générés.
> - Configurer une fenêtre et les métadonnées de l'application.

Sommaire : [← Chapitre précédent](./02-premier-projet.md) · [README](../README.md) · [Chapitre suivant →](./04-vue-fondamentaux.md)

---

## 1. Arborescence complète

```
taurinote/
├── .gitignore
├── .vscode/
│   └── extensions.json
├── index.html                  # point d'entrée Vite
├── package.json                # dépendances front + scripts
├── yarn.lock
├── tsconfig.json               # config TypeScript du front
├── tsconfig.node.json          # config TS pour Vite
├── vite.config.ts              # build front, port 1420
├── public/                     # assets copiés tels quels
├── src/                        # application Vue
│   ├── App.vue
│   ├── main.ts
│   ├── assets/
│   ├── components/
│   └── vite-env.d.ts
└── src-tauri/                  # application Rust
    ├── .gitignore
    ├── Cargo.toml              # dépendances Rust
    ├── Cargo.lock              # versions verrouillées (à committer)
    ├── build.rs                # script de build Tauri
    ├── tauri.conf.json         # configuration principale
    ├── capabilities/
    │   └── default.json        # permissions accordées
    ├── icons/                  # icônes de l'app et du tray
    ├── gen/
    │   └── schemas/            # schémas JSON générés (ignorés par Git)
    ├── resources/              # fichiers embarqués (optionnel)
    └── src/
        ├── main.rs             # binaire
        └── lib.rs              # logique de l'app
```

---

## 2. Côté frontend

### 2.1 `index.html`

```html
<!doctype html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Taurinote</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

C'est une page web tout à fait normale. En production, elle sera servie par le protocole interne de Tauri, pas par un serveur.

### 2.2 `src/main.ts`

```ts
import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";
import router from "./router";
import "./assets/main.css";

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.mount("#app");
```

### 2.3 `vite.config.ts`

```ts
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
  plugins: [vue()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: "ws", host, port: 1421 } : undefined,
    watch: { ignored: ["**/src-tauri/**"] },
  },
  envPrefix: ["VITE_", "TAURI_ENV_*"],
  build: {
    // Les WebView modernes supportent ES2021.
    target: process.env.TAURI_ENV_PLATFORM === "windows" ? "chrome105" : "safari13",
    minify: !process.env.TAURI_ENV_DEBUG ? "esbuild" : false,
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
  },
});
```

Variables fournies par Tauri au build :

| Variable | Exemple | Usage |
|---|---|---|
| `TAURI_ENV_PLATFORM` | `linux`, `windows`, `darwin` | Adapter la cible de build |
| `TAURI_ENV_ARCH` | `x86_64`, `aarch64` | Code spécifique architecture |
| `TAURI_ENV_DEBUG` | `true` / `false` | Sourcemaps, minification |
| `TAURI_DEV_HOST` | IP | Développement sur appareil mobile |

### 2.4 `package.json`

Le point important est la séparation :

- `dependencies` : ce qui part dans le bundle frontend (`vue`, `pinia`, `@tauri-apps/api`, plugins JS).
- `devDependencies` : outillage (`vite`, `typescript`, `@tauri-apps/cli`, `vue-tsc`).

Le CLI Tauri est une **devDependency** : il n'est pas embarqué dans l'application finale.

### 2.5 `tsconfig.json`

Le template active le mode strict :

```json
{
  "compilerOptions": {
    "target": "ES2021",
    "useDefineForClassFields": true,
    "module": "ESNext",
    "lib": ["ES2021", "DOM", "DOM.Iterable"],
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "preserve",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src/**/*.ts", "src/**/*.d.ts", "src/**/*.tsx", "src/**/*.vue"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

Le mode strict est recommandé : les données venant de Rust sont désérialisées à l'exécution, et TypeScript ne peut pas les vérifier. Des types explicites limitent les erreurs.

---

## 3. Côté Rust

### 3.1 `src-tauri/Cargo.toml`

```toml
[package]
name = "taurinote"
version = "0.1.0"
description = "Gestionnaire de tâches local-first"
authors = ["Votre nom"]
edition = "2021"

[lib]
# Le suffixe _lib évite un conflit de nom avec le binaire sous Windows.
name = "taurinote_lib"
crate-type = ["staticlib", "cdylib", "rlib"]

[build-dependencies]
tauri-build = { version = "2", features = [] }

[dependencies]
tauri = { version = "2", features = [] }
tauri-plugin-opener = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
```

| Élément | Rôle |
|---|---|
| `[lib] crate-type` | Permet de compiler la même logique en bibliothèque (mobile) et en binaire (desktop) |
| `tauri-build` | Génère le contexte, les schémas et les ressources au build |
| `tauri` | Cœur du framework |
| `serde` / `serde_json` | Sérialisation des données IPC |
| `tauri-plugin-*` | Plugins natifs |

Pour activer le tray :

```toml
tauri = { version = "2", features = ["tray-icon"] }
```

Pour les tests avec un builder simulé :

```toml
[dev-dependencies]
tauri = { version = "2", features = ["test"] }
```

### 3.2 `build.rs`

```rust
fn main() {
    tauri_build::build()
}
```

Ce script :

- lit `tauri.conf.json` ;
- génère les schémas de capabilities dans `gen/schemas/` ;
- compile les ressources et icônes ;
- prépare le contexte utilisé par `generate_context!()`.

Ne le supprimez pas.

### 3.3 `src/main.rs`

```rust
// Empêche l'ouverture d'une console supplémentaire sous Windows en release.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    taurinote_lib::run()
}
```

Le binaire est minimal : toute la logique est dans `lib.rs`, ce qui permet de réutiliser le même code sur mobile.

### 3.4 `src/lib.rs`

```rust
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![greet])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

`run()` est le point d'assemblage :

1. `Builder::default()` : configure l'application.
2. `.plugin(...)` : initialise les plugins (un par ligne).
3. `.manage(...)` : injecte un état partagé (chapitre 05).
4. `.invoke_handler(...)` : enregistre les commandes.
5. `.setup(...)` : exécute du code au démarrage (tray, menus, migrations).
6. `.on_window_event(...)` : réagit aux événements de fenêtre.
7. `.run(...)` : démarre la boucle native.

### 3.5 `src-tauri/.gitignore`

```gitignore
/target/
/gen/schemas
```

`target/` contient des gigaoctets de compilation. `gen/schemas` est régénéré. En revanche, **commitez `Cargo.lock`** pour des builds reproductibles.

---

## 4. `tauri.conf.json` en détail

Fichier central, au format JSON (avec support de commentaires ? **non**, JSON strict).

```json
{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "Taurinote",
  "version": "0.1.0",
  "identifier": "com.tauricours.taurinote",
  "build": {
    "beforeDevCommand": "yarn dev",
    "devUrl": "http://localhost:1420",
    "beforeBuildCommand": "yarn build",
    "frontendDist": "../dist"
  },
  "app": {
    "windows": [
      {
        "label": "main",
        "title": "Taurinote",
        "width": 1100,
        "height": 720,
        "minWidth": 760,
        "minHeight": 520,
        "resizable": true,
        "center": true
      }
    ],
    "security": {
      "csp": null
    }
  },
  "bundle": {
    "active": true,
    "targets": "all",
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ]
  }
}
```

### 4.1 Champs racine

| Champ | Description |
|---|---|
| `productName` | Nom affiché de l'application (peut contenir des espaces) |
| `version` | Version SemVer utilisée par le bundle et l'updater |
| `identifier` | Identifiant unique (reverse-DNS), **ne pas changer après publication** |
| `build` | Intégration avec le frontend |
| `app` | Fenêtres, sécurité, plugins |
| `bundle` | Empaquetage et installateurs |
| `plugins` | Configuration spécifique aux plugins |

### 4.2 `build`

| Champ | Rôle |
|---|---|
| `beforeDevCommand` | Commande lancée avant `tauri dev` (Vite) |
| `beforeBuildCommand` | Commande lancée avant `tauri build` |
| `devUrl` | URL chargée par la WebView en développement |
| `frontendDist` | Dossier des assets compilés (relatif à `src-tauri/`) |
| `features` | Features Cargo activées pour le build (optionnel) |

> ⚠️ `frontendDist` est relatif à `src-tauri/`, pas à la racine. `../dist` est correct pour un projet standard.

### 4.3 `app.windows`

Chaque objet décrit une fenêtre créée au démarrage. Champs fréquents :

| Champ | Défaut | Description |
|---|---|---|
| `label` | `"main"` | Identifiant utilisé par les capabilities et l'IPC |
| `title` | `productName` | Titre de la fenêtre |
| `width`, `height` | 800 × 600 | Taille logique (en pixels) |
| `minWidth`, `minHeight` | — | Taille minimale |
| `maxWidth`, `maxHeight` | — | Taille maximale |
| `resizable` | `true` | Redimensionnable |
| `fullscreen` | `false` | Plein écran au démarrage |
| `decorations` | `true` | Barre de titre native |
| `transparent` | `false` | Fond transparent (macOS/Linux) |
| `alwaysOnTop` | `false` | Toujours au-dessus |
| `center` | `false` | Centrée à l'écran |
| `visible` | `true` | Visible au démarrage |
| `theme` | — | `light`, `dark` ou `system` |
| `url` | — | Route/URL à charger |
| `titleBarStyle` | `"visible"` | macOS : `transparent`, `overlay`… |
| `dragDropEnabled` | `true` | Active le drag & drop natif |

Exemple de fenêtre « sans décoration », fréquente pour les interfaces personnalisées :

```json
{
  "label": "main",
  "title": "Taurinote",
  "width": 1100,
  "height": 720,
  "decorations": false,
  "transparent": false
}
```

> ⚠️ Sans décoration, vous devez gérer vous-même le déplacement, le redimensionnement et les boutons fermer/réduire via `@tauri-apps/api/window`. À réserver aux designs maîtrisés.

### 4.4 `app.security`

| Champ | Description |
|---|---|
| `csp` | Content Security Policy en production |
| `devCsp` | CSP en développement (si différente) |
| `freezePrototype` | Gèle `Object.prototype` (protection XSS) |
| `dangerousDisableAssetCspModification` | Désactive la réécriture automatique de la CSP (dangereux) |
| `pattern` | `brownfield` (défaut) ou `isolation` |
| `assetProtocol` | Autorise le protocole `asset://` pour servir des fichiers locaux |
| `capabilities` | Liste des capabilities actives (sinon toutes celles du dossier) |

La valeur `"csp": null` du template **désactive** la CSP. C'est acceptable pour prototyper, pas pour publier. Nous la configurons au chapitre 07.

### 4.5 `bundle`

| Champ | Description |
|---|---|
| `active` | Génère les installateurs |
| `targets` | `"all"` ou `["deb", "appimage", "nsis", "dmg"]` |
| `icon` | Icônes utilisées par les installateurs |
| `category` | Catégorie macOS/Linux (`Productivity`, `DeveloperTool`…) |
| `copyright` | Mention de copyright |
| `shortDescription` / `longDescription` | Descriptions pour les stores |
| `resources` | Fichiers additionnels embarqués |
| `externalBin` | Binaires externes (sidecars) |
| `fileAssociations` | Extensions de fichiers associées |
| `createUpdaterArtifacts` | Génère les artefacts de mise à jour |
| `windows`, `macOS`, `linux` | Options spécifiques à chaque OS |

### 4.6 Fichiers de configuration par plateforme

Tauri fusionne automatiquement :

```
tauri.conf.json          # base
tauri.linux.conf.json    # surcharge Linux
tauri.windows.conf.json  # surcharge Windows
tauri.macos.conf.json    # surcharge macOS
```

Pratique pour un titre de fenêtre, une icône ou un comportement spécifique sans dupliquer toute la configuration.

---

## 5. Les capabilities

`src-tauri/capabilities/default.json` :

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "Capacités de la fenêtre principale",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "opener:default"
  ]
}
```

- `windows` : labels des fenêtres concernées. `"main"` correspond au label par défaut.
- `permissions` : liste des commandes autorisées.
- `core:default` : permissions de base (événements, fenêtre, chemins…).
- `opener:default` : permissions par défaut du plugin opener.

Sans capability, les plugins refusent les appels. Les **commandes personnalisées** (`#[tauri::command]`) enregistrées par votre application ne nécessitent pas de permission par défaut — mais elles doivent valider leurs entrées, car le frontend peut les appeler.

Le dossier `gen/schemas/` contient les schémas JSON générés, qui permettent l'autocomplétion dans VS Code. Ils sont recréés à chaque build.

---

## 6. Où mettre quoi ?

| Type de fichier | Emplacement | Embarqué ? |
|---|---|---|
| Composants, styles, code Vue | `src/` | Oui, compilé dans `dist/` |
| Images importées dans le code | `src/assets/` | Oui, hachées par Vite |
| Fichiers servis tels quels | `public/` | Oui, copiés à la racine |
| Icônes de l'application | `src-tauri/icons/` | Oui |
| Fichiers lus par Rust | `src-tauri/resources/` | Oui, via `bundle.resources` |
| Base de données utilisateur | Répertoire app data | Non (créé à l'exécution) |
| Logs, cache | Répertoires système | Non |

### 6.1 `public/` vs `src/assets/`

- `public/logo.png` → accessible via `/logo.png`, **sans** traitement Vite (pas de hash, pas d'optimisation). Utile pour `favicon.ico`, `robots.txt`.
- `src/assets/logo.png` → importé dans le code (`import logo from "@/assets/logo.png"`), haché et optimisé. **Préférez ce mode** pour les images de l'interface.

### 6.2 Ressources Rust

Dans `tauri.conf.json` :

```json
{
  "bundle": {
    "resources": ["resources/*"]
  }
}
```

Accès côté Rust :

```rust
let path = app.path().resolve("resources/config.json", tauri::path::BaseDirectory::Resource)?;
```

Côté JS, le plugin `fs` peut lire `BaseDirectory.Resource`, avec la permission correspondante.

---

## 7. Versions et cohérence

Trois fichiers contiennent une version :

- `package.json` → version du package frontend.
- `src-tauri/Cargo.toml` → version de la crate Rust.
- `src-tauri/tauri.conf.json` → version utilisée par le bundle et l'updater.

La version qui compte pour l'utilisateur est celle de `tauri.conf.json`. Pour éviter les oublis, synchronisez-les avec un script :

```json
{
  "scripts": {
    "version": "node scripts/sync-version.mjs"
  }
}
```

Ou, plus simple, gardez `tauri.conf.json` comme source de vérité et mettez à jour les deux autres dans le script de release (chapitre 13).

---

## 8. Le dossier `gen/`

```
src-tauri/gen/
└── schemas/
    ├── acl-manifests.json
    ├── capabilities.json
    ├── desktop-schema.json
    └── windows-schema.json
```

Ces fichiers sont générés par `tauri-build` et servent :

- à l'autocomplétion des capabilities dans l'éditeur ;
- à la validation des permissions ;
- au CLI pour vérifier la configuration.

Ils ne doivent pas être édités à la main ni commités (le `.gitignore` du template les exclut).

---

## 9. Exercice d'application

Modifiez le projet pour obtenir :

1. Une fenêtre de 1000 × 700, minimum 800 × 600, centrée.
2. Le titre « Taurinote ».
3. Un identifiant `com.votrenom.taurinote`.
4. Un produit nommé « Taurinote ».
5. La version `0.2.0` partout.
6. Aucun plugin opener si vous ne l'utilisez pas (retirez la dépendance Rust, l'appel `.plugin(...)`, la dépendance JS et la permission).

Vérifiez avec :

```bash
yarn tauri info
yarn tauri dev
```

---

## À retenir

- `src/` = frontend Vue ; `src-tauri/` = backend Rust.
- `tauri.conf.json` pilote le build, les fenêtres, la sécurité et l'empaquetage.
- `main.rs` est minimal ; `lib.rs` assemble l'application.
- `build.rs` génère le contexte et les schémas.
- Les capabilities déclarent les permissions par fenêtre.
- `src/assets` est traité par Vite ; `public` est copié tel quel ; `src-tauri/resources` est embarqué côté natif.
- `target/` et `gen/schemas/` ne se committent pas ; `Cargo.lock` oui.

---

## Exercices

1. **Configuration.** Changez la taille minimale de la fenêtre et vérifiez qu'elle ne peut pas être réduite en dessous.
2. **Identification.** Où est utilisé l'`identifier` ? Citez au moins trois conséquences d'un changement après publication.
3. **Assets.** Vous devez afficher un logo dans l'interface et lire un fichier `seed.json` depuis Rust. Où placez-vous chaque fichier ?
4. **Sécurité.** Pourquoi `"csp": null` est-il problématique en production ?
5. **Nettoyage.** Retirez le plugin `opener` du projet. Listez tous les endroits à modifier.

Solutions : [annexe D](../annexes/d-solutions.md#chapitre-03).

---

[← Chapitre précédent](./02-premier-projet.md) · [README](../README.md) · [Chapitre suivant : Vue 3 efficace pour Tauri →](./04-vue-fondamentaux.md)
