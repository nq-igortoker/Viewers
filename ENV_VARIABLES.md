# Environment Variables

## Überblick

OHIF Viewer nutzt Environment Variables für die Konfiguration verschiedener Integrationen und Deployment-Einstellungen.

**Wichtig:** Alle Environment Variables für Vercel Deployments sind **Build-Time Variables**. Das bedeutet:
- Sie werden während des Build-Prozesses in den Code injiziert
- Änderungen erfordern ein **Redeploy** (~3-4 Minuten)
- Sie sind nicht zur Laufzeit änderbar

---

## CreateReport Integration

### CREATE_REPORT_BASE_URL

**Beschreibung:** URL der CreateReport Instanz für OHIF Handoff

**Typ:** Build-Time (Vercel) / Runtime (Dev-Server)  
**Default:** `http://localhost:3001`  
**Erforderlich:** Nein  
**Format:** URL ohne trailing slash

**Beispiele:**
```bash
# Lokale Entwicklung
CREATE_REPORT_BASE_URL=http://localhost:3001

# Development auf Vercel
CREATE_REPORT_BASE_URL=https://dev-create-report.vercel.app

# Production
CREATE_REPORT_BASE_URL=https://create-report.vercel.app
```

**Verwendung lokal:**
```bash
CREATE_REPORT_BASE_URL=http://localhost:3001 yarn dev:fast
```

**Verwendung Vercel:**
1. Dashboard → Settings → Environment Variables
2. Name: `CREATE_REPORT_BASE_URL`
3. Value: `https://your-createreport-url.vercel.app`
4. Environments: Production, Preview, Development
5. **Redeploy erforderlich!**

**Wo wird es verwendet:**
- `platform/app/public/config/default.js` - Config Objekt
- `platform/app/public/html-templates/index.html` - Injection ins HTML
- `extensions/default/src/utils/createReportIncrementalHandoff.ts` - Handoff URL

**Code-Referenz:**
```javascript
// In config/default.js
createReport: {
  baseUrl: (function() {
    if (typeof window !== 'undefined' && window.env && window.env.CREATE_REPORT_BASE_URL) {
      return window.env.CREATE_REPORT_BASE_URL;
    }
    return 'http://localhost:3001';
  })(),
}

// In createReportIncrementalHandoff.ts
const handoffUrl = `${baseUrl}/handoff`;
```

---

### CREATE_REPORT_API_KEY

**Beschreibung:** API Key für CreateReport Authentication

**Typ:** Build-Time (Vercel) / Runtime (Dev-Server)  
**Default:** `''` (leer)  
**Erforderlich:** Nein (abhängig von CreateReport Setup)  
**Format:** String

**Verwendung lokal:**
```bash
CREATE_REPORT_API_KEY=your-secret-api-key yarn dev:fast
```

**Verwendung Vercel:**
1. Dashboard → Settings → Environment Variables
2. Name: `CREATE_REPORT_API_KEY`
3. Value: `your-secret-api-key`
4. Environments: Production, Preview, Development (je nach Bedarf)
5. **Redeploy erforderlich!**

**Wichtig:**
- Sensible Daten! Nicht in Code committen
- Nur setzen wenn CreateReport Authentication erfordert
- Derzeit nicht aktiv genutzt (für zukünftige Features reserviert)

**Wo wird es verwendet:**
- `platform/app/public/config/default.js` - Config Objekt
- `platform/app/public/html-templates/index.html` - Injection ins HTML

---

## OHIF Konfiguration

### OHIF_PORT

**Beschreibung:** Port auf dem der Dev-Server läuft

**Typ:** Runtime (nur Dev-Server, nicht Vercel)  
**Default:** `3000`  
**Erforderlich:** Nein  
**Format:** Number (1024-65535)

**Verwendung:**
```bash
# Standard Port 3000
yarn dev:fast

# Custom Port
OHIF_PORT=3001 yarn dev:fast
OHIF_PORT=8080 yarn dev:fast
```

**Warum ändern?**
- Port 3000 ist bereits belegt
- Mehrere OHIF Instanzen gleichzeitig laufen lassen
- Corporate Proxy-Einstellungen

**Wo wird es verwendet:**
- `.webpack/webpack.pwa.js` - Webpack Dev Server Port
- `rsbuild.config.ts` - Rsbuild Dev Server Port

**Code-Referenz:**
```javascript
// In rsbuild.config.ts
const OHIF_PORT = Number(process.env.OHIF_PORT || 3000);

server: {
  port: OHIF_PORT,
}
```

---

### OHIF_OPEN

**Beschreibung:** Browser automatisch öffnen beim Dev-Server Start

**Typ:** Runtime (nur Dev-Server)  
**Default:** `true`  
**Erforderlich:** Nein  
**Format:** Boolean (`'true'` / `'false'`)

**Verwendung:**
```bash
# Browser nicht öffnen
OHIF_OPEN=false yarn dev:fast

# Browser öffnen (Standard)
OHIF_OPEN=true yarn dev:fast
# oder einfach
yarn dev:fast
```

