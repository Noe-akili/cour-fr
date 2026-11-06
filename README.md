# Tauri 2 — Le cours complet

> Construisez des applications de bureau natives, légères et sécurisées avec **Rust** et **Vue 3**.

**Version du cours :** 1.0 — novembre 2026
**Stack :** Tauri 2.12 · Rust ≥ 1.90 · Vue 3.5 · TypeScript · Vite · Yarn 1 ou 4
**Durée estimée :** 35 à 45 heures (théorie + exercices + projet final)
**Public :** développeurs web à l'aise avec JavaScript/TypeScript. Aucune connaissance préalable de Rust n'est nécessaire : le cours part des bases et l'annexe F sert de référence.

---

## Pourquoi ce cours ?

Tauri permet de créer une application de bureau en réutilisant ses compétences web. Contrairement à Electron, il n'embarque pas Chromium : l'interface tourne dans la WebView du système (WebView2 sur Windows, WKWebView sur macOS, WebKitGTK sur Linux) et le cœur natif est écrit en Rust.

Le résultat : des binaires de quelques mégaoctets, une consommation mémoire réduite, un accès natif complet (fichiers, base de données, notifications, tray, fenêtres…) et une vraie démarche de sécurité par permissions.

Ce cours est **pratique de bout en bout**. Chaque chapitre contient des objectifs, des explications, du code commenté, un récapitulatif et des exercices. Vous construisez progressivement **Taurinote**, un gestionnaire de tâches local-first, jusqu'à sa distribution avec mises à jour automatiques et CI/CD.

> 💡 **Lire ce cours dans le navigateur.** Une documentation interactive est incluse : `yarn install` puis `yarn dev`. Elle affiche tous les chapitres avec coloration Rust/TypeScript, liens internes, sommaire et recherche (`Ctrl+K`).

---

## Ce que vous allez construire

**Taurinote** — une application de gestion de tâches et de notes :

- CRUD de tâches avec priorités, échéances et tags
- Recherche et filtres instantanés
- Persistance SQLite avec migrations versionnées
- Import / export JSON via les boîtes de dialogue natives
- Notifications système
- Icône de barre d'état (system tray) et menu natif
- Fenêtre de paramètres séparée (thème clair/sombre)
- Tests front (Vitest) et back (Rust)
- Build multi-plateforme, signature et mises à jour automatiques
- Pipeline GitHub Actions

Le projet final est construit pas à pas au [chapitre 15](./cours/15-projet-final.md) : chaque jalon correspond à une étape commitée du dépôt.

---

## Prérequis

| Outil | Version conseillée | Vérification |
|---|---|---|
| Node.js | ≥ 20 LTS | `node -v` |
| Yarn | 1.22 (Classic) ou 4.x (Berry) | `yarn -v` |
| Rust | stable ≥ 1.90 | `rustc --version` |
| Outils natifs | selon l'OS (voir chapitre 1) | — |
| Éditeur | VS Code (+ rust-analyzer, Vue Official) ou WebStorm | — |

Aucune expérience de Rust n'est requise : le cours introduit progressivement la syntaxe nécessaire (commandes, `Result`, Serde, état partagé, async) et l'**annexe F — Rust pour Tauri** consolide les bases. En revanche, une bonne maîtrise de JavaScript/TypeScript et des bases de Vue 3 est recommandée.

---

## Sommaire

### Module 1 — Démarrer

