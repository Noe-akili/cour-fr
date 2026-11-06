# 04 — Vue 3 efficace pour Tauri

> **Objectifs**
> - Maîtriser les bases de Vue 3 utiles dans une application de bureau.
> - Structurer une app avec Vue Router et Pinia.
> - Isoler les appels Tauri derrière une couche typée.
> - Gérer les états de chargement, d'erreur et les fuites de listeners.
> - Construire l'interface de Taurinote (sans backend pour l'instant).

Sommaire : [← Chapitre précédent](./03-anatomie-projet.md) · [README](../README.md) · [Chapitre suivant →](./05-commandes-rust.md)

---

## 1. Pourquoi Vue est un bon choix avec Tauri

- **Réactivité légère** : parfait pour les WebView système, y compris les machines modestes.
- **SFC (Single File Components)** : template, script et style au même endroit.
- **Composition API** : logique réutilisable, typage TypeScript solide.
- **Écosystème mature** : Router, Pinia, Vitest, DevTools.
- **Pas de runtime lourd** : ~35 Ko gzip pour le runtime de base.

Tauri n'impose rien : Vue s'exécute exactement comme dans un navigateur. La seule différence est la présence (ou l'absence) des API `window.__TAURI__`.

---

## 2. Composition API : l'essentiel

### 2.1 `ref` et `reactive`

```vue
<script setup lang="ts">
import { ref, reactive, computed } from "vue";

// Valeur primitive réactive
const count = ref(0);
count.value++;

// Objet réactif
const filters = reactive({
  search: "",
  priority: "all" as "all" | "low" | "normal" | "high",
});

// Valeur dérivée, recalculée automatiquement
const hasFilters = computed(() => filters.search !== "" || filters.priority !== "all");
</script>

<template>
  <input v-model="filters.search" placeholder="Rechercher…" />
  <p>{{ count }} résultat(s) — filtres actifs : {{ hasFilters }}</p>
</template>
```

> 🧭 **Explication.** Cet exemple déclare trois formes de réactivité : `ref` pour le compteur primitif, `reactive` pour l'objet de filtres, et `computed` pour une valeur dérivée. Dans le template, `v-model` lie directement `filters.search` et Vue déballe automatiquement `count`. On retient que `count.value` n'est nécessaire que dans le script, jamais dans le template.

Règles pratiques :

- `ref` pour les primitives, les tableaux et les objets que vous remplacez entièrement.
- `reactive` pour les objets dont vous modifiez les propriétés.
- Dans `<script setup>`, les `ref` sont **déballés automatiquement** dans le template : `count`, pas `count.value`.

### 2.2 Props et événements

```vue
<!-- components/TodoItem.vue -->
<script setup lang="ts">
import type { Todo } from "@/types";

const props = defineProps<{
  todo: Todo;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  toggle: [id: number];
  remove: [id: number];
  edit: [todo: Todo];
}>();
</script>

<template>
  <li class="todo" :class="{ done: todo.done }">
    <input
      type="checkbox"
      :checked="todo.done"
      :disabled="disabled"
      @change="emit('toggle', todo.id)"
    />
    <span @dblclick="emit('edit', todo)">{{ todo.title }}</span>
    <button :disabled="disabled" @click="emit('remove', todo.id)">Supprimer</button>
  </li>
</template>
```

> 🧭 **Explication.** Le composant reçoit une tâche typée via `defineProps` et déclare trois événements avec `defineEmits`. Le template utilise `:checked`, `:disabled` et `@change` pour refléter l'état sans modifier la prop, puis `emit` pour remonter l'intention au parent. Cette séparation évite les mutations de props et garde `TodoItem` réutilisable.

> 💡 En Vue 3.3+, la syntaxe typée `defineEmits<{ toggle: [id: number] }>()` documente précisément les événements. Elle est préférable à `(e: 'toggle', id: number) => void` pour les nouveaux projets.

### 2.3 Cycle de vie et nettoyage

```vue
<script setup lang="ts">
import { onMounted, onUnmounted } from "vue";

let timer: number | undefined;

onMounted(() => {
  timer = window.setInterval(() => {
    // rafraîchir quelque chose
  }, 1000);
});

onUnmounted(() => {
  window.clearInterval(timer);
});
</script>
```

> 🧭 **Explication.** `onMounted` démarre un intervalle et `onUnmounted` l'annule avec `clearInterval`. Sans ce nettoyage, chaque montage du composant laisserait un timer actif, ce qui consomme des ressources et peut déclencher des traitements sur un composant détruit. Le même réflexe s'applique aux écouteurs d'événements et aux requêtes annulables.

Dans Tauri, le nettoyage est **critique** pour les listeners IPC :

```ts
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

let unlisten: UnlistenFn | undefined;

onMounted(async () => {
  unlisten = await listen("todo-changed", () => {
    // …
  });
});

onUnmounted(() => {
  unlisten?.();
});
```

> 🧭 **Explication.** Ici, `listen` renvoie une promesse contenant une fonction de désabonnement, stockée dans `unlisten`. `onUnmounted` l'appelle pour retirer l'écouteur Tauri. C'est le pendant IPC du timer : un listener oublié continue de recevoir les événements après la destruction du composant et peut provoquer des fuites ou des actions dupliquées.

Si vous oubliez `unlisten`, chaque montage ajoute un listener : fuite mémoire et actions dupliquées. Nous verrons un composable dédié.

### 2.4 `watch` et `watchEffect`

```ts
import { watch } from "vue";

// Réagit aux changements de recherche, avec debounce
watch(
  () => filters.search,
  (value) => {
    console.log("recherche :", value);
  },
  { immediate: true }
);
```

> 🧭 **Explication.** `watch` observe le getter `() => filters.search` et exécute le callback à chaque changement. L'option `immediate: true` déclenche aussi le callback au montage, ce qui initialise l'affichage. Pour un appel réseau, ajoutez un `debounce` ou un `AbortController` afin d'éviter une requête par frappe.

Pour un appel asynchrone déclenché par un filtre, préférez un `debounce` explicite ou un `AbortController`.

---

## 3. Structurer l'application

```
src/
├── api/
│   ├── client.ts      # wrapper invoke + gestion d'erreurs
│   └── todos.ts       # opérations métier
├── components/
│   ├── TodoForm.vue
│   ├── TodoItem.vue
│   └── TodoList.vue
├── composables/
│   ├── useAsync.ts
│   └── useTauriEvent.ts
├── router/
│   └── index.ts
├── stores/
│   └── todos.ts
├── types/
│   └── index.ts
├── views/
│   ├── HomeView.vue
│   └── SettingsView.vue
├── App.vue
└── main.ts
```

> 🧭 **Explication.** Cette arborescence sépare les responsabilités : `api/` encapsule les appels Tauri, `components/` et `views/` ne gèrent que l'interface, `composables/` regroupe la logique réutilisable, et `stores/` porte l'état global. Cette organisation facilite les tests et évite qu'un composant connaisse directement `invoke`. Adaptez les noms à votre domaine, mais conservez la séparation.

### 3.1 Types partagés

`src/types/index.ts` :

```ts
export type Priority = "low" | "normal" | "high";

export interface Todo {
  id: number;
  title: string;
  done: boolean;
  priority: Priority;
  dueDate: string | null; // ISO 8601 (YYYY-MM-DD)
  tags: string[];
  createdAt: string;
}
```

> 🧭 **Explication.** Ces types TypeScript décrivent le contrat attendu par le frontend : `Priority` est une union de chaînes et `Todo` reflète les champs renvoyés par Rust, avec `dueDate` nullable. Ils ne valident rien à l'exécution ; ils servent à l'autocomplétion et au compilateur. Il faut donc les garder synchronisés avec les structures Serde du chapitre 05.

> ⚠️ Ces types sont une **promesse**, pas une garantie. Rust peut renvoyer autre chose. Validez les données aux frontières (chapitre 05).

### 3.2 Le wrapper `invoke`

`src/api/client.ts` :

```ts
import { invoke, isTauri } from "@tauri-apps/api/core";

export class TauriError extends Error {
  constructor(message: string, readonly command: string) {
    super(message);
    this.name = "TauriError";
  }
}

/**
 * Appelle une commande Rust avec un typage explicite.
 * En navigateur (yarn dev), échoue proprement au lieu de planter.
 */
export async function call<T>(
  command: string,
  args: Record<string, unknown> = {}
): Promise<T> {
  if (!isTauri()) {
    throw new TauriError(
      "Cette action nécessite l'application Tauri (lancez `yarn tauri dev`).",
      command
    );
  }

  try {
    return await invoke<T>(command, args);
  } catch (error) {
    // Tauri renvoie les erreurs Rust sérialisées (souvent une string).
    const message =
      typeof error === "string"
        ? error
        : error instanceof Error
          ? error.message
          : "Erreur inconnue";
    throw new TauriError(message, command);
  }
}
```

> 🧭 **Explication.** `call<T>` centralise les appels IPC : elle vérifie d'abord `isTauri()` pour échouer proprement en mode navigateur, puis enveloppe `invoke` dans un `try/catch`. Les erreurs Rust, souvent sérialisées en chaîne, sont converties en `TauriError` avec le nom de la commande. Les composants n'ont ainsi qu'un point d'entrée typé à tester et à faire évoluer.

`isTauri()` existe dans `@tauri-apps/api/core` depuis Tauri 2. Il permet de garder `yarn dev` utilisable dans un navigateur, avec des données de démonstration.

### 3.3 La couche métier

`src/api/todos.ts` :

```ts
import { call } from "./client";
import type { Priority, Todo } from "@/types";

export interface CreateTodoInput {
  title: string;
  priority: Priority;
  dueDate: string | null;
  tags: string[];
}

export const todosApi = {
  list: () => call<Todo[]>("list_todos"),

  create: (input: CreateTodoInput) =>
    call<Todo>("create_todo", { input }),

  toggle: (id: number) => call<Todo>("toggle_todo", { id }),

  remove: (id: number) => call<void>("delete_todo", { id }),

  update: (todo: Todo) => call<Todo>("update_todo", { todo }),
};
```

> 🧭 **Explication.** `todosApi` expose une méthode par commande Rust et fixe le type de retour de chacune : `Todo[]`, `Todo` ou `void`. Les arguments sont passés sous la forme attendue par Serde, par exemple `{ input }` pour `create_todo`. Cette couche évite de répéter les noms de commandes et les types dans les composants.

Cette couche isole les composants des détails IPC et facilite les tests (on mocke `todosApi`, pas `invoke`).

---

## 4. Pinia : l'état global

### 4.1 Store « setup »

`src/stores/todos.ts` :

```ts
import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { todosApi, type CreateTodoInput } from "@/api/todos";
import { TauriError } from "@/api/client";
import type { Priority, Todo } from "@/types";

export const useTodosStore = defineStore("todos", () => {
  const items = ref<Todo[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const search = ref("");
  const priorityFilter = ref<Priority | "all">("all");

  const filtered = computed(() => {
    const query = search.value.trim().toLowerCase();
    return items.value
      .filter((t) => priorityFilter.value === "all" || t.priority === priorityFilter.value)
      .filter((t) => query === "" || t.title.toLowerCase().includes(query))
      .sort((a, b) => Number(a.done) - Number(b.done));
  });

  const remaining = computed(() => items.value.filter((t) => !t.done).length);

  async function load() {
    loading.value = true;
    error.value = null;
    try {
      items.value = await todosApi.list();
    } catch (e) {
      error.value = e instanceof TauriError ? e.message : "Impossible de charger les tâches.";
    } finally {
      loading.value = false;
    }
  }

  async function create(input: CreateTodoInput) {
    const todo = await todosApi.create(input);
    items.value.unshift(todo);
  }

  async function toggle(id: number) {
    const updated = await todosApi.toggle(id);
    const index = items.value.findIndex((t) => t.id === id);
    if (index !== -1) items.value[index] = updated;
  }

  async function remove(id: number) {
    await todosApi.remove(id);
    items.value = items.value.filter((t) => t.id !== id);
  }

  function resetFilters() {
    search.value = "";
    priorityFilter.value = "all";
  }

  return {
    items, loading, error, search, priorityFilter,
    filtered, remaining,
    load, create, toggle, remove, resetFilters,
  };
});
```

> 🧭 **Explication.** Ce store Pinia en syntaxe « setup » déclare l'état avec `ref`, les valeurs dérivées avec `computed`, puis retourne tout ce qui doit être accessible. `load` gère `loading` et `error` dans un `try/finally`, tandis que `create`, `toggle` et `remove` mettent à jour la liste après l'appel API. Les composants consomment ensuite le store sans connaître le transport IPC.

Bonnes pratiques :

- Le store ne connaît pas les détails de transport : il appelle `todosApi`.
- Les erreurs sont capturées et exposées, pas avalées silencieusement.
- Les valeurs dérivées sont des `computed`, jamais des copies manuelles.
- Les actions asynchrones mettent à jour `loading` dans un `finally`.

### 4.2 Pourquoi Pinia plutôt que des refs globales ?

- DevTools dédiés.
- Stores testables isolément.
- Pas de singletons implicites.
- Typage TypeScript natif.

---

## 5. Vue Router dans une application Tauri

### 5.1 Hash ou history ?

En production, Tauri sert les fichiers via un protocole interne. Le routage « history » (`/settings`) peut fonctionner, mais dépend de la réécriture de chemins. Le mode **hash** (`#/settings`) est le plus robuste, surtout avec les fenêtres multiples et les deep links.

```ts
import { createRouter, createWebHashHistory } from "vue-router";

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: "/",
      name: "home",
      component: () => import("@/views/HomeView.vue"),
    },
    {
      path: "/settings",
      name: "settings",
      component: () => import("@/views/SettingsView.vue"),
    },
  ],
});

export default router;
```

> 🧭 **Explication.** `createWebHashHistory` produit des URLs de la forme `#/settings`, ce qui évite les problèmes de réécriture de chemins dans la WebView Tauri. Chaque route utilise un `import()` dynamique pour être chargée à la demande. Le routeur est exporté puis monté dans `main.ts` avec `app.use(router)`.

Le `import()` dynamique est recommandé : chaque vue devient un chunk séparé, et la fenêtre principale démarre plus vite.

### 5.2 Routes et fenêtres multiples

Une fenêtre secondaire peut charger une route précise :

```rust
WebviewWindowBuilder::new(app, "settings", WebviewUrl::App("index.html#/settings".into()))
```

> 🧭 **Explication.** Cette ligne crée une fenêtre nommée `settings` et lui demande de charger la route `#/settings` de l'application. Le label `settings` servira ensuite à cibler la fenêtre avec `emit_to` ou à la retrouver via `get_webview_window`. La chaîne passée à `WebviewUrl::App` est relative au bundle frontend.

Ou côté JS :

```ts
const url = new URL(window.location.href);
url.hash = "#/settings";
await WebviewWindow.getByLabel("settings").then((w) => w?.navigate(url.toString()));
```

> 🧭 **Explication.** Ce code récupère l'URL courante, remplace son fragment par `#/settings`, puis demande à la fenêtre déjà ouverte de naviguer vers cette adresse. On utilise `getByLabel` pour retrouver la fenêtre par son label et `?.` pour ne rien faire si elle n'existe pas. C'est une alternative au routage interne de Vue lorsque la fenêtre est gérée côté Tauri.

Nous détaillons les fenêtres au chapitre 10.

### 5.3 Garde de navigation

```ts
router.beforeEach((to) => {
  // Exemple : empêcher l'accès aux paramètres si une tâche est en cours d'édition
  const store = useTodosStore();
  if (store.loading) return false;
  return true;
});
```

> 🧭 **Explication.** `beforeEach` s'exécute avant chaque navigation et peut l'annuler en retournant `false`. Ici, la garde empêche de quitter la page tant que `store.loading` est vrai. Le store est instancié à l'intérieur de la fonction, après l'installation de Pinia, ce qui évite l'erreur classique d'un store utilisé trop tôt.

> ⚠️ N'appelez pas `useTodosStore()` au niveau module avant `app.use(pinia)`. Faites-le dans le corps de la garde, après l'initialisation.

---

## 6. Composables réutilisables

### 6.1 `useAsync`

`src/composables/useAsync.ts` :

```ts
import { ref, type Ref } from "vue";

export function useAsync<T>(fn: () => Promise<T>, initial: T) {
  const data = ref(initial) as Ref<T>;
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function run(): Promise<T | undefined> {
    loading.value = true;
    error.value = null;
    try {
      data.value = await fn();
      return data.value;
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e);
      return undefined;
    } finally {
      loading.value = false;
    }
  }

  return { data, loading, error, run };
}
```

### 6.2 `useTauriEvent`

`src/composables/useTauriEvent.ts` :

```ts
import { onMounted, onUnmounted } from "vue";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

/**
 * S'abonne à un événement Tauri et se désabonne automatiquement
 * quand le composant est démonté.
 */
export function useTauriEvent<T>(
  event: string,
  handler: (payload: T) => void
) {
  let unlisten: UnlistenFn | undefined;
  let disposed = false;

  onMounted(async () => {
    const fn = await listen<T>(event, (e) => handler(e.payload));
    // Le composant a pu être démonté pendant l'attente.
    if (disposed) fn();
    else unlisten = fn;
  });

  onUnmounted(() => {
    disposed = true;
    unlisten?.();
  });
}
```

> 💡 Le drapeau `disposed` est important : `listen` est asynchrone. Sans lui, un démontage rapide peut laisser un listener orphelin.

---

## 7. Construire l'interface de Taurinote

Voici une version front-only, avec des données mockées. Elle sera branchée sur Rust au chapitre 05.

### 7.1 `src/views/HomeView.vue`

```vue
<script setup lang="ts">
import { onMounted } from "vue";
import { storeToRefs } from "pinia";
import { useTodosStore } from "@/stores/todos";
import TodoForm from "@/components/TodoForm.vue";
import TodoList from "@/components/TodoList.vue";

const store = useTodosStore();
const { filtered, remaining, loading, error, search, priorityFilter } = storeToRefs(store);

onMounted(() => {
  // Données de démonstration tant que Rust n'est pas branché.
  if (store.items.length === 0) {
    store.items = [
      {
        id: 1,
        title: "Lire le chapitre 05",
        done: false,
        priority: "high",
        dueDate: "2026-11-10",
        tags: ["cours"],
        createdAt: new Date().toISOString(),
      },
    ];
  }
});
</script>

<template>
  <section class="home">
    <header class="toolbar">
      <h1>Taurinote</h1>
      <span class="badge">{{ remaining }} à faire</span>
    </header>

    <TodoForm @created="store.create" />

    <div class="filters">
      <input v-model="search" type="search" placeholder="Rechercher une tâche…" />
      <select v-model="priorityFilter">
        <option value="all">Toutes les priorités</option>
        <option value="high">Haute</option>
        <option value="normal">Normale</option>
        <option value="low">Basse</option>
      </select>
      <button @click="store.resetFilters()">Réinitialiser</button>
    </div>

    <p v-if="error" class="error">{{ error }}</p>
    <p v-if="loading">Chargement…</p>

    <TodoList
      v-else
      :todos="filtered"
      @toggle="store.toggle"
      @remove="store.remove"
    />
  </section>
</template>

<style scoped>
.home { max-width: 820px; margin: 0 auto; padding: 2rem 1.25rem; }
.toolbar { display: flex; align-items: baseline; justify-content: space-between; gap: 1rem; }
.badge { background: #eef2ff; color: #3730a3; padding: .25rem .6rem; border-radius: 999px; font-size: .85rem; }
.filters { display: flex; gap: .5rem; margin: 1.25rem 0; flex-wrap: wrap; }
.filters input { flex: 1 1 240px; }
.error { color: #b91c1c; background: #fef2f2; padding: .75rem 1rem; border-radius: .5rem; }
</style>
```

### 7.2 `src/components/TodoForm.vue`

```vue
<script setup lang="ts">
import { reactive, ref } from "vue";
import type { CreateTodoInput } from "@/api/todos";

const emit = defineEmits<{ created: [input: CreateTodoInput] }>();

const form = reactive<CreateTodoInput>({
  title: "",
  priority: "normal",
  dueDate: null,
  tags: [],
});

const tagsText = ref("");
const error = ref("");

function submit() {
  if (!form.title.trim()) {
    error.value = "Le titre est obligatoire.";
    return;
  }
  error.value = "";

  emit("created", {
    ...form,
    title: form.title.trim(),
    tags: tagsText.value
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean),
  });

  form.title = "";
  form.priority = "normal";
  form.dueDate = null;
  tagsText.value = "";
}
</script>

<template>
  <form class="todo-form" @submit.prevent="submit">
    <input v-model="form.title" placeholder="Nouvelle tâche…" />
    <select v-model="form.priority">
      <option value="low">Basse</option>
      <option value="normal">Normale</option>
      <option value="high">Haute</option>
    </select>
    <input v-model="form.dueDate" type="date" />
    <input v-model="tagsText" placeholder="tags, séparés, par virgule" />
    <button type="submit">Ajouter</button>
    <p v-if="error" class="error">{{ error }}</p>
  </form>
</template>

<style scoped>
.todo-form { display: flex; gap: .5rem; flex-wrap: wrap; }
.todo-form input, .todo-form select { padding: .55rem .7rem; border: 1px solid #d1d5db; border-radius: .45rem; }
.todo-form input:first-child { flex: 1 1 260px; }
.error { color: #b91c1c; flex-basis: 100%; margin: 0; }
</style>
```

### 7.3 `src/components/TodoList.vue`

```vue
<script setup lang="ts">
import type { Todo } from "@/types";
import TodoItem from "./TodoItem.vue";

defineProps<{ todos: Todo[] }>();
const emit = defineEmits<{
  toggle: [id: number];
  remove: [id: number];
}>();
</script>

<template>
  <ul v-if="todos.length" class="todo-list">
    <TodoItem
      v-for="todo in todos"
      :key="todo.id"
      :todo="todo"
      @toggle="emit('toggle', $event)"
      @remove="emit('remove', $event)"
    />
  </ul>
  <p v-else class="empty">Aucune tâche. Profitez-en… ou ajoutez-en une.</p>
</template>

<style scoped>
.todo-list { list-style: none; padding: 0; margin: 0; display: grid; gap: .5rem; }
.empty { color: #6b7280; text-align: center; padding: 3rem 0; }
</style>
```

---

## 8. Mode navigateur et mode Tauri

Pendant le développement, deux commandes coexistent :

| Commande | Environnement | Accès Tauri |
|---|---|---|
| `yarn dev` | Navigateur | ❌ (sauf mocks) |
| `yarn tauri dev` | WebView native | ✅ |

Intérêt du mode navigateur :

- itération UI plus rapide ;
- DevTools Chrome confortables ;
- tests visuels.

Pour que l'application reste utilisable, prévoyez des **mocks** quand `isTauri()` est faux :

```ts
// src/api/todos.ts
import { call } from "./client";
import { isTauri } from "@tauri-apps/api/core";

let memory: Todo[] = [];

export const todosApi = {
  async list(): Promise<Todo[]> {
    if (!isTauri()) return memory;
    return call<Todo[]>("list_todos");
  },
  // …
};
```

Ou utilisez les mocks officiels de Tauri (`mockIPC`) dans les tests (chapitre 11).

---

## 9. Accessibilité et UX de bureau

Quelques réflexes spécifiques aux applications natives :

- **Raccourcis clavier** : `Ctrl/Cmd + N` pour nouvelle tâche, `Ctrl/Cmd + F` pour rechercher.
- **Focus visible** : ne supprimez jamais `:focus-visible` sans alternative.
- **Menus contextuels** : clic droit utile, mais ne dupliquez pas tous les boutons.
- **Densité** : les écrans de bureau sont plus grands ; évitez les interfaces « mobile » étirées.
- **Thème système** : respectez `prefers-color-scheme` ou proposez clair/sombre/auto.
- **États vides** : un message clair vaut mieux qu'une zone blanche.
- **Chargement** : squelettes ou spinner, jamais un blocage silencieux.

---

## 10. Pièges Vue + Tauri

| Piège | Conséquence | Solution |
|---|---|---|
| Oublier `unlisten` | Listeners dupliqués | `onUnmounted`, composable |
| `reactive` réassigné | Perte de réactivité | `ref` ou `Object.assign` |
| `watch` sans `deep` | Changements imbriqués ignorés | `{ deep: true }` ou `watch` ciblé |
| Données Rust non validées | Crash au rendu | Validation/types |
| Router en history | 404 en production | Hash history |
| `localStorage` pour des données critiques | Perte au nettoyage | SQLite / store plugin |
| Composants monolithiques | Difficile à tester | Découper, composables |
| `v-html` avec données utilisateur | XSS | Éviter ou sanitizer |

---

## À retenir

- `<script setup lang="ts">` + Composition API est le standard actuel.
- Les `ref` sont déballés dans le template ; les objets complexes gagnent à être typés.
- Isolez `invoke` derrière une couche `api/` et un store Pinia.
- Utilisez `createWebHashHistory` pour un routage fiable en production.
- Nettoyez systématiquement les listeners Tauri.
- `isTauri()` permet de garder un mode navigateur pour le développement.
- Testez l'accessibilité et les raccourcis dès le début.

---

## Exercices

1. **Ref vs reactive.** Créez un formulaire de tâche avec `reactive`. Que se passe-t-il si vous faites `form = { ... }` ? Corrigez.
2. **Computed.** Ajoutez un compteur `doneCount` et un `progress` (pourcentage) au store.
3. **Router.** Ajoutez une route `/about` et un lien dans l'interface. Vérifiez que le rechargement fonctionne en production.
4. **Composable.** Écrivez `useTauriEvent` puis utilisez-le pour écouter un événement `todos:changed` (simulé par un `setInterval` pour l'instant).
5. **Mode navigateur.** Faites fonctionner la liste de tâches avec un tableau en mémoire quand `isTauri()` est faux, sans dupliquer les composants.

Solutions : [annexe D](../annexes/d-solutions.md#chapitre-04).

---

[← Chapitre précédent](./03-anatomie-projet.md) · [README](../README.md) · [Chapitre suivant : les commandes Rust →](./05-commandes-rust.md)
