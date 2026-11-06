# Annexe B — Dépannage

Sommaire : [README](../README.md)

---

## 1. Installation et environnement

| Symptôme | Cause | Solution |
|---|---|---|
| `error: linker 'cc' not found` | Pas de compilateur C | Linux : `build-essential` ; Windows : Build Tools C++ |
| `Package webkit2gtk-4.1 was not found` | Dépendance absente | `libwebkit2gtk-4.1-dev` (Debian/Ubuntu) |
| `webkit2gtk-sys` échoue | Version 4.0 au lieu de 4.1 | Installer 4.1, puis `cargo clean` |
| `link.exe not found` | Toolchain GNU | `rustup default stable-msvc` |
| `cargo: command not found` | Rust absent du PATH | `source ~/.cargo/env`, rouvrir le terminal |
| `yarn: command not found` | Yarn absent | `npm i -g yarn` ou Corepack |
| `npm.ps1 cannot be loaded` | Politique PowerShell | `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` |
| Compilation très lente | Première build | Normal ; activez `sccache` |
| `No space left on device` | `target/` volumineux | `cargo clean`, libérer de l'espace |
| Corepack absent (Node 25+) | Corepack retiré | `npm i -g corepack` |
| Erreur de certificat réseau | Proxy / TLS | Configurer `HTTP_PROXY`, `NODE_EXTRA_CA_CERTS` |

### Vérifier WebKitGTK

```bash
pkg-config --modversion webkit2gtk-4.1
# doit afficher >= 2.40
```

Si seul `webkit2gtk-4.0` existe, Tauri 2 ne compilera pas.

---

## 2. Développement

| Symptôme | Cause | Solution |
|---|---|---|
| Fenêtre blanche | Erreur JS, mauvaise URL | DevTools, console, vérifier `devUrl` |
| `failed to connect to localhost:1420` | Vite non démarré | Lancer `yarn dev` seul pour tester |
| Port 1420 occupé | Autre processus | `lsof -i :1420`, tuer le processus |
| Vite bascule sur 1421 | `strictPort` absent | `strictPort: true` dans Vite |
| Rebuild Rust en boucle | Watch Vite inclut `src-tauri` | `watch.ignored: ["**/src-tauri/**"]` |
| HMR ne fonctionne pas | CSP, WebSocket bloqué | `devCsp` avec `ws://localhost:1420` |
| Changement Rust ignoré | Compilation en cours / cache | Attendre, `cargo clean` si nécessaire |
| `tauri: command not found` | CLI global absent | `yarn tauri …` |
| `yarn create tauri-app` bloqué | Réseau / cache | Vérifier la connexion, `yarn cache clean` |
| Page rechargée en boucle | Erreur de config HMR | Vérifier `server.hmr` |

### DevTools

- Clic droit → Inspecter.
- `Ctrl+Shift+I` / `Cmd+Opt+I`.
- Si rien ne s'ouvre : vérifier que vous êtes en `yarn tauri dev`.

---

## 3. IPC et commandes

| Symptôme | Cause | Solution |
|---|---|---|
| `Command X not found` | Non enregistrée | Ajouter à `generate_handler!` |
| `invalid args` | Mauvais nom d'argument | `camelCase` JS ↔ `snake_case` Rust |
| `missing field` | Serde attend un autre nom | `#[serde(rename_all = "camelCase")]` |
| `state not managed` | `manage()` oublié | `.manage(AppState::default())` |
| `State<AppState>` introuvable | Type différent | Vérifier le type exact géré |
| `Serialize is not implemented` | Erreur non sérialisable | Implémenter `Serialize` |
| Réponse `null` | Retour `Option::None` | Gérer `null` côté JS |
| UI figée | Commande synchrone lourde | `async` + `spawn_blocking` |
| Deadlock | Mutex tenu pendant `await` | Cloner, relâcher avant `await` |
| Valeur tronquée | Type Rust trop petit | `i64`/`u64`, pas `i32` |

### Tester une commande rapidement

```ts
import { invoke } from "@tauri-apps/api/core";
console.log(await invoke("ping"));
```

Puis vérifier les logs du terminal Rust.

---

## 4. Permissions et CSP

| Symptôme | Cause | Solution |
|---|---|---|
| `not allowed. Permissions associated…` | Permission manquante | Ajouter l'identifiant exact |
| `forbidden path` | Pas de scope / hors scope | Ajouter un `allow` |
| `scope not found` | Variable invalide | `$APPDATA`, `$HOME`… |
| `window label not found` | Capability cible un label absent | Vérifier `label` |
| Page blanche après CSP | Script/style bloqué | Console CSP, ajuster `devCsp` |
| `asset protocol not enabled` | Option désactivée | `assetProtocol.enable: true` |
| Image locale cassée | CSP `img-src` incomplète | Ajouter `asset:` + `http://asset.localhost` |
| `ipc` bloqué | `connect-src` incomplet | Ajouter `ipc: http://ipc.localhost` |
| Permission ajoutée sans effet | Fichier non pris en compte | Redémarrer `tauri dev` |
| Capability ignorée | Liste `capabilities` explicite | Vérifier `app.security.capabilities` |

