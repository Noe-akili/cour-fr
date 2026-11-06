# Annexe F — Rust pour Tauri : le guide essentiel

> **Objectifs**
> - Lire et écrire le Rust utilisé dans un projet Tauri.
> - Comprendre les notions qui posent le plus de questions : ownership, `Result`, `State`, async.
> - Savoir où placer sa logique et comment exposer une commande propre au frontend.
> - Éviter les erreurs de compilation et les pièges de concurrence les plus fréquents.

Sommaire : [← Annexe E](./e-ressources.md) · [README](../README.md) · [Chapitre 05 — Commandes Rust](../cours/05-commandes-rust.md)

---

## 1. Pourquoi Rust dans Tauri ?

Tauri n'embarque pas de navigateur : il utilise la WebView du système pour l'interface et un cœur natif en **Rust** pour :

- créer et gérer les fenêtres, menus, icônes de tray ;
- exposer des commandes au frontend via IPC ;
- accéder aux fichiers, au réseau, aux notifications, à SQLite ;
- appliquer les permissions et la CSP ;
- gérer le cycle de vie de l'application.

Vous pouvez construire beaucoup d'applications avec les plugins officiels et très peu de Rust. Mais dès que vous avez besoin d'une logique système, d'une intégration maison ou d'une optimisation, c'est Rust qui intervient.

> 💡 **Vous n'avez pas besoin de tout apprendre.** Pour ce cours, retenez cinq briques : les types, `Option`/`Result`, l'emprunt (`&`), les structures sérialisables et l'état partagé. Le reste s'ajoute au fil des besoins.

---

## 2. Un programme Rust minimal

```rust
fn main() {
    let nom = "Taurinote";
    println!("Bonjour depuis {nom} !");
}
```

Compilation et exécution :

```bash
rustc main.rs -o taurinote
./taurinote
```

Dans un projet Tauri, vous ne lancez pas `rustc` à la main : **Cargo** s'en charge.

```bash
cargo check      # analyse sans produire de binaire (rapide)
cargo build      # compile en mode debug
cargo run        # compile et exécute
cargo test       # lance les tests
cargo clippy     # conseils de qualité
cargo fmt        # formate le code
```

### `src/main.rs` et `src/lib.rs`

Un projet Tauri récent sépare le point d'entrée et la bibliothèque :

```rust
// src/main.rs
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    taurinote_lib::run();
}
```

```rust
// src/lib.rs
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("erreur au démarrage de Tauri");
}
```

Cette séparation permet de réutiliser la même bibliothèque sur mobile et de tester plus facilement.

---

## 3. Variables, mutabilité et types

```rust
let nom = "Taurinote";        // immutable par défaut
let mut compteur = 0;         // mutable
compteur += 1;

let titre: String = String::from("Première tâche");
let termine: bool = false;
let priorite: u8 = 2;
let tags: Vec<String> = vec!["maison".into(), "urgent".into()];
```

Rust est **statiquement typé** : le type est connu à la compilation. L'inférence évite souvent de l'écrire, mais les types explicites aident à la frontière IPC.

### Les types à connaître

| Type | Usage | Exemple |
|---|---|---|
| `String` | chaîne possédée, modifiable | `String::from("texte")` |
| `&str` | vue empruntée sur une chaîne | `"texte"` |
| `Vec<T>` | liste dynamique | `vec![1, 2, 3]` |
| `Option<T>` | valeur présente ou absente | `Some(42)`, `None` |
| `Result<T, E>` | succès ou erreur | `Ok(todo)`, `Err(e)` |
| `HashMap<K, V>` | dictionnaire | `HashMap::new()` |
| `u32`, `i64`, `f64` | nombres | `42`, `-1`, `3.14` |

### Conversion et formatage

```rust
let nombre = 42;
let texte = nombre.to_string();
let nombre: i32 = "42".parse().expect("nombre invalide");

println!("{texte} — {nombre}");
```

---

## 4. Fonctions et expressions

Une fonction retourne la valeur de sa dernière expression, sans `return` ni point-virgule :

```rust
fn ajouter(a: i32, b: i32) -> i32 {
    a + b
}
```

Le point-virgule transforme une expression en instruction et renvoie `()` :

