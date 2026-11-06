# 08 — Plugins et API natives

> **Objectifs**
> - Comprendre l'anatomie d'un plugin Tauri et l'installer avec Yarn.
> - Utiliser les plugins `dialog`, `fs`, `opener`, `os`, `notification`, `clipboard`.
> - Choisir entre `fetch` navigateur et plugin `http`.
> - Utiliser `shell` et les sidecars sans exposer une faille.
> - Écrire un export JSON complet (dialogue + écriture + notification).

Sommaire : [← Chapitre précédent](./07-permissions-capabilities.md) · [README](../README.md) · [Chapitre suivant →](./09-stockage-sqlite.md)

---

## 1. Anatomie d'un plugin

Un plugin Tauri est composé de :

1. **Une crate Rust** (`tauri-plugin-xxx`) qui implémente les commandes natives.
2. **Un package JS** (`@tauri-apps/plugin-xxx`) qui expose les fonctions au frontend.
3. **Des permissions** (`xxx:default`, `xxx:allow-...`) déclarées dans les capabilities.
4. **Une configuration optionnelle** dans `tauri.conf.json` (`plugins.xxx`).

### Installation automatique

```bash
yarn tauri add dialog
```

Cette commande :

- ajoute `tauri-plugin-dialog` à `Cargo.toml` ;
- ajoute `@tauri-apps/plugin-dialog` à `package.json` ;
- insère `.plugin(tauri_plugin_dialog::init())` dans `lib.rs` ;
- ajoute `dialog:default` à la capability.

> ⚠️ Vérifiez toujours ce qui a été ajouté. `tauri add` choisit souvent la permission `default`, plus large que nécessaire.

### Installation manuelle

```bash
yarn add @tauri-apps/plugin-dialog
cd src-tauri && cargo add tauri-plugin-dialog
```

`src-tauri/src/lib.rs` :

```rust
tauri::Builder::default()
    .plugin(tauri_plugin_dialog::init())
```

`src-tauri/capabilities/default.json` :

```json
{ "permissions": ["dialog:default"] }
```

---

## 2. `dialog` — boîtes de dialogue natives

### 2.1 Ouvrir un fichier

```ts
import { open } from "@tauri-apps/plugin-dialog";

const file = await open({
  multiple: false,
  directory: false,
  title: "Importer des tâches",
  filters: [{ name: "JSON", extensions: ["json"] }],
});

if (file === null) {
  // L'utilisateur a annulé : ce n'est pas une erreur.
  return;
}

console.log(file); // chemin absolu (string)
```

Avec `multiple: true`, le retour est `string[] | null`.

### 2.2 Enregistrer un fichier

```ts
import { save } from "@tauri-apps/plugin-dialog";

const path = await save({
  defaultPath: "taurinote-export.json",
  filters: [{ name: "JSON", extensions: ["json"] }],
});

if (path) {
  await writeTextFile(path, JSON.stringify(data, null, 2));
}
```

### 2.3 Messages et confirmations

```ts
import { message, ask, confirm } from "@tauri-apps/plugin-dialog";

await message("Import terminé.", { title: "Taurinote", kind: "info" });

const sure = await ask("Supprimer toutes les tâches ?", {
  title: "Confirmation",
  kind: "warning",
});

if (sure) {
  const ok = await confirm("Cette action est irréversible. Continuer ?", {
    title: "Dernière vérification",
    kind: "warning",
  });
}
```

`message` retourne `void` ; `ask` et `confirm` retournent un booléen.

### 2.4 Pourquoi pas `window.confirm` ?

Les boîtes natives :

- s'intègrent au système ;
- ne sont pas bloquées par la CSP ;
- peuvent être localisées par l'OS ;
- fonctionnent sur mobile.

### 2.5 Scope automatique

Les chemins choisis via `open`/`save` sont automatiquement ajoutés au scope `fs` et au scope `asset` **pour la session**. C'est ce qui permet d'écrire immédiatement dans le fichier choisi sans autoriser tout `$HOME`.

Pour persister ces autorisations entre deux lancements :

```bash
yarn tauri add persisted-scope
```

---

## 3. `fs` — système de fichiers

### 3.1 Lire et écrire du texte

```ts
import {
  readTextFile,
  writeTextFile,
  BaseDirectory,
} from "@tauri-apps/plugin-fs";

const config = await readTextFile("config.json", {
  baseDir: BaseDirectory.AppConfig,
});

await writeTextFile("config.json", JSON.stringify({ theme: "dark" }), {
  baseDir: BaseDirectory.AppConfig,
});
```

### 3.2 Répertoires applicatifs

