# 13 — Mises à jour automatiques et CI/CD

> **Objectifs**
> - Automatiser tests, builds et releases avec GitHub Actions.
> - Construire pour Linux, Windows et macOS en parallèle.
> - Signer les artefacts et publier les mises à jour.
> - Gérer les secrets proprement.
> - Comprendre le flux `tag → build → release → updater`.
> - Mettre en place une stratégie de version et de canaux.

Sommaire : [← Chapitre précédent](./12-build-distribution.md) · [README](../README.md) · [Chapitre suivant →](./14-performance-securite.md)

---

## 1. Le pipeline cible

```
push / PR
   │
   ├─▶ job "quality" : lint, typecheck, tests front, tests Rust
   │
   └─▶ tag v* ─▶ job "release" (matrice)
                    ├─ Linux   → .deb, .AppImage + .sig
                    ├─ Windows → .msi, .exe   + .sig
                    ├─ macOS Intel   → .dmg + .sig
                    └─ macOS Silicon → .dmg + .sig
                              │
                              ▼
                    GitHub Release + latest.json
                              │
                              ▼
                    Application installée → check() → update
```

---

## 2. Job de qualité

`.github/workflows/ci.yml` :

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  frontend:
    name: Frontend
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: yarn

      - run: yarn install --frozen-lockfile
      - run: yarn test:run
      - run: yarn build

  rust:
    name: Rust
    runs-on: ubuntu-22.04
    steps:
      - uses: actions/checkout@v4

      - name: Dépendances système
        run: |
          sudo apt-get update
          sudo apt-get install -y \
            libwebkit2gtk-4.1-dev libgtk-3-dev libayatana-appindicator3-dev \
            librsvg2-dev libxdo-dev libssl-dev patchelf

      - uses: dtolnay/rust-toolchain@stable
        with:
          components: clippy, rustfmt

      - uses: Swatinem/rust-cache@v2
        with:
          workspaces: "./src-tauri -> target"

      - name: Format
        run: cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check

      - name: Clippy
        run: cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings

      - name: Tests
        run: cargo test --manifest-path src-tauri/Cargo.toml
```

> 💡 `cargo clippy -D warnings` peut être strict au début. Corrigez les avertissements plutôt que de les désactiver en masse.

---

## 3. Workflow de release

`.github/workflows/release.yml` :

```yaml
name: Release

on:
  push:
    tags:
      - "v*"
  workflow_dispatch:

permissions:
  contents: write

jobs:
  publish:
    name: ${{ matrix.name }}
    runs-on: ${{ matrix.platform }}
    strategy:
      fail-fast: false
      matrix:
        include:
          - name: Linux x86_64
            platform: ubuntu-22.04
            args: ""
          - name: Windows x86_64
            platform: windows-latest
            args: ""
          - name: macOS Apple Silicon
            platform: macos-latest
            args: "--target aarch64-apple-darwin"
          - name: macOS Intel
            platform: macos-latest
            args: "--target x86_64-apple-darwin"

    steps:
      - uses: actions/checkout@v4

      - name: Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: yarn

      - name: Rust
        uses: dtolnay/rust-toolchain@stable
        with:
          targets: ${{ startsWith(matrix.platform, 'macos') && 'aarch64-apple-darwin,x86_64-apple-darwin' || '' }}

      - name: Cache Rust
        uses: Swatinem/rust-cache@v2
        with:
          workspaces: "./src-tauri -> target"
          key: ${{ matrix.args }}

      - name: Dépendances Linux
        if: matrix.platform == 'ubuntu-22.04'
        run: |
          sudo apt-get update
          sudo apt-get install -y \
            libwebkit2gtk-4.1-dev libgtk-3-dev libayatana-appindicator3-dev \
            librsvg2-dev libxdo-dev libssl-dev patchelf

      - name: Installer les dépendances
        run: yarn install --frozen-lockfile

      - name: Build et publication
        uses: tauri-apps/tauri-action@v0
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

          # Mises à jour
          TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}
          TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY_PASSWORD }}

          # Signature macOS
          APPLE_CERTIFICATE: ${{ secrets.APPLE_CERTIFICATE }}
          APPLE_CERTIFICATE_PASSWORD: ${{ secrets.APPLE_CERTIFICATE_PASSWORD }}
          APPLE_SIGNING_IDENTITY: ${{ secrets.APPLE_SIGNING_IDENTITY }}
          APPLE_ID: ${{ secrets.APPLE_ID }}
          APPLE_PASSWORD: ${{ secrets.APPLE_PASSWORD }}
          APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}

          # Signature Windows (si signCommand / Azure Trusted Signing)
          AZURE_TENANT_ID: ${{ secrets.AZURE_TENANT_ID }}
          AZURE_CLIENT_ID: ${{ secrets.AZURE_CLIENT_ID }}
          AZURE_CLIENT_SECRET: ${{ secrets.AZURE_CLIENT_SECRET }}

        with:
          tagName: ${{ github.ref_name }}
          releaseName: "Taurinote ${{ github.ref_name }}"
          releaseBody: |
            Voir les changements de cette version.

            ## Installation
            - Windows : `.exe` ou `.msi`
            - macOS : `.dmg`
            - Linux : `.AppImage` ou `.deb`
          releaseDraft: true
          prerelease: false
          args: ${{ matrix.args }}
