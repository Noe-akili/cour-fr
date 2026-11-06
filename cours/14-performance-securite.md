# 14 — Performance et sécurité avancée

> **Objectifs**
> - Mesurer avant d'optimiser (taille, démarrage, mémoire, rendu).
> - Réduire la taille du bundle frontend et Rust.
> - Accélérer le démarrage et les interactions.
> - Éviter les fuites mémoire côté WebView.
> - Appliquer une checklist de sécurité complète.
> - Construire un modèle de menace réaliste.
> - Auditer les dépendances et les permissions.

Sommaire : [← Chapitre précédent](./13-cicd-deploiement.md) · [README](../README.md) · [Chapitre suivant : projet final →](./15-projet-final.md)

---

## 1. Mesurer avant d'optimiser

| Métrique | Outil | Cible indicative |
|---|---|---|
| Taille de l'installateur | `ls -lh bundle/` | 3–15 Mo (hors WebView2 offline) |
| Taille du binaire | `ls -lh target/release/` | 5–20 Mo |
| Taille du front | `dist/` + visualizer | < 500 Ko gzip pour une app simple |
| Temps de démarrage | `Instant` dans `setup` + DevTools | < 1 s sur machine récente |
| Mémoire au repos | Gestionnaire de tâches | 80–250 Mo selon WebView |
| Temps d'interaction | DevTools Performance | < 100 ms pour une action courante |
| Taille de la base | fichier SQLite | selon données |

> 💡 La WebView elle-même consomme mémoire (souvent 60–150 Mo). Tauri réduit par rapport à Chromium embarqué, mais ne descend pas à zéro.

---

## 2. Réduire le bundle frontend

### 2.1 Analyser

```bash
yarn add -D rollup-plugin-visualizer
```

`vite.config.ts` :

```ts
import { visualizer } from "rollup-plugin-visualizer";

export default defineConfig({
  plugins: [
    vue(),
    visualizer({
      filename: "dist/stats.html",
      gzipSize: true,
      template: "treemap",
    }),
  ],
});
```

```bash
yarn build
# Ouvrir dist/stats.html
```

### 2.2 Les gros postes habituels

- Bibliothèques de composants complètes importées sans tree-shaking.
- Icônes : importer tout un pack au lieu des icônes utilisées.
- Dates : `moment` (lourd) → `date-fns` ciblé ou `Intl`.
- Utilitaires : `lodash` complet → imports ciblés.
- Éditeurs de texte, parseurs Markdown, charts : à charger en lazy.
- Polices : plusieurs graisses et jeux complets.

### 2.3 Bonnes pratiques

```ts
// ❌ Tout l'icône pack
import { icons } from "lucide-vue-next";

// ✅ Icône ciblée
import { Check, Trash2 } from "lucide-vue-next";
```

```ts
// ✅ Route lazy
const SettingsView = () => import("@/views/SettingsView.vue");
```

```ts
// ✅ Import ciblé
import debounce from "lodash/debounce";
```

### 2.4 Chunking

```ts
build: {
  rollupOptions: {
    output: {
      manualChunks: {
        vendor: ["vue", "vue-router", "pinia"],
      },
    },
  },
},
```

> ⚠️ Trop de chunks = trop de requêtes. Pour une app de bureau, 2–4 chunks suffisent.

### 2.5 Assets

- Images en WebP/AVIF, dimensions adaptées.
- Pas de vidéos lourdes dans le bundle : téléchargez-les à la demande.
- Compressez les SVG (SVGO).
- Évitez les polices complètes ; sous-ensemble si possible.

---

## 3. Réduire le binaire Rust

`src-tauri/Cargo.toml` :

```toml
[profile.release]
codegen-units = 1
lto = true
opt-level = "s"
panic = "abort"
strip = true
```

| Option | Effet | Compromis |
|---|---|---|
| `codegen-units = 1` | Meilleure optimisation | Compilation plus lente |
| `lto = true` | Link-time optimization | Compilation plus lente |
| `opt-level = "s"` | Optimise la taille | Légèrement moins rapide que `3` |
| `panic = "abort"` | Supprime le code d'unwinding | Pas de rattrapage de panic |
| `strip = true` | Supprime les symboles | Débogage plus difficile |

Pour une application gourmande en CPU, testez `opt-level = 3` : la taille augmente, les performances aussi.

