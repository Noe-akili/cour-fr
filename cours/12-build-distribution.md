# 12 — Build, signature et distribution

> **Objectifs**
> - Générer les icônes et configurer l'empaquetage.
> - Produire des installateurs pour Windows, macOS et Linux.
> - Signer l'application et comprendre la notarisation macOS.
> - Mettre en place les mises à jour automatiques.
> - Préparer une release versionnée.
> - Connaître les contraintes des stores.

Sommaire : [← Chapitre précédent](./11-tests-debogage.md) · [README](../README.md) · [Chapitre suivant →](./13-cicd-deploiement.md)

---

## 1. Le build de production

```bash
yarn tauri build
```

> 🧭 **Explication.** Cette commande lance la chaîne de build de production : Tauri exécute d'abord `beforeBuildCommand` (ici `yarn build`), puis compile le crate Rust en mode `release` avec optimisations et LTO. Le binaire, les assets frontend et les ressources sont ensuite empaquetés dans les installateurs propres à chaque plateforme. Lancez-la sur chaque OS cible, car un installateur ne peut généralement pas être produit pour une autre plateforme depuis Linux.

Déroulé :

1. `beforeBuildCommand` → `yarn build` (typecheck + Vite).
2. Cargo compile en `release` (LTO, optimisations).
3. Tauri empaquette le binaire, les assets et les ressources.
4. Les installateurs sont générés dans `src-tauri/target/release/bundle/`.

### Sorties par plateforme

| OS | Dossiers | Formats |
|---|---|---|
| Linux | `bundle/deb`, `bundle/rpm`, `bundle/appimage` | `.deb`, `.rpm`, `.AppImage` |
| macOS | `bundle/macos`, `bundle/dmg` | `.app`, `.dmg` |
| Windows | `bundle/msi`, `bundle/nsis` | `.msi`, `.exe` |

Le binaire brut : `src-tauri/target/release/<nom>`.

### Options utiles

```bash
yarn tauri build --debug              # build non optimisé, plus rapide
yarn tauri build --bundles deb        # un seul format
yarn tauri build --bundles appimage
yarn tauri build --no-bundle          # binaire seul
yarn tauri build --target aarch64-apple-darwin
yarn tauri build --verbose
```

> 🧭 **Explication.** Ces variantes modifient le comportement du build : `--debug` accélère la compilation mais produit un binaire non optimisé, `--bundles` limite les formats générés et `--no-bundle` ne conserve que le binaire. `--target` sert à compiler pour une autre architecture, par exemple Apple Silicon depuis une machine Intel correctement outillée. Utilisez ces options pour itérer vite ou ne produire que l'artefact dont vous avez besoin.

> 💡 Un build release peut prendre 5 à 20 minutes selon la machine. En CI, le cache Cargo est indispensable (chapitre 13).

---

## 2. Icônes

### 2.1 Générer le jeu complet

Préparez un PNG carré de **1024 × 1024** avec transparence, puis :

```bash
yarn tauri icon ./app-icon.png
```

> 🧭 **Explication.** La commande part d'un PNG carré de 1024 × 1024 et génère automatiquement toutes les tailles et formats attendus par les plateformes. Elle évite de produire à la main les variantes macOS, Windows, tray et stores, qui doivent respecter des dimensions précises. Conservez l'image source dans le dépôt ou un stockage partagé afin de pouvoir régénérer le jeu après une modification graphique.

Cela génère dans `src-tauri/icons/` :

- `32x32.png`, `128x128.png`, `128x128@2x.png` ;
- `icon.icns` (macOS) ;
- `icon.ico` (Windows) ;
- les icônes Android/iOS si présentes ;
- les variantes pour le tray et le Store.

Le fichier source n'a pas besoin d'être committé, mais conservez-le pour régénérer.

### 2.2 Bonnes pratiques

- Design simple, lisible à 16 px.
- Pas de texte fin.
- Contraste suffisant en thème clair et sombre.
- macOS : icône avec coins arrondis gérés par l'OS (ne pas les dessiner).
- Testez l'icône du tray séparément.

---

## 3. Configuration du bundle

