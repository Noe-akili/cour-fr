# 11 — Tests et débogage

> **Objectifs**
> - Mettre en place Vitest pour le frontend Vue.
> - Mocker l'IPC Tauri avec `mockIPC` et avec une couche `api/`.
> - Tester les composants avec `@vue/test-utils`.
> - Tester la logique Rust avec `cargo test`.
> - Mettre en place des tests end-to-end avec `tauri-driver`.
> - Diagnostiquer les problèmes front, Rust et packaging.

Sommaire : [← Chapitre précédent](./10-fenetres-menus-tray.md) · [README](../README.md) · [Chapitre suivant →](./12-build-distribution.md)

---

## 1. La pyramide de tests

```
        ▲  E2E (tauri-driver + WebdriverIO)
       ╱ ╲    peu nombreux, lents, haute confiance
      ╱───╲
     ╱     ╲  Intégration (composants + IPC mocké)
    ╱───────╲
   ╱         ╲ Unitaires (fonctions, composables, Rust)
  ╱───────────╲  nombreux, rapides
```

Objectifs réalistes :

- **Unitaires** : logique métier, mapping, validation, composables.
- **Intégration** : composants avec IPC mocké, store + repository.
- **E2E** : parcours critiques (créer une tâche, exporter, redémarrer et retrouver les données).

---

## 2. Vitest côté Vue

### 2.1 Installation

```bash
yarn add -D vitest @vue/test-utils jsdom @vitest/coverage-v8
```

### 2.2 Configuration

`vitest.config.ts` (ou dans `vite.config.ts` avec `test`) :

```ts
import { defineConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/**/*.{ts,vue}"],
      exclude: ["src/main.ts", "src/**/*.d.ts"],
    },
  },
});
```

`src/test/setup.ts` :

```ts
import { afterEach, vi } from "vitest";
import { cleanup } from "@vue/test-utils";
import { clearMocks } from "@tauri-apps/api/mocks";

afterEach(() => {
  cleanup();
  clearMocks();
  vi.restoreAllMocks();
});
```

Scripts :

```json
{
  "scripts": {
    "test": "vitest",
    "test:run": "vitest run",
    "test:coverage": "vitest run --coverage"
  }
}
```

---

## 3. Mocker l'IPC

### 3.1 `mockIPC`

```ts
import { mockIPC } from "@tauri-apps/api/mocks";
import { invoke } from "@tauri-apps/api/core";

beforeEach(() => {
  mockIPC((cmd, args) => {
    if (cmd === "list_todos") {
      return [
        {
          id: 1,
          title: "Test",
          done: false,
          priority: "normal",
          dueDate: null,
          tags: [],
          createdAt: "2026-01-01T00:00:00Z",
          updatedAt: "2026-01-01T00:00:00Z",
        },
      ];
    }

    if (cmd === "create_todo") {
      const input = args as { input: { title: string } };
      return {
        id: 2,
        title: input.input.title,
        done: false,
        priority: "normal",
        dueDate: null,
        tags: [],
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      };
    }

    throw new Error(`Commande non mockée : ${cmd}`);
  });
});

it("charge les tâches", async () => {
  const todos = await invoke("list_todos");
  expect(todos).toHaveLength(1);
});
```

### 3.2 Mocker les fenêtres

```ts
import { mockWindows, mockIPC } from "@tauri-apps/api/mocks";

mockWindows("main", "settings");
```

Cela permet à `getCurrentWindow()` et `getAllWindows()` de fonctionner dans les tests.

### 3.3 Mocker les plugins

Les plugins utilisent leurs propres commandes IPC (`plugin:dialog|open`, etc.). Deux options :

```ts
mockIPC((cmd) => {
  if (cmd === "plugin:dialog|open") return "/tmp/fichier.json";
  if (cmd === "plugin:fs|write_text_file") return null;
  throw new Error(cmd);
});
```