> ⚠️ `panic = "abort"` peut compliquer le diagnostic de certains panics. Gardez `panic = "unwind"` si vous avez besoin de backtraces détaillées en production.

### 3.1 Dépendances

- Auditez les crates ajoutées (`cargo tree`).
- Évitez les features par défaut inutiles.
- Préférez les implémentations légères (ex. `serde_json` plutôt qu'un gros framework).

```bash
cd src-tauri
cargo tree -e features
cargo bloat --release --crates   # nécessite cargo-bloat
```

---

## 4. Accélérer le démarrage

### 4.1 Ce qui coûte cher

- Ouvrir la base et exécuter des migrations lourdes.
- Charger des plugins inutiles.
- Créer plusieurs fenêtres au démarrage.
- Faire des requêtes réseau bloquantes dans `setup`.
- Charger tout le store Pinia avant le premier rendu.

### 4.2 Stratégies

1. **Lazy loading** des vues et des fonctionnalités secondaires.
2. **Splashscreen** pendant l'initialisation (puis fermeture).
3. **Chargement différé** des plugins non critiques.
4. **Requêtes SQL** limitées et indexées au premier écran.
5. **Éviter les animations** coûteuses au premier rendu.
6. **Précharger** uniquement les données visibles.

```rust
.setup(|app| {
    let start = std::time::Instant::now();

    // Initialisation minimale

    println!("setup terminé en {:?}", start.elapsed());
    Ok(())
})
```

### 4.3 Splashscreen

```json
{
  "app": {
    "windows": [
      { "label": "main", "visible": false },
      {
        "label": "splashscreen",
        "url": "splashscreen.html",
        "width": 400,
        "height": 300,
        "decorations": false,
        "alwaysOnTop": true,
        "center": true
      }
    ]
  }
}
```

Côté Rust, une fois prêt :

```rust
if let Some(splash) = app.get_webview_window("splashscreen") {
    let _ = splash.close();
}
if let Some(main) = app.get_webview_window("main") {
    let _ = main.show();
}
```

> ⚠️ N'oubliez pas de fermer le splash en cas d'erreur, sinon l'utilisateur reste bloqué.

---

## 5. Mémoire et fuites

### 5.1 Fuites typiques

| Fuite | Cause | Correction |
|---|---|---|
| Listeners IPC | `listen` sans `unlisten` | `onUnmounted` |
| Timers | `setInterval` sans clear | `onUnmounted` |
| Observers | `ResizeObserver` non déconnecté | `disconnect()` |
| WebSocket | Non fermé | `close()` |
| Grandes structures | Références conservées | `null`, `shallowRef` |
| Routes | Composants non détruits | Vérifier `keep-alive` |

### 5.2 `shallowRef` pour les gros objets

Si un objet volumineux n'a pas besoin d'être profondément réactif :

```ts
import { shallowRef } from "vue";

const rawData = shallowRef<LargeDataset | null>(null);
```

Cela évite de proxyfier des milliers de propriétés.

### 5.3 Listes longues

- Pagination SQL (`LIMIT`/`OFFSET`).
- Virtual scrolling (`vue-virtual-scroller`, `@tanstack/vue-virtual`).
- Évitez de rendre 10 000 lignes dans le DOM.

```ts
const page = ref(0);
const pageSize = 50;
const rows = await db.select("SELECT * FROM todos LIMIT ? OFFSET ?", [
  pageSize,
  page.value * pageSize,
]);
```

### 5.4 Détecter

- DevTools → Performance → enregistrer une session.
- DevTools → Memory → snapshots avant/après navigation.
- Surveiller la mémoire dans le gestionnaire de tâches après 10 minutes d'utilisation.

---

## 6. Performance de rendu

- Évitez les re-rendus inutiles : `computed`, `v-memo`, composants découpés.
- Ne mettez pas d'objets recréés à chaque rendu dans les props.
- Limitez les animations `filter`, `blur`, `box-shadow` coûteuses.
- Utilisez `content-visibility: auto` pour de longues listes.
- Préférez `transform`/`opacity` pour les animations.
- Testez sur la WebView la plus lente de vos cibles (souvent Linux).

> ⚠️ Les performances de WebKitGTK peuvent différer fortement de Chromium. Un rendu fluide sur Windows peut saccader sur une distribution Linux ancienne.

---

## 7. Performance côté Rust

### 7.1 Commandes

- Commandes `async` pour les I/O.
- `spawn_blocking` pour le CPU lourd et les fichiers.
- Évitez de cloner de grandes structures : utilisez des références ou `Arc`.
- Ne tenez pas de verrou pendant un `await`.

### 7.2 Base de données

- Index sur les colonnes filtrées/triées.
- `EXPLAIN QUERY PLAN` pour vérifier les scans.

```sql
EXPLAIN QUERY PLAN
SELECT * FROM todos WHERE done = 0 AND priority = 'high' ORDER BY due_date;
```

- Pagination.
- Évitez `SELECT *` si vous n'avez pas besoin de toutes les colonnes.
- Regroupez les écritures en transactions.

### 7.3 Calcul parallèle

Pour du traitement intensif, `rayon` peut paralléliser :

```rust
use rayon::prelude::*;

let results: Vec<_> = items.par_iter().map(process).collect();
```

À utiliser avec discernement : la contention et les coûts de synchronisation peuvent annuler le gain.

---

## 8. Sécurité : modèle de menace

| Menace | Vecteur | Impact | Contre-mesure |
|---|---|---|---|
| XSS | Contenu utilisateur, `v-html`, dépendance | Exécution JS dans la WebView | CSP, échappement, pas de `v-html` non sanitizé |
| Abus IPC | JS malveillant | Appels natifs | Permissions minimales, validation Rust |
| Path traversal | Chemins importés | Lecture/écriture hors scope | Scopes fs, canonicalisation |
| Injection SQL | Concaténation | Fuite/corruption | Requêtes paramétrées |
| Dépendance compromise | npm/crates | Exécution de code | Lockfiles, audit, revue |
| Update compromis | Clé privée volée | Malware distribué | Secrets, rotation, signature |
| Contenu distant | Page non fiable | Accès API | Éviter, capabilities distantes restreintes |
| Attaquant local | Fichiers en clair | Lecture de données | Chiffrement si nécessaire |
| Élévation via shell | Commande générique | Exécution arbitraire | Allowlist, commandes dédiées |

### 8.1 Règle d'or

> Tout ce qui vient du frontend est **non fiable**, même si vous avez écrit le frontend. Une XSS peut appeler n'importe quelle commande autorisée.

---

## 9. Checklist de durcissement

### Configuration

- [ ] `"csp"` définie et stricte en production.
- [ ] `"devCsp"` absente ou limitée au développement.
- [ ] `"withGlobalTauri": false`.
- [ ] `freezePrototype: true`.
- [ ] DevTools désactivés en release.
- [ ] Aucune page distante chargée sans nécessité.
- [ ] `assetProtocol` restreint.

### Permissions

- [ ] Une capability par fenêtre.
- [ ] Pas de `"windows": ["*"]` sans raison.
- [ ] Permissions `default` remplacées par des permissions précises.
- [ ] Scopes fs limités.
- [ ] `shell` désactivé ou allowlisté.
- [ ] `AppManifest` limite les commandes.
- [ ] Les plugins inutilisés sont retirés.

### Code

- [ ] Aucune concaténation SQL.
- [ ] Chemins validés et canonicalisés.
- [ ] Entrées validées (taille, format, plage).
- [ ] Pas de `v-html` sur des données non fiables.
- [ ] Pas de `eval`, `new Function`, `innerHTML` dynamique.
- [ ] Secrets absents du frontend.
- [ ] Logs sans données personnelles.
- [ ] Gestion des erreurs sans fuite d'information.

### Chaîne de build

- [ ] `yarn.lock` et `Cargo.lock` committés.
- [ ] `yarn audit` / `cargo audit` sans vulnérabilité critique.
- [ ] Dépendances épinglées et revues.
- [ ] Signature de code (Windows/macOS).
- [ ] Updater signé, clé privée en secret.
- [ ] Artefacts et checksums publiés.
- [ ] CI sans secret exposé.

---

## 10. Validation des chemins

Exemple Rust robuste :

```rust
use std::path::{Path, PathBuf};

fn safe_join(base: &Path, user_name: &str) -> Result<PathBuf, String> {
    // 1. Refuser les composants dangereux
    let candidate = Path::new(user_name);
    if candidate.is_absolute()
        || candidate.components().any(|c| matches!(c, std::path::Component::ParentDir))
    {
        return Err("Nom de fichier invalide.".into());
    }

    // 2. Construire et canonicaliser
    let path = base.join(candidate);
    let canonical_base = base.canonicalize().map_err(|e| e.to_string())?;
    let canonical_path = path.canonicalize().map_err(|e| e.to_string())?;

    // 3. Vérifier que le résultat est bien sous la base
    if !canonical_path.starts_with(&canonical_base) {
        return Err("Chemin hors du répertoire autorisé.".into());
    }

    Ok(canonical_path)
}
```

> ⚠️ La canonicalisation résout les liens symboliques. Combinez toujours validation logique **et** scope Tauri.

---

## 11. XSS et `v-html`

```vue
<!-- ❌ Dangereux si `content` vient de l'utilisateur ou d'un import -->
<div v-html="content" />

<!-- ✅ Texte échappé -->
<div>{{ content }}</div>
```

Si vous devez rendre du HTML (Markdown), utilisez un sanitizer robuste :

```bash
yarn add dompurify
```

```ts
import DOMPurify from "dompurify";
const safe = DOMPurify.sanitize(markdownHtml, { USE_PROFILES: { html: true } });
```

Et gardez une CSP stricte comme défense en profondeur.

---

## 12. Dépendances et supply chain

```bash
# Frontend
yarn audit
yarn outdated

# Rust
cd src-tauri
cargo audit
cargo outdated
cargo deny check
```

`cargo-deny` vérifie licences, vulnérabilités, sources et doublons :

```toml
# deny.toml
[advisories]
vulnerability = "deny"
unmaintained = "warn"

[licenses]
allow = ["MIT", "Apache-2.0", "BSD-3-Clause", "ISC"]
```

> 💡 Auditez aussi les plugins Tauri : un plugin ajoute du code natif avec accès au système.

---

## 13. Sécurité de l'updater

- HTTPS uniquement.
- Signature minisign vérifiée par le client.
- Clé privée dans un coffre de secrets, jamais dans le dépôt.
- Rotation documentée.
- Endpoint surveillé (disponibilité, intégrité).
- Journalisation des échecs côté client, sans données sensibles.

En cas de compromission :

1. Révoquer la clé compromise.
2. Publier une version signée avec la nouvelle clé (en utilisant l'ancienne si elle est encore sûre).
3. Communiquer clairement aux utilisateurs.
4. Auditer les logs de téléchargement.

---

## 14. Sécurité mobile (si vous ciblez iOS/Android)

- Permissions OS déclarées dans les manifestes (caméra, stockage, notifications).
- Deep links validés.
- Stockage sécurisé (Keychain/Keystore) pour les secrets.
- Ne supposez pas que le code natif est inaccessible : le binaire peut être analysé.
- Testez les scénarios de perte/vol d'appareil.

---

## 15. Exercices

1. **Audit de taille.** Analysez `dist/` avec le visualizer et supprimez une dépendance inutile.
2. **Démarrage.** Mesurez le temps de `setup`, puis différez le chargement d'un plugin non critique.
3. **Fuite.** Créez un composant qui écoute un événement sans cleanup, observez la fuite, corrigez.
4. **SQL.** Ajoutez un index et comparez `EXPLAIN QUERY PLAN` avant/après.
5. **Sécurité.** Écrivez une commande Rust qui lit un fichier sous `$APPDATA/exports`, avec validation anti-traversée.
6. **CSP.** Proposez une CSP pour une app qui utilise Google Fonts et une API `https://api.exemple.com`.
7. **Menaces.** Pour Taurinote, listez les trois menaces les plus probables et vos contre-mesures.

Solutions : [annexe D](../annexes/d-solutions.md#chapitre-14).

---

## À retenir

- Mesurez taille, démarrage, mémoire et rendu avant d'optimiser.
- Le frontend est souvent le premier levier de taille ; le profil Rust le second.
- Lazy loading, imports ciblés et virtualisation résolvent la majorité des problèmes.
- La WebView système impose de tester sur chaque OS.
- Toute entrée frontend est non fiable : validez dans Rust.
- CSP + capabilities minimales + scopes étroits = défense en profondeur.
- Les dépendances et la clé d'updater font partie de la surface d'attaque.
- Documentez la rotation de clé et la réponse à incident.

---

[← Chapitre précédent](./13-cicd-deploiement.md) · [README](../README.md) · [Chapitre suivant : projet final →](./15-projet-final.md)