```rust
fn mauvais(a: i32, b: i32) -> i32 {
    a + b; // ❌ retourne () et ne compile pas
}
```

### Retour anticipé

```rust
fn validate_title(title: &str) -> Result<String, String> {
    let trimmed = title.trim();

    if trimmed.is_empty() {
        return Err("Le titre est obligatoire".into());
    }

    if trimmed.chars().count() > 200 {
        return Err("Le titre est trop long".into());
    }

    Ok(trimmed.to_string())
}
```

> ⚠️ `chars().count()` compte les caractères Unicode, `len()` compte les octets. Pour une limite visible par l'utilisateur, utilisez `chars().count()`.

---

## 5. Structures, énumérations et pattern matching

### Une structure sérialisable

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Todo {
    pub id: i64,
    pub title: String,
    pub done: bool,
    pub priority: Priority,
    pub due_date: Option<String>,
    pub tags: Vec<String>,
    pub created_at: String,
    pub updated_at: String,
}
```

- `#[derive(...)]` génère les implémentations.
- `rename_all = "camelCase"` fait correspondre `due_date` à `dueDate` côté TypeScript.
- `Option<String>` devient `string | null` en JSON.

### Une énumération fermée

```rust
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Priority {
    Low,
    Normal,
    High,
}
```

Côté TypeScript :

```ts
export type Priority = "low" | "normal" | "high";
```

### `match` : exhaustif et lisible

```rust
fn poids(priority: Priority) -> u8 {
    match priority {
        Priority::Low => 1,
        Priority::Normal => 2,
        Priority::High => 3,
    }
}
```

Le compilateur refuse un `match` incomplet. C'est une protection, pas une contrainte.

### `if let` et `let else`

```rust
if let Some(window) = app.get_webview_window("main") {
    let _ = window.show();
}

let Some(window) = app.get_webview_window("main") else {
    return Err("Fenêtre introuvable".into());
};
```

---

## 6. `Option` et `Result`

### `Option<T>` : l'absence fait partie du type

```rust
fn find_todo(todos: &[Todo], id: i64) -> Option<&Todo> {
    todos.iter().find(|todo| todo.id == id)
}
```

Utilisation :

```rust
match find_todo(&todos, 42) {
    Some(todo) => println!("Trouvé : {}", todo.title),
    None => println!("Aucune tâche 42"),
}
```

Chaînage :

```rust
let due = find_todo(&todos, 42)
    .and_then(|todo| todo.due_date.as_deref())
    .unwrap_or("sans échéance");
```

### `Result<T, E>` : l'échec est explicite

```rust
use std::fs;

fn read_config(path: &str) -> Result<String, std::io::Error> {
    fs::read_to_string(path)
}
```

L'opérateur `?` propage l'erreur :

```rust
fn read_title(path: &str) -> Result<String, std::io::Error> {
    let content = fs::read_to_string(path)?;
    Ok(content.lines().next().unwrap_or("").to_string())
}
```

### Commandes Tauri : `Result<T, String>`

Pour une application simple, l'erreur sérialisable la plus pratique est une chaîne :

```rust
#[tauri::command]
fn create_todo(title: String) -> Result<Todo, String> {
    let title = validate_title(&title)?;
    // ...
    Ok(todo)
}
```

Côté TypeScript :

```ts
try {
  const todo = await invoke<Todo>("create_todo", { title });
} catch (error) {
  // error est la chaîne renvoyée par Rust
  console.error(String(error));
}
```

> 💡 Pour une application plus grosse, préférez un type d'erreur maison (section 13). `String` est parfait pour démarrer et pour les exercices.

---

## 7. Ownership, borrowing et lifetimes

C'est la notion qui distingue Rust. Retenez trois règles :

1. Chaque valeur a **un seul propriétaire**.
2. Il peut y avoir plusieurs emprunts **immuables** (`&T`) ou **un seul** emprunt **mutable** (`&mut T`).
3. Une référence ne peut pas survivre à la valeur qu'elle emprunte.

### Déplacement

```rust
let titre = String::from("Acheter du café");
let deplace = titre;

// println!("{titre}"); // ❌ titre a été déplacé
println!("{deplace}");  // ✅
```

### Emprunt