### Comprendre l'erreur

```
fs.read_text_file not allowed.
Permissions associated with this command: fs:allow-read-text-file
```

→ Ajouter `fs:allow-read-text-file`, **puis** un scope si nécessaire.

---

## 5. Fichiers et dialogues

| Symptôme | Cause | Solution |
|---|---|---|
| `open` retourne `null` | Annulation utilisateur | Ce n'est pas une erreur |
| Écriture refusée après `save()` | Scope non propagé | Vérifier `fs:allow-write-text-file` |
| Fichier introuvable après redémarrage | Scope non persisté | `persisted-scope` |
| `..` refusé | Protection path traversal | Utiliser un nom validé |
| Chemin relatif inattendu | Pas de `baseDir` | `{ baseDir: BaseDirectory.AppData }` |
| Accents/espaces cassés | Encodage / échappement | Valider et normaliser |
| `remove` échoue sur dossier | Dossier non vide | `{ recursive: true }` |
| Lecture binaire corrompue | `readTextFile` sur binaire | `readFile` + `Uint8Array` |

---

## 6. SQL

| Symptôme | Cause | Solution |
|---|---|---|
| `no such table` | Migrations non exécutées | Vérifier `add_migrations` + `preload` |
| Deux bases | Chaîne de connexion différente | Uniformiser `sqlite:taurinote.db` |
| `database is locked` | Transaction non fermée | `COMMIT`/`ROLLBACK` |
| `datatype mismatch` | Booléen/array passé brut | `0/1`, JSON.stringify |
| `$1` échoue | Syntaxe PostgreSQL | Utiliser `?` |
| `permission denied` | `sql:allow-execute` absent | Ajouter la permission |
| `failed to load sqlite` | Feature absente | `tauri-plugin-sql = { features = ["sqlite"] }` |
| `lastInsertId` undefined | `execute` non utilisé | Utiliser `db.execute` |
| Recherche lente | Pas d'index | Ajouter un index, `EXPLAIN QUERY PLAN` |
| Données perdues | Base dans un dossier nettoyé | Vérifier `AppConfig` |

---

## 7. Fenêtres, menus et tray

| Symptôme | Cause | Solution |
|---|---|---|
| Tray invisible | Feature `tray-icon` | L'activer dans `Cargo.toml` |
| Tray invisible Linux | AppIndicator absent | `libayatana-appindicator3-dev` |
| `window already exists` | Label déjà utilisé | `get_webview_window` d'abord |
| `window label not found` | Fenêtre non créée | Vérifier l'ordre |
| Fenêtre blanche secondaire | URL hash incorrecte | `index.html#/settings` |
| Menu sans effet | ID non câblé | Vérifier `on_menu_event` |
| Copier/coller cassé (macOS) | Items prédéfinis absents | Ajouter `PredefinedMenuItem` |
| App quitte au lieu de se cacher | `CloseRequested` non intercepté | `api.prevent_close()` |
| Raccourci global refusé | Conflit OS | Changer la combinaison |
| Raccourci dupliqué | Enregistré plusieurs fois | `unregisterAll` |
| Tray au mauvais thème | Icône non adaptée | Icône template macOS / contraste |

---

## 8. Build et packaging

| Symptôme | Cause | Solution |
|---|---|---|
| Build très long | Release + LTO | Normal ; cache CI |
| `frontendDist` introuvable | Chemin relatif incorrect | Relatif à `src-tauri/` |
| `dist` vide | `beforeBuildCommand` échoue | Lancer `yarn build` seul |
| Assets manquants | Chemin absolu `/…` | Utiliser des imports ou `public/` |
| MSI échoue | WiX / permissions | Tester NSIS, logs détaillés |
| AppImage ne démarre pas | Dépendance système | Tester sur VM propre |
| DMG « endommagé » | Non notarisé | Signer + notariser |
| SmartScreen | Non signé | Certificat de signature |
| Icône par défaut | `icons` non régénérées | `yarn tauri icon` |
| Taille énorme | Debug / assets | Build release, visualizer |

### Nettoyage

```bash
rm -rf node_modules dist src-tauri/target
yarn install
yarn tauri build
```

---

## 9. Updater

| Symptôme | Cause | Solution |
|---|---|---|
| Aucune mise à jour détectée | Version identique | Bumper `tauri.conf.json` |
| 404 sur `latest.json` | URL / release non publiée | Vérifier l'endpoint et la release |
| Signature invalide | Mauvaise clé | Clé publique = clé privée utilisée |
| `createUpdaterArtifacts` ignoré | Option absente | L'activer et rebuild |
| Mise à jour bloquée | Permissions | `updater:default`, `process:allow-restart` |
| AppImage non mis à jour | Paquet `.deb` | L'updater cible l'AppImage |
| Rollback impossible | Pas de version antérieure | Réinstaller manuellement |
| Artefacts absents | CI sans secrets | Configurer les secrets |

