# 15 — Projet final : Taurinote pas à pas

> **Objectifs**
> - Construire une application Tauri complète, de zéro à la release.
> - Appliquer les mécanismes des chapitres précédents.
> - Organiser le code frontend et Rust.
> - Valider chaque jalon par des tests.
> - Produire un build distribuable et une mise à jour.

Sommaire : [← Chapitre précédent](./14-performance-securite.md) · [README](../README.md) · [Projet final](../cours/15-projet-final.md)

---

## 1. Cahier des charges

### 1.1 Vision

**Taurinote** est un gestionnaire de tâches **local-first** : les données restent sur la machine, l'application démarre vite, fonctionne hors ligne et reste légère.

### 1.2 Utilisateurs et besoins

| Besoin | Fonctionnalité |
|---|---|
| Noter une idée rapidement | Création en une ligne, raccourci `Ctrl/Cmd+N` |
| Prioriser | Priorité basse/normale/haute |
| Planifier | Échéance (date) |
| Retrouver | Recherche par titre/tag, filtre priorité |
| Organiser | Tags libres |
| Suivre | Compteur restant, progression |
| Sauvegarder | Export/import JSON |
| Rester informé | Notification après export/import |
| Personnaliser | Thème clair/sombre/système |
| Accès rapide | Tray + fenêtre de paramètres |

### 1.3 Hors périmètre

- Comptes, synchronisation cloud, collaboration.
- Application mobile complète.
- Rich text / Markdown avancé.
- Thèmes personnalisés.

### 1.4 Critères d'acceptation

1. Les tâches survivent à un redémarrage.
2. La recherche et les filtres fonctionnent sans rechargement.
3. L'export produit un JSON valide, réimportable.
4. Le tray permet d'afficher l'application et de quitter.
5. La fenêtre de paramètres change le thème de la fenêtre principale.
6. `yarn build` et `cargo test` passent.
7. L'application se lance sur Linux, Windows et macOS.
8. Une mise à jour `0.1.1` est proposée à une installation `0.1.0`.

---

## 2. Architecture

```
┌───────────────────────────── main (Vue) ─────────────────────────────┐
│ HomeView ── TodoForm / TodoList ── Pinia (todos, settings)           │
│     │                 │                    │                         │
│     │           api/todosRepository ───────┘                         │
│     │                 │                                              │
│     │           plugin-sql (SQLite)                                  │
│     └── export.ts ── dialog + fs + notification                      │
└──────────────────────────────────────────────────────────────────────┘
                  │ IPC (invoke / events)
┌─────────────────▼──────────────── settings (Vue) ───────────────────┐
│ SettingsView ── plugin-store (settings.json)                         │
└──────────────────────────────────────────────────────────────────────┘
                  │
┌─────────────────▼──────────────── Rust ──────────────────────────────┐
│ lib.rs : plugins, migrations, commandes, tray                        │
│ commands : app_info, open_settings, quit_app                         │
│ tray.rs : menu Afficher / Nouvelle tâche / Quitter                   │
└──────────────────────────────────────────────────────────────────────┘
```

### Choix techniques

| Choix | Justification |
|---|---|
| SQLite via plugin `sql` | Requêtes, transactions, migrations, volume |
| Store plugin pour les réglages | Fichier JSON simple, pas de schéma |
| Pinia setup stores | Typage, testabilité |
| Vue Router hash | Fiable en production et multi-fenêtres |
| Aucune UI framework | Bundle léger, CSS maîtrisé |
| Commandes Rust minimales | La logique métier vit dans SQL/TS ; Rust gère le système |
| Tray + close-to-tray | Application de fond discrète |

> 💡 Pourquoi si peu de commandes Rust ? Parce que le plugin `sql` et les plugins officiels couvrent 90 % des besoins. Rust est utilisé là où il apporte de la valeur : informations système, fenêtres, tray, cycle de vie.

---

## 3. Modèle de données

```sql
CREATE TABLE todos (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    title       TEXT    NOT NULL,
    done        INTEGER NOT NULL DEFAULT 0,
    priority    TEXT    NOT NULL DEFAULT 'normal'
                        CHECK (priority IN ('low', 'normal', 'high')),
    due_date    TEXT,
    tags        TEXT    NOT NULL DEFAULT '[]',   -- JSON array
    created_at  TEXT    NOT NULL,
    updated_at  TEXT    NOT NULL
);
```

### Pourquoi `tags` en JSON ?