```rust
fn compter_restantes(todos: &[Todo]) -> usize {
    todos.iter().filter(|todo| !todo.done).count()
}

let total = compter_restantes(&todos); // on prête la liste
println!("{} tâches", todos.len());    // ✅ toujours utilisable
```

### Cloner quand c'est justifié

```rust
let copie = todo.title.clone();
```

`clone()` a un coût. Ne l'utilisez pas pour contourner une erreur de compilation sans comprendre : souvent, un emprunt suffit.

### Lifetimes

La plupart du temps, le compilateur les infère. Vous les rencontrez avec les références stockées ou les retours de fonctions :

```rust
fn first_word(text: &str) -> &str {
    text.split_whitespace().next().unwrap_or("")
}
```

Ici, le lien de vie est évident. Pour un état Tauri, vous verrez souvent `State<'_, AppState>` : la durée de vie est liée à l'appel de la commande.

---

## 8. Modules et organisation

```text
src-tauri/src/
├── main.rs
├── lib.rs
├── commands/
│   ├── mod.rs
│   ├── todos.rs
│   └── system.rs
├── error.rs
├── state.rs
└── tray.rs
```

```rust
// lib.rs
mod commands;
mod error;
mod state;
mod tray;

pub fn run() {
    tauri::Builder::default()
        .manage(state::AppState::default())
        .invoke_handler(tauri::generate_handler![
            commands::todos::list_todos,
            commands::todos::create_todo,
            commands::system::app_info,
        ])
        .run(tauri::generate_context!())
        .expect("erreur Tauri");
}
```

```rust
// commands/todos.rs
use crate::state::AppState;
use tauri::State;

#[tauri::command]
pub fn list_todos(state: State<'_, AppState>) -> Result<Vec<Todo>, String> {
    let todos = state.todos.lock().map_err(|e| e.to_string())?;
    Ok(todos.clone())
}
```

### Visibilité

| Syntaxe | Portée |
|---|---|
| `fn` | privé au module |
| `pub fn` | public |
| `pub(crate) fn` | visible dans le crate, pas à l'extérieur |
| `pub(super)` | visible dans le module parent |

Un module déclaré avec `mod` doit être accessible depuis `lib.rs`. Pour un sous-dossier, créez `commands/mod.rs` :

```rust
pub mod system;
pub mod todos;
```

---

## 9. Serde : le pont JSON avec le frontend

Tauri sérialise les arguments et les retours de commandes en JSON. Serde fait la traduction.

```rust
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct CreateTodoInput {
    title: String,
    priority: Option<Priority>,
    due_date: Option<String>,
    tags: Option<Vec<String>>,
}

#[tauri::command]
fn create_todo(input: CreateTodoInput) -> Result<Todo, String> {
    // input.title, input.due_date…
    todo!()
}
```

```ts
await invoke("create_todo", {
  input: {
    title: "Préparer la démo",
    priority: "high",
    dueDate: "2026-11-12",
    tags: ["tauri", "rust"],
  },
});
```

### Les erreurs de nommage

| Rust | JSON / TypeScript |
|---|---|
| `snake_case` | `snake_case` par défaut |
| `snake_case` + `rename_all = "camelCase"` | `camelCase` |
| `Option<T>` | `T \| null` |
| `Vec<T>` | `T[]` |
| enum + `rename_all = "lowercase"` | chaîne minuscule |

> ⚠️ Si un champ est absent du JSON mais non `Option`, la désérialisation échoue. Rendez optionnel tout ce qui peut l'être, ou fournissez `#[serde(default)]`.

```rust
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Settings {
    #[serde(default = "default_theme")]
    theme: String,
    #[serde(default = "default_true")]
    notifications: bool,
}

fn default_theme() -> String {
    "system".into()
}

fn default_true() -> bool {
    true
}
```

---

## 10. État partagé et concurrence

Une commande peut être appelée plusieurs fois en parallèle. L'état doit donc être protégé.

```rust
use std::sync::Mutex;

#[derive(Default)]
pub struct AppState {
    pub todos: Mutex<Vec<Todo>>,
}
```

Enregistrement :

```rust
tauri::Builder::default()
    .manage(AppState::default())
```

Accès :