---

## 10. macOS

| Symptôme | Cause | Solution |
|---|---|---|
| « Application endommagée » | Quarantaine / non notarisée | `xattr -dr com.apple.quarantine`, notariser |
| `codesign` échoue | Identité absente | Installer le certificat Developer ID |
| Notarisation échoue | Mot de passe Apple au lieu du mot de passe d'application | Utiliser un mot de passe d'application |
| Icône floue | Mauvais format | `icon.icns` généré par `tauri icon` |
| Menu vide | Pas de menu applicatif | `app.set_menu(...)` |
| Raccourcis `Cmd` absents | Items prédéfinis manquants | `PredefinedMenuItem` |
| Binaire Intel impossible | Cible absente | `rustup target add x86_64-apple-darwin` |

---

## 11. Windows

| Symptôme | Cause | Solution |
|---|---|---|
| Fenêtre console | `windows_subsystem` absent | Attribut dans `main.rs` |
| WebView2 absent | Runtime non installé | Bootstrapper / Evergreen |
| Taille d'installateur énorme | `offlineInstaller` | `downloadBootstrapper` |
| Chemin avec espaces cassé | Commande non échappée | Guillemets / API Rust |
| Antivirus bloque | Exe non signé | Signer |
| MSI en anglais | WiX language | `wix.language: ["fr-FR"]` |
| NSIS demande admin | `installMode` | `currentUser` |

---

## 12. Linux

| Symptôme | Cause | Solution |
|---|---|---|
| `libwebkit2gtk` absent à l'exécution | Paquet runtime | Installer `libwebkit2gtk-4.1-0` |
| Tray absent | AppIndicator | `libayatana-appindicator3` |
| AppImage ne démarre pas | FUSE absent | `libfuse2`, ou `--appimage-extract-and-run` |
| Polices différentes | WebKitGTK | Embarquer une police si critique |
| Rendu lent | WebKitGTK ancien | Tester sur une version récente |
| `.deb` dépendances | Métadonnées | Vérifier `dpkg-deb -I` |
| Écran noir Wayland | Pilote / WebKit | Tester X11, mettre à jour |

---

## 13. CI/CD

| Symptôme | Cause | Solution |
|---|---|---|
| Job Linux échoue | WebKit dev absent | Installer les paquets |
| Cache inefficace | Clé instable | `Swatinem/rust-cache` |
| Secrets absents | Non configurés | Ajouter dans GitHub |
| Release non publiée | `releaseDraft` | Publier manuellement |
| Signature macOS échoue | Certificat expiré | Renouveler |
| Build Windows lent | Pas de cache | Cache Cargo + Node |
| `yarn install` échoue | Lockfile désynchronisé | `yarn install` local, commit |
| Tag sans release | Workflow non déclenché | Vérifier `on.push.tags` |

---

## 14. Comportements spécifiques à la WebView

| Symptôme | Cause | Solution |
|---|---|---|
| `Intl` incomplet | WebKit ancien | Vérifier la version minimale |
| CSS récent ignoré | Support partiel | Fallbacks, `@supports` |
| Police différente | Rendu système | Embarquer une police |
| `position: fixed` saccadé | WebKitGTK | Tester, simplifier |
| Drag & drop natif | `dragDropEnabled` | Désactiver si conflit |
| Sélection de texte | Comportement natif | CSS `user-select` |
| Zoom différent | DPI / scale factor | Tester multi-écrans |

---

## 15. Réinitialiser un projet

```bash
# Dépendances JS
rm -rf node_modules
yarn install --force

# Compilation Rust
cd src-tauri
cargo clean
cargo check

# Schémas et cache Tauri
rm -rf gen/schemas
yarn tauri dev
```

Si le problème persiste :

```bash
yarn tauri info
yarn tauri build --debug --verbose
```

Et joignez ces informations à votre demande d'aide.

---

## 16. Où chercher

- Documentation : [v2.tauri.app](https://v2.tauri.app)
- Référence API : [v2.tauri.app/reference/javascript/api](https://v2.tauri.app/reference/javascript/api/)
- GitHub Discussions : [github.com/tauri-apps/tauri/discussions](https://github.com/tauri-apps/tauri/discussions)
- Discord Tauri
- Issues des plugins : [github.com/tauri-apps/plugins-workspace](https://github.com/tauri-apps/plugins-workspace)

> 💡 Avant de demander de l'aide : version de Tauri, OS, sortie de `yarn tauri info`, message d'erreur complet, extrait minimal reproductible.
