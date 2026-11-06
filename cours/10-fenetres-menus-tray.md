# 10 — Fenêtres, menus, tray et raccourcis

> **Objectifs**
> - Créer et piloter plusieurs fenêtres.
> - Router une fenêtre vers une vue Vue précise.
> - Ajouter un menu applicatif et des raccourcis.
> - Créer une icône de barre d'état avec menu.
> - Réduire l'application dans le tray au lieu de quitter.
> - Enregistrer un raccourci global.
> - Gérer les deep links et l'instance unique.

Sommaire : [← Chapitre précédent](./09-stockage-sqlite.md) · [README](../README.md) · [Chapitre suivant →](./11-tests-debogage.md)

---

## 1. Fenêtres déclaratives

La fenêtre principale est décrite dans `tauri.conf.json` :

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
      }
    ]
  }
}
```

Pour créer plusieurs fenêtres au démarrage :

```json
{
  "app": {
    "windows": [
      { "label": "main", "title": "Taurinote", "width": 1100, "height": 720 },
      {
        "label": "settings",
        "title": "Paramètres",
        "url": "index.html#/settings",
        "width": 560,
        "height": 520,
        "resizable": false,
        "visible": false,
        "center": true
      }
    ]
  }
}
```

> 💡 `visible: false` permet de préparer une fenêtre et de l'afficher à la demande, sans flash.

---

## 2. Créer une fenêtre à la demande (Rust)

```rust
use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};

#[tauri::command]
fn open_settings(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("settings") {
        window.show().map_err(|e| e.to_string())?;
        window.set_focus().map_err(|e| e.to_string())?;
        return Ok(());
    }

    WebviewWindowBuilder::new(
        &app,
        "settings",
        WebviewUrl::App("index.html#/settings".into()),
    )
    .title("Paramètres")
    .inner_size(560.0, 520.0)
    .resizable(false)
    .center()
    .build()
    .map_err(|e| e.to_string())?;

    Ok(())
}
```

Avec un routeur en mode hash, l'URL `index.html#/settings` charge la même application sur la route `/settings`. La fenêtre partage le même bundle, mais possède son propre contexte JS (stores et état séparés).

> ⚠️ Chaque fenêtre a son propre état JavaScript. Pour partager des données en temps réel, utilisez les événements Tauri ou l'état Rust.

### Depuis Vue

```ts
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";

export async function openSettingsWindow() {
  const existing = await WebviewWindow.getByLabel("settings");
  if (existing) {
    await existing.show();
    await existing.setFocus();
    return;
  }

  const window = new WebviewWindow("settings", {
    url: "index.html#/settings",
    title: "Paramètres",
    width: 560,
    height: 520,
    resizable: false,
    center: true,
  });

  window.once("tauri://error", (event) => {
    console.error("Impossible de créer la fenêtre", event);
  });
}
```

Permission requise : `core:webview:allow-create-webview-window` (incluse dans `core:default` selon la version) ou `core:window:default`. Vérifiez le schéma généré.

---

## 3. Piloter une fenêtre

```ts
import { getCurrentWindow, getAllWindows } from "@tauri-apps/api/window";

const win = getCurrentWindow();

await win.setTitle("Taurinote — 3 tâches");
await win.minimize();
await win.maximize();
await win.unmaximize();
await win.setFullscreen(true);
await win.setAlwaysOnTop(true);
await win.setSize(new LogicalSize(1200, 800));
await win.setPosition(new LogicalPosition(100, 100));
await win.center();
await win.hide();
await win.show();
await win.setFocus();
```

Côté Rust :

```rust
if let Some(window) = app.get_webview_window("main") {
    window.set_title("Taurinote")?;
    window.minimize()?;
    window.show()?;
    window.set_focus()?;
}
```

### Événements de fenêtre

```ts
import { getCurrentWindow } from "@tauri-apps/api/window";

const unlisten = await getCurrentWindow().onCloseRequested((event) => {
  const hasUnsaved = false; // votre condition réelle
  if (hasUnsaved) {
    event.preventDefault();
    void confirm("Fermer sans sauvegarder ?").then((ok) => {
      if (ok) getCurrentWindow().destroy();
    });
  }
});
```

