# 07 — Permissions, capabilities et CSP

> **Objectifs**
> - Comprendre le modèle de sécurité de Tauri 2.
> - Écrire des capabilities précises, par fenêtre et par plateforme.
> - Maîtriser les scopes (fichiers, URLs) et le principe du moindre privilège.
> - Configurer une CSP adaptée à Vue/Vite.
> - Restreindre les commandes personnalisées.
> - Auditer les permissions d'un projet.

Sommaire : [← Chapitre précédent](./06-evenements-canaux.md) · [README](../README.md) · [Chapitre suivant →](./08-plugins-api.md)

---

## 1. Le modèle de sécurité

Tauri part d'un principe simple : **la WebView est une zone non fiable**. Même si vous contrôlez votre code, une faille XSS, une dépendance compromise ou une injection peuvent exécuter du JavaScript arbitraire.

Trois couches limitent les dégâts :

| Couche | Question | Mécanisme |
|---|---|---|
| **Permission** | Cette commande est-elle autorisée ? | `allow-*` / `deny-*` |
| **Scope** | Sur quelles ressources ? | listes de chemins, URLs, domaines |
| **Capability** | Pour quelle fenêtre / plateforme ? | fichier JSON dans `capabilities/` |

Sans capability, un plugin refuse l'appel avec une erreur du type :

```
fs.read_text_file not allowed. Permissions associated with this command: fs:allow-read-text-file
```

---

## 2. Permissions

Une permission est identifiée par :

```
<plugin>:<action>
```

Exemples :

| Permission | Effet |
|---|---|
| `core:default` | Permissions de base du cœur |
| `core:window:allow-set-title` | Autorise `window.setTitle` |
| `dialog:default` | `open`, `save`, `message` |
| `fs:allow-read-text-file` | Autorise la lecture de texte |
| `fs:allow-write-text-file` | Autorise l'écriture de texte |
| `sql:default` | `load`, `select`, `close` |
| `sql:allow-execute` | Autorise les écritures SQL |
| `notification:default` | Notifications |
| `store:default` | Toutes les opérations du store |
| `updater:default` | Vérification et installation de mises à jour |

### 2.1 Permission simple vs permission avec scope

```json
{
  "permissions": [
    "fs:default",
    "fs:allow-read-text-file"
  ]
}
```

Ici, la permission autorise la **commande**, mais **aucun chemin** n'est autorisé. Résultat : `forbidden path`.

Une permission avec scope :

```json
{
  "permissions": [
    "fs:default",
    {
      "identifier": "fs:allow-read-text-file",
      "allow": [{ "path": "$APPDATA/**" }],
      "deny": [{ "path": "$APPDATA/secrets/**" }]
    }
  ]
}
```

> ⚠️ **Permission ≠ accès.** C'est la confusion la plus fréquente. `fs:default` ouvre les commandes et un scope restreint aux répertoires applicatifs, mais pas à tout le disque.

---

## 3. Capabilities

### 3.1 Fichier de base

`src-tauri/capabilities/default.json` :

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "Capacités de la fenêtre principale",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "opener:default",
    "dialog:default",
    "fs:default",
    "notification:default",
    "store:default",
    "sql:default",
    "sql:allow-execute"
  ]
}
```

### 3.2 Champs

| Champ | Rôle |
|---|---|
| `identifier` | Identifiant unique de la capability |
| `description` | Documentation lisible |
| `windows` | Labels des fenêtres ciblées (`["*"]` pour toutes) |
| `webviews` | Labels de webviews (mobile/multi-webview) |
| `permissions` | Liste des permissions |
| `platforms` | `linux`, `macOS`, `windows`, `iOS`, `android` |
| `remote` | Autorise des URLs distantes à utiliser l'API |

### 3.3 Une capability par fenêtre

`src-tauri/capabilities/main.json` :

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "main-window",
  "description": "Fenêtre principale : tâches, import/export",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "dialog:default",
    "fs:default",
    "notification:default",
    "sql:default",
    "sql:allow-execute"
  ]
}
```

