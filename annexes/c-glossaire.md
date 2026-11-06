# Annexe C — Glossaire

Sommaire : [README](../README.md)

---

**ACL (Access Control List)** — Ensemble des permissions accordées à une application, compilées par Tauri à partir des capabilities.

**AppHandle** — Poignée clonable vers l'application Tauri, utilisable dans les commandes, threads et callbacks pour accéder aux fenêtres, émettre des événements ou lire les chemins.

**AppImage** — Format de paquet Linux autonome, exécutable sans installation. C'est le format utilisé par l'updater intégré sur Linux.

**Binaire (bundle)** — Exécutable final généré par `tauri build`, accompagné de ses ressources.

**Brownfield** — Mode d'intégration par défaut où Tauri charge l'application frontend telle quelle, sans isolation.

**Capability** — Fichier JSON/TOML qui attribue des permissions à des fenêtres ou webviews, éventuellement pour une plateforme donnée.

**Canal (`Channel`)** — Mécanisme IPC permettant à Rust d'envoyer plusieurs messages à Vue pendant l'exécution d'une commande. Utilisé pour la progression.

**Cargo** — Gestionnaire de paquets et outil de build de Rust.

**CSP (Content Security Policy)** — En-tête/politique qui restreint les sources de scripts, styles, images et connexions. Réduit l'impact des XSS.

**Commande (`#[tauri::command]`)** — Fonction Rust exposée au frontend via IPC.

**`create-tauri-app`** — Utilitaire officiel de génération de projet Tauri.

**DevTools** — Outils de développement de la WebView (console, réseau, performance). Disponibles en développement.

**`devUrl`** — URL chargée par la WebView en développement (souvent `http://localhost:1420`).

**DMG** — Image disque macOS utilisée pour distribuer l'application.

**E2E (end-to-end)** — Tests qui pilotent l'application complète, par exemple via `tauri-driver`.

**`frontendDist`** — Dossier des assets frontend compilés, embarqués dans le binaire (souvent `../dist`).

**HMR (Hot Module Replacement)** — Rechargement à chaud des modules frontend par Vite, sans perdre l'état.

**Identifier** — Identifiant unique de l'application au format inverse de domaine (`com.exemple.app`). Utilisé par l'OS, les stores et les répertoires de données.

**IPC (Inter-Process Communication)** — Pont entre la WebView et le cœur Rust. Repose sur des commandes, événements et canaux.

**Isolation pattern** — Mode de sécurité où le frontend s'exécute dans une iframe et communique via un pont contrôlé.

**Lockfile** — Fichier qui fige les versions exactes des dépendances (`yarn.lock`, `Cargo.lock`).

**Minisign** — Système de signature utilisé par l'updater Tauri pour vérifier l'authenticité des mises à jour.

**MSI** — Format d'installateur Windows (WiX).

**MSRV** — Version minimale de Rust supportée par une crate.

**NSIS** — Générateur d'installateurs Windows, utilisé par Tauri pour produire un `.exe`.

**Notarisation** — Vérification par Apple d'une application macOS signée avant distribution hors App Store.

**Permission** — Autorisation d'exécuter une commande précise (`fs:allow-read-text-file`). Distincte du scope.

**Pinia** — Bibliothèque de gestion d'état officielle pour Vue 3.

**Plugin** — Extension Tauri ajoutant des fonctionnalités natives (dialog, fs, sql…), composée d'une crate Rust, d'un package JS et de permissions.

**Scope** — Restriction sur les ressources accessibles par une permission (chemins, URLs).

**Serde** — Bibliothèque Rust de sérialisation/désérialisation, utilisée pour l'IPC.

**Sidecar** — Binaire externe embarqué avec l'application et exécuté comme processus séparé.

**SQLite** — Base de données relationnelle embarquée, utilisée via le plugin `sql`.

**State (état géré)** — Données partagées injectées dans les commandes via `tauri::State`, généralement protégées par un `Mutex`.

**`tauri-build`** — Crate exécutée au build pour générer le contexte, les schémas et les ressources.

**`tauri-driver`** — Serveur WebDriver officiel pour les tests E2E Tauri (Windows/Linux).

**Tray (system tray)** — Icône de barre d'état/menu système, avec menu contextuel.

**Updater** — Plugin de mise à jour automatique, basé sur un endpoint JSON et des artefacts signés.

**Vite** — Outil de build et serveur de développement frontend utilisé par le template Vue.

**Vue Router** — Routeur officiel de Vue. En Tauri, le mode hash est recommandé.

**WebView** — Composant système affichant du contenu web. Tauri utilise WebView2 (Windows), WKWebView (macOS) et WebKitGTK (Linux).

**WebView2** — Runtime WebView de Microsoft, basé sur Chromium Edge, présent sur Windows 10/11.

**WKWebView** — WebView d'Apple, basée sur WebKit, utilisée sur macOS et iOS.

**WebKitGTK** — Implémentation GTK de WebKit pour Linux.

**`wry`** — Bibliothèque Rust bas niveau utilisée par Tauri pour créer des WebViews.

**`tao`** — Bibliothèque Rust de gestion de fenêtres et d'événements utilisée par Tauri.

**Yarn** — Gestionnaire de paquets JavaScript. Yarn 1 = Classic, Yarn 4 = Berry.

**Yarn Berry** — Version moderne de Yarn, avec Plug'n'Play optionnel et `nodeLinker: node-modules` recommandé pour Tauri.

**`.yarnrc.yml`** — Fichier de configuration de Yarn Berry.

**`yarn.lock`** — Verrou des versions de dépendances JavaScript.