```rust
#[tauri::command]
fn add_todo(state: tauri::State<'_, AppState>, title: String) -> Result<(), String> {
    let mut todos = state.todos.lock().map_err(|e| e.to_string())?;
    todos.push(Todo {
        id: 0,
        title,
        done: false,
        // ...
    });
    Ok(())
}
```

### `Mutex` ou `RwLock` ?

| Verrou | Quand l'utiliser |
|---|---|
| `Mutex<T>` | lectures et écritures mélangées, sections courtes |
| `RwLock<T>` | beaucoup de lectures, peu d'écritures |
| `tokio::sync::Mutex` | verrou conservé à travers un `.await` |

> ⚠️ Ne gardez pas un `std::sync::MutexGuard` à travers un `.await` : le guard n'est pas `Send` et le compilateur refusera la commande async. Relâchez le verrou avant l'attente, ou utilisez `tokio::sync::Mutex`.

### Le piège du double verrou

```rust
let todos = state.todos.lock().unwrap();
let first = todos.first();

// ❌ tentative de verrouiller à nouveau le même Mutex
let count = state.todos.lock().unwrap().len();
```

Un `Mutex` standard n'est pas réentrant : le second verrou bloque indéfiniment. Faites tout dans une seule section critique.

---

## 11. Async et await

Une commande asynchrone permet de ne pas bloquer le thread principal :

```rust
#[tauri::command]
async fn slow_report() -> Result<String, String> {
    let result = tauri::async_runtime::spawn_blocking(|| {
        // calcul lourd ou opération bloquante
        std::thread::sleep(std::time::Duration::from_secs(2));
        "rapport prêt".to_string()
    })
    .await
    .map_err(|e| e.to_string())?;

    Ok(result)
}
```

Règles pratiques :

- Une opération **bloquante** (fichier, SQL lourd, calcul) va dans `spawn_blocking`.
- Une opération **asynchrone** (HTTP, timer) peut utiliser `.await`.
- Une commande `async` doit retourner un type `Send`.
- Les arguments empruntés doivent avoir une durée de vie explicite : `State<'_, T>`.

```rust
#[tauri::command]
async fn fetch_status(url: String) -> Result<String, String> {
    let response = reqwest::get(&url).await.map_err(|e| e.to_string())?;
    let status = response.status().to_string();
    Ok(status)
}
```

> 💡 Le plugin `sql` gère ses propres opérations asynchrones. Vous n'avez généralement pas besoin d'écrire du SQL en Rust : le frontend peut l'appeler directement via `@tauri-apps/plugin-sql`.

---

## 12. Traits et génériques : le minimum

Un **trait** définit un comportement. Un **générique** rend une fonction réutilisable.

```rust
fn first<T>(items: &[T]) -> Option<&T> {
    items.first()
}

let premier = first(&todos);
```

Un trait maison :

```rust
trait Summary {
    fn summary(&self) -> String;
}

impl Summary for Todo {
    fn summary(&self) -> String {
        let statut = if self.done { "terminée" } else { "en cours" };
        format!("{} — {}", self.title, statut)
    }
}
```

Dans Tauri, les traits les plus utiles viennent de l'écosystème : `Serialize`, `Deserialize`, `Display`, `Error`, `From`.

---

## 13. Erreurs applicatives propres

Pour dépasser `Result<T, String>`, créez une enum d'erreurs :

```rust
use serde::ser::{Serialize, Serializer};

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("base de données : {0}")]
    Database(#[from] sqlx::Error),

    #[error("validation : {0}")]
    Validation(String),

    #[error("fenêtre introuvable : {0}")]
    Window(String),
}

impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}
```

```toml
[dependencies]
thiserror = "2"
```

Utilisation :

```rust
#[tauri::command]
fn rename_todo(id: i64, title: String) -> Result<(), AppError> {
    let title = validate_title(&title).map_err(AppError::Validation)?;
    // ...
    Ok(())
}
```

Côté TypeScript, l'erreur reste une chaîne lisible. Pour transmettre un code machine, sérialisez plutôt une structure :

```rust
#[derive(Serialize)]
struct ErrorPayload {
    code: &'static str,
    message: String,
}
```

