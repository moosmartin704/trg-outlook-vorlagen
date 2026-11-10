// Platzhalter in Vorlagen: {{Name}}, {{Vorname}}, {{Nachname}}, {{Betreff}}, {{MeinName}}, {{Datum}}
// Reine Logik ohne Outlook-Bezug, damit sie sich testen lässt.

export const PLACEHOLDERS = [
  { key: 'Name', hint: 'Voller Name des ersten Empfängers' },
  { key: 'Vorname', hint: 'Vorname des ersten Empfängers' },
  { key: 'Nachname', hint: 'Nachname des ersten Empfängers' },
  { key: 'Betreff', hint: 'Aktueller Betreff der Nachricht' },
  { key: 'MeinName', hint: 'Dein Name als Absender' },
  { key: 'Datum', hint: 'Heutiges Datum (TT.MM.JJJJ)' },
];

const TITEL = /^(dr|prof|dipl|ing|mag|herr|frau|hr|fr)\.?$/i;

const capitalize = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : s);

/** Zerlegt einen Anzeigenamen ("Erika Muster", "Muster, Erika", "erika.muster@firma.de") in Vor- und Nachname. */
export function splitName(displayName = '', email = '') {
  let raw = String(displayName || '').replace(/\([^)]*\)/g, '').replace(/["']/g, '').trim();

  // Ohne brauchbaren Anzeigenamen: aus "vorname.nachname@…" ableiten
  if (!raw || raw.includes('@')) {
    const local = String(email || raw).split('@')[0];
    const teile = local.split(/[._-]+/).filter((t) => /^[a-zäöüß]{2,}$/i.test(t));
    if (teile.length < 2) return { name: '', vorname: '', nachname: '' };
    raw = teile.map(capitalize).join(' ');
  }

  let vorname = '';
  let nachname = '';
  if (raw.includes(',')) {
    const [vorn, nach] = [raw.split(',')[1], raw.split(',')[0]];
    nachname = nach.trim();
    vorname = vorn.trim().split(/\s+/).filter((t) => !TITEL.test(t))[0] || '';
  } else {
    const tokens = raw.split(/\s+/).filter((t) => !TITEL.test(t));
    if (tokens.length === 1) nachname = tokens[0];
    else if (tokens.length > 1) {
      vorname = tokens[0];
      nachname = tokens.slice(1).join(' ');
    }
  }
  const name = raw.includes(',') ? [vorname, nachname].filter(Boolean).join(' ') : raw;
  return { name, vorname, nachname };
}

export function formatDatum(d = new Date()) {
  const z = (n) => String(n).padStart(2, '0');
  return `${z(d.getDate())}.${z(d.getMonth() + 1)}.${d.getFullYear()}`;
}

/** Baut die Werte für alle Platzhalter aus dem Zustand der Nachricht. */
export function buildValues({ to = [], subject = '', me = '', now = new Date() } = {}) {
  const first = to[0] || {};
  const { name, vorname, nachname } = splitName(first.displayName, first.emailAddress);
  return {
    name,
    vorname,
    nachname,
    betreff: String(subject || '').trim(),
    meinname: String(me || '').trim(),
    datum: formatDatum(now),
  };
}

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const RE = /\{\{\s*([A-Za-zÄÖÜäöüß]+)\s*\}\}/g;

/**
 * Ersetzt Platzhalter in HTML. Nicht auflösbare bleiben stehen und werden gelb markiert,
 * damit sie vor dem Senden auffallen. Rückgabe: { html, missing }.
 */
export function fillHtml(html, values) {
  const missing = new Set();
  const out = String(html || '').replace(RE, (m, key) => {
    const v = values[key.toLowerCase()];
    if (v) return esc(v);
    missing.add(key);
    return `<span style="background-color:#FFF200">{{${key}}}</span>`;
  });
  return { html: out, missing: [...missing] };
}

/** Wie fillHtml, aber für Klartext (Betreff). Nicht auflösbare Platzhalter bleiben unverändert. */
export function fillText(text, values) {
  const missing = new Set();
  const out = String(text || '').replace(RE, (m, key) => {
    const v = values[key.toLowerCase()];
    if (v) return v;
    missing.add(key);
    return m;
  });
  return { text: out, missing: [...missing] };
}