**Warum deaktivieren?**
- CI/CD Pipelines
- Remote Development
- Mehrere Dev-Server gleichzeitig

**Wo wird es verwendet:**
- `rsbuild.config.ts` - Rsbuild Dev Server Config

**Code-Referenz:**
```javascript
const OHIF_OPEN = process.env.OHIF_OPEN !== 'false';

server: {
  open: OHIF_OPEN,
}
```

---

## Zukünftige Variables (Geplant)

### MAINTENANCE_MODE

**Status:** 🔄 In Planung (Issue #34)

**Beschreibung:** Wartungsmodus aktivieren/deaktivieren

**Typ:** Build-Time  
**Default:** `false`  
**Format:** Boolean (`'true'` / `'false'`)

**Geplante Verwendung:**
```bash
# Vercel Dashboard
MAINTENANCE_MODE=true  # Zeigt Wartungsseite
MAINTENANCE_MODE=false # OHIF läuft normal
```

**Wichtig:** Auch diese Variable würde Redeploy erfordern.

---

## Setup-Guides

### Lokale Entwicklung

#### Option 1: Direkt in Command

```bash
CREATE_REPORT_BASE_URL=http://localhost:3001 yarn dev:fast
```

#### Option 2: .env.local Datei (Empfohlen)

1. Kopieren Sie `.env.example`:
   ```bash
   cp .env.example .env.local
   ```

2. Editieren Sie `.env.local`:
   ```bash
   CREATE_REPORT_BASE_URL=http://localhost:3001
   CREATE_REPORT_API_KEY=
   OHIF_PORT=3000
   OHIF_OPEN=true
   ```

3. Starten Sie den Dev-Server:
   ```bash
   yarn dev:fast
   ```

**Wichtig:** `.env.local` ist in `.gitignore` und wird nicht committet.

---

### Vercel Deployment

#### Initiales Setup

1. **Repository mit Vercel verbinden**
   ```bash
   vercel
   ```

2. **Environment Variables setzen**
   - Gehen Sie zu: https://vercel.com/dashboard
   - Wählen Sie Ihr Projekt
   - Settings → Environment Variables

3. **Hinzufügen:**
   
   **CREATE_REPORT_BASE_URL:**
   - Name: `CREATE_REPORT_BASE_URL`
   - Value: `https://dev-create-report.vercel.app`
   - Environments: ✅ Production, ✅ Preview, ✅ Development
   - Save

   **CREATE_REPORT_API_KEY (optional):**
   - Name: `CREATE_REPORT_API_KEY`
   - Value: `your-api-key`
   - Environments: ✅ Production (Preview & Dev nach Bedarf)
   - Save

4. **Deployment**
   ```bash
   vercel --prod
   ```

#### Variables ändern

1. **In Vercel Dashboard ändern**
   - Settings → Environment Variables
   - Edit → Neuer Wert → Save

2. **Redeploy triggern** ⚠️ **ERFORDERLICH**
   
   **Option A: Automatisch**
   - Neuen Commit pushen
   - Vercel deployt automatisch

   **Option B: Manuell**
   ```bash
   vercel --prod
   ```

   **Option C: Vercel Dashboard**
   - Deployments → "..." → Redeploy

**Wichtig:** Änderungen sind erst nach Redeploy aktiv!

---

## Build-Time vs Runtime

### Build-Time Variables (Vercel Deployments)

**Was sind Build-Time Variables?**
- Werden während des Build-Prozesses in Code injiziert
- Werden "in den Code gebacken"
- Sind im Browser als `window.env.*` verfügbar
- **Änderungen erfordern Redeploy**

**Alle Vercel Variables sind Build-Time:**
- `CREATE_REPORT_BASE_URL`
- `CREATE_REPORT_API_KEY`
- `MAINTENANCE_MODE` (geplant)
- `CREATE_REPORT_HANDOFF_PATH` (geplant)

**Prozess:**
```
Build-Zeit:
  Env Var → HTML Template → Gebauter HTML Code

Browser:
  HTML lädt → window.env.CREATE_REPORT_BASE_URL vorhanden
```

**Beispiel:**
```html
<!-- Template: index.html -->
<script>
  window.env.CREATE_REPORT_BASE_URL = '<%= CREATE_REPORT_BASE_URL %>';
</script>

<!-- Nach Build: -->
<script>
  window.env.CREATE_REPORT_BASE_URL = 'https://dev-create-report.vercel.app';
</script>
```

---

### Runtime Variables (Dev-Server)

**Was sind Runtime Variables?**
- Werden zur Laufzeit gelesen
- **Sofort wirksam** bei Neustart
- Kein Build erforderlich

**Runtime Variables (nur Dev-Server):**
- `OHIF_PORT`
- `OHIF_OPEN`

**Prozess:**
```
Dev-Server Start:
  Env Var → Server Config → Server startet
```

---

## Troubleshooting

### Problem: Variable funktioniert nicht nach Änderung

**Symptom:**
- Environment Variable in Vercel geändert
- OHIF nutzt noch den alten Wert

**Ursache:**
- Build-Time Variable
- Kein Redeploy durchgeführt

**Lösung:**
```bash
# Manuelles Redeploy
vercel --prod

# Oder: Git Commit pushen (automatisches Redeploy)
git commit --allow-empty -m "Trigger redeploy"
git push
```

---

### Problem: CreateReport Handoff funktioniert nicht

**Check 1: Ist Variable gesetzt?**
```javascript
// Browser Console öffnen (F12)
console.log(window.env)
console.log(window.env.CREATE_REPORT_BASE_URL)
```

**Erwartung:**
```javascript
{
  CREATE_REPORT_BASE_URL: 'https://dev-create-report.vercel.app',
  CREATE_REPORT_API_KEY: ''
}
```

**Falls `undefined`:**
- Variable nicht in Vercel gesetzt
- Oder: Redeploy fehlt nach Änderung

---

**Check 2: Ist CreateReport erreichbar?**
```bash
curl https://dev-create-report.vercel.app
# Erwartung: HTML response (nicht 404)

curl https://dev-create-report.vercel.app/handoff
# Erwartung: Handoff page HTML
```

**Falls 404:**
- URL falsch
- CreateReport nicht deployed
- CORS Problem

---

**Check 3: Popup Blocker?**

Browser Console Check:
```
❌ Popup was blocked by the browser
```

**Lösung:**
- Browser Settings → Popups für diese Site erlauben
- Oder: Klick im Popup-Warning auf "Allow"

---

**Check 4: Network Errors?**

Browser DevTools → Network Tab:
- Suche nach `/handoff` Request
- Status Code prüfen (sollte 200 sein)
- CORS Errors?

---

### Problem: Port bereits belegt

**Symptom:**
```
Error: listen EADDRINUSE: address already in use :::3000
```

**Lösung:**
```bash
# Anderen Port verwenden
OHIF_PORT=3001 yarn dev:fast

# Oder: Bestehenden Prozess beenden
lsof -ti:3000 | xargs kill -9
```

---

### Problem: .env.local wird nicht geladen

**Wichtig:** `.env.local` wird **nur im Dev-Server** gelesen.

**Funktioniert:**
```bash
# rsbuild liest .env.local automatisch
yarn dev:fast
```

**Funktioniert NICHT:**
```bash
# webpack liest .env.local NICHT automatisch
yarn dev
```

**Workaround für webpack:**
```bash
# Explizit setzen
CREATE_REPORT_BASE_URL=http://localhost:3001 yarn dev
```

---

## Best Practices

### Security

**Sensible Daten:**
- ✅ Nutzen Sie Environment Variables für API Keys
- ❌ Committen Sie NIEMALS API Keys in Code
- ✅ `.env.local` ist in `.gitignore`
- ✅ `.env.example` hat nur Platzhalter

**Vercel:**
- ✅ Setzen Sie sensible Daten nur für Production
- ✅ Nutzen Sie verschiedene Keys für Dev/Prod
- ❌ Sharen Sie Vercel Environment Variables nicht öffentlich

---

### Wartbarkeit

**Dokumentation:**
- ✅ Neue Variables in diese Datei dokumentieren
- ✅ Default-Werte immer angeben
- ✅ Beispiele für gültige Werte

**Naming:**
- ✅ Prefix für Gruppierung (`CREATE_REPORT_*`, `OHIF_*`)
- ✅ Beschreibende Namen
- ✅ Konsistente Schreibweise (UPPERCASE_WITH_UNDERSCORES)

---

## Cheat Sheet

### Häufige Commands

```bash
# Dev-Server mit allen Settings
CREATE_REPORT_BASE_URL=http://localhost:3001 \
OHIF_PORT=3000 \
OHIF_OPEN=true \
yarn dev:fast

# Production Build lokal testen
yarn build
npx serve -s platform/app/dist

# Vercel Deployment
vercel --prod

# Env Vars in Vercel anzeigen
vercel env ls

# Env Var in Vercel setzen
vercel env add CREATE_REPORT_BASE_URL
```

---

### Quick Reference

| Variable | Typ | Default | Redeploy? |
|----------|-----|---------|-----------|
| `CREATE_REPORT_BASE_URL` | Build-Time | `http://localhost:3001` | ✅ Ja |
| `CREATE_REPORT_API_KEY` | Build-Time | `''` | ✅ Ja |
| `OHIF_PORT` | Runtime | `3000` | ❌ Nein |
| `OHIF_OPEN` | Runtime | `true` | ❌ Nein |

---

## Referenzen

- **Vercel Env Vars Docs:** https://vercel.com/docs/environment-variables
- **OHIF Configuration:** https://docs.ohif.org/configuration/
- **CreateReport Repo:** https://github.com/nq-igortoker/CreateReport
- **Issue #34 (Maintenance Mode):** https://github.com/nq-igortoker/CreateReport/issues/34
