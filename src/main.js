import "@fontsource-variable/inter";
import "@fontsource-variable/jetbrains-mono";
import "./styles.css";

import {
  pages,
  homePage,
  navGroups,
  findPage,
  neighbors,
  pageEyebrow,
  pageLabel,
} from "./nav.js";
import { renderMarkdown, escapeHtml } from "./markdown.js";
import { getSearchIndex, runSearch } from "./search.js";

const $ = (id) => document.getElementById(id);

const sidebar = $("sidebar");
const scrim = $("nav-scrim");
const menuBtn = $("menu-btn");
const nav = $("nav");
const breadcrumb = $("breadcrumb");
const pageHead = $("page-head");
const article = $("article");
const toc = $("toc");
const tocLinks = $("toc-links");
const pageNav = $("page-nav");
const progressBar = $("reading-progress-bar");
const themeBtn = $("theme-btn");

const state = {
  page: null,
  headings: [],
  activeAnchor: null,
};

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const scrollBehavior = () => (prefersReducedMotion.matches ? "auto" : "smooth");

const chapterCount = pages.filter((page) => page.type === "chapter").length;
const annexCount = pages.filter((page) => page.type === "annex").length;

/* -------------------------------------------------------------------------- */
/* Navigation                                                                 */
/* -------------------------------------------------------------------------- */

function makeNavLink(page, { home = false } = {}) {
  const link = document.createElement("a");
  link.className = home ? "nav-link nav-home" : "nav-link";
  link.href = `#/${page.route}`;
  link.dataset.route = page.route;

  const number = document.createElement("span");
  number.className = "nav-num";
  if (home) {
    number.classList.add("nav-num-icon");
    number.innerHTML =
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10.5 12 4l8 6.5V20h-5v-5H9v5H4z"/></svg>';
  } else {
    number.textContent = page.number;
  }

  const label = document.createElement("span");
  label.className = "nav-label";
  label.textContent = page.short;

  link.append(number, label);
  return link;
}

function buildNav() {
  nav.replaceChildren();

  nav.appendChild(makeNavLink(homePage, { home: true }));

  for (const group of navGroups) {
    const section = document.createElement("section");
    section.className = "nav-group";

    const title = document.createElement("p");
    title.className = "nav-group-title";
    title.textContent = group.label;

    section.appendChild(title);
    for (const page of group.pages) {
      section.appendChild(makeNavLink(page));
    }

    nav.appendChild(section);
  }
}

function updateActiveNav(page) {
  for (const link of nav.querySelectorAll(".nav-link")) {
    const active = link.dataset.route === page.route;
    link.classList.toggle("is-active", active);
    if (active) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  }
}

function updateBreadcrumb(page) {
  if (page.type === "home") {
    breadcrumb.innerHTML = '<span class="crumb-current">Cours Tauri 2</span>';
    return;
  }

  breadcrumb.innerHTML = `
    <a href="#/" data-route="">Cours</a>
    <span class="crumb-sep" aria-hidden="true">/</span>
    <span>${escapeHtml(page.group)}</span>
    <span class="crumb-sep" aria-hidden="true">/</span>
    <span class="crumb-current">${escapeHtml(page.short)}</span>
  `;
}

/* -------------------------------------------------------------------------- */
/* Rendu d'une page                                                           */
/* -------------------------------------------------------------------------- */

function buildToc(headings, page) {
  if (headings.length < 2) {
    toc.hidden = true;
    tocLinks.replaceChildren();
    return;
  }

  toc.hidden = false;
  tocLinks.innerHTML = headings
    .map(
      (heading) => `
        <a
          class="toc-link depth-${heading.level}"
          href="#/${page.route}?${encodeURIComponent(heading.id)}"
          data-route="${page.route}"
          data-anchor="${escapeHtml(heading.id)}"
        >${escapeHtml(heading.text)}</a>
      `,
    )
    .join("");
}

function buildPageNav(page) {
  const { previous, next } = neighbors(page);

  const previousMarkup = previous
    ? `<a class="page-nav-link is-prev" href="#/${previous.route}">
         <span class="page-nav-direction">← Précédent</span>
         <span class="page-nav-title">${escapeHtml(previous.short)}</span>
       </a>`
    : "<span></span>";

  const nextMarkup = next
    ? `<a class="page-nav-link is-next" href="#/${next.route}">
         <span class="page-nav-direction">Suivant →</span>
         <span class="page-nav-title">${escapeHtml(next.short)}</span>
       </a>`
    : "<span></span>";

  pageNav.innerHTML = previousMarkup + nextMarkup;
}

