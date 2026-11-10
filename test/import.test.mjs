import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanBody, parseSharedEmailTemplates, templateKey } from '../src/import.js';

// Erfundener Beispielexport im Aufbau der echten Datei (keine Geschäftsdaten).
const body1 = '&lt;div style=&quot;font-family: aptos; font-size: 10pt;&quot;&gt;&#10;&lt;p class=&quot;MsoNormal&quot; style=&quot;margin-top: 0px;&quot;&gt;Guten Tag&lt;/p&gt;&#10;&lt;p class=&quot;MsoNormal&quot;&gt;&amp;nbsp;&lt;/p&gt;&#10;&lt;p class=&quot;MsoNormal&quot;&gt;Text mit &lt;strong&gt;Fettung&lt;/strong&gt;.&lt;/p&gt;&#10;&lt;/div&gt;';
const body2 = '&lt;p&gt;&lt;span style=&quot;color:red&quot;&gt;Hello&amp;nbsp;&lt;/span&gt;&lt;/p&gt;&lt;hr&gt;&lt;p&gt;Link &lt;a href=&quot;https://example.com&quot; onclick=&quot;x()&quot;&gt;hier&lt;/a&gt;&lt;/p&gt;';
const xml =
  '<xml version="1.0" encoding="UTF-8"><templates team="Team A" created-date="x">' +
  '<folder name="01 Anfragen" id="1" teamid="9" parentid="null" group="true">' +
  '<templateItem name="01 Anfrage" id="2" teamid="9" parentid="1" group="false" templatefiledata="' + body1 + '" templatefilemetadata="…"></templateItem>' +
  '</folder>' +
  '<folder name="Deutsch" id="3" teamid="9" parentid="1" group="true"></folder>' +
  '<templateItem name="Antwort" id="4" teamid="9" parentid="3" group="false" templatefiledata="' + body2 + '"></templateItem>' +
  '<templateItem name="Ohne Ordner" id="5" teamid="9" parentid="null" group="false" templatefiledata="&lt;p&gt;x&lt;/p&gt;"></templateItem>' +
  '</templates><signatures team="Team A"></signatures></xml>';

test('cleanBody: entfernt Schrift, Klassen, div und span, macht Leerzeilen', () => {
  const r = cleanBody('<div style="font-family:aptos"><p class="MsoNormal" style="margin:0">A</p><p>&nbsp;</p><p><span>B</span></p></div>');
  assert.equal(r, '<p>A</p><p><br></p><p>B</p>');
});

test('cleanBody: schneidet leere Absätze an Anfang und Ende ab', () => {
  assert.equal(cleanBody('<p>&nbsp;</p><p>A</p><p>&nbsp;</p>'), '<p>A</p>');
});

test('cleanBody: unsichere Inhalte und Attribute werden entfernt, href bleibt', () => {
  const r = cleanBody('<script>x()</script><p onclick="x()">A<img src="a.png"><a href="javascript:x()">b</a><a href="https://e.com" onclick="y()">c</a></p>');
  assert.equal(r, '<p>A<a>b</a><a href="https://e.com">c</a></p>');
});

test('parse: Team, Ordnerpfade, Vorlagen', () => {
  const { team, templates } = parseSharedEmailTemplates(xml);
  assert.equal(team, 'Team A');
  assert.equal(templates.length, 3);
  assert.deepEqual(templates.map((t) => [t.folder, t.title]), [
    ['01 Anfragen', '01 Anfrage'],
    ['01 Anfragen / Deutsch', 'Antwort'],
    ['', 'Ohne Ordner'],
  ]);
  assert.equal(templates[0].body, '<p>Guten Tag</p><p><br></p><p>Text mit <strong>Fettung</strong>.</p>');
  assert.equal(templates[1].body, '<p>Hello&nbsp;</p><hr><p>Link <a href="https://example.com">hier</a></p>');
});

test('parse: leere oder fremde Datei liefert keine Vorlagen', () => {
  assert.deepEqual(parseSharedEmailTemplates('<html></html>').templates, []);
  assert.deepEqual(parseSharedEmailTemplates('').templates, []);
});

test('templateKey ignoriert Groß-/Kleinschreibung und Leerraum', () => {
  assert.equal(templateKey({ folder: ' A / B ', title: 'Titel ' }), templateKey({ folder: 'a / b', title: 'titel' }));
});