```

### 3.1 Ce que fait `tauri-action`

- exécute `yarn tauri build` avec les arguments fournis ;
- signe les artefacts si les secrets sont présents ;
- crée ou met à jour la GitHub Release ;
- téléverse les installateurs ;
- téléverse les fichiers `.sig` de l'updater ;
- génère et téléverse `latest.json` (si `createUpdaterArtifacts` est activé).

### 3.2 Brouillon de release

`releaseDraft: true` permet de vérifier les artefacts avant publication. Une fois validé, publiez la release. L'updater ne voit que les releases publiées (selon l'endpoint).

---

## 4. Secrets GitHub

`Settings → Secrets and variables → Actions → New repository secret`.

| Secret | Contenu |
|---|---|
| `TAURI_SIGNING_PRIVATE_KEY` | Contenu de la clé privée minisign |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Mot de passe de la clé |
| `APPLE_CERTIFICATE` | Certificat `.p12` encodé en base64 |
| `APPLE_CERTIFICATE_PASSWORD` | Mot de passe du `.p12` |
| `APPLE_SIGNING_IDENTITY` | `Developer ID Application: …` |
| `APPLE_ID` | Identifiant Apple |
| `APPLE_PASSWORD` | Mot de passe d'application |
| `APPLE_TEAM_ID` | Identifiant d'équipe |
| `AZURE_*` | Signature Windows (optionnel) |

### Encoder un certificat macOS

```bash
base64 -i certificat.p12 -o certificat.p12.b64
# Copier le contenu dans le secret APPLE_CERTIFICATE
```

### Encoder la clé privée

```bash
base64 -w0 ~/.tauri/taurinote.key
```

Ou collez directement le contenu du fichier si le format est préservé. Les deux fonctionnent selon la version de Tauri ; vérifiez la documentation de `tauri-action`.

> 🔒 Ne mettez jamais ces valeurs dans le dépôt, un fichier `.env` committé ou un log CI. Utilisez les secrets et masquez les sorties.

---

## 5. Endpoint de mise à jour

Le plus simple : pointer vers la dernière release GitHub.

```json
{
  "plugins": {
    "updater": {
      "endpoints": [
        "https://github.com/VOTRE_ORG/taurinote/releases/latest/download/latest.json"
      ],
      "pubkey": "…"
    }
  }
}
```

Avantages :

- pas de serveur à maintenir ;
- HTTPS et CDN GitHub ;
- `latest.json` généré par `tauri-action`.

Inconvénients :

- dépend de GitHub Releases ;
- pas de déploiement progressif ni de rollback fin ;
- les releases doivent être publiques (ou accessibles avec un token).

### Serveur dédié

Pour un contrôle total :

```
https://releases.exemple.com/taurinote/latest.json
```

Publiez le JSON et les artefacts sur un CDN/S3, avec :

- HTTPS ;
- en-têtes `Cache-Control` courts (`max-age=60`) ;
- signature des artefacts ;
- journaux d'accès.

### Canaux (stable / beta)

Endpoint différent selon le canal :

```ts
const channel = import.meta.env.VITE_UPDATE_CHANNEL ?? "stable";
```

```json
{
  "plugins": {
    "updater": {
      "endpoints": [
        "https://releases.exemple.com/taurinote/{{channel}}/latest.json"
      ]
    }
  }
}
```

> ⚠️ Les placeholders disponibles dans les endpoints updater sont limités (`{{target}}`, `{{arch}}`, `{{current_version}}` selon la version). Pour un canal, le plus simple est de compiler deux configurations ou de stocker l'URL côté Rust.

---

## 6. Versionner et taguer

### 6.1 Bumper la version

```bash
# Exemple : 0.1.0 → 0.2.0
yarn version --new-version 0.2.0 --no-git-tag-version
```

Mettez aussi à jour `src-tauri/tauri.conf.json` et `src-tauri/Cargo.toml`.

Script de synchronisation `scripts/sync-version.mjs` :

```js
import { readFile, writeFile } from "node:fs/promises";

const pkg = JSON.parse(await readFile("package.json", "utf8"));
const version = pkg.version;

const confPath = "src-tauri/tauri.conf.json";
const conf = JSON.parse(await readFile(confPath, "utf8"));
conf.version = version;
await writeFile(confPath, JSON.stringify(conf, null, 2) + "\n");

