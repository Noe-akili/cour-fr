# 06 — Événements et canaux (streaming)

> **Objectifs**
> - Diffuser des signaux de Rust vers Vue avec `emit`.
> - Cibler une fenêtre précise avec `emit_to`.
> - Écouter depuis Vue et nettoyer correctement.
> - Envoyer des événements de Vue vers Rust.
> - Streamer une progression avec `Channel`.
> - Choisir entre commande, événement et canal.

Sommaire : [← Chapitre précédent](./05-commandes-rust.md) · [README](../README.md) · [Chapitre suivant →](./07-permissions-capabilities.md)

---

## 1. Trois mécanismes, trois usages

| Mécanisme | Direction | Durée de vie | Usage |
|---|---|---|---|
| **Commande** | Vue → Rust → Vue | Une requête | Lire/écrire des données, déclencher une action |
| **Événement** | N'importe qui → tous les abonnés | Continue | Notifier un changement global (thème, tâche modifiée) |
| **Canal** | Rust → Vue, lié à un appel | Le temps d'une commande | Progression d'un import, logs de build, streaming |

Règle simple :

- Besoin d'une **réponse** ? Commande.
- Besoin de **prévenir plusieurs composants** ? Événement.
- Besoin de **plusieurs messages pour une seule opération** ? Canal.

---

## 2. Émettre depuis Rust

### 2.1 Événement global

```rust
use tauri::Emitter;

#[tauri::command]
fn create_todo(app: tauri::AppHandle, title: String) -> Result<(), String> {
    // … logique métier …

    app.emit("todos:changed", ())
        .map_err(|e| e.to_string())?;

    Ok(())
}
```

Côté Vue :

```ts
import { listen } from "@tauri-apps/api/event";

const unlisten = await listen("todos:changed", () => {
  store.load();
});
```

Toutes les fenêtres et webviews reçoivent l'événement.

### 2.2 Payload typé

```rust
use serde::Serialize;
use tauri::Emitter;

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct TodoCreated {
    id: i64,
    title: String,
}

app.emit("todos:created", TodoCreated { id: 42, title: "Apprendre Tauri".into() })?;
```

```ts
interface TodoCreated {
  id: number;
  title: string;
}

listen<TodoCreated>("todos:created", (event) => {
  console.log(event.payload.id, event.payload.title);
});
```

Le payload doit implémenter `Serialize + Clone`.

### 2.3 Cibler une fenêtre

```rust
use tauri::{Emitter, Manager};

let settings = app.get_webview_window("settings")
    .ok_or("Fenêtre settings absente")?;

app.emit_to(settings.label(), "settings:changed", payload)?;
// ou :
app.emit_to("settings", "settings:changed", payload)?;
```

Côté JS, `emitTo` accepte un label ou une cible typée :

```ts
import { emitTo } from "@tauri-apps/api/event";

// À toutes les fenêtres portant ce label
await emitTo("settings", "settings:changed", { theme: "dark" });
```

> 💡 Un événement émis avec `emit` est reçu par **toutes** les webviews, y compris celles qui n'ont pas besoin de l'information. Utilisez `emit_to` pour limiter le bruit et éviter les fuites d'information entre fenêtres.

### 2.4 Émettre depuis `setup`

```rust
tauri::Builder::default()
    .setup(|app| {
        let handle = app.handle().clone();
        std::thread::spawn(move || {
            std::thread::sleep(std::time::Duration::from_secs(1));
            let _ = handle.emit("app:ready", "Prêt");
        });
        Ok(())
    })
```

> ⚠️ `setup` s'exécute avant que la WebView ne soit forcément prête à recevoir. Un court délai ou un `listen` initié par le frontend (`frontend:ready`) évite de perdre l'événement.

---

## 3. Écouter depuis Vue

### 3.1 `listen`

```ts
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

interface ThemePayload {
  mode: "light" | "dark" | "system";
}

let unlisten: UnlistenFn | undefined;

onMounted(async () => {
  unlisten = await listen<ThemePayload>("theme:changed", (event) => {
    applyTheme(event.payload.mode);
  });
});

onUnmounted(() => unlisten?.());
```

`listen` retourne une promesse : n'oubliez pas `await`. L'identifiant unique de l'événement est disponibles dans `event.id`.

### 3.2 `once`

Pour un événement attendu une seule fois :

```ts
import { once } from "@tauri-apps/api/event";

const payload = await once<string>("import:finished");
console.log(payload.payload);
```

`once` résout avec l'événement complet (pas seulement le payload).

### 3.3 Filtrer par cible

```ts
listen("config:changed", handler, { target: "main" });
```

L'option `target` accepte un label ou un objet `EventTarget` :

```ts
listen("config:changed", handler, {
  target: { kind: "WebviewWindow", label: "main" },
});
```

### 3.4 Événements système prédéfinis

Tauri émet des événements natifs, souvent utilisés via des helpers :

```ts
import { getCurrentWindow } from "@tauri-apps/api/window";

const unlisten = await getCurrentWindow().onFocusChanged(({ payload: focused }) => {
  console.log("focus :", focused);
});
```

