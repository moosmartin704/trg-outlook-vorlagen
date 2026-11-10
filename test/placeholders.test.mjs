import test from 'node:test';
import assert from 'node:assert/strict';
import { splitName, buildValues, fillHtml, fillText, formatDatum } from '../src/placeholders.js';

test('splitName: Vorname Nachname', () => {
  assert.deepEqual(splitName('Erika Muster', 'e@x.de'), { name: 'Erika Muster', vorname: 'Erika', nachname: 'Muster' });
});

test('splitName: Nachname, Vorname', () => {
  const r = splitName('Muster, Erika', 'e@x.de');
  assert.equal(r.vorname, 'Erika');
  assert.equal(r.nachname, 'Muster');
  assert.equal(r.name, 'Erika Muster');
});

test('splitName: Titel und Firmenzusatz werden ignoriert', () => {
  const r = splitName('Dr. Erika Muster (ACME GmbH)', '');
  assert.equal(r.vorname, 'Erika');
  assert.equal(r.nachname, 'Muster');
});

test('splitName: mehrteiliger Nachname', () => {
  const r = splitName('Hans von Beispiel', '');
  assert.equal(r.vorname, 'Hans');
  assert.equal(r.nachname, 'von Beispiel');
});

test('splitName: aus E-Mail-Adresse ableiten, wenn kein Anzeigename', () => {
  const r = splitName('erika.muster@firma.de', 'erika.muster@firma.de');
  assert.equal(r.vorname, 'Erika');
  assert.equal(r.nachname, 'Muster');
});

test('splitName: Sammeladresse liefert nichts', () => {
  assert.deepEqual(splitName('', 'info@firma.de'), { name: '', vorname: '', nachname: '' });
});

test('splitName: nur ein Wort gilt als Nachname', () => {
  const r = splitName('Muster', '');
  assert.equal(r.vorname, '');
  assert.equal(r.nachname, 'Muster');
});

test('formatDatum', () => {
  assert.equal(formatDatum(new Date(2026, 10, 3)), '03.11.2026');
});

test('fillHtml: ersetzt bekannte Platzhalter, schreibt Groß-/Kleinschreibung nicht vor', () => {
  const v = buildValues({ to: [{ displayName: 'Erika Muster', emailAddress: 'e@x.de' }], me: 'Max', now: new Date(2026, 0, 5) });
  const { html, missing } = fillHtml('<p>Hallo {{ Vorname }} {{nachname}}, Gruß {{MeinName}} am {{Datum}}</p>', v);
  assert.equal(html, '<p>Hallo Erika Muster, Gruß Max am 05.01.2026</p>');
  assert.deepEqual(missing, []);
});

test('fillHtml: fehlende Werte werden markiert und gemeldet', () => {
  const v = buildValues({ to: [] });
  const { html, missing } = fillHtml('Hallo {{Vorname}}, {{Unbekannt}}', v);
  assert.match(html, /background-color:#FFF200">\{\{Vorname\}\}/);
  assert.match(html, /\{\{Unbekannt\}\}/);
  assert.deepEqual(missing.sort(), ['Unbekannt', 'Vorname']);
});

test('fillHtml: Werte werden als HTML maskiert', () => {
  const v = buildValues({ to: [{ displayName: '<b>X</b> Y', emailAddress: '' }] });
  const { html } = fillHtml('{{Name}}', v);
  assert.ok(!html.includes('<b>'));
});

test('fillText: Betreff-Platzhalter', () => {
  const v = buildValues({ to: [{ displayName: 'Erika Muster' }], subject: 'Anfrage' });
  assert.deepEqual(fillText('Re: {{Betreff}} für {{Name}} {{Foo}}', v), { text: 'Re: Anfrage für Erika Muster {{Foo}}', missing: ['Foo'] });
});