const cargoPath = "src-tauri/Cargo.toml";
const cargo = await readFile(cargoPath, "utf8");
await writeFile(
  cargoPath,
  cargo.replace(/^version = ".*"$/m, `version = "${version}"`)
);
```

```json
{
  "scripts": {
    "version": "node scripts/sync-version.mjs && git add -A"
  }
}
```

### 6.2 Taguer

```bash
git tag v0.2.0
git push origin main --tags
```

Le workflow `release.yml` se déclenche.

> ⚠️ Un tag doit correspondre à la version de `tauri.conf.json`. Sinon, l'updater proposera une version incohérente.

---

## 7. Tests dans la CI

### 7.1 Frontend

```yaml
- run: yarn test:run
- run: yarn build
```

### 7.2 Rust

```yaml
- run: cargo test --manifest-path src-tauri/Cargo.toml
- run: cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings
```

### 7.3 E2E (optionnel)

Sur Linux :

```yaml
- name: WebKitWebDriver
  run: sudo apt-get install -y webkit2gtk-driver

- name: Build
  run: yarn tauri build --debug

- name: E2E
  run: |
    tauri-driver --port 4444 &
    yarn wdio run wdio.conf.ts
```

> ⚠️ Les E2E natifs sont fragiles en CI (affichage, pilotes). Réservez-les à un job nocturne ou à un workflow manuel.

---

## 8. Cache et performance

| Cache | Action |
|---|---|
| Dépendances Node | `actions/setup-node` avec `cache: yarn` |
| Cargo | `Swatinem/rust-cache@v2` |
| Cibles Rust | `dtolnay/rust-toolchain` |
| Vite | cache optionnel selon le projet |

Le cache Cargo peut réduire un build de 15 à 4 minutes.

Pour Yarn Berry, remplacez :

```yaml
- run: yarn install --immutable
```

et ajoutez Corepack avant :

```yaml
- run: corepack enable
- run: corepack prepare yarn@4.5.0 --activate
```

---

## 9. GitLab CI (variante)

```yaml
stages: [test, build]

test:
  image: node:22
  stage: test
  script:
    - corepack enable
    - yarn install --immutable
    - yarn test:run

build-linux:
  image: rust:latest
  stage: build
  before_script:
    - apt-get update && apt-get install -y libwebkit2gtk-4.1-dev librsvg2-dev patchelf
  script:
    - yarn install --immutable
    - yarn tauri build
  artifacts:
    paths:
      - src-tauri/target/release/bundle/
```

GitLab n'a pas d'équivalent direct à `tauri-action` ; publiez manuellement les artefacts et le `latest.json`.

---

## 10. Rollback et incidents

- **Ne supprimez pas** une release publiée : les clients peuvent encore la télécharger.
- Pour retirer une version défectueuse, publiez une version supérieure corrigée.
- Si l'updater casse, les utilisateurs doivent réinstaller manuellement : gardez toujours un installateur direct accessible.
- Conservez les artefacts et signatures pendant au moins un an.
- Surveillez les taux d'échec de mise à jour (si vous avez de la télémétrie).
- Documentez la procédure de récupération.

> 🔒 Une clé de signature compromise permet de pousser une mise à jour malveillante. Rotation : publiez une version signée avec l'ancienne clé qui embarque la nouvelle clé publique, puis révoquez l'ancienne.

---

## 11. Checklist CI/CD

- [ ] Tests front et Rust exécutés sur chaque PR.
- [ ] `cargo fmt` et `clippy` bloquants.
- [ ] Matrice Linux/Windows/macOS.
- [ ] Cache Node et Cargo.
- [ ] Secrets limités aux jobs de release.
- [ ] Signature macOS et Windows configurée.
- [ ] `createUpdaterArtifacts` activé.
- [ ] `latest.json` publié et accessible en HTTPS.
- [ ] Version cohérente entre tag, `package.json`, `Cargo.toml`, `tauri.conf.json`.
- [ ] Release testée depuis la version précédente.
- [ ] Procédure de rollback documentée.

---

## À retenir

- Un job de qualité bloque les régressions ; un workflow de release construit et publie.
- `tauri-action` gère build, signature, release GitHub et `latest.json`.
- La matrice couvre Linux, Windows et les deux architectures macOS.
- Les secrets de signature ne doivent jamais être loggés ni committés.
- L'endpoint d'update peut pointer vers GitHub Releases ou un CDN.
- Tag, version et `tauri.conf.json` doivent rester synchronisés.
- Testez toujours une mise à jour réelle avant d'annoncer une release.

---

## Exercices

1. **CI.** Ajoutez un job qui échoue si `yarn build` produit des warnings TypeScript.
2. **Cache.** Configurez `Swatinem/rust-cache` et mesurez le gain sur deux runs.
3. **Release.** Créez un tag `v0.1.0` et vérifiez que les quatre artefacts sont publiés en brouillon.
4. **Updater.** Publiez `0.1.0`, installez-la, puis publiez `0.1.1`. Vérifiez que la mise à jour est proposée.
5. **Secrets.** Listez les secrets nécessaires pour macOS et expliquez comment les renouveler.
6. **Rollback.** Rédigez une procédure de 10 lignes pour retirer une version défectueuse.

Solutions : [annexe D](../annexes/d-solutions.md#chapitre-13).

---

[← Chapitre précédent](./12-build-distribution.md) · [README](../README.md) · [Chapitre suivant : performance et sécurité →](./14-performance-securite.md)