| `BaseDirectory` | Emplacement |
|---|---|
| `AppConfig` | Configuration |
| `AppData` | Données (roaming) |
| `AppLocalData` | Données locales |
| `AppCache` | Cache |
| `AppLog` | Logs |
| `Resource` | Ressources embarquées |
| `Download`, `Document`, `Desktop` | Répertoires utilisateur |
| `Temp` | Temporaire |

> 💡 `fs:default` autorise déjà la lecture/écriture dans les répertoires applicatifs. C'est le choix par défaut pour les données de l'application.

### 3.3 Fichiers binaires

```ts
import { readFile, writeFile, BaseDirectory } from "@tauri-apps/plugin-fs";

const bytes = await readFile("avatar.png", { baseDir: BaseDirectory.AppData });
const copy = new Uint8Array(bytes);
await writeFile("avatar-copy.png", copy, { baseDir: BaseDirectory.AppData });
```

### 3.4 Manipulations

```ts
import {
  exists, mkdir, remove, readDir, rename, stat,
  BaseDirectory,
} from "@tauri-apps/plugin-fs";

if (!(await exists("exports", { baseDir: BaseDirectory.AppData }))) {
  await mkdir("exports", { baseDir: BaseDirectory.AppData });
}

const entries = await readDir("exports", { baseDir: BaseDirectory.AppData });
const info = await stat("exports/rapport.json", { baseDir: BaseDirectory.AppData });
await rename("exports/a.json", "exports/b.json", {
  fromPathBaseDir: BaseDirectory.AppData,
  toPathBaseDir: BaseDirectory.AppData,
});
await remove("exports/ancien.json", { baseDir: BaseDirectory.AppData });
```

### 3.5 Sécurité des chemins

- Les chemins relatifs doivent être associés à un `baseDir`.
- Les `..` sont bloqués par le plugin.
- Les chemins absolus ne sont acceptés que s'ils sont dans le scope.
- Ne construisez jamais un chemin avec une entrée utilisateur non validée.

```ts
import { join, appDataDir } from "@tauri-apps/api/path";

const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
const path = await join(await appDataDir(), "exports", safeName);
```

---

## 4. `opener` — ouvrir liens et fichiers

```ts
import { openUrl, openPath, revealItemInDir } from "@tauri-apps/plugin-opener";

// Lien web : ouvre le navigateur par défaut
await openUrl("https://v2.tauri.app");

// Fichier ou dossier : ouvre l'application associée
await openPath("/home/user/Documents/rapport.pdf");

// Révèle un fichier dans le gestionnaire de fichiers
await revealItemInDir("/home/user/Documents/rapport.pdf");
```

Permissions :

```json
{
  "permissions": [
    "opener:default",
    {
      "identifier": "opener:allow-open-path",
      "allow": [{ "path": "$APPDATA/exports/**" }]
    }
  ]
}
```

> 🔒 N'ouvrez jamais une URL ou un chemin fourni brut par l'utilisateur sans validation. `openPath` sur un exécutable peut lancer un programme. `opener` n'est pas un `shell` déguisé, mais reste une frontière.

---

## 5. `os` — informations système

```ts
import { arch, platform, version, type, family } from "@tauri-apps/plugin-os";

const info = {
  platform: platform(),   // "linux" | "macos" | "windows" | "ios" | "android"…
  arch: arch(),           // "x86_64" | "aarch64"…
  version: version(),     // version de l'OS
  type: type(),           // "Linux", "Darwin", "Windows_NT"…
  family: family(),       // "unix" | "windows"
};
```

Utile pour adapter l'UI (raccourcis `⌘` vs `Ctrl`) ou choisir un chemin par défaut.

> 💡 Côté Rust, `std::env::consts::OS` et `ARCH` évitent une dépendance supplémentaire si l'information ne sert qu'au backend.

---

## 6. `notification` — notifications système

### 6.1 Demander la permission

```ts
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";

export async function notify(title: string, body: string) {
  let granted = await isPermissionGranted();

  if (!granted) {
    const permission = await requestPermission();
    granted = permission === "granted";
  }

  if (!granted) {
    console.warn("Notifications refusées par l'utilisateur.");
    return;
  }

  sendNotification({ title, body });
}
```

### 6.2 Bonnes pratiques

- Demandez la permission **au moment utile**, pas au démarrage.
- Expliquez pourquoi dans l'interface avant la demande système.
- Ne spammez pas : une notification par événement significatif.
- Prévoyez un réglage pour désactiver les notifications.
- Sur macOS, l'application doit être signée pour un comportement optimal.

### 6.3 Côté Rust

```rust
use tauri_plugin_notification::NotificationExt;

app.notification()
    .builder()
    .title("Taurinote")
    .body("Sauvegarde terminée")
    .show()?;
```

