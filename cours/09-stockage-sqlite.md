# 09 — Stockage : Store, SQLite et migrations

> **Objectifs**
> - Choisir le bon mécanisme de persistance.
> - Utiliser le plugin `store` pour les préférences.
> - Configurer SQLite avec le plugin `sql` et des migrations versionnées.
> - Écrire une couche d'accès aux données typée et testable.
> - Éviter les injections SQL et gérer les transactions.
> - Sauvegarder, exporter et restaurer les données.

Sommaire : [← Chapitre précédent](./08-plugins-api.md) · [README](../README.md) · [Chapitre suivant →](./10-fenetres-menus-tray.md)

---

## 1. Quelles options de stockage ?

| Mécanisme | Type | Volume | Requêtes | Sécurité | Usage |
|---|---|---|---|---|---|
| `localStorage` | Clé/valeur WebView | ~5 Mo | Non | Faible (accessible au JS) | Brouillons, UI |
| `store` (plugin) | JSON fichier | Moyen | Non | Fichier local | Réglages |
| `sql` (SQLite) | Relationnel | Élevé | SQL | Fichier local | Données métier |
| Rust + `rusqlite`/`sqlx` | Relationnel | Élevé | SQL | Contrôle total | Logique sensible |
| `stronghold` | Coffre chiffré | Faible | Non | Chiffré | Secrets, tokens |

### Pourquoi éviter `localStorage` pour les données métier ?

- Synchronisé et vidé avec les données de la WebView.
- Accessible à tout script exécuté dans la page (XSS).
- Pas de requêtes, pas d'index, pas de transactions.
- Taille limitée et comportement variable selon la WebView.
- Pas de sauvegarde/restauration simple.

Pour Taurinote : **SQLite** pour les tâches, **store** pour les préférences (thème, tri, dernière route).

---

## 2. Le plugin `store` : préférences

### 2.1 Installation

```bash
yarn tauri add store
```

Capability : `store:default`.

### 2.2 Utilisation

```ts
import { load } from "@tauri-apps/plugin-store";

interface Settings {
  theme: "light" | "dark" | "system";
  sort: "created" | "due" | "priority";
  notifications: boolean;
}

const store = await load("settings.json", { autoSave: false });

const defaults: Settings = {
  theme: "system",
  sort: "created",
  notifications: true,
};

export async function getSettings(): Promise<Settings> {
  return {
    theme: (await store.get<Settings["theme"]>("theme")) ?? defaults.theme,
    sort: (await store.get<Settings["sort"]>("sort")) ?? defaults.sort,
    notifications: (await store.get<boolean>("notifications")) ?? defaults.notifications,
  };
}

export async function saveSettings(settings: Settings): Promise<void> {
  await store.set("theme", settings.theme);
  await store.set("sort", settings.sort);
  await store.set("notifications", settings.notifications);
  await store.save(); // persiste immédiatement
}
```

Avec `autoSave` activé (délai de 100 ms par défaut), `save()` est optionnel. Pour des réglages critiques, gardez le contrôle explicite.

### 2.3 `LazyStore`

```ts
import { LazyStore } from "@tauri-apps/plugin-store";

const store = new LazyStore("settings.json");
// Le fichier n'est chargé qu'au premier get/set.
```

Pratique pour ne pas retarder le démarrage.

### 2.4 Limites

- Pas de requêtes : pour filtrer, vous chargez tout en mémoire.
- Pas de transactions.
- Ne stockez pas de secrets (fichier JSON en clair).

---

## 3. SQLite avec le plugin `sql`

### 3.1 Installation

```bash
yarn tauri add sql
```

Puis activez la feature SQLite dans `src-tauri/Cargo.toml` :

```toml
[dependencies]
tauri-plugin-sql = { version = "2", features = ["sqlite"] }
```

> ⚠️ Sans `features = ["sqlite"]`, le plugin compile mais aucune base SQLite n'est disponible.

### 3.2 Initialisation et migrations