```json
{
  "bundle": {
    "active": true,
    "targets": ["deb", "appimage", "nsis", "dmg"],
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ],
    "category": "Productivity",
    "shortDescription": "Gestionnaire de tâches local-first",
    "longDescription": "Taurinote organise vos tâches, tags et échéances, hors ligne.",
    "copyright": "© 2026 Votre nom",
    "resources": ["resources/*"],
    "fileAssociations": [
      {
        "ext": ["taurinote"],
        "name": "Document Taurinote",
        "description": "Fichier d'export Taurinote",
        "role": "Editor"
      }
    ]
  }
}
```

> 🧭 **Explication.** Ce fragment de `tauri.conf.json` active l'empaquetage et décrit les métadonnées communes à tous les installateurs. `targets` restreint les formats produits, `icon` liste les fichiers générés à l'étape précédente, et `resources` embarque des fichiers supplémentaires dans l'application. `fileAssociations` permet d'ouvrir les fichiers `.taurinote` avec l'application ; adaptez les descriptions et la catégorie avant publication.

### 3.1 Catégories

Valeurs courantes : `Business`, `DeveloperTool`, `Education`, `Entertainment`, `Finance`, `Game`, `GraphicsAndDesign`, `HealthcareAndFitness`, `Lifestyle`, `Medical`, `Music`, `News`, `Photography`, `Productivity`, `Reference`, `SocialNetworking`, `Sports`, `Travel`, `Utility`, `Video`, `Weather`.

### 3.2 Windows

```json
{
  "bundle": {
    "windows": {
      "webviewInstallMode": {
        "type": "downloadBootstrapper",
        "silent": true
      },
      "nsis": {
        "installMode": "currentUser",
        "languages": ["French", "English"]
      },
      "wix": {
        "language": ["fr-FR", "en-US"]
      }
    }
  }
}
```

> 🧭 **Explication.** Cette configuration Windows choisit comment WebView2 est fourni et comment l'installateur NSIS se comporte. `downloadBootstrapper` télécharge le runtime au moment de l'installation, ce qui garde l'installeur léger, tandis que `installMode: "currentUser"` évite d'exiger les droits administrateur. Les listes `languages` localisent l'assistant NSIS et WiX ; vérifiez que les langues choisies sont bien prises en charge par votre version de Tauri.

| Option WebView2 | Effet |
|---|---|
| `downloadBootstrapper` | Télécharge WebView2 à l'installation (petit) |
| `embedBootstrapper` | Embarque le bootstrapper (plus gros, hors ligne partiel) |
| `offlineInstaller` | Embarque l'installateur complet (~150 Mo) |
| `skip` | Suppose WebView2 présent |
| `fixedRuntime` | Embarque une version fixe |