Autres helpers : `onResized`, `onMoved`, `onCloseRequested`, `onThemeChanged`, `onScaleChanged`, `onDragDropEvent`.

Les noms bruts sont exposés par `TauriEvent` (`tauri://resize`, `tauri://close-requested`…). Préférez les helpers, qui décodent les payloads.

### 3.5 Composable robuste

`src/composables/useTauriEvent.ts` :

```ts
import { onMounted, onUnmounted } from "vue";
import { listen, type EventTarget, type UnlistenFn } from "@tauri-apps/api/event";

export function useTauriEvent<T>(
  event: string,
  handler: (payload: T) => void,
  options?: { target?: string | EventTarget }
) {
  let unlisten: UnlistenFn | undefined;
  let disposed = false;

  onMounted(async () => {
    const fn = await listen<T>(event, (e) => handler(e.payload), options);
    if (disposed) fn();
    else unlisten = fn;
  });

  onUnmounted(() => {
    disposed = true;
    unlisten?.();
  });
}
```

---

## 4. Événements de Vue vers Rust

Le frontend peut émettre, et Rust écouter.

### 4.1 Côté Vue

```ts
import { emit } from "@tauri-apps/api/event";

interface ReadyPayload {
  route: string;
  version: string;
}

await emit("frontend:ready", {
  route: window.location.hash,
  version: "0.1.0",
} satisfies ReadyPayload);
```

### 4.2 Côté Rust

```rust
use tauri::Listener;

tauri::Builder::default()
    .setup(|app| {
        app.listen("frontend:ready", |event| {
            let payload = event.payload(); // &str (JSON)
            println!("Frontend prêt : {payload}");
        });
        Ok(())
    })
```

Pour désérialiser :

```rust
use serde::Deserialize;
use tauri::Listener;

#[derive(Deserialize)]
struct ReadyPayload {
    route: String,
    version: String,
}

app.listen("frontend:ready", |event| {
    match serde_json::from_str::<ReadyPayload>(event.payload()) {
        Ok(p) => println!("route={} version={}", p.route, p.version),
        Err(e) => eprintln!("payload invalide : {e}"),
    }
});
```

`listen` sur `AppHandle` écoute les événements destinés à l'application. Pour une fenêtre précise, utilisez `window.listen(...)`.

### 4.3 `listen_any` et désabonnement

```rust
let id = app.listen_any("log", |event| {
    println!("{}", event.payload());
});

app.unlisten(id);
```

Les événements émis par le frontend sont aussi reçus par les autres webviews, sauf ciblage.

---

## 5. Canaux : streamer une opération

Un **canal** est un objet créé côté JS et passé en argument à une commande. Rust peut envoyer plusieurs messages pendant l'exécution.

### 5.1 Côté Rust

```rust
use serde::Serialize;
use tauri::ipc::Channel;

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase", tag = "event", content = "data")]
enum ImportEvent {
    Started { total: usize },
    Progress { current: usize, file: String },
    Finished { imported: usize },
    Failed { message: String },
}

#[tauri::command]
async fn import_files(
    paths: Vec<String>,
    on_event: Channel<ImportEvent>,
) -> Result<usize, String> {
    let total = paths.len();
    on_event
        .send(ImportEvent::Started { total })
        .map_err(|e| e.to_string())?;

    let mut imported = 0;

    for (index, path) in paths.iter().enumerate() {
        // … traiter le fichier …
        imported += 1;

        on_event
            .send(ImportEvent::Progress {
                current: index + 1,
                file: path.clone(),
            })
            .map_err(|e| e.to_string())?;
    }

    on_event
        .send(ImportEvent::Finished { imported })
        .map_err(|e| e.to_string())?;

    Ok(imported)
}
```

### 5.2 Côté Vue

```ts
import { Channel, invoke } from "@tauri-apps/api/core";

type ImportEvent =
  | { event: "started"; data: { total: number } }
  | { event: "progress"; data: { current: number; file: string } }
  | { event: "finished"; data: { imported: number } }
  | { event: "failed"; data: { message: string } };

const onEvent = new Channel<ImportEvent>();

onEvent.onmessage = (message) => {
  switch (message.event) {
    case "started":
      progress.value = 0;
      total.value = message.data.total;
      break;
    case "progress":
      progress.value = message.data.current;
      currentFile.value = message.data.file;
      break;
    case "finished":
      toast(`Import terminé : ${message.data.imported} fichier(s)`);
      break;
    case "failed":
      error.value = message.data.message;
      break;
  }
};

await invoke<number>("import_files", { paths, onEvent });
```

Points clés :

- Le nom JS `onEvent` correspond au paramètre Rust `on_event`.
- **Définissez `onmessage` avant l'appel** : les messages arrivés avant sont perdus.
- Rust doit renvoyer `Channel<T>` en paramètre ; Serde n'est pas nécessaire pour le canal lui-même, mais le type `T` doit être `Serialize`.
- Le canal est détruit à la fin de la commande ; inutile de le nettoyer côté JS.
- Un canal ne fonctionne que pour la durée d'un appel. Pour des notifications durables, utilisez des événements.

