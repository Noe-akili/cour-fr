# Annexe D — Solutions des exercices

Sommaire : [README](../README.md)

> Les solutions sont volontairement concises. Plusieurs variantes sont acceptables : ce qui compte est le raisonnement et la validation.

---

## Chapitre 00

**1. Cartographie**

| Fonctionnalité | Couche |
|---|---|
| (a) Filtrer une liste | Vue (computed) |
| (b) Lire un fichier choisi | Dialogue + fs (front) ou commande Rust |
| (c) Notification système | Plugin notification (Rust/JS) |
| (d) Valider un formulaire | Vue + validation Rust si critique |
| (e) Stocker dans SQLite | Plugin SQL côté TS, migrations en Rust |
| (f) Changer le thème | Vue + store plugin |

**2. Comparaison**

Electron : besoin d'un rendu strictement identique sur tous les OS ; équipe exclusivement JS/Node avec des bibliothèques natives non portables. Tauri : binaire léger, faible mémoire, accès mobile, sécurité par permissions.

**3. WebView**

Ubuntu 22.04 peut avoir WebKitGTK 2.40, macOS 15 un WKWebView plus récent. Les API CSS/JS, le rendu des polices, les performances et le support de certaines fonctionnalités diffèrent. Il faut tester sur chaque cible et éviter les API non polyfillées.

**4. `read_any_file`**

Risques : lecture de clés SSH, tokens, fichiers système ; exfiltration via XSS ou dépendance compromise. Alternative : `dialog.open()` + scope fs automatique, ou une commande Rust dédiée limitée à un répertoire applicatif avec canonicalisation et validation d'extension.

---

## Chapitre 01

**1.** Coller la sortie de `node -v`, `yarn -v`, `rustc --version`.

**2.** `libwebkit2gtk-4.1-dev` (et `libjavascriptcoregtk-4.1-dev`). Tauri 2 utilise l'API WebKitGTK 4.1 ; la 4.0 ne fournit pas les mêmes symboles/headers et la compilation de `webkit2gtk-sys` échoue.

**3.** `stable-msvc` utilise le linker et le runtime Microsoft (recommandé sur Windows) ; `stable-gnu` utilise MinGW. Tauri recommande MSVC pour la compatibilité avec les bibliothèques système et WebView2.

**4.**

```bash
corepack enable
corepack prepare yarn@4.5.0 --activate
yarn set version stable
printf 'nodeLinker: node-modules\n' > .yarnrc.yml
yarn dlx create-tauri-app
yarn install
```

**5.** Installer `libwebkit2gtk-4.1-dev` (4.1, pas 4.0), puis `cargo clean` dans `src-tauri/` et relancer. Vérifier avec `pkg-config --modversion webkit2gtk-4.1`.

---

## Chapitre 02

**1.** La première compilation dure généralement 2 à 10 minutes ; noter la valeur observée.

**2.**

```rust
#[tauri::command]
fn ping() -> &'static str { "pong" }
```

```rust
.invoke_handler(tauri::generate_handler![greet, ping])
```

```ts
const pong = await invoke<string>("ping");
```

**3.**

```rust
use serde::Serialize;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Greeting {
    message: String,
    timestamp: u64,
}

#[tauri::command]
fn greet(name: &str) -> Greeting {
    Greeting {
        message: format!("Bonjour {name} !"),
        timestamp: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs(),
    }
}
```

```ts
interface Greeting { message: string; timestamp: number }
const g = await invoke<Greeting>("greet", { name: "Vue" });
const date = new Date(g.timestamp * 1000).toLocaleString();
```

**4.** `src-tauri/target/debug/taurinote` (ou le nom du produit). Taille typique : 20–80 Mo en debug.

**5.** `src-tauri/` (Cargo.toml, build.rs, tauri.conf.json, capabilities, icons, src/main.rs, src/lib.rs), plus les scripts npm et les dépendances `@tauri-apps/cli`, `@tauri-apps/api`.

---

## Chapitre 03

**1.** Dans `app.windows[0]` :

```json
{ "minWidth": 800, "minHeight": 600 }
```