Ou, plus lisible, mockez votre **couche `api/`** : les composants ne connaissent pas `invoke`.

```ts
vi.mock("@/api/todos", () => ({
  todosApi: {
    list: vi.fn().mockResolvedValue([]),
    create: vi.fn(),
    toggle: vi.fn(),
    remove: vi.fn(),
  },
}));
```

> 💡 Préférez mocker votre couche métier pour les tests de composants. Gardez `mockIPC` pour tester la couche `api/` elle-même.

---

## 4. Tester un composant

```ts
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TodoForm from "@/components/TodoForm.vue";

describe("TodoForm", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("refuse un titre vide", async () => {
    const wrapper = mount(TodoForm);

    await wrapper.find("form").trigger("submit");

    expect(wrapper.text()).toContain("Le titre est obligatoire.");
    expect(wrapper.emitted("created")).toBeUndefined();
  });

  it("émet une tâche valide", async () => {
    const wrapper = mount(TodoForm);

    await wrapper.find("input").setValue("Acheter du pain");
    await wrapper.find("form").trigger("submit");

    const events = wrapper.emitted("created");
    expect(events).toHaveLength(1);
    expect(events?.[0]?.[0]).toMatchObject({
      title: "Acheter du pain",
      priority: "normal",
    });
  });
});
```

### Tester un composant avec Pinia

```ts
const pinia = createPinia();
setActivePinia(pinia);

const wrapper = mount(HomeView, {
  global: {
    plugins: [pinia],
    stubs: { TodoList: true },
  },
});
```

### Tester un composable

```ts
import { effectScope } from "vue";
import { useTodosStore } from "@/stores/todos";

it("filtre par priorité", () => {
  const store = useTodosStore();
  store.items = [
    { id: 1, title: "A", priority: "high", done: false, dueDate: null, tags: [], createdAt: "", updatedAt: "" },
    { id: 2, title: "B", priority: "low", done: false, dueDate: null, tags: [], createdAt: "", updatedAt: "" },
  ];
  store.priorityFilter = "high";

  expect(store.filtered).toHaveLength(1);
  expect(store.filtered[0].title).toBe("A");
});
```

### Tester un événement Tauri

`listen` peut être mocké :

```ts
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
}));
```

Pour tester le handler lui-même, extrayez la logique dans une fonction pure.

---

## 5. Tester Rust

### 5.1 Tests unitaires

```rust
#[derive(Debug, PartialEq)]
pub enum Priority { Low, Normal, High }

pub fn validate_title(title: &str) -> Result<(), String> {
    let title = title.trim();
    if title.is_empty() {
        return Err("Le titre est obligatoire.".into());
    }
    if title.chars().count() > 200 {
        return Err("Titre trop long.".into());
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn titre_vide_refuse() {
        assert!(validate_title("   ").is_err());
    }

    #[test]
    fn titre_valide_accepte() {
        assert!(validate_title("Acheter du pain").is_ok());
    }

    #[test]
    fn titre_trop_long_refuse() {
        assert!(validate_title(&"a".repeat(201)).is_err());
    }
}
```

```bash
cd src-tauri
cargo test
cargo test -- --nocapture
cargo clippy --all-targets -- -D warnings
cargo fmt --check
```

### 5.2 Tester la logique métier avec état

Extrayez des fonctions pures :

```rust
pub fn add_todo(todos: &mut Vec<Todo>, input: CreateTodoInput) -> Result<Todo, String> {
    validate_title(&input.title)?;
    let id = todos.iter().map(|t| t.id).max().unwrap_or(0) + 1;
    let todo = Todo { id, /* … */ };
    todos.push(todo.clone());
    Ok(todo)
}

#[test]
fn ajoute_une_tache() {
    let mut todos = Vec::new();
    let todo = add_todo(&mut todos, CreateTodoInput {
        title: "Test".into(),
        priority: Priority::Normal,
        due_date: None,
        tags: vec![],
    }).unwrap();

    assert_eq!(todo.id, 1);
    assert_eq!(todos.len(), 1);
}
```