- Évite une table de jointure pour un besoin simple.
- Suffisant pour filtrer avec `LIKE`.
- Migration possible vers une table `tags` + `todo_tags` si le besoin grandit.

### Index

```sql
CREATE INDEX idx_todos_done ON todos(done);
CREATE INDEX idx_todos_due_date ON todos(due_date);
CREATE INDEX idx_todos_priority ON todos(priority);
```

---

## 4. Jalons

Chaque jalon est un commit idéal. Le code complet est décrit dans ce chapitre, jalon par jalon.

### Jalon 0 — Scaffold et configuration

```bash
yarn create tauri-app taurinote -m yarn -t vue-ts --identifier com.tauricours.taurinote -y
cd taurinote
yarn add pinia vue-router
yarn tauri add sql
yarn tauri add dialog
yarn tauri add fs
yarn tauri add notification
yarn tauri add store
yarn tauri add opener
```

Vérifications :

- `src-tauri/Cargo.toml` : `tauri-plugin-sql` avec `features = ["sqlite"]`, `tauri` avec `tray-icon`.
- `src-tauri/lib.rs` : plugins initialisés.
- `capabilities/default.json` : permissions.

Configuration de la fenêtre :

```json
{
  "app": {
    "windows": [
      {
        "label": "main",
        "title": "Taurinote",
        "width": 1100,
        "height": 720,
        "minWidth": 760,
        "minHeight": 520,
        "center": true
      },
      {
        "label": "settings",
        "title": "Paramètres",
        "url": "index.html#/settings",
        "width": 600,
        "height": 560,
        "resizable": false,
        "visible": false,
        "center": true
      }
    ]
  }
}
```

> ⚠️ La fenêtre `settings` existe dans la configuration mais reste cachée. Elle est affichée par la commande Rust `open_settings`, ce qui évite d'accorder la permission de créer des fenêtres au frontend.

### Jalon 1 — Base de données

1. Créer `src-tauri/migrations/001_init.sql` et `002_indexes.sql`.
2. Enregistrer les migrations dans `lib.rs`.
3. Ajouter `"plugins": { "sql": { "preload": ["sqlite:taurinote.db"] } }`.
4. Créer `src/api/db.ts`, `mappers.ts`, `todosRepository.ts`.

Test manuel :

```ts
const db = await getDb();
await db.execute("INSERT INTO todos (title, created_at, updated_at) VALUES (?, ?, ?)", [
  "Première tâche",
  new Date().toISOString(),
  new Date().toISOString(),
]);
console.table(await db.select("SELECT * FROM todos"));
```

Vérifier l'emplacement du fichier :

```bash
# Linux
find ~/.config -name "taurinote.db"
# macOS
find ~/Library/Application\ Support -name "taurinote.db"
```

### Jalon 2 — Store et interface

`src/stores/todos.ts` :

```ts
export const useTodosStore = defineStore("todos", () => {
  const items = ref<Todo[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const search = ref("");
  const priorityFilter = ref<Priority | "all">("all");

  const filtered = computed(() => {
    const q = search.value.trim().toLowerCase();
    return items.value
      .filter((t) => priorityFilter.value === "all" || t.priority === priorityFilter.value)
      .filter((t) => !q || t.title.toLowerCase().includes(q) || t.tags.some((tag) => tag.toLowerCase().includes(q)));
  });

  const remaining = computed(() => items.value.filter((t) => !t.done).length);
  const doneCount = computed(() => items.value.filter((t) => t.done).length);
  const progress = computed(() => items.value.length === 0 ? 0 : Math.round((doneCount.value / items.value.length) * 100));

  async function load() {
    loading.value = true;
    error.value = null;
    try {
      items.value = await todosRepository.list();
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Erreur de chargement";
    } finally {
      loading.value = false;
    }
  }

  // create, toggle, remove, resetFilters…
});
```

Composants :

- `TodoForm` : titre, priorité, échéance, tags. Émet `created`.
- `TodoList` : liste ou état vide.
- `TodoItem` : checkbox, badge priorité, échéance, tags, suppression.
- `HomeView` : stats, filtres, formulaire, liste, export/import.

Accessibilité :

- `label` pour chaque champ.
- `aria-checked` sur la checkbox personnalisée (ou input natif).
- Focus visible.
- `data-testid` pour les E2E.

### Jalon 3 — Paramètres et thème

`src/api/settings.ts` :