Autres événements : `onResized`, `onMoved`, `onFocusChanged`, `onThemeChanged`, `onScaleChanged`.

---

## 4. Menu applicatif

### 4.1 Menu Rust

```rust
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem, Submenu},
    Emitter, Manager,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let new_todo = MenuItem::with_id(
                app, "new_todo", "Nouvelle tâche", true, Some("CmdOrCtrl+N"),
            )?;
            let export = MenuItem::with_id(
                app, "export", "Exporter…", true, Some("CmdOrCtrl+E"),
            )?;
            let quit = MenuItem::with_id(
                app, "quit", "Quitter", true, Some("CmdOrCtrl+Q"),
            )?;

            let file = Submenu::with_items(
                app,
                "Fichier",
                true,
                &[
                    &new_todo,
                    &export,
                    &PredefinedMenuItem::separator(app)?,
                    &quit,
                ],
            )?;

            let menu = Menu::with_items(app, &[&file])?;
            app.set_menu(menu)?;

            app.on_menu_event(|app, event| match event.id().as_ref() {
                "new_todo" => {
                    let _ = app.emit("menu:new-todo", ());
                }
                "export" => {
                    let _ = app.emit("menu:export", ());
                }
                "quit" => app.exit(0),
                _ => {}
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### 4.2 Écouter dans Vue

```ts
useTauriEvent("menu:new-todo", () => {
  focusNewTodoInput();
});

useTauriEvent("menu:export", () => {
  void exportTodos(store.items);
});
```

### 4.3 Menus standards

Pour le copier/coller/couper, utilisez les items prédéfinis :

```rust
let edit = Submenu::with_items(
    app,
    "Édition",
    true,
    &[
        &PredefinedMenuItem::undo(app, None)?,
        &PredefinedMenuItem::redo(app, None)?,
        &PredefinedMenuItem::separator(app)?,
        &PredefinedMenuItem::cut(app, None)?,
        &PredefinedMenuItem::copy(app, None)?,
        &PredefinedMenuItem::paste(app, None)?,
        &PredefinedMenuItem::select_all(app, None)?,
    ],
)?;
```

Sans ces items, `Cmd/Ctrl+C` peut ne pas fonctionner dans certains champs sur macOS.

### 4.4 Menu contextuel

```ts
import { Menu, MenuItem } from "@tauri-apps/api/menu";

async function showContextMenu(x: number, y: number) {
  const menu = await Menu.new({
    items: [
      {
        id: "toggle",
        text: "Terminer",
        action: () => store.toggle(selectedId.value),
      },
      {
        id: "delete",
        text: "Supprimer",
        action: () => store.remove(selectedId.value),
      },
    ],
  });

  await menu.popup({ position: { x, y } });
}
```

> 💡 Sur le web, le menu contextuel natif du navigateur reste disponible. Pour le remplacer, écoutez `contextmenu` et appelez `preventDefault()`.

---

## 5. Icône de barre d'état (system tray)

### 5.1 Activer la feature

`src-tauri/Cargo.toml` :

```toml
tauri = { version = "2", features = ["tray-icon"] }
```

### 5.2 Créer le tray

```rust
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager,
};

tauri::Builder::default()
    .setup(|app| {
        let show = MenuItem::with_id(app, "show", "Afficher Taurinote", true, None::<&str>)?;
        let new_todo = MenuItem::with_id(app, "new_todo", "Nouvelle tâche", true, None::<&str>)?;
        let quit = MenuItem::with_id(app, "quit", "Quitter", true, None::<&str>)?;

        let menu = Menu::with_items(app, &[&show, &new_todo, &quit])?;

        let _tray = TrayIconBuilder::new()
            .icon(app.default_window_icon().unwrap().clone())
            .tooltip("Taurinote")
            .menu(&menu)
            .show_menu_on_left_click(false)
            .on_menu_event(|app, event| match event.id.as_ref() {
                "show" => show_main_window(app),
                "new_todo" => {
                    show_main_window(app);
                    let _ = app.emit("menu:new-todo", ());
                }
                "quit" => app.exit(0),
                _ => {}
            })
            .on_tray_icon_event(|tray, event| {
                if let TrayIconEvent::Click {
                    button: MouseButton::Left,
                    button_state: MouseButtonState::Up,
                    ..
                } = event
                {
                    show_main_window(tray.app_handle());
                }
            })
            .build(app)?;

        Ok(())
    })