---

## 7. `clipboard-manager` — presse-papiers

```ts
import { writeText, readText } from "@tauri-apps/plugin-clipboard-manager";

await writeText("Texte copié depuis Taurinote");
const text = await readText();
```

Permission : `clipboard-manager:default` (ou `allow-read-text`, `allow-write-text`).

> 🔒 Lire le presse-papiers peut exposer des secrets (mots de passe copiés). Ne le faites qu'à la demande explicite de l'utilisateur.

---

## 8. `http` — requêtes réseau

### 8.1 `fetch` natif vs `fetch` navigateur

| Critère | `fetch` navigateur | Plugin `http` |
|---|---|---|
| CORS | Soumis au CORS | Contourné (requête native) |
| Cookies | WebView | Non |
| Scope | Libre | Domains autorisés |
| Mobile | Limité | Fonctionne |
| Taille | 0 | Plugin |

Dans une WebView Tauri, le `fetch` standard fonctionne pour les API qui autorisent CORS. Pour appeler une API sans CORS (ou avec des en-têtes spécifiques), utilisez le plugin.

```bash
yarn tauri add http
```

```ts
import { fetch } from "@tauri-apps/plugin-http";

const response = await fetch("https://api.exemple.com/taches", {
  method: "GET",
  headers: { Accept: "application/json" },
});

if (!response.ok) throw new Error(`HTTP ${response.status}`);
const data = await response.json();
```

Capability :

```json
{
  "permissions": [
    {
      "identifier": "http:default",
      "allow": [{ "url": "https://api.exemple.com/*" }]
    }
  ]
}
```

### 8.2 Bonnes pratiques réseau

- Toujours HTTPS en production.
- Limitez les domaines dans le scope.
- Gérez les timeouts et les erreurs réseau.
- Ne loggez pas les tokens.
- Pour des secrets d'API, préférez un backend ou un proxy ; un secret embarqué dans le frontend est extractible.

---

## 9. `shell` — processus et sidecars

### 9.1 Exécuter une commande autorisée

```ts
import { Command } from "@tauri-apps/plugin-shell";

const command = Command.create("git", ["status", "--short"]);
const output = await command.execute();

console.log(output.stdout);
```

Capability avec allowlist stricte :

```json
{
  "permissions": [
    {
      "identifier": "shell:allow-execute",
      "allow": [
        {
          "name": "git-status",
          "cmd": "git",
          "args": ["status", "--short"]
        }
      ]
    }
  ]
}
```

### 9.2 Sidecar

Un **sidecar** est un binaire embarqué avec l'application (autre langage, outil CLI).

`tauri.conf.json` :

```json
{
  "bundle": {
    "externalBin": ["binaries/ffmpeg"]
  }
}
```

Le fichier doit être nommé avec le triplet de la plateforme : `binaries/ffmpeg-x86_64-unknown-linux-gnu`.

```ts
import { Command } from "@tauri-apps/plugin-shell";

const cmd = Command.sidecar("binaries/ffmpeg", ["-version"]);
const result = await cmd.execute();
```

### 9.3 Avertissement

> 🔒 Le plugin `shell` est l'une des surfaces les plus dangereuses. N'exposez jamais une commande générique `run(cmd, args)` au frontend. Préférez :
> - des commandes Rust dédiées avec des arguments fixes ;
> - une allowlist `shell` ultra-restreinte ;
> - `std::process::Command` côté Rust avec validation.

---

## 10. `log` — journalisation

```bash
yarn tauri add log
```

Rust :

```rust
tauri::Builder::default()
    .plugin(
        tauri_plugin_log::Builder::new()
            .level(log::LevelFilter::Info)
            .build(),
    )
```

JS :

```ts
import { info, warn, error } from "@tauri-apps/plugin-log";

info("Application démarrée");
warn("Import partiel");
error("Échec de la sauvegarde");
```

Les logs sont écrits dans le répertoire de logs de l'application, ce qui est précieux pour diagnostiquer un problème chez un utilisateur.

> ⚠️ Ne loggez jamais de données personnelles, de tokens ou de chemins sensibles en production.

---

## 11. `single-instance` — une seule instance

Empêche l'ouverture de plusieurs processus et permet de réutiliser la fenêtre existante.

```rust
tauri::Builder::default()
    .plugin(tauri_plugin_single_instance::init(|app, argv, cwd| {
        println!("Nouvelle instance : {argv:?} dans {cwd}");
        if let Some(window) = app.get_webview_window("main") {
            let _ = window.show();
            let _ = window.set_focus();
        }
    }))
```

Ce plugin doit être enregistré **en premier**. Il n'a pas d'API JS.

