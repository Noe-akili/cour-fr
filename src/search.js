import { pages } from "./nav.js";
import { createSlugger } from "./markdown.js";

function stripMarkdown(markdown) {
  return markdown
    .replace(/```[^\n]*\n([\s\S]*?)```/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^\s*#{1,6}\s+/gm, "")
    .replace(/^\s*>\s?/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/[*_~]/g, "")
    .replace(/\|/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function countOccurrences(haystack, needle) {
  let count = 0;
  let index = 0;
  while (count < 8) {
    const found = haystack.indexOf(needle, index);
    if (found === -1) break;
    count += 1;
    index = found + needle.length;
  }
  return count;
}

let cachedIndex = null;

/**
 * Découpe chaque page en sections (H2) pour la recherche plein texte.
 * Les titres de code sont ignorés afin de ne pas créer de fausses ancres.
 */
export function getSearchIndex() {
  if (cachedIndex) return cachedIndex;

  const sections = [];

  for (const page of pages) {
    const slug = createSlugger();
    const lines = page.body.split(/\r?\n/);
    let inFence = false;
    let section = {
      page,
      title: page.title,
      anchor: null,
      lines: [],
    };

    const flush = () => {
      const text = stripMarkdown(section.lines.join("\n"));
      if (!text && !section.anchor) return;
      sections.push({
        page,
        title: section.title,
        anchor: section.anchor,
        text,
        titleLower: section.title.toLowerCase(),
        pageLower: `${page.title} ${page.short} ${page.group}`.toLowerCase(),
        textLower: text.toLowerCase(),
      });
    };

    for (const line of lines) {
      if (/^\s*```/.test(line)) {
        inFence = !inFence;
        section.lines.push(line);
        continue;
      }

      const heading = !inFence && line.match(/^(#{2,4})\s+(.+?)\s*#*\s*$/);
      if (heading) {
        flush();
        const level = heading[1].length;
        const title = heading[2].trim();
        const id = slug(title);
        section = {
          page,
          title,
          anchor: level === 2 ? id : id,
          lines: [],
        };
        continue;
      }

      section.lines.push(line);
    }

    flush();
  }

  cachedIndex = sections;
  return sections;
}

export function runSearch(index, rawQuery, limit = 18) {
  const query = rawQuery.trim().toLowerCase();
  if (query.length < 2) return [];

  const terms = query.split(/\s+/).filter(Boolean);
  const results = [];

  for (let order = 0; order < index.length; order += 1) {
    const section = index[order];
    let score = 0;
    let matchesAll = true;

    for (const term of terms) {
      const inTitle =
        section.titleLower.includes(term) || section.pageLower.includes(term);
      const bodyIndex = section.textLower.indexOf(term);

      if (!inTitle && bodyIndex === -1) {
        matchesAll = false;
        break;
      }

      if (inTitle) score += 600;
      if (bodyIndex !== -1) {
        score += 40 + countOccurrences(section.textLower, term) * 12;
        score -= Math.min(30, bodyIndex / 250);
      }
    }

    if (!matchesAll) continue;

    const firstTerm = terms[0];
    const position = section.textLower.indexOf(firstTerm);
    const start = position > 70 ? position - 70 : 0;
    const end = Math.min(section.text.length, start + 190);
    let snippet = section.text.slice(start, end).trim();
    if (start > 0) snippet = `…${snippet}`;
    if (end < section.text.length) snippet = `${snippet}…`;

    results.push({
      page: section.page,
      title: section.title,
      anchor: section.anchor,
      snippet,
      score,
      order,
    });
  }

  results.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.order - b.order;
  });

  return results.slice(0, limit);
}