### 5.3 Tester une commande Tauri

Nécessite la feature `test` :

```toml
[dev-dependencies]
tauri = { version = "2", features = ["test"] }
```

```rust
#[cfg(test)]
mod tests {
    use tauri::test::{mock_builder, mock_context, noop_assets};

    #[test]
    fn commande_enregistree() {
        let app = mock_builder()
            .invoke_handler(tauri::generate_handler![crate::commands::ping])
            .build(mock_context(noop_assets()))
            .unwrap();

        // Des tests IPC plus poussés sont possibles via tauri::test.
        drop(app);
    }
}
```

> 💡 Les tests de commandes avec `AppHandle`/WebView sont complexes. La majorité de la valeur vient des fonctions pures et de la couche repository.

---

## 6. Tests end-to-end avec `tauri-driver`

### 6.1 Principe

`tauri-driver` expose un serveur WebDriver qui pilote la WebView native. WebdriverIO s'y connecte comme à un navigateur.

**Plateformes supportées :** Windows et Linux. macOS n'est pas supporté (limitation WKWebView).

### 6.2 Prérequis

```bash
cargo install tauri-driver --locked
```

- Linux : `sudo apt install webkit2gtk-driver` (fournit `WebKitWebDriver`).
- Windows : Microsoft Edge Driver correspondant à la version de WebView2.

### 6.3 Configuration WebdriverIO

```bash
yarn add -D @wdio/cli @wdio/local-runner @wdio/mocha-framework @wdio/spec-reporter
```

`wdio.conf.ts` :

```ts
export const config: WebdriverIO.Config = {
  runner: "local",
  hostname: "127.0.0.1",
  port: 4444,
  specs: ["./e2e/**/*.spec.ts"],
  maxInstances: 1,
  capabilities: [
    {
      // @ts-expect-error extension Tauri
      "tauri:options": {
        application: "../src-tauri/target/release/taurinote",
      },
      browserName: "wry",
    },
  ],
  framework: "mocha",
  reporters: ["spec"],
  mochaOpts: {
    ui: "bdd",
    timeout: 60_000,
  },
};
```

Lancement :

```bash
# Terminal 1
tauri-driver --port 4444

# Terminal 2
yarn wdio run wdio.conf.ts
```

### 6.4 Exemple de test

```ts
describe("Taurinote", () => {
  it("crée une tâche", async () => {
    const input = await $('input[placeholder="Nouvelle tâche…"]');
    await input.setValue("Tâche E2E");

    await $('button=Ajouter').click();

    const items = await $$(".todo-list li");
    await expect(items).toBeElementsArrayOfSize(1);
    await expect(items[0]).toHaveTextContaining("Tâche E2E");
  });
});
```

### 6.5 Bonnes pratiques E2E

