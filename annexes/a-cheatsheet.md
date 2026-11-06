# Annexe A — Aide-mémoire

Sommaire : [README](../README.md)

---

## Commandes Yarn / Tauri

```bash
# Création
yarn create tauri-app                    # assistant
yarn create tauri-app taurinote -m yarn -t vue-ts --identifier com.exemple.app -y

# Développement
yarn install
yarn dev                                 # front seul (navigateur)
yarn tauri dev                           # application native
yarn tauri dev --verbose

# Qualité
yarn build                               # typecheck + build front
yarn test                                # Vitest watch
yarn test:run                            # Vitest une fois
yarn test:coverage
cd src-tauri && cargo test
cd src-tauri && cargo clippy --all-targets -- -D warnings
cd src-tauri && cargo fmt

# Production
yarn tauri build
yarn tauri build --debug
yarn tauri build --bundles deb
yarn tauri build --no-bundle
yarn tauri build --target aarch64-apple-darwin

# Utilitaires
yarn tauri info
yarn tauri icon ./app-icon.png
yarn tauri add dialog
yarn tauri signer generate -w ~/.tauri/monapp.key
```

## Chemins de sortie

```
src-tauri/target/release/
src-tauri/target/release/bundle/deb/
src-tauri/target/release/bundle/rpm/
src-tauri/target/release/bundle/appimage/
src-tauri/target/release/bundle/macos/
src-tauri/target/release/bundle/dmg/
src-tauri/target/release/bundle/msi/
src-tauri/target/release/bundle/nsis/
```

---

## Structure minimale

```
mon-app/
├── src/                    # Vue
│   ├── api/
│   ├── components/
│   ├── composables/
│   ├── router/
│   ├── stores/
│   ├── views/
│   ├── App.vue
│   └── main.ts
├── src-tauri/
│   ├── capabilities/default.json
│   ├── icons/
│   ├── migrations/
│   ├── src/
│   │   ├── commands/
│   │   ├── error.rs
│   │   ├── lib.rs
│   │   ├── main.rs
│   │   ├── models.rs
│   │   └── state.rs
│   ├── Cargo.toml
│   ├── build.rs
│   └── tauri.conf.json
├── package.json
├── vite.config.ts
└── yarn.lock
```

---

## Commande Rust + appel Vue

```rust
#[tauri::command]
fn ping() -> String { "pong".into() }

#[tauri::command]
fn create_todo(state: tauri::State<'_, AppState>, input: CreateTodoInput) -> Result<Todo, AppError> {
    // …
}

tauri::Builder::default()
    .manage(AppState::default())
    .invoke_handler(tauri::generate_handler![ping, create_todo])
```

```ts
import { invoke } from "@tauri-apps/api/core";

const pong = await invoke<string>("ping");
const todo = await invoke<Todo>("create_todo", {
  input: { title: "Test", priority: "high", dueDate: null, tags: [] },
});
```

**Noms :** commande `snake_case`, arguments JS `camelCase`, paramètres Rust `snake_case`, champs `#[serde(rename_all = "camelCase")]`.

---

## Événements

```rust
use tauri::Emitter;

app.emit("todos:changed", ())?;
app.emit_to("settings", "theme:changed", "dark")?;
```

```ts
import { listen, emit, emitTo } from "@tauri-apps/api/event";

const unlisten = await listen<T>("todos:changed", (e) => {});
unlisten();

await emit("frontend:ready", { route: "/" });
await emitTo("settings", "theme:changed", "dark");
```

```rust
use tauri::Listener;

app.listen("frontend:ready", |event| {
    println!("{}", event.payload());
});
```

## Canal

```rust
use tauri::ipc::Channel;

#[tauri::command]
async fn run(on_event: Channel<Progress>) -> Result<(), String> {
    on_event.send(Progress { current: 1, total: 10 }).map_err(|e| e.to_string())?;
    Ok(())
}
```

```ts
import { Channel, invoke } from "@tauri-apps/api/core";

const onEvent = new Channel<Progress>();
onEvent.onmessage = (msg) => console.log(msg);
await invoke("run", { onEvent });
```

---

## État partagé

```rust
use std::sync::Mutex;

pub struct AppState { pub todos: Mutex<Vec<Todo>> }

tauri::Builder::default().manage(AppState { todos: Mutex::new(vec![]) })
```

```rust
#[tauri::command]
fn list(state: tauri::State<'_, AppState>) -> Result<Vec<Todo>, String> {
    let todos = state.todos.lock().map_err(|e| e.to_string())?;
    Ok(todos.clone())
}
```

> Ne tenez pas un `Mutex` standard à travers un `.await`.

---

## Erreur Rust sérialisable

```rust
#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("Introuvable : {0}")] NotFound(i64),
    #[error("Validation : {0}")] Validation(String),
    #[error(transparent)] Io(#[from] std::io::Error),
}

impl serde::Serialize for AppError {
    fn serialize<S>(&self, s: S) -> Result<S::Ok, S::Error>
    where S: serde::Serializer {
        s.serialize_str(&self.to_string())
    }
}
```

---

## `tauri.conf.json` (squelette)

```json
{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "Taurinote",
  "version": "0.1.0",
  "identifier": "com.exemple.taurinote",
  "build": {
    "beforeDevCommand": "yarn dev",
    "devUrl": "http://localhost:1420",
    "beforeBuildCommand": "yarn build",
    "frontendDist": "../dist"
  },
  "app": {
    "windows": [
      { "label": "main", "title": "Taurinote", "width": 1100, "height": 720 }
    ],
    "security": {
      "csp": {
        "default-src": "'self'",
        "script-src": "'self'",
        "style-src": "'self' 'unsafe-inline'",
        "img-src": "'self' data: asset: http://asset.localhost",
        "connect-src": "ipc: http://ipc.localhost"
      },
      "freezePrototype": true
    }
  },
  "bundle": {
    "active": true,
    "targets": "all",
    "icon": ["icons/32x32.png", "icons/128x128.png", "icons/icon.icns", "icons/icon.ico"]
  },
  "plugins": {
    "sql": { "preload": ["sqlite:taurinote.db"] }
  }
}
```