> ⚠️ N'exposez jamais un message interne contenant un chemin absolu, une requête SQL ou un secret. Journalisez le détail côté Rust, renvoyez un message utilisateur.

---

## 14. Tester du Rust

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn valide_un_titre_normal() {
        assert_eq!(validate_title("  Acheter du pain  ").unwrap(), "Acheter du pain");
    }

    #[test]
    fn refuse_un_titre_vide() {
        assert!(validate_title("   ").is_err());
    }

    #[test]
    fn compte_les_taches_restantes() {
        let todos = vec![
            Todo { done: false, ..Default::default() },
            Todo { done: true, ..Default::default() },
        ];
        assert_eq!(compter_restantes(&todos), 1);
    }
}
```

```bash
cd src-tauri
cargo test
cargo test valide_un_titre -- --nocapture
```

Pour tester une commande Tauri, testez d'abord la **fonction pure** qu'elle appelle. L'IPC et les fenêtres se testent plus difficilement ; isolez la logique.

---

## 15. Les API Tauri à connaître

```rust
use tauri::{AppHandle, Emitter, Manager, State, WebviewWindow};
```

| API | Rôle |
|---|---|
| `app.get_webview_window("main")` | récupérer une fenêtre par son label |
| `window.show()` / `hide()` / `set_focus()` | piloter une fenêtre |
| `app.emit("event", payload)` | émettre vers toutes les fenêtres |
| `app.emit_to("main", "event", payload)` | émettre vers une fenêtre |
| `state.inner()` | accéder à l'état géré |
| `app.exit(0)` | quitter l'application |
| `tauri::async_runtime::spawn` | lancer une tâche asynchrone |
| `app.path().app_config_dir()` | répertoire de configuration |

Exemple complet :

```rust
#[tauri::command]
fn notify_todos_changed(app: AppHandle, count: usize) -> Result<(), String> {
    app.emit("todos:changed", count).map_err(|e| e.to_string())
}

#[derive(Clone, serde::Serialize)]
struct ThemePayload {
    theme: String,
}

#[tauri::command]
fn broadcast_theme(app: AppHandle, theme: String) {
    let _ = app.emit_to("main", "theme:changed", ThemePayload { theme });
}
```

### Fermer vers le tray

```rust
.on_window_event(|window, event| {
    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
        if window.label() == "main" {
            api.prevent_close();
            let _ = window.hide();
        }
    }
})
```

### Erreurs de compilation fréquentes

| Message | Cause probable | Correction |
|---|---|---|
| `cannot move out of borrowed content` | tentative de déplacer une valeur empruntée | cloner, ou emprunter avec `&` |
| `borrowed value does not live long enough` | référence vers une variable locale | retourner une valeur possédée (`String`, `Vec`) |
| `the trait Serialize is not implemented` | type de retour non sérialisable | ajouter `#[derive(Serialize)]` |
| `future is not Send` | guard de `Mutex` gardé pendant un `await` | relâcher le verrou ou utiliser `tokio::sync::Mutex` |
| `state is not managed` | `.manage(...)` oublié | enregistrer l'état dans le builder |
| `command not found` | commande absente de `generate_handler!` | l'ajouter à la liste |

---

## 16. Anti-patterns à éviter

- **Trop de Rust.** Si un plugin officiel couvre le besoin, utilisez-le.
- **`unwrap()` partout.** Dans une commande, renvoyez une erreur ; `unwrap()` tue le processus.
- **Bloquer le thread principal.** Déplacez les opérations lentes dans `spawn_blocking`.
- **Stocker un `AppHandle` dans un état global inutilement.** Les commandes le reçoivent en argument.
- **Exposer des chemins arbitraires au frontend.** Validez et limitez les accès via les permissions.
- **Mélanger logique métier et IPC.** Une fonction pure testable vaut mieux qu'une commande géante.
- **Ignorer Clippy.** `cargo clippy -- -D warnings` attrape beaucoup de bugs.

---

## 17. Aide-mémoire

