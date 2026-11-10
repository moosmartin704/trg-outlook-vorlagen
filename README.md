# TRG Vorlagen – Outlook-Add-in

Gemeinsame E-Mail-Vorlagen für Outlook (Windows, Mac, neues Outlook, Outlook im Web). Die Vorlagen liegen in Firebase (Firestore) und sind für alle berechtigten Konten und Postfächer gleich. Das Add-in selbst ist eine statische Webseite, die auf GitHub Pages läuft.

## Was es kann

- Vorlagen suchen, nach Ordner filtern, mit einem Klick in die Nachricht einfügen (formatiert, an der Cursorposition).
- Platzhalter: `{{Name}}`, `{{Vorname}}`, `{{Nachname}}` (vom ersten Empfänger), `{{Betreff}}`, `{{MeinName}}`, `{{Datum}}`. Nicht auflösbare Platzhalter bleiben stehen und werden gelb markiert.
- Optionaler Betreff je Vorlage; er wird nur gesetzt, wenn der Betreff der Nachricht noch leer ist.
- Vorlagen im Add-in anlegen, ändern, löschen (Anmeldung nötig).

Ohne Firebase-Konfiguration läuft das Add-in schreibgeschützt mit `templates.json`.

## Einrichtung in sechs Schritten

### 1. Firebase

1. [console.firebase.google.com](https://console.firebase.google.com) → **Projekt hinzufügen**, Name z. B. `trg-vorlagen` (neues, eigenes Projekt, nicht das des CRM). Google Analytics ausschalten.
2. **Build → Firestore Database → Datenbank erstellen**, Standort `eur3 (Europe)`, **Produktionsmodus**.
3. **Build → Authentication → Los geht's → E-Mail/Passwort** aktivieren. Unter **Users → Nutzer hinzufügen** die beiden Konten mit euren `@trg-gmbh.de`-Adressen und je einem Passwort anlegen. Danach unter **Settings → User actions** die Option „Enable create (sign-up)“ ausschalten, falls sie angeboten wird.
4. **Authentication → Settings → Authorized domains → Domain hinzufügen**: `<dein-github-konto>.github.io`.
5. **Firestore → Regeln**: Inhalt von `firestore.rules` einfügen, die beiden Beispieladressen durch eure echten ersetzen, **Veröffentlichen**.
6. **Projekteinstellungen (Zahnrad) → Deine Apps → Web-App (`</>`) registrieren**. Die angezeigte `firebaseConfig` in `src/config.js` eintragen (`export const firebaseConfig = { … }`). Diese Werte sind nicht geheim.

### 2. GitHub Pages

1. Neues **öffentliches** Repository anlegen (private Pages brauchen einen bezahlten Tarif), z. B. `trg-outlook-vorlagen`. Hier liegt nur Programmcode, keine Vorlagen.
2. Diesen Ordner dorthin pushen.
3. Repository → **Settings → Pages → Deploy from a branch → `main` / `/ (root)`**. Nach ein bis zwei Minuten ist die Seite unter `https://<konto>.github.io/<repo>/taskpane.html` erreichbar.

### 3. Manifest erzeugen

```bash
node scripts/make-manifest.mjs https://<konto>.github.io/<repo>
```

`manifest.xml` einchecken und pushen.

### 4. In Outlook installieren

**Für alle zentral (empfohlen):** [admin.microsoft.com](https://admin.microsoft.com) → **Einstellungen → Integrierte Apps → Benutzerdefinierte Apps hochladen** → `manifest.xml` wählen → Benutzer festlegen (ihr zwei) → bereitstellen. Es kann bis zu einigen Stunden dauern, bis Outlook das Add-in zeigt.

**Nur für dich zum Testen:** Outlook im Web → neue Nachricht → `…` → **Apps** → **Add-Ins verwalten** → **Meine Add-Ins → Benutzerdefinierte Add-Ins → Aus Datei hinzufügen**.

### 5. Erster Start

Neue Nachricht öffnen → Schaltfläche **Vorlagen** (Gruppe „TRG“) → anmelden. Bei leerer Datenbank erscheint **Beispielvorlagen anlegen**.

## Lokal testen

```bash
npm test               # Platzhalter- und Outlook-Brücke-Tests
node scripts/serve.mjs # http://localhost:5174/ – im Browser läuft ein Testmodus mit Beispielempfänger
```

Im Browser fügt ein Klick den Text in die Zwischenablage ein, weil es dort keine Nachricht gibt.

## Aufbau

| Datei | Zweck |
|---|---|
| `manifest.template.xml` / `manifest.xml` | Beschreibung des Add-ins für Outlook |
| `taskpane.html`, `src/app.js`, `src/styles.css` | Oberfläche |
| `src/placeholders.js` | Platzhalter und Namenserkennung |
| `src/host.js` | Zugriff auf die Outlook-Nachricht (Office.js) |
| `src/store.js` | Speicher: Firestore oder `templates.json` |
| `src/config.js` | Firebase-Konfiguration |
| `firestore.rules` | Zugriffsregeln für die Datenbank |

## Hinweise

- **Datenschutz:** Die Vorlagentexte liegen nur in Firestore, nicht im Repository. Im öffentlichen Repo stehen nur Code und die Beispiel-`templates.json`.
- **Zugriff:** Die Regeln erlauben nur die in `firestore.rules` genannten Adressen. Eine feste Liste ist sicherer als „alle @trg-gmbh.de“, weil sich sonst jemand mit dem öffentlichen API-Schlüssel selbst ein Konto anlegen könnte.
- **Mehrere Empfänger:** Namensplatzhalter beziehen sich auf den ersten Empfänger im „An“-Feld.
- **Änderungen am Code:** Nach einem Push aktualisiert GitHub Pages die Seite automatisch. Outlook lädt sie beim nächsten Öffnen der Seitenleiste neu, das Manifest muss dafür nicht neu hochgeladen werden.