function renderPage(page) {
  state.page = page;
  state.headings = [];
  state.activeAnchor = null;

  document.title =
    page.type === "home" ? "Tauri 2 — Le cours complet" : `${page.title} — Cours Tauri 2`;

  const meta =
    page.type === "home"
      ? `${chapterCount} chapitres · ${annexCount} annexes · Rust + Vue 3`
      : `${pageLabel(page)} · ${page.minutes} min de lecture`;

  pageHead.innerHTML = `
    <p class="page-eyebrow">${escapeHtml(pageEyebrow(page))}</p>
    <h1 class="page-title">${escapeHtml(page.title)}</h1>
    <p class="page-meta">${escapeHtml(meta)}</p>
  `;

  article.className = `article article-${page.type}`;
  const { fragment, headings } = renderMarkdown(page.body, page);
  article.replaceChildren(fragment);

  state.headings = headings;
  buildToc(headings, page);
  buildPageNav(page);
  updateBreadcrumb(page);
  updateActiveNav(page);
  updateProgress();
  updateTocActive();
}

function parseRoute() {
  const raw = window.location.hash.replace(/^#\/?/, "");
  if (!raw) return { page: homePage, anchor: "" };

  const [pathPart, anchorPart] = raw.split("?");
  const [section, slug] = pathPart.split("/");
  const page = findPage(section, slug) || homePage;

  let anchor = "";
  if (anchorPart) {
    try {
      anchor = decodeURIComponent(anchorPart);
    } catch {
      anchor = anchorPart;
    }
  }

  return { page, anchor };
}

function renderRoute({ initial = false } = {}) {
  const { page, anchor } = parseRoute();

  if (state.page && state.page.route === page.route) {
    if (anchor) {
      scrollToAnchor(anchor, { smooth: !initial, updateHash: false });
    } else if (!initial) {
      window.scrollTo({ top: 0, behavior: "auto" });
    }
    return;
  }

  renderPage(page);

  if (anchor) {
    scrollToAnchor(anchor, { smooth: false, updateHash: false });
    window.requestAnimationFrame(() => {
      scrollToAnchor(anchor, { smooth: false, updateHash: false });
    });
    window.setTimeout(() => {
      scrollToAnchor(anchor, { smooth: false, updateHash: false });
    }, 150);
  } else {
    window.scrollTo({ top: 0, behavior: "auto" });
  }
}

/* -------------------------------------------------------------------------- */
/* Ancres, sommaire et progression                                           */
/* -------------------------------------------------------------------------- */

function setActiveToc(id) {
  for (const link of tocLinks.querySelectorAll(".toc-link")) {
    const active = link.dataset.anchor === id;
    link.classList.toggle("is-active", active);
    if (active) link.setAttribute("aria-current", "location");
    else link.removeAttribute("aria-current");
  }
  state.activeAnchor = id;
}

function scrollToAnchor(id, { smooth = true, updateHash = true } = {}) {
  const target = document.getElementById(id);
  if (!target) return false;

  const topbar = document.querySelector(".topbar");
  const offset = (topbar?.offsetHeight || 64) + 22;
  const top = target.getBoundingClientRect().top + window.scrollY - offset;

  window.scrollTo({ top, behavior: smooth ? scrollBehavior() : "auto" });
  setActiveToc(id);

  target.classList.add("is-target");
  window.setTimeout(() => target.classList.remove("is-target"), 1600);

  if (updateHash && state.page) {
    window.history.replaceState(
      null,
      "",
      `#/${state.page.route}?${encodeURIComponent(id)}`,
    );
  }

  return true;
}

function updateProgress() {
  const scrollable = document.documentElement.scrollHeight - window.innerHeight;
  const progress = scrollable > 0 ? Math.min(1, window.scrollY / scrollable) : 0;
  progressBar.style.transform = `scaleX(${progress})`;
}

function updateTocActive() {
  if (!state.headings.length) return;

  const topbar = document.querySelector(".topbar");
  const offset = (topbar?.offsetHeight || 64) + 48;
  let active = state.headings[0].id;

  for (const heading of state.headings) {
    const element = document.getElementById(heading.id);
    if (element && element.getBoundingClientRect().top <= offset) {
      active = heading.id;
    }
  }

  if (!state.activeAnchor || state.activeAnchor !== active) {
    setActiveToc(active);
  }
}

let scrollTicking = false;
window.addEventListener(
  "scroll",
  () => {
    if (scrollTicking) return;
    scrollTicking = true;
    window.requestAnimationFrame(() => {
      updateProgress();
      updateTocActive();
      scrollTicking = false;
    });
  },
  { passive: true },
);

window.addEventListener("resize", updateProgress);

/* -------------------------------------------------------------------------- */
/* Thème                                                                      */
/* -------------------------------------------------------------------------- */

const THEME_KEY = "tauricours-theme";
const colorSchemeQuery = window.matchMedia("(prefers-color-scheme: dark)");

function applyTheme(theme, { persist = true } = {}) {
  document.documentElement.dataset.theme = theme;

  if (persist) {
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      /* mode privé : on applique quand même le thème pour la session. */
    }
  }

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", theme === "dark" ? "#0d141b" : "#fbfcfd");

  themeBtn.setAttribute("aria-pressed", String(theme === "dark"));
  themeBtn.setAttribute(
    "aria-label",
    theme === "dark" ? "Activer le thème clair" : "Activer le thème sombre",
  );
}

