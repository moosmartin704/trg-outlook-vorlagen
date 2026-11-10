// Erzeugt manifest.xml aus manifest.template.xml.
// Aufruf: node scripts/make-manifest.mjs https://<konto>.github.io/<repo>
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const base = (process.argv[2] || '').replace(/\/+$/, '');

if (!/^https:\/\/[^\s/]+(\/[^\s]*)?$/.test(base)) {
  console.error('Bitte die öffentliche HTTPS-Adresse angeben, z. B.:\n  node scripts/make-manifest.mjs https://meinkonto.github.io/trg-outlook-vorlagen');
  process.exit(1);
}

const xml = readFileSync(join(root, 'manifest.template.xml'), 'utf8').replaceAll('{{BASE_URL}}', base);
writeFileSync(join(root, 'manifest.xml'), xml);
console.log(`manifest.xml erzeugt für ${base}`);
