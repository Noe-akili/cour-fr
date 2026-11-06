import readme from "../README.md?raw";

const chapterModules = import.meta.glob("../cours/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
});

const annexModules = import.meta.glob("../annexes/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
});

/** Libellés courts utilisés dans la barre latérale. */
const SHORT_TITLES = {
  "00-introduction": "Introduction",
  "01-installation": "Installer l'environnement",
  "02-premier-projet": "Premier projet",
  "03-anatomie-projet": "Anatomie du projet",
  "04-vue-fondamentaux": "Vue 3 pour Tauri",
  "05-commandes-rust": "Commandes Rust",
  "06-evenements-canaux": "Événements & canaux",
  "07-permissions-capabilities": "Permissions & CSP",
  "08-plugins-api": "Plugins & API natives",
  "09-stockage-sqlite": "Stockage & SQLite",
  "10-fenetres-menus-tray": "Fenêtres, menus & tray",
  "11-tests-debogage": "Tests & débogage",
  "12-build-distribution": "Build & distribution",
  "13-cicd-deploiement": "CI/CD & mises à jour",
  "14-performance-securite": "Performance & sécurité",
  "15-projet-final": "Projet final : Taurinote",
  "a-cheatsheet": "Aide-mémoire",
  "b-depannage": "Dépannage",
  "c-glossaire": "Glossaire",
  "d-solutions": "Solutions des exercices",
  "e-ressources": "Ressources",
  "f-rust-pour-tauri": "Rust pour Tauri",
};

const GROUPS = [
  {
    id: "start",
    label: "Démarrer",
    slugs: ["00-introduction", "01-installation", "02-premier-projet", "03-anatomie-projet"],
  },
  {
    id: "foundations",
    label: "Fondations",
    slugs: [
      "04-vue-fondamentaux",
      "05-commandes-rust",
      "06-evenements-canaux",
      "07-permissions-capabilities",
    ],
  },
  {
    id: "ecosystem",
    label: "Écosystème",
    slugs: ["08-plugins-api", "09-stockage-sqlite", "10-fenetres-menus-tray"],
  },
  {
    id: "production",
    label: "Qualité & production",
    slugs: [
      "11-tests-debogage",
      "12-build-distribution",
      "13-cicd-deploiement",
      "14-performance-securite",
    ],
  },
  {
    id: "final",
    label: "Projet final",
    slugs: ["15-projet-final"],
  },
];

const ANNEX_GROUP = {
  id: "annexes",
  label: "Annexes",
};

function fileSlug(path) {
  return path.split("/").pop().replace(/\.md$/, "");
}

function extractHeading(markdown) {
  const match = markdown.match(/^\uFEFF?#\s+(.+?)\s*$/m);
  return match ? match[1].trim() : "Sans titre";
}

function cleanHeading(heading) {
  return heading
    .replace(/^(Chapitre|Annexe)\s+[\w]+\s*[—–-]\s*/i, "")
    .replace(/^\d{2}\s*[—–-]\s*/, "")
    .trim();
}

function stripFirstHeading(markdown) {
  return markdown.replace(/^\uFEFF?#\s+[^\n]*(?:\n+|$)/, "");
}

function readingMinutes(markdown) {
  const words = markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/https?:\/\/\S+/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

function makeChapter(path, raw, index) {
  const slug = fileSlug(path);
  const number = slug.slice(0, 2);
  const heading = extractHeading(raw);
  const group = GROUPS.find((item) => item.slugs.includes(slug));

  return {
    id: `cours/${slug}`,
    route: `cours/${slug}`,
    type: "chapter",
    slug,
    number,
    group: group ? group.label : "Chapitres",
    title: cleanHeading(heading),
    short: SHORT_TITLES[slug] || cleanHeading(heading),
    raw,
    body: stripFirstHeading(raw),
    minutes: readingMinutes(raw),
    order: index,
  };
}

function makeAnnex(path, raw, index) {
  const slug = fileSlug(path);
  const number = slug.slice(0, 1).toUpperCase();
  const heading = extractHeading(raw);

  return {
    id: `annexes/${slug}`,
    route: `annexes/${slug}`,
    type: "annex",
    slug,
    number,
    group: ANNEX_GROUP.label,
    title: cleanHeading(heading),
    short: SHORT_TITLES[slug] || cleanHeading(heading),
    raw,
    body: stripFirstHeading(raw),
    minutes: readingMinutes(raw),
    order: 100 + index,
  };
}

const chapterPages = Object.entries(chapterModules)
  .map(([path, raw], index) => makeChapter(path, raw, index))
  .sort((a, b) => a.slug.localeCompare(b.slug));

const annexPages = Object.entries(annexModules)
  .map(([path, raw], index) => makeAnnex(path, raw, index))
  .sort((a, b) => a.slug.localeCompare(b.slug));

export const homePage = {
  id: "home",
  route: "",
  type: "home",
  slug: "README",
  number: "",
  group: "Cours complet",
  title: extractHeading(readme),
  short: "Accueil",
  raw: readme,
  body: stripFirstHeading(readme),
  minutes: readingMinutes(readme),
  order: -1,
};

export const chapterPagesList = chapterPages;
export const annexPagesList = annexPages;

/** Toutes les pages, dans l'ordre de lecture. */
export const pages = [homePage, ...chapterPages, ...annexPages];

export const navGroups = [
  ...GROUPS.map((group) => ({
    id: group.id,
    label: group.label,
    pages: group.slugs
      .map((slug) => chapterPages.find((page) => page.slug === slug))
      .filter(Boolean),
  })),
  {
    ...ANNEX_GROUP,
    pages: annexPages,
  },
];

export function findPage(section, slug) {
  const route = section ? `${section}/${slug}` : "";
  return pages.find((page) => page.route === route) || null;
}

export function pageIndex(page) {
  return pages.findIndex((item) => item.id === page.id);
}

export function neighbors(page) {
  const index = pageIndex(page);
  return {
    previous: index > 0 ? pages[index - 1] : null,
    next: index >= 0 && index < pages.length - 1 ? pages[index + 1] : null,
  };
}

export function pageLabel(page) {
  if (page.type === "home") return "Accueil";
  if (page.type === "annex") return `Annexe ${page.number}`;
  return `Chapitre ${page.number}`;
}

export function pageEyebrow(page) {
  if (page.type === "home") return "Cours complet · Tauri 2";
  if (page.type === "annex") return `Annexe ${page.number} · ${page.group}`;
  return `Chapitre ${page.number} · ${page.group}`;
}
