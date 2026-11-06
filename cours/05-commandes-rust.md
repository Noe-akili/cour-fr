# 05 — Appeler Rust depuis Vue : les commandes

> **Objectifs**
> - Écrire, enregistrer et appeler une commande Rust.
> - Passer des données structurées dans les deux sens avec Serde.
> - Gérer proprement les erreurs et les types de retour.
> - Utiliser l'état partagé (`State`) et les commandes asynchrones.
> - Organiser les commandes en modules et sécuriser les entrées.
> - Implémenter le CRUD complet des tâches de Taurinote.

Sommaire : [← Chapitre précédent](./04-vue-fondamentaux.md) · [README](../README.md) · [Chapitre suivant →](./06-evenements-canaux.md)

---

## 1. Le modèle requête/réponse

Une **commande** est une fonction Rust exposée au frontend. Le frontend l'appelle avec `invoke`, envoie des arguments JSON, et reçoit une réponse JSON (ou une erreur).

```
Vue                          IPC                        Rust
 │                            │                          │
 │ invoke("create_todo", {    │                          │
 │   input: {...}             │  sérialisation JSON      │
 │ }) ───────────────────────▶│─────────────────────────▶│ create_todo(input)
 │                            │                          │   ├─ valide
 │                            │                          │   ├─ met à jour l'état
 │                            │  désérialisation         │   └─ retourne Todo
 │◀───────────────────────────│◀─────────────────────────│
 │  Promise<Todo>             │                          │
```

Caractéristiques :

- **Asynchrone** : `invoke` retourne toujours une `Promise`.
- **Typé côté JS** : `invoke<T>` est une assertion de type, pas une vérification runtime.
- **Sérialisé** : les données doivent être compatibles JSON (ou utiliser un canal binaire pour les gros volumes).
- **Unidirectionnel** : le frontend initie, Rust répond. Pour pousser des données, utilisez les événements (chapitre 06).

---

## 2. Première commande, de bout en bout

### 2.1 Rust

`src-tauri/src/lib.rs` :

```rust
#[tauri::command]
fn ping() -> String {
    "pong".to_string()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![ping])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### 2.2 Vue

```ts
import { invoke } from "@tauri-apps/api/core";

const answer = await invoke<string>("ping");
console.log(answer); // "pong"
```

### 2.3 Règles de nommage

| Élément | Convention |
|---|---|
| Nom de commande | `snake_case` en Rust (`create_todo`) |
| Appel JS | Même nom, en `snake_case` |
| Arguments JS | `camelCase` par défaut |
| Paramètres Rust | `snake_case` |
| Champs de structs | `snake_case` en Rust, souvent `camelCase` via Serde |

Exemple :

```rust
#[tauri::command]
fn greet_user(first_name: String, last_name: String) -> String { … }
```

```ts
await invoke("greet_user", { firstName: "Ada", lastName: "Lovelace" });
```

Pour changer la convention des arguments :

```rust
#[tauri::command(rename_all = "snake_case")]
fn greet_user(first_name: String) { … }
```

```ts
await invoke("greet_user", { first_name: "Ada" });
```

> ⚠️ Choisissez une convention et tenez-la. Le mélange `camelCase`/`snake_case` est la première cause d'erreurs `invalid args`.

---

## 3. Passer des structures avec Serde

### 3.1 Côté Rust

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Todo {
    pub id: i64,
    pub title: String,
    pub done: bool,
    pub priority: Priority,
    pub due_date: Option<String>, // "2026-11-10" ou null
    pub tags: Vec<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum Priority {
    Low,
    Normal,
    High,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateTodoInput {
    pub title: String,
    pub priority: Priority,
    pub due_date: Option<String>,
    pub tags: Vec<String>,
}
```

- `rename_all = "camelCase"` aligne les champs sur TypeScript (`dueDate`, `createdAt`).
- `Option<T>` accepte `null` ou l'absence du champ.
- Les enums unitaires se sérialisent en chaînes (`"low"`, `"normal"`, `"high"`).
- `#[serde(default)]` permet d'omettre un champ et d'utiliser `Default`.

### 3.2 Côté TypeScript

```ts
export type Priority = "low" | "normal" | "high";

export interface Todo {
  id: number;
  title: string;
  done: boolean;
  priority: Priority;
  dueDate: string | null;
  tags: string[];
  createdAt: string;
}

export interface CreateTodoInput {
  title: string;
  priority: Priority;
  dueDate: string | null;
  tags: string[];
}
```

### 3.3 Synchroniser les types automatiquement

Deux options :