```rust
// Structure sérialisable
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct Todo { id: i64, title: String }

// Commande synchrone
#[tauri::command]
fn ping() -> String { "pong".into() }

// Commande avec état
#[tauri::command]
fn list(state: tauri::State<'_, AppState>) -> Result<Vec<Todo>, String> {
    let todos = state.todos.lock().map_err(|e| e.to_string())?;
    Ok(todos.clone())
}

// Commande asynchrone
#[tauri::command]
async fn report() -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(|| "ok".to_string())
        .await
        .map_err(|e| e.to_string())
}

// Enregistrement
tauri::Builder::default()
    .manage(AppState::default())
    .invoke_handler(tauri::generate_handler![ping, list, report])
```

```toml
# Cargo.toml
[dependencies]
tauri = { version = "2", features = ["tray-icon"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
thiserror = "2"
```

---

## 18. Exercices

### Exercice 1 — Compter les tâches restantes

Écrivez une fonction qui prend `&[Todo]` et retourne le nombre de tâches non terminées.

```rust
fn compter_restantes(todos: &[Todo]) -> usize {
    // à compléter
}
```

<details>
<summary>Solution</summary>

```rust
fn compter_restantes(todos: &[Todo]) -> usize {
    todos.iter().filter(|todo| !todo.done).count()
}
```

</details>

### Exercice 2 — Valider une priorité

Écrivez `parse_priority(value: &str) -> Result<Priority, String>` qui accepte `low`, `normal`, `high` (insensible à la casse).

<details>
<summary>Solution</summary>

```rust
fn parse_priority(value: &str) -> Result<Priority, String> {
    match value.to_lowercase().as_str() {
        "low" => Ok(Priority::Low),
        "normal" => Ok(Priority::Normal),
        "high" => Ok(Priority::High),
        other => Err(format!("priorité inconnue : {other}")),
    }
}
```

</details>

### Exercice 3 — État partagé

Ajoutez un champ `settings` protégé par `Mutex` dans `AppState` et une commande `get_theme` qui renvoie le thème courant.

<details>
<summary>Solution</summary>

```rust
#[derive(Default)]
struct Settings {
    theme: String,
}

#[derive(Default)]
struct AppState {
    settings: std::sync::Mutex<Settings>,
}

#[tauri::command]
fn get_theme(state: tauri::State<'_, AppState>) -> Result<String, String> {
    let settings = state.settings.lock().map_err(|e| e.to_string())?;
    Ok(settings.theme.clone())
}
```

</details>

### Exercice 4 — Erreur propre

Transformez une fonction qui utilise `unwrap()` en une fonction qui retourne `Result<T, String>`.

<details>
<summary>Solution</summary>

```rust
// Avant
fn read_title(path: &str) -> String {
    std::fs::read_to_string(path).unwrap()
}

// Après
fn read_title(path: &str) -> Result<String, String> {
    std::fs::read_to_string(path).map_err(|e| format!("lecture impossible : {e}"))
}
```

</details>

### Exercice 5 — Trouver l'erreur

```rust
#[tauri::command]
async fn count(state: tauri::State<'_, AppState>) -> Result<usize, String> {
    let todos = state.todos.lock().map_err(|e| e.to_string())?;
    let total = some_async_call().await;
    Ok(todos.len() + total)
}
```

<details>
<summary>Solution</summary>

Le `MutexGuard` est conservé à travers le `.await`. La commande ne compile pas car le futur n'est pas `Send`. Relâchez le verrou avant l'attente :

```rust
#[tauri::command]
async fn count(state: tauri::State<'_, AppState>) -> Result<usize, String> {
    let len = {
        let todos = state.todos.lock().map_err(|e| e.to_string())?;
        todos.len()
    };

    let total = some_async_call().await;
    Ok(len + total)
}
```

</details>

---

## 19. Ce qu'il faut retenir

- Rust est le cœur natif de Tauri ; le frontend reste en TypeScript.
- `Option` et `Result` remplacent `null` et les exceptions implicites.
- Les commandes sont des fonctions Rust annotées, enregistrées dans `generate_handler!`.
- Serde relie les structures Rust au JSON du frontend.
- L'état partagé passe par `.manage()` et `State<'_, T>`.
- Une commande lente doit être asynchrone ou déléguée à `spawn_blocking`.
- Testez les fonctions pures, gardez les commandes minces.

---

[← Annexe E](./e-ressources.md) · [README](../README.md) · [Chapitre 05 — Commandes Rust →](../cours/05-commandes-rust.md)