---

## 12. `window-state` — mémoriser la fenêtre

```rust
tauri::Builder::default()
    .plugin(tauri_plugin_window_state::Builder::default().build())
```

Taille, position et état maximisé sont restaurés au lancement. Pensez à exclure les fenêtres transitoires (dialogue, splash) :

```rust
tauri_plugin_window_state::Builder::default()
    .with_denylist(&["splashscreen"])
    .build()
```

---

## 13. Catalogue des plugins utiles

| Plugin | Usage |
|---|---|
| `autostart` | Lancer l'app à la connexion |
| `clipboard-manager` | Presse-papiers |
| `deep-link` | URLs `taurinote://` |
| `dialog` | Ouvrir/enregistrer, messages |
| `fs` | Fichiers et dossiers |
| `global-shortcut` | Raccourcis globaux |
| `http` | Requêtes sans CORS |
| `log` | Logs fichier + console |
| `notification` | Notifications système |
| `opener` | Liens et fichiers |
| `os` | Informations OS |
| `persisted-scope` | Persiste les scopes fs |
| `process` | Redémarrer / quitter |
| `shell` | Commandes et sidecars |
| `single-instance` | Instance unique |
| `sql` | SQLite / MySQL / PostgreSQL |
| `store` | Clé/valeur JSON |
| `stronghold` | Secrets chiffrés |
| `updater` | Mises à jour |
| `upload` | Upload de fichiers |
| `websocket` | WebSocket natif |
| `window-state` | Taille/position des fenêtres |

Liste complète : [v2.tauri.app/plugin](https://v2.tauri.app/plugin/).

---

## 14. Atelier : export JSON complet

Objectif : exporter les tâches dans un fichier choisi par l'utilisateur, puis notifier le résultat.

```ts
import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { isPermissionGranted, requestPermission, sendNotification } from "@tauri-apps/plugin-notification";
import type { Todo } from "@/types";

export async function exportTodos(todos: Todo[]): Promise<boolean> {
  const path = await save({
    title: "Exporter les tâches",
    defaultPath: `taurinote-${new Date().toISOString().slice(0, 10)}.json`,
    filters: [{ name: "JSON", extensions: ["json"] }],
  });

  if (!path) return false; // annulé

  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    todos,
  };

  try {
    await writeTextFile(path, JSON.stringify(payload, null, 2));

    if (await isPermissionGranted() || (await requestPermission()) === "granted") {
      sendNotification({
        title: "Taurinote",
        body: `${todos.length} tâche(s) exportée(s).`,
      });
    }

    return true;
  } catch (error) {
    console.error("Export échoué", error);
    return false;
  }
}
```

Permissions minimales :

```json
{
  "permissions": [
    "dialog:default",
    "fs:default",
    "notification:default",
    "fs:allow-write-text-file"
  ]
}
```

Le fichier choisi via `save()` étant ajouté au scope automatiquement, `fs:allow-write-text-file` suffit : inutile d'autoriser tout `$DOWNLOAD`.

---

## 15. Exercices

1. **Dialogue.** Ouvrez un fichier `.json`, lisez-le avec `fs` et affichez son contenu. Gérez l'annulation.
2. **Export.** Ajoutez un bouton « Exporter » à Taurinote et affichez une notification.
3. **OS.** Affichez `⌘` sur macOS et `Ctrl` ailleurs dans les libellés de raccourcis.
4. **HTTP.** Appelez une API publique avec le plugin `http` et affichez les données. Restreignez le scope au domaine exact.
5. **Sécurité.** Pourquoi `openPath` est-il plus risqué que `openUrl` ? Proposez une validation.
6. **Sidecar.** Décrivez les étapes pour embarquer un binaire `rg` (ripgrep) et l'appeler depuis Rust, sans exposer `shell` au frontend.

Solutions : [annexe D](../annexes/d-solutions.md#chapitre-08).

---

## À retenir

- `yarn tauri add <plugin>` installe la crate, le package JS, l'init Rust et la permission.
- Les plugins sont soumis aux capabilities : sans permission, l'appel échoue.
- Les dialogues ajoutent automatiquement les fichiers choisis au scope de session.
- `fs:default` couvre les répertoires applicatifs ; les autres chemins exigent un scope.
- Préférez `openUrl` à `openPath`, et n'exposez jamais `shell` générique.
- Le plugin `http` contourne CORS mais doit être limité par un scope d'URL.
- Une notification se demande au bon moment et reste désactivable.

---

[← Chapitre précédent](./07-permissions-capabilities.md) · [README](../README.md) · [Chapitre suivant : stockage SQLite →](./09-stockage-sqlite.md)
