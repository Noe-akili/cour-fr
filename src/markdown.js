import { marked } from "marked";
import hljs from "highlight.js/lib/core";

import bash from "highlight.js/lib/languages/bash";
import css from "highlight.js/lib/languages/css";
import diff from "highlight.js/lib/languages/diff";
import ini from "highlight.js/lib/languages/ini";
import javascript from "highlight.js/lib/languages/javascript";
import json from "highlight.js/lib/languages/json";
import markdown from "highlight.js/lib/languages/markdown";
import powershell from "highlight.js/lib/languages/powershell";
import rust from "highlight.js/lib/languages/rust";
import sql from "highlight.js/lib/languages/sql";
import typescript from "highlight.js/lib/languages/typescript";
import xml from "highlight.js/lib/languages/xml";
import yaml from "highlight.js/lib/languages/yaml";

hljs.registerLanguage("bash", bash);
hljs.registerLanguage("css", css);
hljs.registerLanguage("diff", diff);
hljs.registerLanguage("ini", ini);
hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("json", json);
hljs.registerLanguage("markdown", markdown);
hljs.registerLanguage("powershell", powershell);
hljs.registerLanguage("rust", rust);
hljs.registerLanguage("sql", sql);
hljs.registerLanguage("typescript", typescript);
hljs.registerLanguage("xml", xml);
hljs.registerLanguage("yaml", yaml);

marked.setOptions({
  gfm: true,
  breaks: false,
  headerIds: false,
  mangle: false,
});

const LANGUAGE_ALIASES = {
  ts: "typescript",
  tsx: "typescript",
  js: "javascript",
  jsx: "javascript",
  rs: "rust",
  sh: "bash",
  shell: "bash",
  zsh: "bash",
  yml: "yaml",
  toml: "ini",
  vue: "xml",
  html: "xml",
  svg: "xml",
  md: "markdown",
  ps1: "powershell",
  text: "plaintext",
  txt: "plaintext",
  gitignore: "plaintext",
  console: "bash",
};

const LANGUAGE_LABELS = {
  bash: "Shell",
  css: "CSS",
  diff: "Diff",
  ini: "TOML",
  javascript: "JavaScript",
  json: "JSON",
  markdown: "Markdown",
  plaintext: "Texte",
  powershell: "PowerShell",
  rust: "Rust",
  sql: "SQL",
  typescript: "TypeScript",
  xml: "HTML / Vue",
  yaml: "YAML",
};

const CALLOUT_TONES = [
  { tone: "warning", markers: ["⚠️", "⚠"] },
  { tone: "tip", markers: ["💡"] },
  { tone: "security", markers: ["🔒"] },
  { tone: "success", markers: ["✅"] },
  { tone: "danger", markers: ["❌"] },
  { tone: "info", markers: ["ℹ️", "📌"] },
];

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function slugifyHeading(text) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function uniqueId(text, seen) {
  const base = slugifyHeading(text) || "section";
  const count = seen.get(base) || 0;
  seen.set(base, count + 1);
  return count === 0 ? base : `${base}-${count}`;
}

/** Retourne une fonction qui produit des ancres uniques, comme le rendu. */
export function createSlugger() {
  const seen = new Map();
  return (text) => uniqueId(text, seen);
}