**2.** L'identifier sert au bundle, aux répertoires de données (`AppConfig`, `AppData`…), à la signature, aux stores, aux deep links et à l'updater. Le changer après publication crée une nouvelle application aux yeux de l'OS et perd les données/identités existantes.

**3.** Logo → `src/assets/logo.png` (import Vite) ou `public/` ; `seed.json` → `src-tauri/resources/seed.json`, déclaré dans `bundle.resources`, lu via `BaseDirectory::Resource`.

**4.** `"csp": null` désactive la CSP : une XSS peut charger des scripts distants et exfiltrer des données. En production, définir une CSP stricte.

**5.** Retirer `tauri-plugin-opener` de `Cargo.toml`, `.plugin(...)` de `lib.rs`, `@tauri-apps/plugin-opener` de `package.json`, `opener:default` de la capability, puis `yarn install` et `cargo update`/rebuild.

---

## Chapitre 04

**1.** `form = { ... }` remplace l'objet et casse le lien réactif. Utiliser `Object.assign(form, nouveau)` ou `ref`.

**2.**

```ts
const doneCount = computed(() => items.value.filter((t) => t.done).length);
const progress = computed(() =>
  items.value.length === 0 ? 0 : Math.round((doneCount.value / items.value.length) * 100)
);
```

**3.** Ajouter une route `/about` et un `<RouterLink to="/about">`. Avec `createWebHashHistory`, l'URL devient `#/about`, ce qui fonctionne après rechargement.

**4.**

```ts
useTauriEvent<{ count: number }>("todos:changed", (payload) => {
  console.log(payload.count);
});
```

Le composable de la section 6.2 gère le cleanup.

**5.**

```ts
const memory: Todo[] = [];

export const todosApi = {
  async list() {
    if (!isTauri()) return [...memory];
    return call<Todo[]>("list_todos");
  },
};
```

---

## Chapitre 05

**1.** Voir section 2. Vérifier `generate_handler![ping]`.

**2.** `{ a: 1, b: 2 }` fonctionne (camelCase par défaut). `{ a: 1, b: 2 }` reste identique car les noms sont d'un seul mot. Avec `first_name`, JS doit envoyer `firstName`, sauf `#[tauri::command(rename_all = "snake_case")]`.

**3.**

```rust
#[tauri::command]
fn divide(a: f64, b: f64) -> Result<f64, String> {
    if b == 0.0 { Err("Division par zéro".into()) } else { Ok(a / b) }
}
```

```ts
try { await invoke<number>("divide", { a: 10, b: 0 }); }
catch (e) { error.value = String(e); }
```

**4.**

```rust
#[tauri::command]
pub fn update_todo(state: State<'_, AppState>, todo: Todo) -> AppResult<Todo> {
    validate_title(&todo.title)?;
    let mut todos = state.todos.lock().map_err(|_| AppError::Lock)?;
    let existing = todos.iter_mut().find(|t| t.id == todo.id)
        .ok_or(AppError::NotFound(todo.id))?;
    *existing = todo.clone();
    Ok(todo)
}
```

**5.**

```rust
#[tauri::command]
async fn slow_double(n: u64) -> u64 {
    tauri::async_runtime::spawn_blocking(move || {
        std::thread::sleep(std::time::Duration::from_millis(500));
        n * 2
    }).await.unwrap_or(0)
}
```

**6.** Valider que le chemin est sous une base autorisée (`canonicalize` + `starts_with`), refuser `..` et les chemins absolus arbitraires, limiter la taille/extension, et passer par un dialogue utilisateur plutôt qu'un chemin fourni par le frontend.

---

## Chapitre 06

**1.**

```rust
#[tauri::command]
fn ping_event(app: tauri::AppHandle) -> Result<(), String> {
    app.emit("app:ping", std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_millis() as u64)
        .map_err(|e| e.to_string())
}
```

```ts
useTauriEvent<number>("app:ping", (ts) => console.log(new Date(ts)));
```

**2.** `emit_to("settings", ...)` ne touche que les webviews dont le label est `settings`. `emit` touche tout le monde.

