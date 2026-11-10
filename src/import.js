// Import aus dem Export von "Shared Email Templates" (Datei shared-email-templates-backup-….xml).
// Reine Textverarbeitung ohne Browserbezug, damit sie sich testen lässt.

const decode = (s) =>
  String(s || '')
    .replace(/&#(\d+);/g, (m, n) => String.fromCharCode(Number(n)))
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');

const attrs = (tag) => Object.fromEntries([...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map((m) => [m[1], decode(m[2])]));

const KEEP = new Set(['p', 'strong', 'b', 'em', 'i', 'u', 'br', 'hr', 'ul', 'ol', 'li', 'a']);

/**
 * Räumt das HTML einer Vorlage auf: entfernt Schriftangaben, Klassen, Wrapper-div und span
 * (die Schrift setzt das Add-in beim Einfügen selbst) und macht aus Absätzen mit nur &nbsp; echte Leerzeilen.
 */
export function cleanBody(html) {
  let out = String(html || '')
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, '')
    .replace(/<(\/?)([a-zA-Z][a-zA-Z0-9]*)([^>]*)>/g, (m, slash, rawTag, rest) => {
      const tag = rawTag.toLowerCase();
      if (!KEEP.has(tag)) return '';
      if (slash) return `</${tag}>`;
      if (tag === 'a') {
        const href = /href="([^"]*)"/i.exec(rest);
        return href && /^(https?:|mailto:|tel:)/i.test(href[1]) ? `<a href="${href[1]}">` : '<a>';
      }
      return `<${tag}>`;
    })
    .replace(/[\r\n]+/g, '')
    .replace(/<p>(?:\s|&nbsp;|<br>)*<\/p>/gi, '<p><br></p>')
    .replace(/<p><\/p>/gi, '');
  // Leere Absätze am Anfang und Ende entfernen
  out = out.replace(/^(?:<p><br><\/p>)+/, '').replace(/(?:<p><br><\/p>)+$/, '');
  return out.trim();
}

/**
 * Liest einen Export und liefert { team, templates: [{ title, folder, subject, body }] }.
 * Verschachtelte Ordner werden zu "Ordner / Unterordner".
 */
export function parseSharedEmailTemplates(xml) {
  const text = String(xml || '');
  const teamTag = /<templates\s([^>]*)>/.exec(text);
  const team = teamTag ? attrs(teamTag[1]).team || '' : '';

  const items = [...text.matchAll(/<(folder|templateItem)\s([^>]*?)>/g)].map((m) => ({ kind: m[1], ...attrs(m[2]) }));
  const byId = new Map(items.map((i) => [i.id, i]));

  const folderPath = (item) => {
    const names = [];
    const seen = new Set();
    let cur = byId.get(item.parentid);
    while (cur && !seen.has(cur.id)) {
      seen.add(cur.id);
      names.unshift(cur.name);
      cur = byId.get(cur.parentid);
    }
    return names.join(' / ');
  };

  const templates = items
    .filter((i) => i.kind === 'templateItem' && i.group !== 'true')
    .map((i) => ({
      title: String(i.name || '').trim(),
      folder: folderPath(i),
      subject: '',
      body: cleanBody(i.templatefiledata),
    }))
    .filter((t) => t.title && t.body);

  return { team, templates };
}

/** Schlüssel zum Erkennen schon vorhandener Vorlagen. */
export const templateKey = (t) => `${(t.folder || '').trim().toLowerCase()}\u0000${(t.title || '').trim().toLowerCase()}`;