```

```rust
fn show_main_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}
```

N'oubliez pas `use tauri::Emitter;` pour `app.emit` et `use tauri::Manager;` pour `get_webview_window`.

### 5.3 Réduire dans le tray à la fermeture

Comportement classique d'une application de fond : cliquer sur la croix cache la fenêtre au lieu de quitter.

```rust
use tauri::{Manager, WindowEvent};

tauri::Builder::default()
    .on_window_event(|window, event| {
        if let WindowEvent::CloseRequested { api, .. } = event {
            if window.label() == "main" {
                api.prevent_close();
                let _ = window.hide();
            }
        }
    })
```

Prévoyez toujours un moyen de quitter (menu du tray, menu applicatif) et informez l'utilisateur lors de la première fermeture.

> ⚠️ Sur macOS, le comportement attendu est souvent de garder l'application active dans le Dock. Adaptez selon votre plateforme et testez.

### 5.4 Bonnes pratiques tray

- Une icône lisible en clair et en sombre (macOS template image).
- Un menu court : Afficher, action principale, Quitter.
- Un tooltip explicite.
- Ne cachez pas l'application sans explication.
- Sur Linux, `libayatana-appindicator3` doit être installé.

---

## 6. Raccourcis globaux

Un raccourci **global** fonctionne même quand l'application n'a pas le focus.

### 6.1 Plugin Rust

```bash
yarn tauri add global-shortcut
```

```rust
use tauri_plugin_global_shortcut::{
    Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState,
};

tauri::Builder::default()
    .plugin(tauri_plugin_global_shortcut::Builder::new().build())
    .setup(|app| {
        let shortcut = Shortcut::new(
            Some(Modifiers::CONTROL | Modifiers::SHIFT),
            Code::KeyN,
        );

        app.global_shortcut().on_shortcut(shortcut, move |app, _shortcut, event| {
            if event.state() == ShortcutState::Pressed {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
                let _ = app.emit("shortcut:new-todo", ());
            }
        })?;

        Ok(())
    })
```

### 6.2 Depuis Vue

```ts
import { register, unregisterAll } from "@tauri-apps/plugin-global-shortcut";

await register("CommandOrControl+Shift+N", (event) => {
  if (event.state === "Pressed") {
    focusNewTodoInput();
  }
});

// Au démontage de l'application :
await unregisterAll();
```

### 6.3 Bonnes pratiques

- Proposez un raccourci **configurable**.
- Vérifiez qu'il n'est pas déjà pris ; gérez l'échec.
- Désenregistrez au démontage.
- Sur macOS, évitez les combinaisons réservées au système.
- Ne créez pas de conflit avec les raccourcis internes de l'application.

---

## 7. Deep links et instance unique

### 7.1 Deep links (`taurinote://`)

```bash
yarn tauri add deep-link
```

`tauri.conf.json` :

```json
{
  "plugins": {
    "deep-link": {
      "desktop": {
        "schemes": ["taurinote"]
      }
    }
  }
}
```

Côté Rust :

```rust
use tauri_plugin_deep_link::DeepLinkExt;

tauri::Builder::default()
    .plugin(tauri_plugin_deep_link::init())
    .setup(|app| {
        app.deep_link().on_open_url(|event| {
            for url in event.urls() {
                println!("Deep link reçu : {url}");
            }
        });
        Ok(())
    })
```

Côté Vue :

```ts
import { onOpenUrl } from "@tauri-apps/plugin-deep-link";

await onOpenUrl((urls) => {
  const url = new URL(urls[0]);
  if (url.host === "todo") {
    router.push(`/todo/${url.pathname.slice(1)}`);
  }
});
```