`src-tauri/src/lib.rs` :

```rust
use tauri_plugin_sql::{Migration, MigrationKind};

fn migrations() -> Vec<Migration> {
    vec![
        Migration {
            version: 1,
            description: "create_todos",
            sql: include_str!("../migrations/001_init.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "add_todo_indexes",
            sql: include_str!("../migrations/002_indexes.sql"),
            kind: MigrationKind::Up,
        },
    ]
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:taurinote.db", migrations())
                .build(),
        )
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

`src-tauri/migrations/001_init.sql` :

```sql
CREATE TABLE IF NOT EXISTS todos (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    title       TEXT    NOT NULL,
    done        INTEGER NOT NULL DEFAULT 0,
    priority    TEXT    NOT NULL DEFAULT 'normal'
                        CHECK (priority IN ('low', 'normal', 'high')),
    due_date    TEXT,
    tags        TEXT    NOT NULL DEFAULT '[]',
    created_at  TEXT    NOT NULL,
    updated_at  TEXT    NOT NULL
);
```

`src-tauri/migrations/002_indexes.sql` :

```sql
CREATE INDEX IF NOT EXISTS idx_todos_done      ON todos(done);
CREATE INDEX IF NOT EXISTS idx_todos_due_date  ON todos(due_date);
CREATE INDEX IF NOT EXISTS idx_todos_priority  ON todos(priority);
```

> 💡 `include_str!` est relatif au fichier Rust. Depuis `src/lib.rs`, `../migrations/...` pointe vers `src-tauri/migrations/`.

### 3.3 Appliquer les migrations au démarrage

`tauri.conf.json` :

```json
{
  "plugins": {
    "sql": {
      "preload": ["sqlite:taurinote.db"]
    }
  }
}
```

Avec `preload`, les migrations sont exécutées avant l'ouverture de la fenêtre. Sinon, `Database.load()` les exécute à la première connexion.

> ⚠️ La chaîne de connexion doit être **exactement identique** dans `add_migrations`, `preload` et `Database.load`. Une différence crée une seconde base, sans migrations.

### 3.4 Emplacement de la base

Le chemin relatif est résolu depuis `BaseDirectory::AppConfig` :

| OS | Exemple |
|---|---|
| Linux | `~/.config/com.tauricours.taurinote/taurinote.db` |
| macOS | `~/Library/Application Support/com.tauricours.taurinote/taurinote.db` |
| Windows | `%APPDATA%\com.tauricours.taurinote\taurinote.db` |

Pour un chemin absolu, utilisez `sqlite:/chemin/absolu.db` (avec un scope fs adapté si nécessaire).

---

## 4. Accès aux données depuis Vue

### 4.1 Connexion unique

`src/api/db.ts` :

```ts
import Database from "@tauri-apps/plugin-sql";

let connection: Promise<Database> | null = null;

export function getDb(): Promise<Database> {
  // Une seule connexion par session, réutilisée.
  connection ??= Database.load("sqlite:taurinote.db");
  return connection;
}
```

Ne créez pas une connexion par composant : le plugin maintient un pool, mais multiplier les `load` est inutile.

### 4.2 Types et mapping

```ts
// src/types/index.ts
export type Priority = "low" | "normal" | "high";