function storedTheme() {
  try {
    return localStorage.getItem(THEME_KEY);
  } catch {
    return null;
  }
}

themeBtn.addEventListener("click", () => {
  const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  applyTheme(next);
});

colorSchemeQuery.addEventListener("change", (event) => {
  if (!storedTheme()) applyTheme(event.matches ? "dark" : "light", { persist: false });
});

/* -------------------------------------------------------------------------- */
/* Navigation mobile                                                          */
/* -------------------------------------------------------------------------- */

function setNavOpen(open) {
  sidebar.classList.toggle("is-open", open);
  document.body.classList.toggle("nav-open", open);
  scrim.hidden = !open;
  menuBtn.setAttribute("aria-expanded", String(open));
}

menuBtn.addEventListener("click", () => setNavOpen(!sidebar.classList.contains("is-open")));
scrim.addEventListener("click", () => setNavOpen(false));
nav.addEventListener("click", (event) => {
  if (event.target.closest("a")) setNavOpen(false);
});

/* -------------------------------------------------------------------------- */
/* Recherche                                                                  */
/* -------------------------------------------------------------------------- */

const searchOverlay = $("search-overlay");
const searchInput = $("search-input");
const searchResults = $("search-results");
const searchTriggers = [$("search-trigger"), $("search-trigger-top")].filter(Boolean);

let searchIndex = null;
let currentResults = [];
let currentQuery = "";
let activeResult = -1;
let searchTimer = null;

function ensureSearchIndex() {
  if (!searchIndex) searchIndex = getSearchIndex();
  return searchIndex;
}