1. **Manuel** (ce cours) : simple, mais source d'oublis.
2. **Génération** avec [`tauri-specta`](https://github.com/specta-rs/tauri-specta) ou [`ts-rs`](https://github.com/Aleph-Alpha/ts-rs) : les types TypeScript sont produits depuis Rust.

Exemple avec `ts-rs` :

```rust
#[derive(Serialize, Deserialize, TS)]
#[ts(export, export_to = "../src/types/generated/")]
#[serde(rename_all = "camelCase")]
pub struct Todo { … }
```

Pour un projet qui grandit, la génération évite les désynchronisations silencieuses.

---

## 4. Gérer les erreurs

### 4.1 `Result<T, E>`

Une commande peut retourner `Result<T, E>` où `E: Serialize` :

```rust
#[tauri::command]
fn divide(a: f64, b: f64) -> Result<f64, String> {
    if b == 0.0 {
        Err("Division par zéro".into())
    } else {
        Ok(a / b)
    }
}
```

Côté JS, une erreur rejette la promesse :

```ts
try {
  const result = await invoke<number>("divide", { a: 10, b: 0 });
} catch (error) {
  console.error(error); // "Division par zéro"
}
```

### 4.2 Un type d'erreur applicatif

Pour un vrai projet, un enum d'erreurs est plus maintenable que des `String` éparpillées.

`src-tauri/src/error.rs` :

```rust
use serde::Serialize;

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("Tâche introuvable : {0}")]
    NotFound(i64),

    #[error("Données invalides : {0}")]
    Validation(String),

    #[error("Erreur de base de données : {0}")]
    Database(String),

    #[error("Erreur d'entrée/sortie : {0}")]
    Io(#[from] std::io::Error),

    #[error("État interne verrouillé")]
    Lock,
}

// Tauri exige que l'erreur soit sérialisable.
impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

pub type AppResult<T> = Result<T, AppError>;
```

Ajoutez la dépendance :

```bash
cd src-tauri
cargo add thiserror
```

> 🔒 Ne renvoyez jamais au frontend des détails internes sensibles (chemins absolus, requêtes SQL, secrets). Un message utilisateur clair suffit ; loggez le détail côté Rust.

### 4.3 Erreurs personnalisées côté JS

```ts
export class AppError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AppError";
  }
}
```

Tauri sérialise l'erreur en chaîne ; vous pouvez aussi retourner un objet `{ code, message }` si vous préférez :

```rust
#[derive(Serialize)]
struct ErrorPayload {
    code: &'static str,
    message: String,
}
```

Mais `Result<T, String>` ou un enum sérialisé en message reste le plus simple.

---

## 5. État partagé avec `State`

### 5.1 Déclarer l'état

`src-tauri/src/state.rs` :

```rust
use std::sync::Mutex;
use crate::models::Todo;

pub struct AppState {
    pub todos: Mutex<Vec<Todo>>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            todos: Mutex::new(Vec::new()),
        }
    }
}
```

### 5.2 L'enregistrer

```rust
tauri::Builder::default()
    .manage(AppState::default())
    .invoke_handler(tauri::generate_handler![list_todos, create_todo])
    .run(tauri::generate_context!())
    .expect("…");
```

`manage` peut être appelé plusieurs fois pour plusieurs états ; Tauri les distingue par leur type.

### 5.3 L'utiliser dans une commande

```rust
use tauri::State;
use crate::error::{AppError, AppResult};
use crate::models::Todo;

#[tauri::command]
pub fn list_todos(state: State<'_, AppState>) -> AppResult<Vec<Todo>> {
    let todos = state.todos.lock().map_err(|_| AppError::Lock)?;
    Ok(todos.clone())
}
```

Points importants :

- `State<'_, T>` est injecté automatiquement, **sans argument côté JS**.
- Le `Mutex` protège l'accès concurrent.
- On clone les données avant de relâcher le verrou pour ne pas bloquer inutilement.
- Un `Mutex` empoisonné (`poisoned`) est converti en erreur applicative.

### 5.4 CRUD complet

`src-tauri/src/commands/todos.rs` :

```rust
use tauri::State;
use crate::error::{AppError, AppResult};
use crate::models::{CreateTodoInput, Priority, Todo};
use crate::state::AppState;

fn now_iso() -> String {
    // Sans dépendance supplémentaire : timestamp RFC 3339 via chrono si ajouté.
    // Pour l'exemple, on stocke un timestamp Unix en chaîne.
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
        .to_string()
}

#[tauri::command]
pub fn list_todos(state: State<'_, AppState>) -> AppResult<Vec<Todo>> {
    let todos = state.todos.lock().map_err(|_| AppError::Lock)?;
    Ok(todos.clone())
}

#[tauri::command]
pub fn create_todo(
    state: State<'_, AppState>,
    input: CreateTodoInput,
) -> AppResult<Todo> {
    let title = input.title.trim();
    if title.is_empty() {
        return Err(AppError::Validation("Le titre est obligatoire.".into()));
    }
    if title.chars().count() > 200 {
        return Err(AppError::Validation("Le titre est limité à 200 caractères.".into()));
    }

    let mut todos = state.todos.lock().map_err(|_| AppError::Lock)?;

    let id = todos.iter().map(|t| t.id).max().unwrap_or(0) + 1;
    let todo = Todo {
        id,
        title: title.to_string(),
        done: false,
        priority: input.priority,
        due_date: input.due_date,
        tags: input.tags,
        created_at: now_iso(),
    };

    todos.push(todo.clone());
    Ok(todo)
}

#[tauri::command]
pub fn toggle_todo(state: State<'_, AppState>, id: i64) -> AppResult<Todo> {
    let mut todos = state.todos.lock().map_err(|_| AppError::Lock)?;
    let todo = todos
        .iter_mut()
        .find(|t| t.id == id)
        .ok_or(AppError::NotFound(id))?;

    todo.done = !todo.done;
    Ok(todo.clone())
}

#[tauri::command]
pub fn delete_todo(state: State<'_, AppState>, id: i64) -> AppResult<()> {
    let mut todos = state.todos.lock().map_err(|_| AppError::Lock)?;
    let index = todos
        .iter()
        .position(|t| t.id == id)
        .ok_or(AppError::NotFound(id))?;

    todos.remove(index);
    Ok(())
}
```

`src-tauri/src/commands/mod.rs` :

```rust
pub mod todos;
```

`src-tauri/src/lib.rs` :

```rust
mod commands;
mod error;
mod models;
mod state;

use state::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            commands::todos::list_todos,
            commands::todos::create_todo,
            commands::todos::toggle_todo,
            commands::todos::delete_todo,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

> ⚠️ `generate_handler!` accepte les chemins de modules. Une commande non listée renvoie `Command <name> not found`. Une faute de frappe dans le nom de module produit une erreur de compilation — bonne nouvelle.

### 5.5 Côté Vue

```ts
import { call } from "@/api/client";
import type { CreateTodoInput, Todo } from "@/types";

export const todosApi = {
  list: () => call<Todo[]>("list_todos"),
  create: (input: CreateTodoInput) => call<Todo>("create_todo", { input }),
  toggle: (id: number) => call<Todo>("toggle_todo", { id }),
  remove: (id: number) => call<void>("delete_todo", { id }),
};
```

---

## 6. Commandes asynchrones

### 6.1 `async fn`

```rust
#[tauri::command]
async fn fetch_stats(state: State<'_, AppState>) -> AppResult<Stats> {
    // Ici, on peut await sans bloquer le thread principal.
    let todos = state.todos.lock().map_err(|_| AppError::Lock)?;
    let total = todos.len();
    drop(todos); // on relâche le verrou avant tout await éventuel

    Ok(Stats { total, done: 0 })
}
```

Une commande `async` s'exécute sur le runtime asynchrone de Tauri (Tokio). Elle ne bloque pas l'UI.

### 6.2 Travail bloquant

Pour du CPU lourd ou des I/O bloquantes, utilisez `spawn_blocking` :

```rust
#[tauri::command]
async fn import_csv(path: String) -> AppResult<usize> {
    let count = tauri::async_runtime::spawn_blocking(move || {
        let content = std::fs::read_to_string(path)?;
        let lines = content.lines().count();
        Ok::<usize, std::io::Error>(lines)
    })
    .await
    .map_err(|e| AppError::Database(e.to_string()))??;

    Ok(count)
}
```

> ⚠️ Ne faites jamais de `std::thread::sleep`, de lecture disque massive ou de calcul intensif directement dans une commande synchrone : vous figeriez l'interface.

### 6.3 `Mutex` et `await`

Avec `std::sync::Mutex`, **ne gardez jamais le verrou à travers un `.await`** :

```rust
// ❌ Mauvais : le garde est tenu pendant l'await
let todos = state.todos.lock().unwrap();
some_async_call().await;
drop(todos);

// ✅ Bon : libérer avant l'await
let snapshot = {
    let todos = state.todos.lock().unwrap();
    todos.clone()
};
some_async_call().await;
```

Si vous avez besoin de verrous asynchrones, utilisez `tokio::sync::Mutex` et `state.todos.lock().await`.

---

## 7. Accéder à l'application et à la fenêtre

```rust
use tauri::{AppHandle, Manager, WebviewWindow};

#[tauri::command]
fn app_info(app: AppHandle) -> AppResult<AppInfo> {
    let package = app.package_info();
    Ok(AppInfo {
        name: package.name.clone(),
        version: package.version.to_string(),
        tauri_version: tauri::VERSION.to_string(),
    })
}

#[tauri::command]
fn hide_main_window(window: WebviewWindow) -> AppResult<()> {
    window.hide().map_err(|e| AppError::Validation(e.to_string()))
}
```

- `AppHandle` : accès global (emit, fenêtres, chemins, état).
- `WebviewWindow` : la fenêtre qui a appelé la commande.
- `Window` : équivalent sans accès à la WebView.
- Injectez-les en paramètre ; Tauri les fournit automatiquement.

Pour émettre un événement depuis une commande, il faut le trait `Emitter` :

```rust
use tauri::Emitter;

#[tauri::command]
fn notify_frontend(app: AppHandle, message: String) -> AppResult<()> {
    app.emit("app:message", message)
        .map_err(|e| AppError::Validation(e.to_string()))
}
```

---

## 8. Valider les entrées

Le frontend est **non fiable** : une commande peut être appelée par n'importe quel code exécuté dans la WebView (XSS, extension, DevTools).

Règles :

1. Validez les longueurs, formats et plages.
2. Refusez les chemins non attendus (path traversal).
3. Ne construisez jamais une requête SQL par concaténation.
4. Limitez les tailles de payload.
5. N'exposez que les commandes nécessaires.

```rust
fn validate_title(title: &str) -> AppResult<()> {
    let title = title.trim();
    if title.is_empty() {
        return Err(AppError::Validation("Titre vide.".into()));
    }
    if title.chars().count() > 200 {
        return Err(AppError::Validation("Titre trop long.".into()));
    }
    if title.contains('\0') {
        return Err(AppError::Validation("Caractère interdit.".into()));
    }
    Ok(())
}
```

Pour les dates, validez le format ISO (`YYYY-MM-DD`) avec `chrono` ou `time` plutôt qu'une simple regex naïve.

---

## 9. Tests rapides des commandes

Une commande qui ne dépend pas de `State` ni de `AppHandle` est une fonction Rust normale :

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn refuse_un_titre_vide() {
        assert!(validate_title("   ").is_err());
    }

    #[test]
    fn accepte_un_titre_normal() {
        assert!(validate_title("Acheter du pain").is_ok());
    }
}
```

Pour tester avec état, extrayez la logique dans des fonctions pures qui prennent `&mut Vec<Todo>`, puis testez-les. Nous approfondissons au chapitre 11.

---

## 10. Erreurs fréquentes

| Erreur | Cause | Correction |
|---|---|---|
| `Command X not found` | Non enregistrée dans `generate_handler!` | Ajouter le chemin exact |
| `invalid args 'input'` | Mauvais nom/clé d'argument | Vérifier `camelCase` |
| `missing field 'dueDate'` | Serde attend `due_date` sans `rename_all` | Ajouter `#[serde(rename_all = "camelCase")]` |
| `state not managed` | `manage()` oublié | Ajouter `.manage(...)` |
| `cannot find type AppState` | Module non déclaré | `mod state;` |
| `the trait Serialize is not implemented for AppError` | Implémentation manquante | Implémenter `Serialize` |
| Deadlock | Verrou tenu pendant un `await` | Cloner puis relâcher |
| UI figée | Travail bloquant en sync | `async` + `spawn_blocking` |

---

## À retenir

- `#[tauri::command]` + `generate_handler!` = commande exposée.
- Les arguments JS sont en `camelCase`, les paramètres Rust en `snake_case`.
- Serde sérialise les structs ; `rename_all = "camelCase"` aligne les deux mondes.
- Retournez `Result<T, E>` avec `E: Serialize` pour des erreurs propres.
- `State<'_, T>` injecte l'état partagé sans argument JS.
- Les commandes `async` ne bloquent pas l'UI ; `spawn_blocking` pour le travail lourd.
- Ne tenez pas un `Mutex` standard à travers un `await`.
- Validez toujours les entrées côté Rust.

---

## Exercices

1. **Ping.** Ajoutez `ping()` et un bouton. Vérifiez le nom dans `generate_handler!`.
2. **Typage.** Créez une commande `add(a: i32, b: i32) -> i32` et appelez-la avec des arguments `camelCase` puis `snake_case`. Que se passe-t-il ?
3. **Erreur.** Écrivez `divide` qui retourne une erreur si `b == 0`, et affichez-la dans l'UI.
4. **CRUD.** Implémentez `update_todo(todo: Todo)` avec validation de l'ID et du titre.
5. **Async.** Écrivez une commande `slow_double(n: u64)` qui attend 500 ms via `spawn_blocking` et retourne `n * 2`, sans figer l'interface.
6. **Sécurité.** Une commande `read_file(path)` est exposée. Proposez trois protections minimales.

Solutions : [annexe D](../annexes/d-solutions.md#chapitre-05).

---

[← Chapitre précédent](./04-vue-fondamentaux.md) · [README](../README.md) · [Chapitre suivant : événements et canaux →](./06-evenements-canaux.md)