**3.**

```rust
#[tauri::command]
async fn count_to(n: u32, on_event: tauri::ipc::Channel<Progress>) -> Result<(), String> {
    for current in 1..=n {
        on_event.send(Progress { current }).map_err(|e| e.to_string())?;
        tokio::time::sleep(std::time::Duration::from_millis(100)).await;
    }
    on_event.send(Progress { current: n }).ok();
    Ok(())
}
```

**4.**

```rust
app.listen("ui:route-changed", |event| println!("route={}", event.payload()));
```

```ts
router.afterEach((to) => { void emit("ui:route-changed", to.fullPath); });
```

**5.** Si la fenêtre se ferme, le canal renvoie une erreur au prochain `send`. Utiliser un `AtomicBool` d'annulation, vérifier avant chaque envoi, et arrêter proprement. Pour un import long, exécuter dans une tâche annulable et journaliser l'état.

---

## Chapitre 07

**1.**

```json
// main.json
{ "identifier": "main", "windows": ["main"], "permissions": [
  "core:default", "dialog:default", "fs:default", "sql:default", "sql:allow-execute"
]}
// settings.json
{ "identifier": "settings", "windows": ["settings"], "permissions": [
  "core:default", "store:default"
]}
```

Un `Database.load` depuis `settings` échoue avec `sql.load not allowed`.

**2.** Le `save()` ajoute le chemin choisi au scope de session, donc l'écriture fonctionne même hors `$DOWNLOAD/taurinote/**`. Après redémarrage, le scope est perdu ; `persisted-scope` le conserve.

**3.**

```json
"csp": {
  "default-src": "'self'",
  "script-src": "'self'",
  "style-src": "'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src": "'self' https://fonts.gstatic.com",
  "img-src": "'self' data:",
  "connect-src": "ipc: http://ipc.localhost"
}
```

**4.** Activer `assetProtocol.enable`, ajouter `$APPDATA/**` au scope asset, ajouter `asset:`/`http://asset.localhost` à `img-src`, puis `convertFileSrc(path)` dans `<img :src>`.

**5.** Exemples : retirer `opener:default` si inutilisé ; remplacer `fs:default` par des permissions ciblées ; retirer `sql:allow-execute` si l'app est en lecture seule ; restreindre `windows` à `main`.

**6.**

```rust
fn main() {
    tauri_build::try_build(
        tauri_build::Attributes::new().app_manifest(
            tauri_build::AppManifest::new().commands(&["app_info", "open_settings", "quit_app"]),
        ),
    ).unwrap();
}
```

Une commande non listée est bloquée par le runtime.

---

## Chapitre 08

**1.**

```ts
const path = await open({ filters: [{ name: "JSON", extensions: ["json"] }] });
if (!path) return;
const content = await readTextFile(path as string);
const data = JSON.parse(content);
```

**2.** Voir section 14 ; ajouter le bouton dans `HomeView` et appeler `exportTodos(store.items)`.

**3.**

```ts
import { platform } from "@tauri-apps/plugin-os";
const mod = platform() === "macos" ? "⌘" : "Ctrl";
```

**4.**

```ts
import { fetch } from "@tauri-apps/plugin-http";
const res = await fetch("https://api.github.com/repos/tauri-apps/tauri");
const data = await res.json();
```

```json
{ "identifier": "http:default", "allow": [{ "url": "https://api.github.com/*" }] }
```

**5.** `openPath` peut lancer un exécutable ou ouvrir un fichier avec une application associée ; une entrée malveillante peut exécuter du code. Valider l'extension, le scope et l'origine, ou préférer `revealItemInDir`.

**6.** Placer le binaire nommé `binaries/rg-x86_64-unknown-linux-gnu` (et variantes), déclarer `bundle.externalBin`, puis appeler `Command.sidecar` avec des arguments fixes et une permission `shell:allow-execute` limitée. Encore mieux : une commande Rust qui exécute `std::process::Command` avec validation.

---

## Chapitre 09