`src-tauri/capabilities/settings.json` :

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "settings-window",
  "description": "Fenêtre de paramètres : store et thème uniquement",
  "windows": ["settings"],
  "permissions": [
    "core:default",
    "store:default"
  ]
}
```

La fenêtre de paramètres ne peut pas lire le disque ni exécuter de SQL : même si un attaquant y injecte du JS, la surface d'attaque est réduite.

> ⚠️ Une fenêtre présente dans **plusieurs** capabilities cumule leurs permissions. Vérifiez toujours les recoupements.

### 3.4 Capabilities par plateforme

```json
{
  "identifier": "desktop-only",
  "windows": ["main"],
  "platforms": ["linux", "macOS", "windows"],
  "permissions": ["global-shortcut:allow-register", "updater:default"]
}
```

```json
{
  "identifier": "mobile-only",
  "windows": ["main"],
  "platforms": ["iOS", "android"],
  "permissions": ["notification:default", "haptics:allow-vibrate"]
}
```

Cela évite d'activer des plugins desktop sur mobile, où ils n'existent pas.

### 3.5 Activer explicitement un sous-ensemble

Par défaut, **toutes** les capabilities du dossier sont actives. Pour n'en garder qu'une partie :

```json
{
  "app": {
    "security": {
      "capabilities": ["main-window", "settings-window"]
    }
  }
}
```

Utile pour exclure une capability de debug d'un build de production.

### 3.6 Capabilities distantes

Par défaut, l'API n'est accessible qu'au code embarqué. Si vous chargez une page distante (à éviter), vous devez l'autoriser explicitement :

```json
{
  "identifier": "remote-docs",
  "windows": ["docs"],
  "remote": {
    "urls": ["https://docs.mon-app.com/*"]
  },
  "permissions": ["core:default"]
}
```

> 🔒 N'activez des permissions que pour des domaines que vous contrôlez. Une page distante compromise hérite des permissions accordées.

---

## 4. Scopes : le cœur du moindre privilège

### 4.1 Variables de chemin

| Variable | Répertoire |
|---|---|
| `$APPDATA` | Données applicatives (roaming sur Windows) |
| `$APPCONFIG` | Configuration applicative |
| `$APPLOCALDATA` | Données locales (non roaming) |
| `$APPCACHE` | Cache |
| `$APPLOG` | Logs |
| `$HOME` | Dossier personnel |
| `$DOCUMENT` | Documents |
| `$DOWNLOAD` | Téléchargements |
| `$DESKTOP` | Bureau |
| `$PICTURE` | Images |
| `$VIDEO` | Vidéos |
| `$AUDIO` | Musique |
| `$TEMP` | Répertoire temporaire |
| `$RESOURCE` | Ressources embarquées |
| `$PUBLIC` | Dossier public |

Les motifs glob sont supportés :

- `$APPDATA/*` : fichiers et dossiers de premier niveau.
- `$APPDATA/**` : récursif.
- `$HOME/**/*.json` : tous les JSON sous le dossier personnel.

### 4.2 Exemple minimal pour Taurinote

```json
{
  "permissions": [
    "sql:default",
    "sql:allow-execute",
    "dialog:default",
    "fs:default",
    {
      "identifier": "fs:allow-write-text-file",
      "allow": [
        { "path": "$APPDATA/exports/**" },
        { "path": "$DOWNLOAD/taurinote-*.json" }
      ]
    }
  ]
}
```

Les fichiers choisis via les dialogues `open`/`save` sont ajoutés **automatiquement** au scope fs et au scope asset pour la session courante. Vous n'avez donc pas besoin d'autoriser tout `$HOME`.

> 💡 Pour conserver ces autorisations après redémarrage, utilisez `tauri-plugin-persisted-scope`. Sans lui, l'utilisateur devra re-sélectionner le fichier après un redémarrage.

### 4.3 Scope du protocole `asset`

Pour afficher un fichier local dans une balise `<img>` :

```json
{
  "app": {
    "security": {
      "assetProtocol": {
        "enable": true,
        "scope": ["$APPDATA/**", "$RESOURCE/**"]
      }
    }
  }
}
```

```ts
import { convertFileSrc } from "@tauri-apps/api/core";