function highlightText(text, query) {
  const escaped = escapeHtml(text);
  const terms = [...new Set(query.split(/\s+/).filter((term) => term.length > 0))];

  if (!terms.length) return escaped;

  const pattern = terms
    .map((term) => escapeHtml(term).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");

  return escaped.replace(new RegExp(`(${pattern})`, "gi"), "<mark>$1</mark>");
}

function resultMarkup(result, index, query) {
  const { page } = result;
  const target = `#/${page.route}${
    result.anchor ? `?${encodeURIComponent(result.anchor)}` : ""
  }`;
  const meta = result.anchor
    ? `${pageLabel(page)} · ${page.short}`
    : pageLabel(page);

  const title = result.title || page.short;
  const snippet = result.snippet || "";

  return `
    <a class="search-result${index === activeResult ? " is-active" : ""}" href="${target}" data-index="${index}">
      <span class="result-meta">${escapeHtml(meta)}</span>
      <span class="result-title">${highlightText(title, query)}</span>
      ${snippet ? `<span class="result-snippet">${highlightText(snippet, query)}</span>` : ""}
    </a>
  `;
}

function renderResults(results, query, hint = "") {
  currentResults = results;
  currentQuery = query;
  activeResult = -1;

  if (!results.length) {
    searchResults.innerHTML = `
      <div class="search-empty">
        <p>Aucun résultat pour « ${escapeHtml(query)} ».</p>
        <p class="search-empty-hint">Essayez « commande », « sqlite », « tray » ou « rust ».</p>
      </div>
    `;
    return;
  }

  searchResults.innerHTML =
    (hint ? `<p class="search-hint">${escapeHtml(hint)}</p>` : "") +
    results.map((result, index) => resultMarkup(result, index, query)).join("");
}

function quickResults() {
  const preferred = [
    "00-introduction",
    "05-commandes-rust",
    "09-stockage-sqlite",
    "10-fenetres-menus-tray",
    "15-projet-final",
    "f-rust-pour-tauri",
  ];

  return preferred
    .map((slug) => pages.find((page) => page.slug === slug))
    .filter(Boolean)
    .map((page) => ({
      page,
      title: page.short,
      anchor: null,
      snippet: page.title,
      score: 0,
      order: page.order,
    }));
}

function openSearch() {
  ensureSearchIndex();
  searchOverlay.classList.add("is-open");
  document.body.classList.add("search-open");
  searchInput.value = "";
  renderResults(quickResults(), "", "Accès rapide");
  window.requestAnimationFrame(() => searchInput.focus());
}

function closeSearch() {
  window.clearTimeout(searchTimer);
  searchOverlay.classList.remove("is-open");
  document.body.classList.remove("search-open");
  searchInput.value = "";
  searchResults.replaceChildren();
  currentResults = [];
  activeResult = -1;
}

function setActiveResult(index) {
  const items = [...searchResults.querySelectorAll(".search-result")];
  if (!items.length) return;

  activeResult = ((index % items.length) + items.length) % items.length;
  items.forEach((item, itemIndex) => {
    item.classList.toggle("is-active", itemIndex === activeResult);
  });
  items[activeResult].scrollIntoView({ block: "nearest" });
}

for (const trigger of searchTriggers) trigger.addEventListener("click", openSearch);
searchOverlay.addEventListener("click", (event) => {
  if (event.target === searchOverlay) closeSearch();
});
searchResults.addEventListener("click", (event) => {
  const result = event.target.closest(".search-result");
  if (!result) return;

  event.preventDefault();
  const target = result.getAttribute("href");
  closeSearch();
  window.location.hash = target.slice(1);
});

searchInput.addEventListener("input", () => {
  window.clearTimeout(searchTimer);
  const query = searchInput.value;

  if (query.trim().length < 2) {
    renderResults(quickResults(), "", "Accès rapide");
    return;
  }

  searchTimer = window.setTimeout(() => {
    const results = runSearch(ensureSearchIndex(), query);
    renderResults(results, query.trim());
  }, 70);
});

searchInput.addEventListener("keydown", (event) => {
  if (event.key === "ArrowDown") {
    event.preventDefault();
    setActiveResult(activeResult + 1);
    return;
  }

  if (event.key === "ArrowUp") {
    event.preventDefault();
    setActiveResult(activeResult - 1);
    return;
  }

  if (event.key === "Enter") {
    event.preventDefault();
    const active =
      searchResults.querySelector(".search-result.is-active") ||
      searchResults.querySelector(".search-result");
    if (active) {
      const target = active.getAttribute("href");
      closeSearch();
      window.location.hash = target.slice(1);
    }
  }
});

/* -------------------------------------------------------------------------- */
/* Raccourcis clavier et clics internes                                      */
/* -------------------------------------------------------------------------- */

function isTypingContext(target) {
  if (!target) return false;
  if (target.isContentEditable) return true;
  return ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

document.addEventListener("keydown", (event) => {
  const command = event.ctrlKey || event.metaKey;

  if (command && event.key.toLowerCase() === "k") {
    event.preventDefault();
    if (searchOverlay.classList.contains("is-open")) closeSearch();
    else openSearch();
    return;
  }

  if (event.key === "/" && !isTypingContext(document.activeElement)) {
    event.preventDefault();
    openSearch();
    return;
  }

  if (event.key === "Escape") {
    if (searchOverlay.classList.contains("is-open")) closeSearch();
    else setNavOpen(false);
  }
});

document.addEventListener("click", (event) => {
  const link = event.target.closest("a[data-route]");
  if (!link) return;

  const route = link.dataset.route;
  const anchor = link.dataset.anchor || "";

  if (state.page && route === state.page.route) {
    event.preventDefault();

    if (anchor) {
      scrollToAnchor(anchor, { smooth: true, updateHash: true });
    } else {
      window.scrollTo({ top: 0, behavior: scrollBehavior() });
      window.history.replaceState(null, "", `#/${route}`);
    }
  }

  setNavOpen(false);
});

/* -------------------------------------------------------------------------- */
/* Démarrage                                                                  */
/* -------------------------------------------------------------------------- */

buildNav();
applyTheme(document.documentElement.dataset.theme === "dark" ? "dark" : "light", {
  persist: false,
});

// Active la transition du tiroir mobile après le premier rendu, pour éviter
// que la barre latérale ne glisse au chargement de la page.
window.requestAnimationFrame(() => {
  window.requestAnimationFrame(() => sidebar.classList.add("nav-animated"));
});

if (!window.location.hash) {
  window.history.replaceState(null, "", "#/");
}

window.addEventListener("hashchange", () => renderRoute());
renderRoute({ initial: true });

// Certaines polices se chargent après le premier rendu : on recale l'ancre.
document.fonts?.ready.then(() => {
  const { anchor } = parseRoute();
  if (anchor) scrollToAnchor(anchor, { smooth: false, updateHash: false });
});
