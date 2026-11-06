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

> 🧭 **Explication.** Cette commande installe en une fois la chaîne de compilation C/C++ (`build-essential`), les outils de téléchargement et toutes les bibliothèques système requises par Tauri 2 sous Debian/Ubuntu. L'option `-y` accepte automatiquement l'installation, et l'antislash `\` poursuit la commande sur plusieurs lignes pour la lisibilité. Les paquets `-dev` sont indispensables : ils fournissent les en-têtes utilisés par `pkg-config` lors de la compilation de la WebView.

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

> 🧭 **Explication.** L'équivalent Fedora utilise `dnf` et des noms de paquets différents : `webkit2gtk4.1-devel`, `gtk3-devel` ou encore `libsoup3-devel`. Le groupe `@development-tools` remplace `build-essential` et apporte GCC, make et les en-têtes de développement. Vérifiez que la version 4.1 de WebKitGTK est bien proposée par votre dépôt, car Tauri 2 ne compile pas avec la 4.0.

### 2.3 Arch Linux / Manjaro

```bash
sudo pacman -S --needed \
  webkit2gtk-4.1 base-devel curl wget file openssl \
  appmenu-gtk-module libappindicator-gtk3 librsvg \
  gtk3 libsoup3
```

> 🧭 **Explication.** Sous Arch et Manjaro, `pacman -S --needed` installe les paquets sans réinstaller ceux déjà présents. Les noms sont ici sans suffixe `-dev` : Arch inclut les en-têtes dans le paquet principal. `base-devel` fournit la chaîne de compilation, tandis que `webkit2gtk-4.1`, `gtk3` et `libsoup3` couvrent la WebView et ses dépendances réseau.

### 2.4 Vérification

```bash
pkg-config --modversion webkit2gtk-4.1
pkg-config --modversion gtk+-3.0
# Attendu : une version >= 2.40 pour WebKitGTK
```

> 🧭 **Explication.** Ces deux commandes interrogent `pkg-config` pour connaître la version installée de WebKitGTK et de GTK 3. Elles ne compilent rien : elles vérifient simplement que les fichiers `.pc` des bibliothèques sont visibles, ce qui conditionne la compilation Rust. Une version de WebKitGTK inférieure à 2.40 ou une absence de résultat signale un paquet `-dev` manquant.

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

> 🧭 **Explication.** `winget` est le gestionnaire de paquets intégré à Windows 10/11. Cette commande installe `rustup`, l'installateur et gestionnaire de toolchains Rust, sans passer par un navigateur. Elle ne compile rien encore : elle prépare l'outil qui permettra ensuite de choisir la cible MSVC et d'installer Cargo.

Puis, dans un nouveau terminal :

```powershell
rustup default stable-msvc
rustc --version
cargo --version
```

> 🧭 **Explication.** `rustup default stable-msvc` sélectionne la toolchain stable associée à l'éditeur MSVC, puis `rustc --version` et `cargo --version` confirment que le compilateur et le gestionnaire de dépendances répondent. La cible MSVC est préférable sous Windows car elle s'intègre directement aux Build Tools C++ et évite les problèmes d'édition de liens de la variante GNU.

La cible **`stable-msvc`** est importante : la cible GNU fonctionne mais complique le linking avec MSVC.

### 3.4 Node.js et Yarn

```powershell
winget install OpenJS.NodeJS.LTS
```

> 🧭 **Explication.** Cette commande installe la dernière version LTS de Node.js via `winget`, avec npm inclus. Elle suffit pour faire tourner Vite et le CLI Tauri côté frontend ; aucun serveur Node ne sera embarqué dans l'application finale. Rouvrez ensuite le terminal pour que le `PATH` soit actualisé.

Fermez puis rouvrez le terminal, ensuite :

```powershell
node -v
npm install -g yarn
yarn -v
```

> 🧭 **Explication.** Ces trois commandes vérifient Node, installent Yarn globalement avec npm, puis contrôlent sa version. `npm install -g yarn` place le binaire `yarn` dans le répertoire global de Node, accessible depuis n'importe quel projet. Si `yarn -v` échoue juste après l'installation, fermez et rouvrez le terminal avant de conclure à une erreur.

> Si PowerShell bloque les scripts (`npm.ps1 cannot be loaded`), exécutez `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`, ou utilisez `npm.cmd install -g yarn`.

---

## 4. macOS

### 4.1 Xcode Command Line Tools

```bash
xcode-select --install
```

> 🧭 **Explication.** `xcode-select --install` ouvre l'installateur des outils en ligne de commande Apple, qui fournit `clang`, les en-têtes système et les outils de compilation nécessaires à Rust. L'application Xcode complète n'est pas requise pour développer avec Tauri. Acceptez la licence et attendez la fin de l'installation avant de lancer Cargo.

Vérifiez :

```bash
xcode-select -p
# /Library/Developer/CommandLineTools
```

