# 00 — Introduction : comprendre Tauri

> **Objectifs**
> - Expliquer ce qu'est Tauri et comment il fonctionne.
> - Distinguer le rôle du frontend (Vue) et du backend (Rust).
> - Comparer Tauri à Electron sans caricature.
> - Identifier les forces, les limites et les cas d'usage adaptés.
> - Situer le projet fil rouge du cours.

Sommaire : [README](../README.md) · [Chapitre suivant →](./01-installation.md)

---

## 1. Qu'est-ce que Tauri ?

Tauri est un **framework de création d'applications de bureau** (et mobiles depuis Tauri 2). Il combine :

- une **interface web** (HTML, CSS, JavaScript/TypeScript, ici Vue 3) affichée dans la WebView du système ;
- un **cœur natif en Rust** qui gère la fenêtre, le système de fichiers, les notifications, la base de données, les mises à jour, etc. ;
- un **pont IPC** (Inter-Process Communication) qui relie les deux mondes.

Autrement dit : vous écrivez l'interface comme un site web, mais vous obtenez un exécutable natif, sans navigateur embarqué ni serveur Node en production.

```
┌─────────────────────────────────────────────────────────────┐
│                      Application Tauri                       │
│                                                             │
│  ┌───────────────────────┐        ┌──────────────────────┐  │
│  │   WebView système     │  IPC   │   Cœur Rust (Tauri)  │  │
│  │                       │◀──────▶│                      │  │
│  │  Vue 3 + Vite         │ JSON   │  commandes, état,    │  │
│  │  (HTML/CSS/TS)        │        │  plugins, OS, SQL…   │  │
│  └───────────────────────┘        └──────────────────────┘  │
│             │                                │               │
│             ▼                                ▼               │
│      WebView du système              API natives de l'OS     │
│   (WebView2 / WKWebView /            (fichiers, fenêtres,    │
│         WebKitGTK)                    tray, notifications…)   │
└─────────────────────────────────────────────────────────────┘
```

> 🧭 **Explication.** Ce schéma résume l'architecture en deux mondes reliés par l'IPC : la WebView affiche l'interface Vue, tandis que le cœur Rust accède aux API natives. La flèche centrale indique que les échanges passent par des messages JSON, et non par un serveur HTTP. Retenez que le frontend ne touche jamais directement le système : tout accès passe par une commande, un événement ou un plugin autorisé.

### Ce que Tauri n'est pas