function resolveLink(href, page) {
  if (!href) return { kind: "empty" };

  if (/^(https?:|mailto:|tel:)/i.test(href)) {
    return { kind: "external", href };
  }

  if (href.startsWith("#")) {
    return { kind: "same-page", anchor: decodeURIComponent(href.slice(1)) };
  }

  const base =
    page.type === "home"
      ? "https://docs.local/README.md"
      : `https://docs.local/${page.type}/${page.slug}.md`;

  let url;
  try {
    url = new URL(href, base);
  } catch {
    return { kind: "external", href };
  }

  if (url.origin !== "https://docs.local") {
    return { kind: "external", href: url.href };
  }

  const anchor = url.hash ? decodeURIComponent(url.hash.slice(1)) : "";
  const pathname = url.pathname;

  // Le dossier du projet final n'est pas publié avec la documentation :
  // on renvoie vers le chapitre qui le décrit pas à pas.
  if (pathname.includes("/projet-final")) {
    return { kind: "internal", route: "cours/15-projet-final", anchor };
  }

  if (pathname === "/README.md" || pathname === "/") {
    return { kind: "internal", route: "", anchor };
  }

  if (pathname.endsWith(".md")) {
    const route = pathname.replace(/^\//, "").replace(/\.md$/, "");
    if (route.startsWith("cours/") || route.startsWith("annexes/")) {
      return { kind: "internal", route, anchor };
    }
  }

  // Fichier ou image relatif : on laisse le navigateur décider.
  return { kind: "asset", href: url.href };
}

function rewriteLinks(article, page) {
  for (const link of article.querySelectorAll("a[href]")) {
    const resolution = resolveLink(link.getAttribute("href"), page);

    if (resolution.kind === "external") {
      link.href = resolution.href;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.classList.add("external-link");
      continue;
    }

    if (resolution.kind === "same-page") {
      link.dataset.route = page.route;
      link.dataset.anchor = resolution.anchor;
      link.href = `#/${page.route}${resolution.anchor ? `?${encodeURIComponent(resolution.anchor)}` : ""}`;
      continue;
    }

    if (resolution.kind === "internal") {
      link.dataset.route = resolution.route;
      link.dataset.anchor = resolution.anchor;
      link.href = `#/${resolution.route}${resolution.anchor ? `?${encodeURIComponent(resolution.anchor)}` : ""}`;
      continue;
    }

    if (resolution.kind === "asset") {
      link.href = resolution.href;
    }
  }
}

function enhanceHeadings(article, page) {
  const seen = new Map();
  const headings = [];

  for (const heading of article.querySelectorAll("h1, h2, h3, h4")) {
    const text = heading.textContent.trim();
    if (!text) continue;

    const id = uniqueId(text, seen);
    heading.id = id;

    const anchor = document.createElement("a");
    anchor.className = "heading-anchor";
    anchor.href = `#${id}`;
    anchor.dataset.anchor = id;
    anchor.dataset.route = page.route;
    anchor.setAttribute("aria-hidden", "true");
    anchor.tabIndex = -1;
    anchor.textContent = "#";
    heading.appendChild(anchor);

    if (heading.tagName === "H2" || heading.tagName === "H3") {
      headings.push({
        id,
        text,
        level: heading.tagName === "H2" ? 2 : 3,
      });
    }
  }

  return headings;
}

function enhanceTables(article) {
  for (const table of article.querySelectorAll("table")) {
    if (table.parentElement?.classList.contains("table-wrap")) continue;
    const wrapper = document.createElement("div");
    wrapper.className = "table-wrap";
    wrapper.tabIndex = 0;
    table.parentNode.insertBefore(wrapper, table);
    wrapper.appendChild(table);
  }
}

function enhanceBlockquotes(article) {
  for (const quote of article.querySelectorAll("blockquote")) {
    const text = quote.textContent.trim();
    quote.classList.add("callout");

    let tone = "info";
    for (const candidate of CALLOUT_TONES) {
      if (candidate.markers.some((marker) => text.includes(marker))) {
        tone = candidate.tone;
        break;
      }
    }

    if (tone === "info" && /^(objectifs|prérequis|prerequis|à retenir|a retenir)/i.test(text)) {
      tone = "objectives";
    }

    quote.classList.add(`callout-${tone}`);
  }
}

function decodeText(text) {
  const textarea = document.createElement("textarea");
  textarea.innerHTML = text;
  return textarea.value;
}

function copyText(text) {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text);
  }

  return new Promise((resolve, reject) => {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand("copy");
      resolve();
    } catch (error) {
      reject(error);
    } finally {
      textarea.remove();
    }
  });
}

function createCopyButton(getText) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "copy-btn";
  button.innerHTML =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="11" height="11" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg><span>Copier</span>';
  button.setAttribute("aria-label", "Copier le code");

  button.addEventListener("click", async () => {
    try {
      await copyText(getText());
      button.classList.add("copied");
      button.querySelector("span").textContent = "Copié !";
      window.setTimeout(() => {
        button.classList.remove("copied");
        button.querySelector("span").textContent = "Copier";
      }, 1800);
    } catch {
      button.querySelector("span").textContent = "Erreur";
    }
  });

  return button;
}

function enhanceCodeBlocks(article) {
  for (const pre of article.querySelectorAll("pre")) {
    const code = pre.querySelector("code");
    if (!code) continue;

    const languageClass = [...code.classList].find((name) => name.startsWith("language-"));
    const rawLanguage = languageClass ? languageClass.slice("language-".length) : "";
    const language = LANGUAGE_ALIASES[rawLanguage] || rawLanguage;

    if (language && language !== "plaintext" && hljs.getLanguage(language)) {
      try {
        const source = code.textContent;
        code.innerHTML = hljs.highlight(source, {
          language,
          ignoreIllegals: true,
        }).value;
        code.classList.add("hljs");
      } catch {
        // En cas d'échec, on conserve le texte échappé par marked.
      }
    }

    const wrapper = document.createElement("div");
    wrapper.className = "code-block";

    const header = document.createElement("div");
    header.className = "code-header";

    const label = document.createElement("span");
    label.className = "code-language";
    label.textContent = LANGUAGE_LABELS[language] || (rawLanguage ? rawLanguage.toUpperCase() : "Code");

    header.appendChild(label);
    header.appendChild(createCopyButton(() => code.textContent));

    pre.parentNode.insertBefore(wrapper, pre);
    wrapper.appendChild(header);
    wrapper.appendChild(pre);
  }
}

function enhanceTaskLists(article) {
  for (const input of article.querySelectorAll('input[type="checkbox"]')) {
    input.disabled = true;
    input.closest("li")?.classList.add("task-item");
  }
}

/**
 * Transforme le Markdown en HTML puis applique les enrichissements
 * nécessaires à la documentation (ancres, liens, coloration, copie).
 */
export function renderMarkdown(markdown, page) {
  const container = document.createElement("div");
  container.innerHTML = marked.parse(markdown);

  rewriteLinks(container, page);
  const headings = enhanceHeadings(container, page);
  enhanceTables(container);
  enhanceBlockquotes(container);
  enhanceCodeBlocks(container);
  enhanceTaskLists(container);

  const fragment = document.createDocumentFragment();
  fragment.append(...container.childNodes);

  return { fragment, headings };
}

export { escapeHtml };