```ts
import { load } from "@tauri-apps/plugin-store";

const store = await load("settings.json", { autoSave: true });

export async function loadSettings(): Promise<Settings> {
  return {
    theme: (await store.get<Theme>("theme")) ?? "system",
    notifications: (await store.get<boolean>("notifications")) ?? true,
  };
}

export async function saveSettings(settings: Settings): Promise<void> {
  await store.set("theme", settings.theme);
  await store.set("notifications", settings.notifications);
  await store.save();
}
```

`src/stores/settings.ts` applique le thème :

```ts
function applyTheme(theme: Theme) {
  const resolved = theme === "system"
    ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
    : theme;
  document.documentElement.dataset.theme = resolved;
}
```

`SettingsView` :

- choix du thème (radio cards) ;
- notifications (toggle) ;
- informations de version via `app_info` ;
- bouton « Quitter » (`quit_app`).

Synchronisation entre fenêtres :

```ts
// settings
await emitTo("main", "theme:changed", theme);

// main
useTauriEvent<Theme>("theme:changed", (theme) => {
  document.documentElement.dataset.theme = theme;
});
```

### Jalon 4 — Export / import

`src/api/transfer.ts` :

```ts
export async function exportTodos(todos: Todo[]): Promise<boolean> {
  const path = await save({
    title: "Exporter les tâches",
    defaultPath: `taurinote-${new Date().toISOString().slice(0, 10)}.json`,
    filters: [{ name: "JSON", extensions: ["json"] }],
  });
  if (!path) return false;

  await writeTextFile(path, JSON.stringify({
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    todos,
  }, null, 2));

  await notify("Taurinote", `${todos.length} tâche(s) exportée(s).`);
  return true;
}
```

Import :

1. `open()` un JSON.
2. Lire et valider la structure.
3. Confirmer avec `confirm()`.
4. Insérer dans une transaction.
5. Émettre `todos:changed` ou recharger le store.

Validation minimale :

```ts
function isBackup(value: unknown): value is Backup {
  if (typeof value !== "object" || value === null) return false;
  const backup = value as Partial<Backup>;
  return backup.schemaVersion === 1 && Array.isArray(backup.todos);
}
```

> ⚠️ Ne faites pas confiance au fichier importé : un JSON peut contenir des tailles énormes, des types inattendus ou du HTML. Validez, limitez et échappez.

### Jalon 5 — Tray, fenêtre de paramètres, cycle de vie

Commandes Rust :

```rust
#[tauri::command]
fn open_settings(app: tauri::AppHandle) -> Result<(), String> {
    let window = app.get_webview_window("settings")
        .ok_or("Fenêtre de paramètres introuvable")?;
    window.show().map_err(|e| e.to_string())?;
    window.set_focus().map_err(|e| e.to_string())
}

#[tauri::command]
fn quit_app(app: tauri::AppHandle) {
    app.exit(0);
}
```

Tray :

- Afficher Taurinote.
- Nouvelle tâche (affiche + émet `menu:new-todo`).
- Quitter.

Fermeture :

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

> ⚠️ Prévoyez toujours un moyen de quitter (tray, bouton). Sinon, l'application devient impossible à fermer si le tray n'est pas visible.

### Jalon 6 — Tests

- `src/components/__tests__/TodoForm.spec.ts` : validation et émission.
- `src/stores/__tests__/todos.spec.ts` : filtres et compteurs.
- `src-tauri/src/` : tests des fonctions pures (validation, mapping).
- `mockIPC` pour `app_info`.
- Un test E2E : créer une tâche, vérifier l'affichage.

```bash
yarn test:run
cd src-tauri && cargo test
```

### Jalon 7 — Build et release

1. `yarn tauri icon ./app-icon.png`
2. Vérifier la CSP et les capabilities.
3. `yarn tauri build`
4. Tester l'installateur sur une VM propre.
5. Configurer la signature.
6. Ajouter l'updater et `latest.json`.
7. Configurer GitHub Actions.
8. Publier `v0.1.0`.
9. Publier `v0.1.1` et vérifier la mise à jour.

---

## 5. Détails d'implémentation utiles

### 5.1 Éviter les doubles chargements

```ts
let loaded = false;

onMounted(async () => {
  if (loaded) return;
  loaded = true;
  await store.load();
});
```

Avec `<keep-alive>`, utilisez `onActivated` plutôt que `onMounted` pour rafraîchir.

### 5.2 Gérer les erreurs de façon uniforme

```ts
async function withErrorHandling<T>(action: () => Promise<T>): Promise<T | undefined> {
  try {
    return await action();
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    useToast().error(message);
    return undefined;
  }
}
```