**1.** Voir `src/api/settings.ts` et `SettingsView` ; appliquer le thème dans `App.vue` au montage.

**2.**

```sql
-- 003_add_notes.sql
ALTER TABLE todos ADD COLUMN notes TEXT NOT NULL DEFAULT '';
```

Ajouter une `Migration { version: 3, ... }` et rebuild.

**3.**

```ts
async update(id: number, patch: Partial<CreateTodoInput>): Promise<Todo> {
  const db = await getDb();
  const current = (await db.select<TodoRow[]>(`${SELECT} WHERE id = ?`, [id]))[0];
  if (!current) throw new Error("Tâche introuvable");
  const now = new Date().toISOString();
  await db.execute(
    "UPDATE todos SET title = ?, priority = ?, due_date = ?, tags = ?, updated_at = ? WHERE id = ?",
    [patch.title ?? current.title, patch.priority ?? current.priority,
     patch.dueDate ?? current.due_date, JSON.stringify(patch.tags ?? JSON.parse(current.tags)), now, id]
  );
  return rowToTodo((await db.select<TodoRow[]>(`${SELECT} WHERE id = ?`, [id]))[0]);
}
```

**4.**

```sql
SELECT * FROM todos
WHERE done = 0 AND due_date IS NOT NULL AND due_date < date('now')
ORDER BY due_date ASC;
```

**5.** Voir la fonction `importTodos` : `BEGIN`, boucle, `COMMIT`, `ROLLBACK` dans `catch`.

**6.** `title` peut contenir `' OR 1=1 --`, ce qui casse la requête ou permet de lire/modifier des données. Même en local, un fichier importé ou une XSS peut exploiter l'injection. Toujours utiliser `?`.

---

## Chapitre 10

**1.**

```rust
WebviewWindowBuilder::new(&app, "about", WebviewUrl::App("index.html#/about".into()))
    .title("À propos")
    .inner_size(350.0, 250.0)
    .resizable(false)
    .center()
    .build()?;
```

**2.**

```rust
let light = MenuItem::with_id(app, "theme-light", "Thème clair", true, None::<&str>)?;
let dark = MenuItem::with_id(app, "theme-dark", "Thème sombre", true, None::<&str>)?;
let system = MenuItem::with_id(app, "theme-system", "Système", true, None::<&str>)?;
let view = Submenu::with_items(app, "Affichage", true, &[&light, &dark, &system])?;
// on_menu_event : émettre "theme:set" avec la valeur
```

**3.** Ajouter `new_todo` au menu du tray, appeler `show_main_window` puis `app.emit("menu:new-todo", ())`.

**4.** `on_window_event` + `api.prevent_close()` + `hide()`. Le menu du tray appelle `app.exit(0)`. Afficher une notification ou un message la première fois.

**5.** Voir section 6 ; tester avec `yarn tauri dev` puis fenêtre en arrière-plan.

**6.** Configurer `plugins.deep-link.desktop.schemes`, enregistrer `on_open_url` et router vers `/todo/:id` après validation de l'URL.

---

## Chapitre 11

**1.**

```ts
it("découpe les tags", async () => {
  const wrapper = mount(TodoForm);
  await wrapper.find('input[placeholder="Nouvelle tâche…"]').setValue("Test");
  await wrapper.find('input[placeholder="tags, séparés, par virgule"]').setValue("a, b , c");
  await wrapper.find("form").trigger("submit");
  expect(wrapper.emitted("created")?.[0]?.[0]).toMatchObject({ tags: ["a", "b", "c"] });
});
```

**2.**

```ts
mockIPC(() => { throw new Error("boom"); });
await expect(todosApi.list()).rejects.toThrow("boom");
```

**3.** Voir chapitre 11, section 4 ; tester `priorityFilter`, `search`, `remaining`.

**4.**

```rust
#[test]
fn refuse_titre_trop_long() {
    assert!(validate_title(&"x".repeat(201)).is_err());
}
#[test]
fn accepte_titre_limite() {
    assert!(validate_title(&"x".repeat(200)).is_ok());
}
```

**5.**

