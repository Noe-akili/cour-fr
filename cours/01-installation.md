# 01 — Installer l'environnement (Rust, Node, Yarn)

> **Objectifs**
> - Installer les dépendances système de Tauri sur Linux, Windows et macOS.
> - Installer Rust, Node.js et Yarn proprement.
> - Vérifier que la chaîne complète fonctionne.
> - Résoudre les erreurs d'installation les plus fréquentes.

Sommaire : [← Chapitre précédent](./00-introduction.md) · [README](../README.md) · [Chapitre suivant →](./02-premier-projet.md)

---

## 1. Vue d'ensemble

Pour compiler une application Tauri, il faut :

1. **Les outils natifs de compilation** (compilateur C/C++, GTK/WebKit sur Linux, Xcode sur macOS, MSVC sur Windows).
2. **Rust** (chaîne stable + Cargo).
3. **Node.js** (≥ 20 LTS) pour Vite et l'outillage frontend.
4. **Yarn** comme gestionnaire de paquets.
5. **Le CLI Tauri**, installé localement dans chaque projet (pas besoin de l'installer globalement).

> 💡 **Règle d'or :** installez le CLI Tauri **par projet** (`devDependency`). Cela garantit que tous les contributeurs utilisent la même version. La commande globale `cargo install tauri-cli` est réservée aux projets sans Node.

---

## 2. Linux

### 2.1 Debian / Ubuntu

```bash
sudo apt update
sudo apt install -y \
  build-essential curl wget file \
  libwebkit2gtk-4.1-dev libgtk-3-dev libglib2.0-dev \
  libjavascriptcoregtk-4.1-dev libsoup-3.0-dev \
  libxdo-dev libssl-dev \
  libayatana-appindicator3-dev librsvg2-dev patchelf
```

| Paquet | Rôle |
|---|---|
| `libwebkit2gtk-4.1-dev` | WebView (obligatoire) |
| `libgtk-3-dev`, `libglib2.0-dev` | Interface native (fenêtres, événements) |
| `libsoup-3.0-dev` | Requêtes réseau de la WebView |
| `libxdo-dev` | Simulation d'entrées clavier/souris |
| `libssl-dev` | TLS (HTTP, updater) |
| `libayatana-appindicator3-dev` | Icône de barre d'état (tray) |
| `librsvg2-dev` | Rendu des icônes SVG |
| `patchelf` | Empaquetage AppImage |

Sur Ubuntu 22.04/24.04, ces paquets existent dans les dépôts officiels. Sur les distributions plus anciennes, `libwebkit2gtk-4.1-dev` peut manquer : Tauri 2 exige WebKitGTK 4.1 (API `webkit2gtk-4.1`), pas 4.0.

### 2.2 Fedora

```bash
sudo dnf install -y \
  webkit2gtk4.1-devel openssl-devel curl wget file \
  libappindicator-gtk3-devel librsvg2-devel \
  gtk3-devel javascriptcoregtk4.1-devel libsoup3-devel \
  @development-tools
```

### 2.3 Arch Linux / Manjaro

```bash
sudo pacman -S --needed \
  webkit2gtk-4.1 base-devel curl wget file openssl \
  appmenu-gtk-module libappindicator-gtk3 librsvg \
  gtk3 libsoup3
```

### 2.4 Vérification

```bash
pkg-config --modversion webkit2gtk-4.1
pkg-config --modversion gtk+-3.0
# Attendu : une version >= 2.40 pour WebKitGTK
```

Si `pkg-config` ne trouve rien, vérifiez que `pkg-config` et les paquets `-dev`/`-devel` sont installés.

### 2.5 Cas des environnements headless / conteneurs

Une application Tauri a besoin d'un serveur graphique. Dans un conteneur ou sur un serveur sans écran :

- utilisez `xvfb-run yarn tauri dev` pour les tests ;
- ou développez sur une machine avec affichage ;
- le **build** (`yarn tauri build`) fonctionne sans écran, mais l'exécution non.

---

## 3. Windows

### 3.1 Microsoft C++ Build Tools

1. Téléchargez [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/).
2. Lancez l'installateur et cochez **« Développement Desktop en C++ »**.
3. Vérifiez que les composants **MSVC v143** et **Windows 10/11 SDK** sont inclus.

> ⚠️ Installer seulement « Visual Studio Code » ne suffit pas. Il faut la chaîne de compilation C++.

### 3.2 WebView2

Windows 10 (à jour) et Windows 11 incluent WebView2. Sur Windows 10 ancien, installez le [WebView2 Runtime](https://developer.microsoft.com/microsoft-edge/webview2/) (Evergreen Bootstrapper).

En production, Tauri peut embarquer un installateur WebView2 si nécessaire (voir chapitre 12, option `bundle.windows.webviewInstallMode`).

### 3.3 Rust

```powershell
winget install --id Rustlang.Rustup
```

Puis, dans un nouveau terminal :

```powershell
rustup default stable-msvc
rustc --version
cargo --version
```

La cible **`stable-msvc`** est importante : la cible GNU fonctionne mais complique le linking avec MSVC.

### 3.4 Node.js et Yarn

```powershell
winget install OpenJS.NodeJS.LTS
```

Fermez puis rouvrez le terminal, ensuite :

```powershell
node -v
npm install -g yarn
yarn -v
```

> Si PowerShell bloque les scripts (`npm.ps1 cannot be loaded`), exécutez `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`, ou utilisez `npm.cmd install -g yarn`.

---

## 4. macOS

### 4.1 Xcode Command Line Tools

```bash
xcode-select --install
```

Vérifiez :

```bash
xcode-select -p
# /Library/Developer/CommandLineTools
```

L'application Xcode complète n'est pas nécessaire pour Tauri, sauf pour la notarisation (chapitre 12).

### 4.2 Rust

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source "$HOME/.cargo/env"
rustc --version
```

Sur Apple Silicon, la cible par défaut est `aarch64-apple-darwin`. Pour produire un binaire Intel, ajoutez la cible :

```bash
rustup target add x86_64-apple-darwin
```

### 4.3 Node.js et Yarn

Avec Homebrew :

```bash
brew install node
npm install -g yarn
```

Ou avec `fnm` (recommandé pour changer de version de Node) :

```bash
brew install fnm
fnm install 22
fnm use 22
```

---

## 5. Rust : configuration recommandée

### 5.1 Vérifier la toolchain

```bash
rustup show
# stable (default)
# rustc 1.9x.x
```

Tauri 2 exige Rust **≥ 1.77.2** ; les plugins récents (fs, sql) peuvent exiger **≥ 1.90**. Utilisez la dernière stable :

```bash
rustup update stable
```

### 5.2 Composants utiles

```bash
rustup component add rustfmt clippy
```

- `rustfmt` : formatage automatique.
- `clippy` : lint Rust, très utile pour apprendre.

### 5.3 Accélérer les compilations

Les premières compilations Tauri sont longues (plusieurs centaines de crates). Quelques réglages :

```bash
# Linux/macOS : utiliser tous les cœurs
export CARGO_BUILD_JOBS=$(nproc)

# Vérifier l'espace disque : ~3 à 6 Go pour target/
df -h .
```

Pour les projets volumineux, `sccache` peut réduire les temps de compilation :

```bash
cargo install sccache
export RUSTC_WRAPPER=sccache
```

> ⚠️ Ne commitez jamais `src-tauri/target/` ni `node_modules/`. Ajoutez-les au `.gitignore`.

---

## 6. Node.js

Tauri ne dépend pas d'une version précise de Node, mais Vite 6/7 et Vue 3.5 recommandent Node **20 LTS ou plus**. Utilisez Node 22 LTS de préférence.

### Avec nvm (Linux/macOS)

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
source ~/.bashrc
nvm install 22
nvm use 22
node -v
```

### Avec fnm (multi-plateforme)

```bash
# macOS/Linux
brew install fnm        # ou : curl -fsSL https://fnm.vercel.app/install | bash
fnm install 22
fnm use 22
```

### Avec winget (Windows)

```powershell
winget install OpenJS.NodeJS.LTS
```

### Fichier `.nvmrc`

À la racine du projet :

```
22
```

Ainsi, `nvm use` ou `fnm use` sélectionne automatiquement la bonne version.

---

## 7. Yarn

### 7.1 Yarn Classic (1.x)

C'est la version utilisée par défaut dans ce cours.

```bash
npm install -g yarn
yarn -v
# 1.22.x
```

Ou via Corepack :

```bash
corepack enable
corepack prepare yarn@1.22.22 --activate
```

> Node 25+ ne fournit plus Corepack par défaut. Installez-le avec `npm install -g corepack` si la commande est absente.

### 7.2 Yarn Berry (4.x)

```bash
corepack enable
corepack prepare yarn@4.5.0 --activate
# ou, dans le projet :
yarn set version stable
yarn -v
```

Créez ou complétez `.yarnrc.yml` :

```yaml
nodeLinker: node-modules
```

Ce réglage évite les surprises de Plug'n'Play avec les binaires natifs et le CLI Tauri.

### 7.3 Différences à connaître

| Commande | Yarn 1 | Yarn 4 |
|---|---|---|
| Créer un projet Tauri | `yarn create tauri-app` | `yarn dlx create-tauri-app` |
| Ajouter un paquet | `yarn add pkg` | `yarn add pkg` |
| Ajouter en dev | `yarn add -D pkg` | `yarn add -D pkg` |
| Lancer un script | `yarn tauri dev` | `yarn tauri dev` |
| Nettoyer | `rm -rf node_modules && yarn install` | `yarn install --immutable` |
| Verrou | `yarn.lock` | `yarn.lock` |

### 7.4 Fichier `.yarnrc` (Yarn 1) utile

```
--network-timeout 600000
```

Cela évite les échecs de téléchargement sur les connexions lentes.

---

## 8. Éditeur et extensions

### VS Code (recommandé)

Extensions :

- **rust-analyzer** — autocomplétion, diagnostics Rust.
- **Vue - Official** (anciennement Volar) — support des SFC Vue 3.
- **Tauri** — commandes et snippets.
- **ESLint** / **Prettier** — qualité et formatage.
- **Error Lens** — erreurs inline (confort).

Réglages utiles (`.vscode/settings.json`) :

```json
{
  "rust-analyzer.check.command": "clippy",
  "editor.formatOnSave": true,
  "[rust]": { "editor.defaultFormatter": "rust-lang.rust-analyzer" },
  "[vue]": { "editor.defaultFormatter": "Vue.volar" },
  "typescript.tsdk": "node_modules/typescript/lib"
}
```

### JetBrains

WebStorm + plugin **Rust** + plugin **Tauri** (ou RustRover pour le backend). Le support Vue est excellent.

### Neovim

`rust-analyzer`, `vue-language-server` (Volar), `tauri-vscode` n'est pas nécessaire. Le chapitre 11 donne des pistes de débogage.

---

## 9. Vérification complète

Créez un script `check-env.sh` (ou exécutez les commandes une à une) :

```bash
#!/usr/bin/env bash
set -e

echo "Node   : $(node -v)"
echo "Yarn   : $(yarn -v)"
echo "Rust   : $(rustc --version)"
echo "Cargo  : $(cargo --version)"

case "$(uname -s)" in
  Linux*)
    echo "WebKit : $(pkg-config --modversion webkit2gtk-4.1)"
    echo "GTK    : $(pkg-config --modversion gtk+-3.0)"
    ;;
  Darwin*)
    echo "Xcode  : $(xcode-select -p)"
    ;;
esac

echo "✅ Environnement prêt (si aucune erreur ci-dessus)"
```

Sous Windows PowerShell :

```powershell
node -v
yarn -v
rustc --version
cargo --version
```

### Test de bout en bout

```bash
yarn create tauri-app --help
```

Si la commande affiche l'aide de `create-tauri-app`, Node et Yarn communiquent correctement. Le chapitre 02 crée le vrai projet.

> 💡 `yarn create tauri-app` télécharge le package `create-tauri-app` à la volée. Il n'est pas nécessaire de l'installer globalement.

---

## 10. Erreurs fréquentes

| Symptôme | Cause probable | Solution |
|---|---|---|
| `error: linker 'cc' not found` | Pas de compilateur C | Installez `build-essential` / Build Tools |
| `Package webkit2gtk-4.1 was not found` | Dépendance Linux manquante | Installez `libwebkit2gtk-4.1-dev` |
| `failed to run custom build command for 'webkit2gtk-sys'` | Version 4.0 au lieu de 4.1 | Installez la 4.1 et supprimez `target/` |
| `npm.ps1 cannot be loaded` (Windows) | Politique PowerShell | `Set-ExecutionPolicy RemoteSigned` |
| `link.exe not found` | Cible GNU sans MSVC | `rustup default stable-msvc` |
| `yarn: command not found` | Yarn absent du PATH | Rouvrez le terminal ou `npm i -g yarn` |
| Compilation très lente | Première compilation | Normal (5–15 min) ; les suivantes sont incrémentales |
| `No space left on device` | `target/` volumineux | `cargo clean` ou libérez de l'espace |
| `error while loading shared libraries: libwebkit2gtk` | Runtime Linux manquant | Installez le paquet non `-dev` équivalent |

---

## À retenir

- Tauri exige une chaîne de compilation native, Rust, Node et Yarn.
- Sur Linux, WebKitGTK **4.1** est indispensable.
- Sur Windows, installez les Build Tools C++ et la toolchain `stable-msvc`.
- Le CLI Tauri s'installe **par projet**, pas globalement.
- Node 20+ et Rust stable récent évitent la majorité des problèmes.
- Vérifiez toujours l'environnement avec les commandes de version avant de créer un projet.

---

## Exercices

1. **Installation.** Installez Rust, Node 22 et Yarn, puis collez la sortie de `node -v`, `yarn -v`, `rustc --version`.
2. **Linux.** Quel paquet fournit l'API `webkit2gtk-4.1` ? Pourquoi la 4.0 ne suffit-elle pas ?
3. **Windows.** Expliquez la différence entre la cible Rust `stable-msvc` et `stable-gnu`, et pourquoi Tauri recommande la première.
4. **Yarn.** Configurez le projet pour utiliser Yarn 4 avec `nodeLinker: node-modules`. Quelles commandes utilisez-vous pour créer puis installer un projet Tauri ?
5. **Diagnostic.** Un collaborateur obtient `Package 'webkit2gtk-4.1' not found` alors qu'il a installé `libwebkit2gtk-4.0-dev`. Que lui conseillez-vous ?

Solutions : [annexe D](../annexes/d-solutions.md#chapitre-01).

---

[← Chapitre précédent](./00-introduction.md) · [README](../README.md) · [Chapitre suivant : créer son premier projet →](./02-premier-projet.md)