`installMode` : `currentUser` (pas d'admin), `perMachine` (tous les utilisateurs), `both`.

### 3.3 macOS

```json
{
  "bundle": {
    "macOS": {
      "minimumSystemVersion": "10.15",
      "entitlements": "entitlements.plist",
      "exceptionDomain": ""
    }
  }
}
```

> 🧭 **Explication.** Ce bloc règle le comportement macOS : `minimumSystemVersion` fixe la plus ancienne version d'OS acceptée, `entitlements` référence le fichier de droits nécessaire au sandbox, aux notifications ou au réseau, et `exceptionDomain` ouvre une exception ATS pour un domaine distant. Laissez `exceptionDomain` vide sauf contrainte forte, car chaque exception affaiblit la sécurité réseau. Vérifiez les entitlements avec la signature et la notarisation avant diffusion.

- `minimumSystemVersion` : version minimale supportée.
- `entitlements` : requis pour le sandbox, les notifications, l'accès réseau.
- `exceptionDomain` : exceptions ATS (à éviter).

### 3.4 Linux

```json
{
  "bundle": {
    "linux": {
      "deb": {
        "depends": ["libwebkit2gtk-4.1-0", "libgtk-3-0"]
      },
      "appimage": {
        "bundleMediaFramework": false
      }
    }
  }
}
```

> 🧭 **Explication.** Ce fragment adapte les paquets Linux : `deb.depends` déclare explicitement les bibliothèques système requises, et `bundleMediaFramework` contrôle l'embarquement de GStreamer dans l'AppImage. Désactiver le framework média réduit fortement la taille, mais casse la lecture audio/vidéo si l'utilisateur ne dispose pas des codecs sur sa machine. Tauri détecte souvent les dépendances Debian tout seul ; ne les surchargez que si le paquet généré est incomplet.

Les dépendances Debian sont souvent détectées automatiquement. Vérifiez avec :

```bash
dpkg-deb -I src-tauri/target/release/bundle/deb/*.deb
```

> 🧭 **Explication.** `dpkg-deb -I` affiche les métadonnées du paquet Debian produit : nom, version, architecture, dépendances et mainteneur. C'est le moyen rapide de vérifier que les dépendances détectées sont correctes et que la version correspond au tag avant de publier. Faites-le sur une machine propre ou dans une VM pour éviter de dépendre de bibliothèques déjà installées.

---

## 4. Signature

### 4.1 Pourquoi signer ?

- **Windows** : SmartScreen bloque les exécutables non signés.
- **macOS** : Gatekeeper refuse l'ouverture sans signature/notarisation.
- **Linux** : pas de signature obligatoire, mais des checksums sont recommandés.

### 4.2 Windows

Achetez un certificat de signature de code (OV ou EV), puis configurez :

```json
{
  "bundle": {
    "windows": {
      "certificateThumbprint": "A1B2C3...",
      "digestAlgorithm": "sha256",
      "timestampUrl": "http://timestamp.digicert.com"
    }
  }
}
```

> 🧭 **Explication.** Ces options indiquent à Tauri comment signer l'exécutable Windows : `certificateThumbprint` identifie le certificat installé dans le magasin Windows, `digestAlgorithm` fixe l'algorithme de hachage et `timestampUrl` ajoute un horodatage signé. L'horodatage est essentiel : il permet à la signature de rester valide après l'expiration du certificat. Vérifiez l'empreinte exacte du certificat et ne la confondez pas avec son numéro de série.

Ou utilisez une commande de signature personnalisée (Azure Trusted Signing, HSM) :

```json
{
  "bundle": {
    "windows": {
      "signCommand": {
        "cmd": "signtool",
        "args": ["sign", "/fd", "sha256", "/tr", "http://timestamp.digicert.com", "/td", "sha256", "/f", "cert.pfx", "/p", "$PASSWORD", "%1"]
      }
    }
  }
}
```

> 🧭 **Explication.** `signCommand` remplace la signature intégrée par un appel à `signtool`, ce qui permet d'utiliser un HSM, Azure Trusted Signing ou un certificat non installé localement. Les arguments sont transmis à l'outil, `%1` représentant l'artefact à signer et `$PASSWORD` une variable d'environnement fournie par la CI. Ne stockez jamais le `.pfx` ni son mot de passe dans le dépôt ; injectez-les comme secrets au moment du build.

> ⚠️ Ne commitez jamais un `.pfx` ni son mot de passe. Utilisez des secrets CI.

### 4.3 macOS

Prérequis :

- compte Apple Developer Program ;
- certificat **Developer ID Application** dans le trousseau ;
- identifiant d'équipe.

Signature locale :

```bash
export APPLE_SIGNING_IDENTITY="Developer ID Application: Votre Nom (TEAMID)"
yarn tauri build
```

> 🧭 **Explication.** Cette commande exporte l'identité de signature macOS puis lance le build, afin que Tauri signe automatiquement l'application avec le certificat correspondant présent dans le trousseau. La chaîne doit reprendre exactement le nom du certificat « Developer ID Application » et l'identifiant d'équipe entre parenthèses. Sans cette variable, le binaire peut être produit mais Gatekeeper le refusera chez vos utilisateurs.

Notarisation :

```bash
export APPLE_ID="vous@example.com"
export APPLE_PASSWORD="mot-de-passe-application"   # mot de passe d'application, pas le mot de passe Apple
export APPLE_TEAM_ID="TEAMID"
yarn tauri build
```

> 🧭 **Explication.** Ces variables fournissent à Tauri les identifiants nécessaires pour soumettre automatiquement l'application au service de notarisation d'Apple après la signature. `APPLE_PASSWORD` doit être un mot de passe d'application généré depuis le compte Apple, jamais le mot de passe principal. La notarisation ajoute un aller-retour réseau de plusieurs minutes ; conservez les mêmes valeurs dans les secrets CI pour les releases.

Tauri signe puis notarise automatiquement si ces variables sont présentes.

Vérification :

```bash
codesign --verify --deep --strict --verbose=2 src-tauri/target/release/bundle/macos/Taurinote.app
spctl --assess --type execute --verbose src-tauri/target/release/bundle/macos/Taurinote.app
xcrun stapler validate src-tauri/target/release/bundle/dmg/Taurinote_0.1.0_aarch64.dmg
```

> 🧭 **Explication.** Ces trois commandes contrôlent la chaîne de confiance macOS : `codesign --verify` valide la signature et son intégrité, `spctl --assess` simule l'évaluation Gatekeeper, et `stapler validate` vérifie que le ticket de notarisation est bien agrafé au DMG. Exécutez-les avant de publier, car une notarisation incomplète produit l'erreur « application endommagée » chez l'utilisateur. Adaptez les chemins et la version à l'artefact réellement généré.

> ⚠️ La notarisation peut prendre plusieurs minutes. En CI, prévoyez un timeout suffisant.

### 4.4 Linux

Pas de signature obligatoire. Publiez :

```bash
sha256sum Taurinote_0.1.0_amd64.AppImage > Taurinote_0.1.0_amd64.AppImage.sha256
```

> 🧭 **Explication.** Cette commande calcule l'empreinte SHA-256 de l'AppImage et l'écrit dans un fichier `.sha256` publié à côté de l'artefact. L'utilisateur peut ensuite vérifier que le téléchargement n'a pas été altéré avec `sha256sum -c`. Adaptez le nom du fichier à la version et à l'architecture réellement produites.

Pour les dépôts APT, signez les métadonnées avec GPG.

---

## 5. Mises à jour automatiques

### 5.1 Vue d'ensemble

```
┌──────────────┐   1. check()    ┌──────────────────┐
│ Application  │────────────────▶│ Endpoint JSON    │
│ (Tauri)      │◀────────────────│ (latest.json)    │
└──────┬───────┘  2. version +   └──────────────────┘
       │             signature
       │ 3. downloadAndInstall()
       ▼
┌──────────────┐
│ Nouveau      │
│ binaire      │
└──────────────┘
```

Tauri utilise **minisign** pour vérifier la signature des artefacts. La clé publique est embarquée dans l'application ; la clé privée signe les releases en CI.

### 5.2 Générer les clés

```bash
yarn tauri signer generate -w ~/.tauri/taurinote.key
```

> 🧭 **Explication.** Cette commande crée une paire de clés minisign dédiée aux mises à jour et écrit la clé privée dans le chemin indiqué par `-w`. Elle demande un mot de passe qui protège la clé privée ; ce mot de passe sera aussi nécessaire en CI. La clé publique servira à configurer l'updater, tandis que la clé privée ne doit jamais quitter votre coffre de secrets.

Sortie :

```
Your keypair was generated successfully.
Private: ~/.tauri/taurinote.key (keep it secret!)
Public:  dW50cnVzdGVk...
```

> 🧭 **Explication.** Cette sortie confirme la création de la paire et affiche la clé publique à recopier dans la configuration de l'updater. Le chemin mentionné contient la clé privée : conservez-le hors du dépôt et sauvegardez-le, car sa perte empêcherait de signer de futures mises à jour.

- **Clé publique** → `tauri.conf.json` (`plugins.updater.pubkey`).
- **Clé privée** → secret CI (`TAURI_SIGNING_PRIVATE_KEY`).
- **Mot de passe** → secret CI (`TAURI_SIGNING_PRIVATE_KEY_PASSWORD`).

> 🔒 Perdre la clé privée rend les mises à jour impossibles pour les versions déjà installées. Sauvegardez-la dans un gestionnaire de secrets.

### 5.3 Activer l'updater

```bash
yarn tauri add updater
yarn tauri add process
```

> 🧭 **Explication.** Ces commandes installent le plugin d'updater et le plugin `process`, qui fournit la fonction `relaunch` utilisée après installation d'une mise à jour. `tauri add` met à jour les dépendances Rust et npm, enregistre les plugins et ajoute les permissions de base. Relisez ensuite les capabilities générées : elles doivent rester limitées aux fenêtres et aux actions réellement nécessaires.

`tauri.conf.json` :

```json
{
  "bundle": {
    "createUpdaterArtifacts": true
  },
  "plugins": {
    "updater": {
      "pubkey": "dW50cnVzdGVk...",
      "endpoints": [
        "https://releases.exemple.com/taurinote/latest.json"
      ]
    }
  }
}
```

> 🧭 **Explication.** `createUpdaterArtifacts` demande à Tauri de produire les archives et signatures `.sig` nécessaires à l'updater lors du build. La clé `pubkey` vérifie ces signatures côté client, et `endpoints` liste les URL où l'application cherche `latest.json` ; plusieurs endpoints servent de repli. Les permissions `updater:default` et `process:allow-restart` doivent être déclarées dans une capability pour autoriser la vérification et le redémarrage.

Capabilities : `updater:default`, `process:allow-restart`.

### 5.4 Vérifier et installer

```ts
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

export async function checkForUpdates() {
  const update = await check();

  if (!update) return { available: false as const };

  console.log(`Version ${update.version} disponible : ${update.notes}`);

  await update.downloadAndInstall((event) => {
    switch (event.event) {
      case "Started":
        console.log("Téléchargement démarré", event.data.contentLength);
        break;
      case "Progress":
        console.log(`${event.data.chunkLength} octets reçus`);
        break;
      case "Finished":
        console.log("Téléchargement terminé");
        break;
    }
  });

  await relaunch();
}
```

> ⚠️ Sur Linux, l'updater fonctionne avec l'AppImage. Les paquets `.deb`/`.rpm` sont généralement mis à jour par le gestionnaire de paquets, pas par l'updater intégré.

### 5.5 Format de l'endpoint

`latest.json` :

```json
{
  "version": "0.2.0",
  "notes": "Ajout des tags et correction de l'import.",
  "pub_date": "2026-11-05T10:00:00Z",
  "platforms": {
    "linux-x86_64": {
      "signature": "…",
      "url": "https://releases.exemple.com/taurinote/Taurinote_0.2.0_amd64.AppImage.tar.gz"
    },
    "windows-x86_64": {
      "signature": "…",
      "url": "https://releases.exemple.com/taurinote/Taurinote_0.2.0_x64-setup.nsis.zip"
    },
    "darwin-x86_64": {
      "signature": "…",
      "url": "https://releases.exemple.com/taurinote/Taurinote_0.2.0_x64.app.tar.gz"
    },
    "darwin-aarch64": {
      "signature": "…",
      "url": "https://releases.exemple.com/taurinote/Taurinote_0.2.0_aarch64.app.tar.gz"
    }
  }
}
```

`tauri-action` (chapitre 13) génère ce fichier et les artefacts signés automatiquement.

### 5.6 Stratégie de version

- SemVer : `MAJOR.MINOR.PATCH`.
- L'updater compare la version de l'endpoint à celle de `tauri.conf.json`.
- Ne publiez jamais deux versions avec le même numéro.
- Une version ne peut pas être « rétrogradée » par l'updater standard.
- Testez le parcours complet avec une version `0.1.1` avant la première release publique.

### 5.7 Sécurité de l'updater

- HTTPS obligatoire.
- Signature minisign vérifiée avant installation.
- Endpoint contrôlé par vous.
- Pas de clé privée dans l'application.
- Journalisez les échecs, mais ne divulguez pas d'informations sensibles.

---

## 6. Stores et canaux de distribution

| Canal | Format | Contraintes |
|---|---|---|
| Site officiel | `.exe`, `.dmg`, `.AppImage`, `.deb` | Signature recommandée |
| GitHub Releases | tous | Gratuit, updater possible |
| Microsoft Store | MSIX/AppX | Packaging spécifique, sandbox |
| Mac App Store | `.pkg` | Sandbox obligatoire, updater maison interdit |
| Flathub | Flatpak | Sandbox, permissions déclaratives |
| Snap Store | Snap | Confinement, plugins parfois limités |
| AUR / dépôts | PKGBUILD, `.deb` | Maintenance communautaire |

### Contraintes des stores

- **Mac App Store** : sandbox obligatoire ; accès fichiers via dialogues ; l'updater intégré ne doit pas être utilisé ; certains plugins (shell, fs large) sont incompatibles.
- **Microsoft Store** : nécessite un compte développeur et un packaging MSIX ; les mises à jour passent par le Store.
- **Flathub** : les permissions sont déclarées dans le manifeste Flatpak ; les accès hors sandbox doivent être justifiés.

> 💡 Commencez par une distribution directe (site + GitHub Releases). Ajoutez les stores ensuite, en adaptant la configuration par plateforme.

---

## 7. Checklist de release

- [ ] Version mise à jour dans `tauri.conf.json` (et idéalement partout).
- [ ] `yarn test:run` et `cargo test` passent.
- [ ] `cargo clippy -- -D warnings` passe.
- [ ] `yarn build` sans erreur TypeScript.
- [ ] Build release testé sur chaque OS cible.
- [ ] Icônes à jour.
- [ ] CSP de production stricte.
- [ ] Capabilities minimales.
- [ ] DevTools désactivés.
- [ ] Signature configurée.
- [ ] Checksums publiés.
- [ ] `latest.json` et signatures d'updater générés.
- [ ] Notes de version rédigées.
- [ ] Test de mise à jour depuis la version précédente.
- [ ] Sauvegarde de la clé privée vérifiée.

---

## 8. Erreurs fréquentes

| Problème | Cause | Solution |
|---|---|---|
| SmartScreen bloque | Exe non signé | Signer avec un certificat |
| « App endommagée » sur macOS | Non notarisée | Signer + notariser |
| `codesign` échoue | Identité absente | Installer le certificat |
| DMG non ouvrable | Notarisation incomplète | `stapler validate` |
| AppImage ne démarre pas | Dépendance manquante | Tester sur une VM propre |
| Taille énorme | Assets non optimisés / debug | Build release, inspecter `dist/` |
| Updater : signature invalide | Clé privée différente | Régénérer et republier |
| Updater : 404 | Chemin d'endpoint | Vérifier l'URL et le JSON |
| Updater ne détecte rien | Version identique | Bumper la version |
| MSI échoue | WiX / permissions | Tester NSIS, vérifier les logs |

---

## À retenir

- `yarn tauri build` produit binaires et installateurs.
- `yarn tauri icon` génère toutes les icônes depuis un PNG 1024².
- La signature est indispensable sur Windows et macOS.
- La notarisation macOS nécessite un compte Apple Developer.
- L'updater repose sur une paire de clés minisign et un endpoint JSON.
- La clé privée ne doit jamais être dans le dépôt ni dans l'application.
- Linux : AppImage pour l'updater, paquets pour les dépôts.
- Testez les mises à jour depuis une version antérieure réelle.

---

## Exercices

1. **Icônes.** Générez un jeu d'icônes depuis un PNG et vérifiez les fichiers produits.
2. **Build.** Produisez un `.deb` et un `.AppImage`, puis installez le `.deb` sur une VM.
3. **Windows.** Configurez NSIS en `currentUser` avec français et anglais.
4. **Updater.** Générez une paire de clés, publiez `0.1.0`, puis testez la mise à jour vers `0.1.1` via un `latest.json` local servi en HTTPS.
5. **Signature.** Listez les secrets nécessaires pour signer et notariser sur macOS.
6. **Stores.** Quelles fonctionnalités de Taurinote poseraient problème sur le Mac App Store ? Pourquoi ?

Solutions : [annexe D](../annexes/d-solutions.md#chapitre-12).

---

[← Chapitre précédent](./11-tests-debogage.md) · [README](../README.md) · [Chapitre suivant : CI/CD et déploiement →](./13-cicd-deploiement.md)