| # | Chapitre | Durée |
|---|---|---|
| 00 | [Introduction : comprendre Tauri](./cours/00-introduction.md) | 45 min |
| 01 | [Installer l'environnement (Rust, Node, Yarn)](./cours/01-installation.md) | 1 h |
| 02 | [Créer son premier projet](./cours/02-premier-projet.md) | 1 h 30 |
| 03 | [Anatomie d'un projet Tauri + Vue](./cours/03-anatomie-projet.md) | 1 h |

### Module 2 — Les fondations

| # | Chapitre | Durée |
|---|---|---|
| 04 | [Vue 3 efficace pour Tauri](./cours/04-vue-fondamentaux.md) | 2 h |
| 05 | [Appeler Rust depuis Vue : les commandes](./cours/05-commandes-rust.md) | 2 h 30 |
| 06 | [Événements et canaux (streaming)](./cours/06-evenements-canaux.md) | 1 h 30 |
| 07 | [Permissions, capabilities et CSP](./cours/07-permissions-capabilities.md) | 1 h 30 |

### Module 3 — L'écosystème

| # | Chapitre | Durée |
|---|---|---|
| 08 | [Plugins et API natives](./cours/08-plugins-api.md) | 2 h 30 |
| 09 | [Stockage : Store, SQLite et migrations](./cours/09-stockage-sqlite.md) | 2 h 30 |
| 10 | [Fenêtres, menus, tray et raccourcis](./cours/10-fenetres-menus-tray.md) | 2 h |

### Module 4 — Qualité et production

| # | Chapitre | Durée |
|---|---|---|
| 11 | [Tests et débogage](./cours/11-tests-debogage.md) | 2 h |
| 12 | [Build, signature et distribution](./cours/12-build-distribution.md) | 2 h |
| 13 | [Mises à jour automatiques et CI/CD](./cours/13-cicd-deploiement.md) | 2 h |
| 14 | [Performance et sécurité avancée](./cours/14-performance-securite.md) | 1 h 30 |

### Module 5 — Projet final

| # | Chapitre | Durée |
|---|---|---|
| 15 | [Projet final : Taurinote pas à pas](./cours/15-projet-final.md) | 6 à 8 h |

### Annexes

- [A. Aide-mémoire (cheatsheet)](./annexes/a-cheatsheet.md)
- [B. Dépannage](./annexes/b-depannage.md)
- [C. Glossaire](./annexes/c-glossaire.md)
- [D. Solutions des exercices](./annexes/d-solutions.md)
- [E. Ressources et pour aller plus loin](./annexes/e-ressources.md)
- [F. Rust pour Tauri : le guide essentiel](./annexes/f-rust-pour-tauri.md)

---

## Comment suivre ce cours

1. **Lisez dans l'ordre.** Les chapitres 05 à 07 posent les mécanismes centraux ; le reste s'appuie dessus.
2. **Tapez le code.** Ne copiez-collez pas tout : les erreurs font partie de l'apprentissage.
3. **Faites les exercices.** Les solutions sont regroupées en annexe D, mais cherchez d'abord.
4. **Consultez l'annexe F pour Rust.** Ownership, `Result`, Serde, `State`, async : la référence Rust du cours, à lire en parallèle des chapitres 05, 09 et 10.
5. **Committez à chaque étape.** Le projet final propose des jalons (`milestone`) faciles à suivre avec Git.
6. **Testez sur votre OS cible.** Une WebView n'est pas l'autre : un rendu parfait sur Linux peut casser sur macOS.

### Conventions

- Les commandes sont données pour **Yarn Classic (1.x)**. Les différences avec **Yarn Berry (4.x)** sont signalées par le bloc `Yarn Berry`.
- `src/` désigne le frontend Vue, `src-tauri/` le backend Rust.
- Les chemins sont relatifs à la racine du projet.
- Les extraits sont en **TypeScript strict** et en **Rust 2021**.
- Les blocs marqués `⚠️` signalent un piège fréquent, `🔒` une implication sécurité.

### Yarn Classic ou Yarn Berry ?

Les deux fonctionnent. Ce cours utilise Yarn Classic par défaut, car c'est le plus répandu et celui qui pose le moins de problèmes avec les outils natifs.

| Action | Yarn 1 (Classic) | Yarn 4 (Berry) |
|---|---|---|
| Créer un projet | `yarn create tauri-app` | `yarn dlx create-tauri-app` |
| Ajouter un paquet | `yarn add -D pkg` | `yarn add -D pkg` |
| Exécuter un binaire | `yarn tauri dev` | `yarn tauri dev` |
| Installer | `yarn install` | `yarn install` |

> **Recommandation Yarn Berry :** configurez `nodeLinker: node-modules` dans `.yarnrc.yml`. Le mode Plug'n'Play (PnP) fonctionne avec Vite mais complique inutilement le chargement des binaires natifs par le CLI Tauri.

```yaml
# .yarnrc.yml
nodeLinker: node-modules
```

---

## Démarrage express

```bash
# 1. Vérifier les outils
node -v && yarn -v && rustc --version

# 2. Créer le projet (choix : TypeScript, Yarn, Vue)
yarn create tauri-app

# 3. Installer et lancer
cd taurinote
yarn install
yarn tauri dev
```

Si tout se passe bien, une fenêtre native s'ouvre avec le template Vue + Tauri. La suite du cours commence au chapitre 00.

---

## Licence et contribution

Ce support est fourni à des fins pédagogiques. Vous pouvez réutiliser, adapter et partager le contenu et le code d'exemple. Les marques Tauri, Vue et Yarn appartiennent à leurs détenteurs respectifs.

Une erreur ? Un extrait obsolète ? Ouvrez une issue ou corrigez directement le fichier concerné.
