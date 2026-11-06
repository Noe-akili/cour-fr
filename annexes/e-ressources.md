# Annexe E — Ressources et aller plus loin

Sommaire : [README](../README.md)

---

## Documentation officielle

| Sujet | Lien |
|---|---|
| Tauri 2 | [v2.tauri.app](https://v2.tauri.app) |
| Démarrage | [v2.tauri.app/start](https://v2.tauri.app/start/) |
| Concepts | [v2.tauri.app/concept](https://v2.tauri.app/concept/) |
| Développement | [v2.tauri.app/develop](https://v2.tauri.app/develop/) |
| Sécurité | [v2.tauri.app/security](https://v2.tauri.app/security/) |
| Plugins | [v2.tauri.app/plugin](https://v2.tauri.app/plugin/) |
| Distribution | [v2.tauri.app/distribute](https://v2.tauri.app/distribute/) |
| Référence JS | [v2.tauri.app/reference/javascript/api](https://v2.tauri.app/reference/javascript/api/) |
| Référence Rust | [docs.rs/tauri](https://docs.rs/tauri) |

## Code source et dépôts

| Dépôt | Contenu |
|---|---|
| [tauri-apps/tauri](https://github.com/tauri-apps/tauri) | Cœur, CLI, API |
| [tauri-apps/plugins-workspace](https://github.com/tauri-apps/plugins-workspace) | Plugins officiels |
| [tauri-apps/create-tauri-app](https://github.com/tauri-apps/create-tauri-app) | Générateur de projet |
| [tauri-apps/awesome-tauri](https://github.com/tauri-apps/awesome-tauri) | Exemples, templates, outils |
| [tauri-apps/tauri-docs](https://github.com/tauri-apps/tauri-docs) | Documentation |

## Vue 3

| Sujet | Lien |
|---|---|
| Documentation Vue | [vuejs.org](https://vuejs.org/) |
| Guide TypeScript | [vuejs.org/guide/typescript](https://vuejs.org/guide/typescript/overview.html) |
| Vue Router | [router.vuejs.org](https://router.vuejs.org/) |
| Pinia | [pinia.vuejs.org](https://pinia.vuejs.org/) |
| Vitest | [vitest.dev](https://vitest.dev/) |
| Vue Test Utils | [test-utils.vuejs.org](https://test-utils.vuejs.org/) |

## Rust

| Sujet | Lien |
|---|---|
| Le langage Rust | [rust-lang.org/learn](https://www.rust-lang.org/learn) |
| Rust Book (FR) | [doc.rust-lang.org/book](https://doc.rust-lang.org/book/) |
| Rust by Example | [doc.rust-lang.org/rust-by-example](https://doc.rust-lang.org/rust-by-example/) |
| Serde | [serde.rs](https://serde.rs/) |
| Tokio | [tokio.rs](https://tokio.rs/) |
| SQLx | [docs.rs/sqlx](https://docs.rs/sqlx) |
| thiserror | [docs.rs/thiserror](https://docs.rs/thiserror) |

## Outils

| Outil | Usage |
|---|---|
| [tauri-action](https://github.com/tauri-apps/tauri-action) | CI/CD GitHub |
| [tauri-driver](https://v2.tauri.app/develop/tests/webdriver/) | Tests E2E |
| [CrabNebula DevTools](https://crabnebula.dev/devtools/) | Débogage Tauri |
| [cargo-audit](https://github.com/rustsec/rustsec) | Vulnérabilités Rust |
| [cargo-deny](https://github.com/EmbarkStudios/cargo-deny) | Licences et dépendances |
| [cargo-bloat](https://github.com/RazrFalcon/cargo-bloat) | Analyse de taille |
| [sccache](https://github.com/mozilla/sccache) | Cache de compilation |
| [rollup-plugin-visualizer](https://github.com/btd/rollup-plugin-visualizer) | Analyse du bundle |
| [DOMPurify](https://github.com/cure53/DOMPurify) | Sanitization HTML |

## Apprendre Rust par la pratique

Si vous débutez en Rust, voici un parcours minimal avant d'écrire beaucoup de backend Tauri :

1. **Rust Book, chapitres 1–10** : variables, ownership, structs, enums, erreurs, génériques, traits.
2. **Serde** : `Serialize`, `Deserialize`, `rename_all`, `Option`, enums.
3. **Gestion d'erreurs** : `Result`, `?`, `thiserror`.
4. **Concurrence** : `Mutex`, `Arc`, `Send`, `Sync`.
5. **Async** : notions de `Future`, `tokio`, `spawn_blocking`.
6. **Tests** : `#[test]`, `assert_eq!`, tests de modules.

Le code Rust d'une application Tauri typique reste modeste : initialisation, commandes, état, quelques accès système. Vous n'avez pas besoin de maîtriser les macros ou l'async avancé pour être productif.

## Modèles et exemples

- [Tauri Examples](https://github.com/tauri-apps/tauri/tree/dev/examples) : exemples officiels.
- [Awesome Tauri](https://github.com/tauri-apps/awesome-tauri) : applications et templates.
- [create-tauri-app templates](https://github.com/tauri-apps/create-tauri-app/tree/dev/templates) : structures de référence.

## Communauté

| Canal | Lien |
|---|---|
| Discord Tauri | [discord.gg/tauri](https://discord.gg/tauri) |
| GitHub Discussions | [github.com/tauri-apps/tauri/discussions](https://github.com/tauri-apps/tauri/discussions) |
| X / Twitter | [@TauriApps](https://twitter.com/TauriApps) |
| Blog | [v2.tauri.app/blog](https://v2.tauri.app/blog/) |

## Lectures recommandées

- **Tauri Book** : architecture et philosophie.
- **OWASP Desktop App Security** : menaces et contre-mesures.
- **Electron vs Tauri** : comparatifs récents, en gardant un œil critique sur les chiffres.
- **WebView security** : bonnes pratiques CSP et isolation.
- **Rust API Guidelines** : conventions de code Rust.

## Après ce cours

Trois pistes pour progresser :

1. **Publier Taurinote** sur GitHub Releases avec updater et CI. Le plus formateur.
2. **Écrire un plugin Tauri** pour un besoin concret (par exemple un accès à un service système).
3. **Porter l'application sur mobile** et comparer les contraintes (permissions, stockage, UI).

> « La meilleure façon d'apprendre Tauri est de livrer une petite application réelle, puis d'en mesurer les limites. »

---

[← Annexe D](./d-solutions.md) · [README](../README.md)