---

## Capability

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "main",
  "description": "Fenêtre principale",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "dialog:default",
    "fs:default",
    "sql:default",
    "sql:allow-execute",
    "notification:default",
    {
      "identifier": "fs:allow-write-text-file",
      "allow": [{ "path": "$APPDATA/exports/**" }]
    }
  ]
}
```

Variables : `$APPDATA`, `$APPCONFIG`, `$APPLOCALDATA`, `$APPCACHE`, `$APPLOG`, `$HOME`, `$DOCUMENT`, `$DOWNLOAD`, `$DESKTOP`, `$PICTURE`, `$VIDEO`, `$AUDIO`, `$TEMP`, `$RESOURCE`, `$PUBLIC`.

---

## Plugins : commandes d'installation

```bash
yarn tauri add dialog
yarn tauri add fs
yarn tauri add opener
yarn tauri add notification
yarn tauri add sql
yarn tauri add store
yarn tauri add http
yarn tauri add shell
yarn tauri add updater
yarn tauri add process
yarn tauri add global-shortcut
yarn tauri add window-state
yarn tauri add single-instance
yarn tauri add log
yarn tauri add deep-link
yarn tauri add clipboard-manager
yarn tauri add persisted-scope
```

Après chaque ajout : vérifier `Cargo.toml`, `lib.rs`, `package.json`, `capabilities/`.

---

## SQL

```rust
use tauri_plugin_sql::{Migration, MigrationKind};

tauri_plugin_sql::Builder::default()
    .add_migrations("sqlite:taurinote.db", vec![Migration {
        version: 1,
        description: "init",
        sql: include_str!("../migrations/001_init.sql"),
        kind: MigrationKind::Up,
    }])
    .build()
```

```ts
import Database from "@tauri-apps/plugin-sql";

const db = await Database.load("sqlite:taurinote.db");
const rows = await db.select<TodoRow[]>("SELECT * FROM todos WHERE done = ?", [0]);
const result = await db.execute("INSERT INTO todos (title) VALUES (?)", ["Test"]);
// result.lastInsertId, result.rowsAffected
```

SQLite : placeholders `?`. PostgreSQL : `$1`. Base dans `AppConfig`.

---

## Store

```ts
import { load, LazyStore } from "@tauri-apps/plugin-store";

const store = await load("settings.json", { autoSave: false });
await store.set("theme", "dark");
const theme = await store.get<string>("theme");
await store.save();

const lazy = new LazyStore("settings.json");
```

---

## Fenêtre / tray / menu

```rust
use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};

WebviewWindowBuilder::new(&app, "settings", WebviewUrl::App("index.html#/settings".into()))
    .title("Paramètres")
    .inner_size(560.0, 520.0)
    .build()?;
```

```ts
import { getCurrentWindow } from "@tauri-apps/api/window";
await getCurrentWindow().setTitle("Taurinote");
```

```rust
use tauri::{menu::{Menu, MenuItem}, tray::TrayIconBuilder, Manager};

let show = MenuItem::with_id(app, "show", "Afficher", true, None::<&str>)?;
let quit = MenuItem::with_id(app, "quit", "Quitter", true, None::<&str>)?;
let menu = Menu::with_items(app, &[&show, &quit])?;

TrayIconBuilder::new()
    .icon(app.default_window_icon().unwrap().clone())
    .menu(&menu)
    .on_menu_event(|app, e| match e.id.as_ref() {
        "show" => { if let Some(w) = app.get_webview_window("main") { let _ = w.show(); } }
        "quit" => app.exit(0),
        _ => {}
    })
    .build(app)?;
```

Feature requise : `tauri = { version = "2", features = ["tray-icon"] }`.

---

## Tests

```ts
import { mockIPC, clearMocks, mockWindows } from "@tauri-apps/api/mocks";

mockWindows("main");
mockIPC((cmd, args) => {
  if (cmd === "ping") return "pong";
  throw new Error(cmd);
});

afterEach(() => clearMocks());
```

```bash
cargo test
cargo test -- --nocapture
cargo clippy -- -D warnings
```

E2E : `tauri-driver --port 4444` + WebdriverIO (`browserName: "wry"`), Linux/Windows uniquement.

---

## Signature / updater

```bash
yarn tauri signer generate -w ~/.tauri/monapp.key
```

```json
{
  "bundle": { "createUpdaterArtifacts": true },
  "plugins": {
    "updater": {
      "pubkey": "CLÉ_PUBLIQUE",
      "endpoints": ["https://github.com/ORG/REPO/releases/latest/download/latest.json"]
    }
  }
}
```

```ts
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

const update = await check();
if (update) {
  await update.downloadAndInstall();
  await relaunch();
}
```

Secrets CI : `TAURI_SIGNING_PRIVATE_KEY`, `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`, `APPLE_*`.

---

## Profil release Rust

```toml
[profile.release]
codegen-units = 1
lto = true
opt-level = "s"
panic = "abort"
strip = true
```

---

## Vérifications rapides

```bash
yarn tauri info
node -v && yarn -v && rustc --version
pkg-config --modversion webkit2gtk-4.1   # Linux
cargo fmt --check
cargo clippy -- -D warnings
cargo audit
yarn audit
```