- Utilisez une base de données de test (`identifier` ou variable d'environnement).
- Réinitialisez l'état entre les tests.
- Ciblez des sélecteurs stables (`data-testid`).
- Limitez les scénarios aux parcours critiques.
- Exécutez en CI sur Linux/Windows, pas sur macOS.

---

## 7. Déboguer le frontend

### 7.1 DevTools

En développement, la WebView expose les DevTools :

- clic droit → « Inspecter » ;
- `F12` ou `Ctrl+Shift+I` (Windows/Linux) ;
- `Cmd+Option+I` (macOS) selon la configuration.

En production, les DevTools sont désactivés par défaut. N'activez pas `devtools` dans le build final.

### 7.2 Console et réseau

- `console.log` reste votre meilleur ami.
- L'onglet Réseau montre les requêtes `fetch` et les erreurs CORS.
- L'onglet Application montre le stockage de la WebView (`localStorage`, IndexedDB).
- Les erreurs CSP apparaissent dans la console.

### 7.3 Problèmes classiques

| Symptôme | Piste |
|---|---|
| Page blanche en dev | `devUrl` incorrect, Vite non démarré, erreur JS |
| Page blanche en prod | Chemin d'asset absolu, CSP, route history |
| HMR ne fonctionne pas | `connect-src` CSP, port, `watch.ignored` |
| Styles absents | `style-src` CSP, import CSS manquant |
| Images cassées | `asset:` non activé, `convertFileSrc` oublié |
| `invoke` échoue | Commande non enregistrée, permission, arguments |

---

## 8. Déboguer le backend Rust

### 8.1 Logs

`println!`, `eprintln!`, `dbg!` s'affichent dans le terminal qui a lancé `yarn tauri dev`.

Pour des logs persistants, utilisez le plugin `log` :

```rust
tauri_plugin_log::Builder::new()
    .level(log::LevelFilter::Debug)
    .build()
```

### 8.2 Backtrace

```bash
RUST_BACKTRACE=1 yarn tauri dev
# PowerShell :
$env:RUST_BACKTRACE=1; yarn tauri dev
```

### 8.3 Panics

Un panic dans une commande remonte une erreur IPC générique. Enveloppez les opérations risquées dans `Result` plutôt que de laisser paniquer :

```rust
let content = std::fs::read_to_string(&path)
    .map_err(|e| AppError::Io(e))?;
```

### 8.4 Recompilation et cache

```bash
cd src-tauri
cargo clean          # si un changement de config ne s'applique pas
cargo check          # vérification rapide sans link
cargo clippy         # lints
```

### 8.5 Profilage

- `cargo flamegraph` pour le CPU.
- DevTools Performance pour le rendu.
- `console.time` / `performance.mark` pour le front.
- Mesurez le démarrage avec `Instant::now()` dans `setup`.

---

## 9. Diagnostiquer l'environnement

```bash
yarn tauri info
```

Affiche :

- versions de Node, Yarn, Rust, Cargo ;
- version de la WebView ;
- dépendances système ;
- configuration détectée ;
- cibles installées.

En cas de doute sur un build :

```bash
yarn tauri build --debug --verbose
```

---

## 10. Intégration continue

Un pipeline minimal :

```yaml
- run: yarn install --frozen-lockfile
- run: yarn test:run
- run: yarn build
- run: cd src-tauri && cargo test && cargo clippy -- -D warnings
```

Les builds multi-plateformes sont couverts au chapitre 13.

---

## À retenir

- Vitest + `@vue/test-utils` pour les composants et composables.
- `mockIPC` et `mockWindows` simulent Tauri ; mocker `api/` simplifie les tests de composants.
- `cargo test` et `cargo clippy` pour le backend.
- `tauri-driver` permet des E2E sur Linux et Windows, pas macOS.
- Les DevTools sont disponibles en dev ; désactivés en production.
- `yarn tauri info` et `RUST_BACKTRACE=1` sont les premiers réflexes de diagnostic.

---

## Exercices

1. **Vitest.** Écrivez un test pour `TodoForm` qui vérifie l'émission de `created` avec les tags découpés.
2. **Mock IPC.** Testez `todosApi.list()` avec `mockIPC`, y compris le cas d'erreur.
3. **Store.** Testez `filtered` et `remaining` avec plusieurs tâches.
4. **Rust.** Testez `validate_title` et une fonction `add_todo` avec 3 cas limites.
5. **E2E.** Écrivez un scénario qui crée deux tâches, en termine une, et vérifie le compteur.
6. **Diagnostic.** Une fenêtre est blanche en production mais fonctionne en dev. Listez cinq causes et les vérifications associées.

Solutions : [annexe D](../annexes/d-solutions.md#chapitre-11).

---

[← Chapitre précédent](./10-fenetres-menus-tray.md) · [README](../README.md) · [Chapitre suivant : build et distribution →](./12-build-distribution.md)