export interface Todo {
  id: number;
  title: string;
  done: boolean;
  priority: Priority;
  dueDate: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

// Ligne brute SQLite : done est 0/1, tags est du JSON texte.
export interface TodoRow {
  id: number;
  title: string;
  done: number;
  priority: Priority;
  due_date: string | null;
  tags: string;
  created_at: string;
  updated_at: string;
}
```

```ts
// src/api/mappers.ts
import type { Todo, TodoRow } from "@/types";

export function rowToTodo(row: TodoRow): Todo {
  return {
    id: row.id,
    title: row.title,
    done: row.done === 1,
    priority: row.priority,
    dueDate: row.due_date,
    tags: safeParseTags(row.tags),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function safeParseTags(raw: string): string[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.every((t) => typeof t === "string")
      ? parsed
      : [];
  } catch {
    return [];
  }
}
```

> 💡 SQLite n'a pas de type booléen ni de tableau. `done` est un entier, `tags` est du JSON texte. Le mapping est explicite, donc testable.

### 4.3 Repository

`src/api/todosRepository.ts` :

```ts
import { getDb } from "./db";
import { rowToTodo } from "./mappers";
import type { CreateTodoInput, Priority, Todo, TodoRow } from "@/types";

const SELECT = `
  SELECT id, title, done, priority, due_date, tags, created_at, updated_at
  FROM todos
`;

export interface TodoFilters {
  search?: string;
  priority?: Priority | "all";
  includeDone?: boolean;
}

export const todosRepository = {
  async list(filters: TodoFilters = {}): Promise<Todo[]> {
    const db = await getDb();
    const where: string[] = [];
    const params: unknown[] = [];

    if (!filters.includeDone) {
      where.push("done = 0");
    }

    if (filters.priority && filters.priority !== "all") {
      where.push("priority = ?");
      params.push(filters.priority);
    }

    if (filters.search?.trim()) {
      where.push("(title LIKE ? OR tags LIKE ?)");
      const like = `%${filters.search.trim()}%`;
      params.push(like, like);
    }

    const sql = `${SELECT}
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY done ASC, 
        CASE priority WHEN 'high' THEN 0 WHEN 'normal' THEN 1 ELSE 2 END,
        due_date IS NULL, due_date ASC, created_at DESC`;

    const rows = await db.select<TodoRow[]>(sql, params);
    return rows.map(rowToTodo);
  },

  async create(input: CreateTodoInput): Promise<Todo> {
    const db = await getDb();
    const now = new Date().toISOString();

    const result = await db.execute(
      `INSERT INTO todos (title, done, priority, due_date, tags, created_at, updated_at)
       VALUES (?, 0, ?, ?, ?, ?, ?)`,
      [
        input.title.trim(),
        input.priority,
        input.dueDate,
        JSON.stringify(input.tags),
        now,
        now,
      ]
    );

    const rows = await db.select<TodoRow[]>(`${SELECT} WHERE id = ?`, [
      result.lastInsertId,
    ]);

    if (!rows[0]) throw new Error("Tâche créée mais introuvable.");
    return rowToTodo(rows[0]);
  },

  async toggle(id: number): Promise<Todo> {
    const db = await getDb();
    const now = new Date().toISOString();

    await db.execute(
      "UPDATE todos SET done = CASE done WHEN 1 THEN 0 ELSE 1 END, updated_at = ? WHERE id = ?",
      [now, id]
    );

    const rows = await db.select<TodoRow[]>(`${SELECT} WHERE id = ?`, [id]);
    if (!rows[0]) throw new Error(`Tâche ${id} introuvable.`);
    return rowToTodo(rows[0]);
  },

  async remove(id: number): Promise<void> {
    const db = await getDb();
    await db.execute("DELETE FROM todos WHERE id = ?", [id]);
  },

  async stats(): Promise<{ total: number; done: number }> {
    const db = await getDb();
    const rows = await db.select<{ total: number; done: number }[]>(
      "SELECT COUNT(*) AS total, COALESCE(SUM(done), 0) AS done FROM todos"
    );
    return rows[0] ?? { total: 0, done: 0 };
  },
};
```

Points clés :

- **Requêtes paramétrées** (`?`) : jamais de concaténation de valeurs.
- Les colonnes et clauses dynamiques (`AND`, `ORDER BY`) sont construites à partir de valeurs contrôlées, pas d'entrées brutes.
- `LIKE` avec `%` : les wildcards fournis par l'utilisateur sont acceptés ; pour les neutraliser, échappez `%` et `_`.
- `lastInsertId` permet de relire la ligne créée.
- Le mapping convertit `0/1` et le JSON.

### 4.4 Placeholders SQLite

| Base | Syntaxe |
|---|---|
| SQLite | `?` |
| PostgreSQL | `$1`, `$2`… |
| MySQL | `?` |

> ⚠️ N'utilisez pas `$1` avec SQLite : la requête échouera ou sera mal interprétée.

---

## 5. Transactions

Le plugin n'expose pas d'API `transaction()`. Utilisez SQL directement :

```ts
export async function importTodos(todos: CreateTodoInput[]): Promise<number> {
  const db = await getDb();
  await db.execute("BEGIN");

  try {
    let imported = 0;
    for (const todo of todos) {
      const now = new Date().toISOString();
      await db.execute(
        `INSERT INTO todos (title, done, priority, due_date, tags, created_at, updated_at)
         VALUES (?, 0, ?, ?, ?, ?, ?)`,
        [todo.title, todo.priority, todo.dueDate, JSON.stringify(todo.tags), now, now]
      );
      imported++;
    }

    await db.execute("COMMIT");
    return imported;
  } catch (error) {
    await db.execute("ROLLBACK");
    throw error;
  }
}
```

> ⚠️ Une transaction ouverte doit toujours être fermée (`COMMIT` ou `ROLLBACK`), sinon la connexion reste bloquée. Encapsulez dans `try/finally` si nécessaire.

Pour de gros imports, un `INSERT` multi-lignes ou une préparation de statement est plus rapide que N requêtes.

---

## 6. Recherche performante

### 6.1 `LIKE` suffit pour de petits volumes

Jusqu'à quelques milliers de tâches, `LIKE '%terme%'` est acceptable, surtout avec un index sur `done` et `due_date`.

### 6.2 FTS5 pour la recherche plein texte

SQLite inclut FTS5 :

```sql
CREATE VIRTUAL TABLE todos_fts USING fts5(
    title,
    tags,
    content='todos',
    content_rowid='id'
);

CREATE TRIGGER todos_ai AFTER INSERT ON todos BEGIN
  INSERT INTO todos_fts(rowid, title, tags) VALUES (new.id, new.title, new.tags);
END;

CREATE TRIGGER todos_ad AFTER DELETE ON todos BEGIN
  INSERT INTO todos_fts(todos_fts, rowid, title, tags)
  VALUES ('delete', old.id, old.title, old.tags);
END;

CREATE TRIGGER todos_au AFTER UPDATE ON todos BEGIN
  INSERT INTO todos_fts(todos_fts, rowid, title, tags)
  VALUES ('delete', old.id, old.title, old.tags);
  INSERT INTO todos_fts(rowid, title, tags) VALUES (new.id, new.title, new.tags);
END;
```

```ts
const rows = await db.select<TodoRow[]>(
  `SELECT t.* FROM todos t
   JOIN todos_fts f ON f.rowid = t.id
   WHERE todos_fts MATCH ?
   ORDER BY rank`,
  [query]
);
```

> ⚠️ FTS5 n'est pas compilé dans toutes les builds SQLite. Le plugin `sql` l'inclut généralement ; vérifiez sur vos cibles.

---

## 7. Sauvegarde et restauration

### 7.1 Export logique (recommandé)

```ts
export interface Backup {
  schemaVersion: number;
  exportedAt: string;
  todos: Todo[];
}

export async function createBackup(): Promise<Backup> {
  const todos = await todosRepository.list({ includeDone: true });
  return {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    todos,
  };
}
```

L'export logique est portable, lisible et survit aux changements de schéma (avec migrations).

### 7.2 Copie du fichier SQLite

Possible mais risqué si la base est ouverte (journal WAL). Préférez :

```sql
VACUUM INTO '/chemin/sauvegarde.db';
```

ou fermez la connexion avant la copie.

### 7.3 Restauration

- Validez la version du backup.
- Utilisez une transaction.
- Gérez les conflits d'ID (réinsérer avec de nouveaux IDs ou `INSERT OR REPLACE`).
- Affichez un récapitulatif avant d'écraser les données.

---

## 8. Chiffrement et secrets

SQLite n'est **pas chiffré** par défaut. Le fichier est lisible par l'utilisateur (ce qui est souvent acceptable pour des données locales).

Pour des secrets (tokens, mots de passe) :

- **`stronghold`** : coffre chiffré avec mot de passe.
- **Trousseau de l'OS** via une crate dédiée (`keyring`).
- Ne stockez jamais un secret dans `localStorage`, `store` ou le code frontend.

> 🔒 Le chiffrement de la base elle-même (SQLCipher) n'est pas fourni par le plugin `sql`. Si c'est une exigence, utilisez une crate Rust adaptée ou chiffrez les champs sensibles.

---

## 9. Tests de la couche données

Le repository dépend de `@tauri-apps/plugin-sql`, difficile à exécuter hors Tauri. Deux stratégies :

1. **Abstraction** : injectez une interface `DatabaseLike` et mockez-la.
2. **Tests d'intégration** : exécutez les tests dans l'application Tauri (ou via `tauri-driver`).

```ts
export interface DatabaseLike {
  select<T>(sql: string, params?: unknown[]): Promise<T>;
  execute(sql: string, params?: unknown[]): Promise<{ lastInsertId: number; rowsAffected: number }>;
}
```

```ts
export function createTodosRepository(db: DatabaseLike) {
  return {
    async list(): Promise<Todo[]> { /* … */ },
  };
}
```

Ainsi, la logique SQL et le mapping sont testables avec un faux `DatabaseLike`.

---

## 10. Erreurs fréquentes

| Erreur | Cause | Solution |
|---|---|---|
| `no such table: todos` | Migrations non exécutées | Vérifier `add_migrations` + `preload` |
| Deux bases différentes | Chaîne de connexion incohérente | Utiliser la même partout |
| `database is locked` | Transaction non terminée | `COMMIT`/`ROLLBACK` |
| `datatype mismatch` | Booléen/tableau passé tel quel | Convertir en `0/1` et JSON |
| `$1` ne fonctionne pas | Syntaxe PostgreSQL | Utiliser `?` |
| `permission denied` | `sql:allow-execute` manquant | Ajouter la permission |
| Données corrompues | Écriture hors transaction | Transactions + validation |
| Base introuvable | Chemin mal compris | Chemin relatif à `AppConfig` |

---

## À retenir

- `localStorage` ne convient pas aux données métier.
- `store` est idéal pour les préférences ; SQLite pour les données relationnelles.
- Les migrations sont définies en Rust et exécutées au chargement.
- La chaîne `sqlite:...` doit être identique partout.
- Utilisez des requêtes paramétrées et mappez explicitement les types.
- Les transactions doivent être fermées dans tous les cas.
- Exportez au format logique pour des sauvegardes portables.
- Ne stockez pas de secrets dans SQLite ou le store.

---

## Exercices

1. **Store.** Ajoutez un réglage `theme` persisté et appliquez-le au démarrage.
2. **Migration.** Ajoutez une colonne `notes TEXT` via une migration version 3, sans perdre les données existantes.
3. **Repository.** Implémentez `update(id, patch)` avec validation et `updated_at`.
4. **Recherche.** Ajoutez un filtre « échéance dépassée » (`due_date < date('now') AND done = 0`).
5. **Transaction.** Importez 100 tâches ; vérifiez qu'une erreur au milieu annule tout.
6. **Sécurité.** Expliquez pourquoi `db.execute(\`SELECT * FROM todos WHERE title = '${title}'\`)` est dangereux, même dans une application locale.

Solutions : [annexe D](../annexes/d-solutions.md#chapitre-09).

---

[← Chapitre précédent](./08-plugins-api.md) · [README](../README.md) · [Chapitre suivant : fenêtres, menus et tray →](./10-fenetres-menus-tray.md)