const src = convertFileSrc("/chemin/absolu/image.png");
// <img :src="src" />
```

> 🔒 N'activez pas `assetProtocol` sur `$HOME/**` : cela reviendrait à exposer tout le dossier personnel à la WebView.

---

## 5. CSP (Content Security Policy)

### 5.1 Pourquoi

La CSP limite les sources de scripts, styles, images et connexions. Elle réduit l'impact d'une XSS : même si un script malveillant est injecté, il ne peut pas charger de code distant ni envoyer de données à un domaine inconnu.

Tauri ajoute automatiquement les hashes/nonces des scripts et styles embarqués. Vous ne déclarez que ce qui est spécifique à votre application.

### 5.2 Configuration recommandée

`tauri.conf.json` :

```json
{
  "app": {
    "security": {
      "csp": {
        "default-src": "'self'",
        "script-src": "'self'",
        "style-src": "'self' 'unsafe-inline'",
        "img-src": "'self' asset: http://asset.localhost data: blob:",
        "font-src": "'self' data:",
        "connect-src": "ipc: http://ipc.localhost",
        "object-src": "'none'",
        "base-uri": "'self'",
        "frame-ancestors": "'none'"
      }
    }
  }
}
```

- `ipc:` et `http://ipc.localhost` sont nécessaires au pont Tauri.
- `'unsafe-inline'` pour les styles est souvent requis par Vue (styles dynamiques, transitions). Évitez-le pour les scripts.
- `asset:` et `http://asset.localhost` ne sont utiles que si vous activez le protocole asset.
- `object-src 'none'`, `base-uri 'self'`, `frame-ancestors 'none'` ferment des vecteurs classiques.

### 5.3 Développement

Vite utilise un WebSocket pour le HMR. Si la CSP casse le rechargement à chaud, définissez une CSP de développement :

```json
{
  "app": {
    "security": {
      "csp": "…",
      "devCsp": "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; connect-src 'self' ipc: http://ipc.localhost ws://localhost:1420 http://localhost:1420"
    }
  }
}
```

> ⚠️ `devCsp` ne s'applique qu'en développement. Ne relâchez jamais la CSP de production pour faire fonctionner un outil de dev.

### 5.4 Vérifier la CSP

En production, ouvrez les DevTools (si activés) ou inspectez les en-têtes. La console signale les violations :

```
Refused to load the script 'https://cdn.example.com/lib.js'
because it violates the following Content Security Policy directive…
```

Testez aussi avec des contenus distants bloqués pour vérifier qu'aucune dépendance cachée n'est requise.

### 5.5 Autres options de sécurité

| Option | Effet |
|---|---|
| `freezePrototype: true` | Gèle les prototypes JS (limite le prototype pollution) |
| `pattern: "isolation"` | Isole le code de l'application dans une iframe, avec un pont contrôlé |
| `dangerousDisableAssetCspModification` | Désactive la réécriture CSP de Tauri — **à ne pas utiliser** sans raison forte |
| `withGlobalTauri: false` | N'expose pas `window.__TAURI__` (défaut) |

`isolation` a un coût de performance et de complexité ; réservez-le aux applications traitant du contenu très non fiable (éditeurs, navigateurs intégrés).

---

## 6. Restreindre les commandes personnalisées

Par défaut, toutes les commandes enregistrées dans `generate_handler!` sont accessibles à toutes les fenêtres. Pour n'en autoriser qu'une liste :

`src-tauri/build.rs` :

```rust
fn main() {
    tauri_build::try_build(
        tauri_build::Attributes::new().app_manifest(
            tauri_build::AppManifest::new().commands(&[
                "list_todos",
                "create_todo",
                "toggle_todo",
                "delete_todo",
                "app_info",
            ]),
        ),
    )
    .expect("failed to run tauri-build");
}
```

Toute commande non listée sera bloquée par le runtime. C'est une protection supplémentaire contre l'exposition accidentelle d'une commande de debug.

> 💡 Après modification, nettoyez `src-tauri/target/` si le changement ne semble pas pris en compte.

---

## 7. Auditer son projet

Checklist avant publication :

- [ ] Chaque capability cible uniquement les fenêtres nécessaires.
- [ ] Les permissions `default` des plugins sont remplacées par des permissions précises quand c'est possible.
- [ ] Les scopes fs sont limités à des répertoires dédiés.
- [ ] `assetProtocol` est restreint.
- [ ] La CSP de production est définie et testée.
- [ ] `devCsp` n'est pas utilisée en production.
- [ ] Les commandes personnalisées sont listées dans `AppManifest` si vous utilisez cette restriction.
- [ ] Aucune permission `shell` ou `process` inutile.
- [ ] Aucun secret dans le frontend.
- [ ] Les dépendances sont à jour (`yarn audit`, `cargo audit`).

### Exemple d'audit rapide

```bash
# Permissions déclarées
cat src-tauri/capabilities/*.json

# Dépendances JS vulnérables
yarn audit

# Dépendances Rust vulnérables
cargo install cargo-audit   # une fois
cd src-tauri && cargo audit

# Configuration effective
yarn tauri info
```

> ⚠️ `yarn audit` sur Yarn 1 peut être bruyant. Traitez en priorité les vulnérabilités `high` et `critical` des dépendances réellement embarquées.

---

## 8. Erreurs courantes

| Erreur | Cause | Solution |
|---|---|---|
| `not allowed. Permissions associated…` | Permission absente | Ajouter l'identifiant exact |
| `forbidden path` | Permission sans scope, ou chemin hors scope | Ajouter un `allow` avec le bon motif |
| `scope not found` | Variable inconnue | Vérifier `$APPDATA`, `$HOME`… |
| `window label not found` | Capability cible un label inexistant | Vérifier `label` dans la config |
| CSP bloque le HMR | `connect-src` sans WebSocket | `devCsp` avec `ws://localhost:1420` |
| `asset protocol not enabled` | Option désactivée | Activer `assetProtocol.enable` |
| Page blanche après CSP | Script inline bloqué | Supprimer l'inline ou utiliser `devCsp` |
| Permission OK mais écriture échoue | Fichier hors scope | Passer par un dialogue ou élargir le scope |

---

## À retenir

- Permission = autorisation d'une commande ; scope = ressources accessibles.
- Capability = attribution des permissions à des fenêtres/plateformes.
- Le code frontend est non fiable : validez toujours côté Rust.
- Les dialogues ajoutent automatiquement les fichiers choisis au scope de la session.
- Une CSP stricte est indispensable en production ; `devCsp` sert au HMR.
- Une capability par fenêtre réduit la surface d'attaque.
- `AppManifest` permet de restreindre les commandes personnalisées.
- Auditez permissions, scopes et dépendances avant chaque release.

---

## Exercices

1. **Moindre privilège.** Créez deux capabilities : `main` (sql, dialog, fs limité à `$APPDATA/exports`) et `settings` (store uniquement). Vérifiez qu'un appel `sql` depuis `settings` échoue.
2. **Scope.** Autorisez l'écriture uniquement dans `$DOWNLOAD/taurinote/**`. Que se passe-t-il si l'utilisateur choisit un fichier ailleurs via `save()` ?
3. **CSP.** Ajoutez `https://fonts.googleapis.com` pour les styles et `https://fonts.gstatic.com` pour les polices. Écrivez la CSP correspondante.
4. **Asset.** Affichez une image stockée dans `$APPDATA`. Listez les trois modifications nécessaires (config, permission, code).
5. **Audit.** Inspectez les capabilities d'un projet généré par `create-tauri-app` et proposez au moins deux réductions de privilèges.
6. **Commandes.** Listez trois commandes de votre projet dans `AppManifest` et vérifiez qu'une commande non listée est refusée.

Solutions : [annexe D](../annexes/d-solutions.md#chapitre-07).

---

[← Chapitre précédent](./06-evenements-canaux.md) · [README](../README.md) · [Chapitre suivant : plugins et API natives →](./08-plugins-api.md)