- **Pas un serveur web déguisé.** En production, les fichiers frontend sont embarqués dans le binaire et servis via un protocole interne (`tauri://localhost`, `http://tauri.localhost` selon l'OS).
- **Pas Node.js dans l'application finale.** Node sert uniquement à l'outillage (Vite, Yarn, CLI). Le runtime natif est Rust.
- **Pas un framework UI.** Tauri ne remplace ni Vue, ni React, ni Svelte. Il fournit la couche « application de bureau ».
- **Pas une solution magique multi-plateforme.** Les WebView diffèrent : il faut tester sur chaque OS cible.

---

## 2. Architecture en trois couches

### 2.1 Le frontend (Vue 3)

Il vit dans `src/`. C'est une application web classique, construite par Vite :

- composants `.vue`, router, stores Pinia, appels HTTP ;
- aucun accès direct au système (sauf via les API Tauri) ;
- en développement, servie par `http://localhost:1420` ;
- en production, compilée dans `dist/` puis embarquée dans le binaire.

### 2.2 Le backend (Rust)

Il vit dans `src-tauri/`. C'est un programme Rust qui :

- crée et gère les fenêtres ;
- expose des **commandes** appelables depuis Vue (`#[tauri::command]`) ;
- émet des **événements** vers le frontend ;
- initialise les **plugins** (SQL, dialog, fs, notification, updater…) ;
- applique les **permissions** et les **scopes** de sécurité.

### 2.3 L'IPC

Le pont entre les deux est asynchrone et sérialisé en JSON (ou via un format binaire pour les gros volumes). Trois mécanismes principaux :

| Mécanisme | Sens | Usage typique |
|---|---|---|
| **Commande** (`invoke`) | Vue → Rust | Demander une action, récupérer des données |
| **Événement** (`emit` / `listen`) | Rust → Vue (ou Vue → Vue) | Notifier un changement, diffuser un signal |
| **Canal** (`Channel`) | Rust → Vue | Streamer une progression (téléchargement, import) |

Nous les détaillons aux chapitres 05 et 06.

---

## 3. Tauri vs Electron

Les deux permettent de faire des applications de bureau avec des technologies web. La différence fondamentale : **Electron embarque Chromium et Node.js**, **Tauri utilise la WebView et le runtime du système**.

| Critère | Tauri 2 | Electron |
|---|---|---|
| Taille d'un binaire simple | ~3–10 Mo | ~80–150 Mo |
| Mémoire au repos | Souvent 2 à 4 fois moins | Chromium complet en mémoire |
| Moteur de rendu | WebView de l'OS | Chromium embarqué, identique partout |
| Langage natif | Rust | Node.js / C++ |
| Sécurité par défaut | Permissions + scopes + CSP | Contexte Node complet, à verrouiller manuellement |
| Support mobile | iOS et Android | Non |
| Écosystème | Plus jeune, en forte croissance | Très mature |
| Cohérence du rendu | Dépend de l'OS | Excellente |
| Dépendance système | WebView2 (Windows), WebKitGTK (Linux) | Aucune (tout est embarqué) |

### Faut-il choisir Tauri ?

**Tauri est un bon choix si :**

- vous voulez des binaires légers et une faible empreinte mémoire ;
- vous acceptez de tester sur chaque OS ;
- vous avez besoin d'accès natifs profonds (fichiers, SQLite, tray, notifications) ;
- la sécurité et le principe du moindre privilège comptent ;
- vous visez aussi le mobile à terme.

**Electron reste pertinent si :**

- vous devez garantir un rendu strictement identique partout ;
- votre équipe est 100 % JavaScript et ne veut pas de Rust ;
- vous dépendez de bibliothèques Node natives non portables ;
- vous avez besoin d'un écosystème mature et de nombreuses embauches.

> **À retenir :** Tauri n'est pas « Electron en mieux » dans l'absolu. C'est un compromis différent : moins de ressources, plus de contraintes système.

---

## 4. La WebView : promesses et réalités

Tauri s'appuie sur la WebView fournie par l'OS :

| OS | Moteur | Version |
|---|---|---|
| Windows | WebView2 (Chromium Edge) | Mise à jour automatique |
| macOS | WKWebView (Safari/WebKit) | Liée à l'OS |
| Linux | WebKitGTK | Liée à la distribution |

### Conséquences pratiques

1. **Testez sur chaque plateforme cible.** Une API CSS ou JavaScript récente peut manquer sur une WebKitGTK ancienne.
2. **La version de la WebView n'est pas toujours la dernière.** Sur macOS, elle suit la version de l'OS ; sur Linux, la distribution.
3. **Les performances de rendu varient.** Les animations lourdes et les milliers de nœuds DOM coûtent plus cher sur certaines WebView.
4. **Le débogage diffère.** DevTools intégrés en développement, parfois absents en production.
5. **Le comportement des polices et du scroll** peut varier légèrement.

Bonne nouvelle : Vue 3 et les API modernes (ES2020+) sont largement supportés. Évitez simplement les fonctionnalités expérimentales non polyfillées.

---

## 5. Ce que Tauri apporte « out of the box »

Le cœur (`@tauri-apps/api`) fournit :

- **Fenêtres** : création, taille, position, plein écran, always-on-top, multi-fenêtres.
- **Événements** : bus global, événements ciblés par fenêtre.
- **Chemins** : répertoires standards (`appData`, `download`, `document`…).
- **Menu** : menus applicatifs et contextuels.
- **Tray** : icône de barre d'état avec menu.
- **Webview** : navigation, zoom, eval JS.
- **App** : version, nom, redémarrage.
- **IPC** : commandes, canaux, mocks de test.

Et via des **plugins officiels** :

| Domaine | Plugin |
|---|---|
| Boîtes de dialogue | `dialog` |
| Fichiers | `fs` |
| Base de données | `sql` |
| Stockage clé/valeur | `store` |
| Notifications | `notification` |
| Ouverture de liens/fichiers | `opener` |
| HTTP | `http` |
| Processus / sidecars | `shell` |
| Raccourcis globaux | `global-shortcut` |
| Mises à jour | `updater` |
| État de fenêtre | `window-state` |
| Instance unique | `single-instance` |
| Logs | `log` |
| Coffre-fort de secrets | `stronghold` |
| Presse-papiers | `clipboard-manager` |

Le chapitre 08 en couvre les plus utiles. Le catalogue complet est sur [v2.tauri.app/plugin](https://v2.tauri.app/plugin/).

---

## 6. Le projet fil rouge : Taurinote

Tout au long du cours, nous construisons **Taurinote**, une application de gestion de tâches « local-first ». Elle est volontairement simple fonctionnellement, mais utilise les mécanismes essentiels de Tauri :

```
┌──────────────────────────────────────────────────────────┐
│ Fenêtre principale                                       │
│  ┌────────────┐  ┌────────────────────────────────────┐  │
│  │ Sidebar    │  │ Liste des tâches                   │  │
│  │ Filtres    │  │  - titre, priorité, échéance, tags │  │
│  │ Tags       │  │  - recherche, tri                  │  │
│  └────────────┘  └────────────────────────────────────┘  │
│  Import / Export JSON · Notifications · Paramètres       │
└──────────────────────────────────────────────────────────┘
           │ SQLite (plugin-sql)      │ Tray + menu natif
           ▼                          ▼
     taurinote.db               Icône système
```

> 🧭 **Explication.** Cette maquette présente l'écran principal de Taurinote : une barre latérale pour les filtres et les tags, une liste de tâches au centre, puis des actions transverses (import/export, notifications, paramètres). Les deux flèches du bas rappellent les dépendances natives : SQLite pour la persistance et le tray pour l'icône système. Elle sert de fil conducteur : chaque chapitre ajoute une brique à cet écran sans changer l'architecture d'ensemble.

### Fonctionnalités

- Créer, modifier, supprimer, terminer une tâche.
- Priorités (`low`, `normal`, `high`), échéance, tags.
- Recherche plein texte et filtres.
- Persistance SQLite avec migrations.
- Export / import JSON via les dialogues natifs.
- Notification de rappel.
- Fenêtre de paramètres (thème).
- Tray avec « Afficher » et « Quitter ».
- Build signé, updater et CI GitHub Actions.

### Ce que le projet n'inclut pas (volontairement)

- Synchronisation cloud et comptes utilisateurs.
- Collaboration temps réel.
- Application mobile complète (le cours signale les adaptations).
- Design system avancé (le CSS reste simple et lisible).

---

## 7. Le modèle mental à retenir

Quand vous développez avec Tauri, posez-vous systématiquement trois questions :

1. **Cette action peut-elle se faire côté web ?**
   Calculs d'affichage, état de l'UI, routage, formulaires → Vue.
2. **Cette action touche-t-elle le système ou doit-elle être sécurisée ?**
   Fichiers, base de données, réseau privilégié, processus → Rust ou plugin.
3. **Quelle permission minimale est nécessaire ?**
   Chaque accès natif doit être déclaré dans une capability, avec le scope le plus étroit possible.

Cette discipline évite les applications qui donnent au frontend un accès total au disque « parce que c'était plus simple ».

---

## 8. Ce qu'il faut installer avant de continuer

Rust, Node.js, Yarn et les dépendances système de votre OS. Le chapitre suivant détaille chaque plateforme, avec les commandes exactes et les pièges connus.

---

## À retenir

- Tauri = WebView système + cœur Rust + pont IPC.
- Le frontend est une application web classique ; le backend est natif.
- Pas de Chromium ni de Node embarqués : binaires légers, mais rendu dépendant de l'OS.
- Trois mécanismes IPC : commandes, événements, canaux.
- La sécurité repose sur des permissions et des scopes explicites.
- Le cours construit Taurinote, une application local-first complète.

---

## Exercices

1. **Cartographie.** Pour chaque fonctionnalité, indiquez si elle relève de Vue, de Rust, ou des deux : (a) filtrer une liste de tâches, (b) lire un fichier choisi par l'utilisateur, (c) afficher une notification système, (d) valider un formulaire, (e) stocker des tâches dans SQLite, (f) changer le thème.
2. **Comparaison.** Citez deux cas où Electron serait un meilleur choix que Tauri, et deux cas inverse.
3. **WebView.** Expliquez pourquoi une application Tauri peut s'afficher différemment sur Ubuntu 22.04 et sur macOS 15.
4. **Sécurité.** Un développeur propose d'exposer une commande Rust `read_any_file(path)` au frontend. Quels risques et quelle alternative ?

Les solutions sont en [annexe D](../annexes/d-solutions.md#chapitre-00).

---

[README](../README.md) · [Chapitre suivant : installer l'environnement →](./01-installation.md)