### 5.3 Optimistic UI

Pour `toggle`, mettez à jour l'UI immédiatement, puis confirmez avec la base. En cas d'échec, restaurez l'état précédent.

```ts
async function toggle(id: number) {
  const todo = items.value.find((t) => t.id === id);
  if (!todo) return;

  const previous = todo.done;
  todo.done = !previous;

  try {
    const updated = await todosRepository.toggle(id);
    Object.assign(todo, updated);
  } catch (e) {
    todo.done = previous;
    throw e;
  }
}
```

### 5.4 Recherche débouncée

```ts
import { watch } from "vue";
import { useDebounceFn } from "@vueuse/core"; // ou implémentation maison

const runSearch = useDebounceFn(() => store.load(), 250);
watch(() => store.search, runSearch);
```

Ou filtrez côté client, ce qui suffit pour quelques milliers de tâches.

### 5.5 Notifications respectueuses

- Une seule notification après un export/import.
- Pas de notification à chaque tâche terminée.
- Réglage `notifications` respecté.

---

## 6. Tests et qualité

### 6.1 Checklist fonctionnelle

- [ ] Créer une tâche avec tous les champs.
- [ ] Créer une tâche avec seulement un titre.
- [ ] Modifier/terminer/supprimer.
- [ ] Rechercher par titre et par tag.
- [ ] Filtrer par priorité.
- [ ] Trier par échéance.
- [ ] Redémarrer et retrouver les données.
- [ ] Exporter puis importer.
- [ ] Changer le thème depuis les paramètres.
- [ ] Fermer la fenêtre → tray → rouvrir.
- [ ] Quitter depuis le tray.
- [ ] Vérifier les notifications.

### 6.2 Checklist technique

- [ ] `yarn build` sans erreur.
- [ ] `yarn test:run` vert.
- [ ] `cargo test` vert.
- [ ] `cargo clippy -- -D warnings` vert.
- [ ] Aucun `console.log` oublié.
- [ ] CSP stricte.
- [ ] Capabilities minimales.
- [ ] Aucune permission `shell`.
- [ ] Build testé sur chaque OS.
- [ ] Signature vérifiée.
- [ ] Updater testé.

### 6.3 Grille d'évaluation (sur 100)

| Critère | Points |
|---|---|
| Fonctionnalités CRUD et filtres | 20 |
| Persistance SQLite et migrations | 15 |
| Architecture et lisibilité du code | 15 |
| Gestion des erreurs et validation | 10 |
| Sécurité (permissions, CSP, validation) | 15 |
| Tests | 10 |
| Tray, fenêtres, notifications | 5 |
| Build, signature, CI/CD | 10 |

---

## 7. Extensions possibles

- **Récurrence** des tâches (quotidienne, hebdomadaire).
- **Sous-tâches** avec table dédiée.
- **Recherche FTS5**.
- **Rappels planifiés** avec notifications.
- **Thème personnalisé** (couleurs).
- **Import/export Markdown**.
- **Raccourcis configurables**.
- **Statistiques** (tâches terminées par semaine).
- **Multi-fenêtres** : vue « Focus » always-on-top.
- **Synchronisation** chiffrée de bout en bout (hors périmètre initial).
- **Mobile** : adaptation des dialogues et du stockage.
- **Accessibilité** : navigation clavier complète, lecteur d'écran.

---

## 8. Ce que vous avez appris

À l'issue de ce projet, vous savez :

- structurer une application Tauri 2 + Vue 3 ;
- concevoir des commandes Rust typées et sécurisées ;
- utiliser les événements et les canaux ;
- configurer des capabilities et une CSP ;
- intégrer des plugins natifs ;
- persister avec SQLite et migrer un schéma ;
- gérer plusieurs fenêtres, un tray et des menus ;
- tester et déboguer ;
- produire des installateurs signés ;
- automatiser les releases et les mises à jour.

---

## 9. Pour aller plus loin

- Ajoutez l'updater et publiez une vraie `v0.1.1`.
- Portez l'application sur mobile avec `yarn tauri android init` / `yarn tauri ios init`.
- Écrivez un plugin Tauri maison (chapitre 08 et documentation « Mobile Plugin Development »).
- Contribuez à un plugin de l'écosystème.
- Mesurez et optimisez le démarrage sur une machine modeste.

---

[← Chapitre précédent](./14-performance-securite.md) · [README](../README.md) · [Retour au sommaire →](../README.md)