```ts
it("crée et termine une tâche", async () => {
  const input = await $('[data-testid="new-todo"]');
  await input.setValue("E2E");
  await $('[data-testid="add-todo"]').click();
  await $('[data-testid="todo-checkbox"]').click();
  await expect($('[data-testid="remaining"]')).toHaveText("0 à faire");
});
```

**6.** Causes : chemin d'asset absolu, CSP trop stricte, route history sans rewrite, `frontendDist` incorrect, erreur JS silencieuse, permission manquante. Vérifier la console, les logs Rust, `dist/`, et tester avec `--debug`.

---

## Chapitre 12

**1.** `yarn tauri icon` produit `icons/32x32.png`, `128x128.png`, `128x128@2x.png`, `icon.icns`, `icon.ico`, et les variantes mobiles.

**2.**

```bash
yarn tauri build --bundles deb
yarn tauri build --bundles appimage
```

Installer le `.deb` : `sudo dpkg -i src-tauri/target/release/bundle/deb/*.deb`.

**3.**

```json
"windows": {
  "nsis": { "installMode": "currentUser", "languages": ["French", "English"] }
}
```

**4.** Générer les clés, servir `latest.json` en HTTPS local (ex. `python3 -m http.server` derrière un tunnel TLS), publier `0.1.0`, puis `0.1.1`, et vérifier `check()`.

**5.** `APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY`, `APPLE_ID`, `APPLE_PASSWORD`, `APPLE_TEAM_ID`.

**6.** Le sandbox interdit l'accès fs arbitraire et l'updater intégré ; `shell` et les accès hors sandbox sont incompatibles. Il faut passer par les dialogues et le Mac App Store pour les mises à jour.

---

## Chapitre 13

**1.** `vue-tsc --noEmit` échoue déjà sur les erreurs de type ; ajouter `strict` et un script CI qui exécute `yarn build`.

**2.** `Swatinem/rust-cache` avec `workspaces: "./src-tauri -> target"` ; mesurer la durée avant/après.

**3.** `git tag v0.1.0 && git push origin v0.1.0`, puis vérifier la release brouillon et les 4 artefacts.

**4.** Installer `0.1.0`, publier `0.1.1`, lancer `check()`, vérifier la signature et le redémarrage.

**5.** Voir chapitre 12/13 ; renouveler le certificat avant expiration, mettre à jour le secret, rebuild.

**6.** Dépublier la release défectueuse (la conserver en draft), publier une version corrective supérieure, communiquer, vérifier `latest.json`, et garder un installateur direct.

---

## Chapitre 14

**1.** `rollup-plugin-visualizer`, identifier le plus gros module, remplacer/supprimer, mesurer.

**2.** `let t = Instant::now();` dans `setup`, log, puis différer un plugin non critique et comparer.

**3.** Un composant qui `listen` sans `unlisten` ; naviguer 10 fois, observer les handlers cumulés, corriger avec `onUnmounted`.

**4.** `EXPLAIN QUERY PLAN SELECT ...` avant/après `CREATE INDEX`; vérifier `SEARCH` au lieu de `SCAN`.

**5.** Voir `safe_join` (section 10), avec `canonicalize` et `starts_with`.

**6.**

```json
"csp": {
  "default-src": "'self'",
  "script-src": "'self'",
  "style-src": "'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src": "'self' https://fonts.gstatic.com",
  "img-src": "'self' data:",
  "connect-src": "ipc: http://ipc.localhost https://api.exemple.com"
}
```

**7.** XSS via import de contenu, abus de permissions fs/sql, dépendance compromise. Contre-mesures : CSP, validation, scopes, audit, requêtes paramétrées.

---

## Chapitre 15

Le projet final n'a pas de solution unique. Utilisez la grille d'évaluation (section 6.3) et la checklist fonctionnelle pour valider votre implémentation. Le code de référence est décrit jalon par jalon au [chapitre 15](../cours/15-projet-final.md).

---

[← Chapitre précédent](../cours/14-performance-securite.md) · [README](../README.md) · [Annexe E →](./e-ressources.md)