> 🧭 **Explication.** `xcode-select -p` affiche le chemin du dossier de développement actif, ici `/Library/Developer/CommandLineTools`. Cette vérification confirme que les outils Apple sont bien installés et sélectionnés. Si le chemin pointe vers une installation Xcode incomplète, utilisez `sudo xcode-select -s` pour le corriger.

L'application Xcode complète n'est pas nécessaire pour Tauri, sauf pour la notarisation (chapitre 12).

### 4.2 Rust

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source "$HOME/.cargo/env"
rustc --version
```

> 🧭 **Explication.** Cette séquence télécharge le script officiel de `rustup` via HTTPS, l'exécute, puis recharge l'environnement du shell pour rendre `cargo` et `rustc` accessibles. L'option `--proto '=https'` impose HTTPS et `-sSf` échoue proprement en cas d'erreur réseau. La ligne `source` n'est utile que dans le terminal courant ; les nouveaux terminaux liront `.cargo/env` automatiquement.

Sur Apple Silicon, la cible par défaut est `aarch64-apple-darwin`. Pour produire un binaire Intel, ajoutez la cible :

```bash
rustup target add x86_64-apple-darwin
```

> 🧭 **Explication.** Cette commande ajoute la cible de compilation `x86_64-apple-darwin` à la toolchain installée sur un Mac Apple Silicon. Elle permet de produire un binaire Intel en plus du binaire ARM natif, par exemple pour distribuer une application universelle. L'ajout de cible ne change pas la cible par défaut : il faut la préciser au moment du build.

### 4.3 Node.js et Yarn

Avec Homebrew :

```bash
brew install node
npm install -g yarn
```

> 🧭 **Explication.** Homebrew installe Node.js et npm sur macOS, puis npm installe Yarn globalement. Cette méthode convient si vous voulez une version de Node gérée par Homebrew et mise à jour avec `brew upgrade`. Pour changer fréquemment de version de Node, préférez toutefois un gestionnaire comme `fnm` ou `nvm`.

Ou avec `fnm` (recommandé pour changer de version de Node) :

```bash
brew install fnm
fnm install 22
fnm use 22
```

> 🧭 **Explication.** `fnm` est un gestionnaire de versions de Node rapide, installé ici via Homebrew. `fnm install 22` télécharge Node 22 et `fnm use 22` l'active pour la session courante. Pensez à ajouter l'initialisation de `fnm` à votre fichier de shell pour que la version soit reprise automatiquement dans chaque terminal.

---

## 5. Rust : configuration recommandée

### 5.1 Vérifier la toolchain

```bash
rustup show
# stable (default)
# rustc 1.9x.x
```

> 🧭 **Explication.** `rustup show` affiche la toolchain active, la cible par défaut et les composants installés ; les lignes commentées rappellent la sortie attendue. Cette commande est le premier réflexe en cas d'erreur de compilation liée à une mauvaise version de Rust. Tauri 2 exige au minimum Rust 1.77.2, et certains plugins récents demandent davantage.

Tauri 2 exige Rust **≥ 1.77.2** ; les plugins récents (fs, sql) peuvent exiger **≥ 1.90**. Utilisez la dernière stable :

```bash
rustup update stable
```

> 🧭 **Explication.** `rustup update stable` télécharge et installe la dernière version stable de Rust, ainsi que les composants associés. Elle remplace l'ancienne toolchain sans désinstaller vos projets ni vos dépendances. Relancez ensuite `rustc --version` pour vérifier que la mise à jour a bien été prise en compte.

### 5.2 Composants utiles

```bash
rustup component add rustfmt clippy
```

> 🧭 **Explication.** Cette commande ajoute deux composants officiels à la toolchain : `rustfmt`, qui reformate le code selon le style standard, et `clippy`, qui signale des erreurs et des maladresses. Ils s'utilisent ensuite avec `cargo fmt` et `cargo clippy`. Les installer dès le départ évite d'accumuler du code non formaté.

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

> 🧭 **Explication.** `CARGO_BUILD_JOBS` indique à Cargo combien de compilations lancer en parallèle ; `$(nproc)` renvoie le nombre de cœurs disponibles sous Linux. `df -h .` vérifie l'espace disque du répertoire courant, car le dossier `target/` peut occuper plusieurs gigaoctets. Ces réglages accélèrent la première compilation, qui reste longue quel que soit le matériel.

Pour les projets volumineux, `sccache` peut réduire les temps de compilation :

```bash
cargo install sccache
export RUSTC_WRAPPER=sccache
```

> 🧭 **Explication.** `sccache` est un cache de compilation partagé : `cargo install` l'installe, puis `RUSTC_WRAPPER` demande à Cargo de passer par lui pour chaque compilation. Les artefacts déjà produits sont réutilisés, ce qui accélère les rebuilds et les builds successifs. Ces variables ne sont actives que dans le terminal courant, à moins de les ajouter à votre profil de shell.

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

> 🧭 **Explication.** Le script officiel de `nvm` est téléchargé et exécuté, puis `source ~/.bashrc` recharge la configuration du shell. `nvm install 22` installe Node 22 et `nvm use 22` l'active pour la session ; `node -v` confirme la version. `nvm` est pratique pour jongler entre plusieurs projets, mais il ne gère que Node, pas Yarn.

### Avec fnm (multi-plateforme)

```bash
# macOS/Linux
brew install fnm        # ou : curl -fsSL https://fnm.vercel.app/install | bash
fnm install 22
fnm use 22
```

> 🧭 **Explication.** Sur macOS et Linux, `fnm` s'installe via Homebrew ou via son script officiel, indiqué en commentaire. Les commandes suivantes installent puis activent Node 22, comme avec `nvm`. L'intérêt de `fnm` est sa rapidité et son support natif de Windows, ce qui uniformise les environnements d'équipe.

### Avec winget (Windows)

```powershell
winget install OpenJS.NodeJS.LTS
```

> 🧭 **Explication.** Sous Windows, `winget` installe directement la dernière version LTS de Node.js, sans Script Host ni gestionnaire de versions. C'est la méthode la plus simple pour démarrer. Si vous devez conserver plusieurs versions, utilisez plutôt `fnm`, qui s'installe aussi via `winget`.

### Fichier `.nvmrc`

À la racine du projet :

```
22
```

> 🧭 **Explication.** Ce fichier contient uniquement le numéro de version majeure de Node attendu par le projet. `nvm use` ou `fnm use`, lancés à la racine, lisent ce fichier et sélectionnent automatiquement la bonne version. Committez-le pour que tous les contributeurs travaillent avec le même runtime.

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

> 🧭 **Explication.** Cette séquence installe Yarn 1 globalement via npm, puis affiche sa version ; la sortie attendue est `1.22.x`. Yarn 1 reste la version utilisée par défaut dans ce cours pour sa simplicité et sa compatibilité avec `create-tauri-app`. Vérifiez toujours la version après installation, car un ancien binaire peut rester dans le `PATH`.

Ou via Corepack :

```bash
corepack enable
corepack prepare yarn@1.22.22 --activate
```

> 🧭 **Explication.** Corepack, fourni avec Node, active et télécharge une version précise de Yarn sans passer par npm. `corepack prepare yarn@1.22.22 --activate` épingle Yarn 1.22.22 pour le projet. Cette méthode est plus reproductible qu'une installation globale, car la version est déclarée et partagée via `package.json`.

> Node 25+ ne fournit plus Corepack par défaut. Installez-le avec `npm install -g corepack` si la commande est absente.

### 7.2 Yarn Berry (4.x)

```bash
corepack enable
corepack prepare yarn@4.5.0 --activate
# ou, dans le projet :
yarn set version stable
yarn -v
```

> 🧭 **Explication.** Ces commandes activent Yarn 4 via Corepack et l'épinglent à la version 4.5.0. Dans un projet existant, `yarn set version stable` enregistre la version choisie dans le dépôt. `yarn -v` confirme ensuite que c'est bien Yarn 4, et non Yarn 1, qui sera utilisé.

Créez ou complétez `.yarnrc.yml` :

```yaml
nodeLinker: node-modules
```

> 🧭 **Explication.** Ce réglage demande à Yarn 4 d'installer les dépendances dans `node_modules`, comme Yarn 1, au lieu du mode Plug'n'Play par défaut. Il évite les incompatibilités avec les binaires natifs, Vite et le CLI Tauri, qui supposent une arborescence classique. Placez ce fichier `.yarnrc.yml` à la racine du projet.

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

> 🧭 **Explication.** Cette ligne augmente à dix minutes le délai maximal accordé à Yarn 1 pour télécharger un paquet. Elle est utile sur les connexions lentes ou derrière un proxy, où le délai par défaut provoque des échecs intermittents. Le fichier `.yarnrc` se place à la racine du projet ou dans le dossier utilisateur.

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

> 🧭 **Explication.** Ce fichier de réglages VS Code active Clippy pour rust-analyzer, le formatage à la sauvegarde et associe les bons formateurs aux fichiers Rust et Vue. La dernière ligne indique à l'éditeur d'utiliser le TypeScript installé dans le projet plutôt que sa version intégrée. Ces réglages sont propres au dossier et peuvent être partagés avec l'équipe.

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

> 🧭 **Explication.** Ce script bash vérifie en une passe les versions de Node, Yarn, Rust et Cargo, puis les dépendances propres à l'OS : WebKitGTK et GTK sous Linux, Xcode sous macOS. `set -e` interrompt le script à la première commande en échec, ce qui rend le diagnostic immédiat. Rendez-le exécutable avec `chmod +x check-env.sh` avant de le lancer.

Sous Windows PowerShell :

```powershell
node -v
yarn -v
rustc --version
cargo --version
```

> 🧭 **Explication.** Cette variante PowerShell reprend les mêmes vérifications de version, sans les contrôles spécifiques à Linux ou macOS. Elle suffit sous Windows, où WebView2 est fourni par le système et où Xcode n'existe pas. Exécutez chaque ligne dans un terminal rouvert après l'installation pour éviter les problèmes de `PATH`.

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