### 7.2 Instance unique

Sans `single-instance`, un second lancement crée un second processus. Avec :

```rust
tauri::Builder::default()
    .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
        if let Some(window) = app.get_webview_window("main") {
            let _ = window.show();
            let _ = window.set_focus();
        }
        // Transmettre argv (ex. deep link) au frontend
        let _ = app.emit("app:second-instance", argv);
    }))
```

Placez ce plugin **en premier** dans la chaîne.

> ⚠️ Sur macOS, le comportement des deep links et des instances diffère ; testez avec un vrai bundle signé.

---

## 8. Fenêtre de paramètres : architecture complète

1. La fenêtre `main` émet `settings:open` ou appelle une commande `open_settings`.
2. Rust crée ou affiche la fenêtre `settings` (route `#/settings`).
3. La fenêtre `settings` écrit dans le store.
4. Elle émet `theme:changed` vers `main` via `emit_to`.
5. `main` applique le thème.

```ts
// settings
import { emitTo } from "@tauri-apps/api/event";
import { saveSettings } from "@/api/settings";

async function updateTheme(theme: "light" | "dark" | "system") {
  await saveSettings({ ...settings, theme });
  await emitTo("main", "theme:changed", theme);
}

// main
useTauriEvent<"light" | "dark" | "system">("theme:changed", (theme) => {
  document.documentElement.dataset.theme = theme;
});
```

Capabilities : `settings` n'a besoin que de `core:default` + `store:default` + `core:event:default`.

---

## 9. Erreurs fréquentes

| Erreur | Cause | Solution |
|---|---|---|
| Tray invisible | Feature `tray-icon` absente | L'activer dans `Cargo.toml` |
| Tray invisible (Linux) | AppIndicator manquant | Installer `libayatana-appindicator3` |
| `window label not found` | Fenêtre pas encore créée | Vérifier le label et l'ordre |
| `window already exists` | `build()` sur un label existant | `get_webview_window` d'abord |
| Menu sans effet | Item non câblé dans `on_menu_event` | Vérifier l'ID |
| Raccourci global refusé | Conflit avec l'OS | Changer la combinaison, gérer l'erreur |
| App quitte au lieu de se cacher | `CloseRequested` non intercepté | `api.prevent_close()` |
| Fenêtre blanche | URL hash incorrecte | Vérifier `index.html#/route` |
| Raccourci dupliqué | Enregistrement à chaque montage | `unregister` / `unregisterAll` |

---

## À retenir

- Les fenêtres se déclarent dans `tauri.conf.json` ou se créent avec `WebviewWindowBuilder`.
- Chaque fenêtre a son propre contexte JS : utilisez les événements pour synchroniser.
- Les menus se construisent côté Rust (ou JS) et émettent des événements vers Vue.
- Le tray nécessite la feature `tray-icon` et une icône adaptée.
- `CloseRequested` + `prevent_close()` permet de réduire l'application dans le tray.
- Les raccourcis globaux doivent être configurable et désenregistrés.
- `single-instance` et `deep-link` sont complémentaires.

---

## Exercices

1. **Fenêtre.** Créez une fenêtre « À propos » (350 × 250, non redimensionnable) chargée à la demande.
2. **Menu.** Ajoutez un menu « Affichage » avec « Thème clair », « Thème sombre », « Système ».
3. **Tray.** Ajoutez un item « Nouvelle tâche » qui affiche la fenêtre et émet un événement.
4. **Fermeture.** Cachez la fenêtre à la fermeture, mais quittez réellement via le menu du tray. Ajoutez une notification la première fois.
5. **Raccourci.** Enregistrez `CmdOrCtrl+Shift+N` et vérifiez qu'il fonctionne quand la fenêtre est en arrière-plan.
6. **Deep link.** Faites en sorte que `taurinote://todo/42` ouvre la tâche 42.

Solutions : [annexe D](../annexes/d-solutions.md#chapitre-10).

---

[← Chapitre précédent](./09-stockage-sqlite.md) · [README](../README.md) · [Chapitre suivant : tests et débogage →](./11-tests-debogage.md)