### 5.3 Progression côté Rust avec `AppHandle` et canaux

Pour un téléchargement avec `reqwest` :

```rust
#[tauri::command]
async fn download(url: String, on_event: Channel<DownloadEvent>) -> Result<(), String> {
    let response = reqwest::get(&url).await.map_err(|e| e.to_string())?;
    let total = response.content_length().unwrap_or(0);
    on_event.send(DownloadEvent::Started { total })?;

    // … lire le flux par morceaux et envoyer Progress …
    Ok(())
}
```

Utilisez `Channel::send` à une fréquence raisonnable (par exemple toutes les 100 ms ou tous les 1 %), pas à chaque octet.

---

## 6. Patron complet : rafraîchissement global

Scénario : la fenêtre de paramètres change le thème, la fenêtre principale doit réagir.

### Rust

```rust
use tauri::{Emitter, Manager};

#[tauri::command]
fn set_theme(app: tauri::AppHandle, mode: String) -> Result<(), String> {
    let allowed = ["light", "dark", "system"];
    if !allowed.contains(&mode.as_str()) {
        return Err("Thème invalide".into());
    }

    app.emit_to("main", "theme:changed", &mode)
        .map_err(|e| e.to_string())?;

    Ok(())
}
```

### Fenêtre principale

```ts
import { useTauriEvent } from "@/composables/useTauriEvent";

useTauriEvent<"light" | "dark" | "system">("theme:changed", (mode) => {
  document.documentElement.dataset.theme = mode;
});
```

### Pourquoi pas un `emit` global ?

Le thème ne concerne peut-être que la fenêtre principale. `emit_to` évite qu'une troisième fenêtre applique un thème incohérent.

---

## 7. Erreurs et pièges

| Symptôme | Cause | Correction |
|---|---|---|
| Aucun événement reçu | Écouté trop tard / émis trop tôt | Écouter avant d'émettre, ou `frontend:ready` |
| `event name contains invalid characters` | Nom avec espace ou accent | `[a-zA-Z0-9:_/-]` uniquement |
| Payload `null` | Mauvais type / Serde | Vérifier la sérialisation |
| Listeners dupliqués | `listen` dans un composant sans cleanup | `onUnmounted` |
| `listen is not a function` | Mauvais import | `@tauri-apps/api/event`, pas `window` |
| Canal muet | `onmessage` défini après `invoke` | Définir avant |
| Message perdu | Channel lié à une commande terminée | Utiliser un événement durable |
| Événement reçu deux fois | Plusieurs abonnements (HMR, remontage) | Nettoyer, ou `once` |

---

## 8. Choisir le bon mécanisme : arbre de décision

```
L'opération produit-elle une réponse unique ?
├─ Oui → Commande (invoke)
└─ Non
   ├─ Plusieurs composants/fenêtres doivent réagir ?
   │  ├─ Oui → Événement (emit / listen)
   │  └─ Non
   │     ├─ Plusieurs messages pendant UN appel ? → Canal
   │     └─ Un seul signal ponctuel ? → Événement ciblé (emit_to)
```

Exemples concrets :

- Charger les tâches → commande.
- Une tâche a été supprimée ailleurs → événement `todos:changed`.
- Importer 500 fichiers avec barre de progression → canal.
- L'utilisateur a changé le thème → événement `theme:changed` ciblé.
- Le frontend signale qu'il est prêt → événement `frontend:ready`.

---

## À retenir

- `emit` diffuse à tous ; `emit_to` cible une fenêtre.
- `listen` retourne une promesse de désabonnement ; nettoyez toujours.
- Les payloads doivent être `Serialize + Clone`.
- Un canal (`Channel`) streame plusieurs messages pendant une commande.
- `onmessage` doit être défini avant `invoke`.
- Les noms d'événements sont limités à `[a-zA-Z0-9:_/-]`.
- Utilisez le mécanisme le plus étroit possible.

---

## Exercices

1. **Événement.** Ajoutez une commande `ping_event` qui émet `app:ping` avec un timestamp. Affichez-le dans Vue.
2. **Ciblage.** Créez deux fenêtres (ou simulez avec deux composants) et vérifiez que `emit_to` ne touche que la bonne cible.
3. **Canal.** Écrivez `count_to(n, on_event)` qui envoie `Progress { current }` toutes les 100 ms jusqu'à `n`, puis `Finished`.
4. **Frontend → Rust.** Émettre `ui:route-changed` à chaque navigation et logger la route côté Rust.
5. **Robustesse.** Que se passe-t-il si l'utilisateur ferme la fenêtre pendant un import ? Proposez une gestion (annulation, `AtomicBool`, nettoyage).

Solutions : [annexe D](../annexes/d-solutions.md#chapitre-06).

---

[← Chapitre précédent](./05-commandes-rust.md) · [README](../README.md) · [Chapitre suivant : permissions et CSP →](./07-permissions-capabilities.md)
