# OHIF Viewer - CreateReport Integration Fork

> Fork von [OHIF Viewers](https://github.com/OHIF/Viewers) mit Integration für CreateReport

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/nq-igortoker/Viewers)

## Über diesen Fork

Dieser Fork des OHIF Viewers wurde erweitert für die nahtlose Integration mit [CreateReport](https://github.com/nq-igortoker/CreateReport), einer KI-gestützten radiologischen Befundungssoftware.

### Was ist neu?

- 🔗 **CreateReport Integration** - Direkter Handoff von Key-Images zu CreateReport
- 📤 **Inkrementelles Image-Sharing** - Mehrere Bilder einzeln sammeln und senden
- ⚙️ **Konfigurierbare Integration** - Via Environment Variables (Vercel-kompatibel)
- 🚀 **Vercel-optimiert** - Ready für Cloud Deployment
- 🔧 **Wartungsmodus-fähig** - Einfaches An/Ausschalten via Environment Variable (geplant)

---

## Quick Start

### Lokal starten

```bash
# Dependencies installieren
yarn install:frozen

# Dev-Server starten (Standard Port 3000)
yarn dev:fast

# Mit CreateReport Integration
CREATE_REPORT_BASE_URL=http://localhost:3001 yarn dev:fast

# Mit custom Port
OHIF_PORT=3001 yarn dev:fast
```

Der OHIF Viewer ist dann verfügbar unter: `http://localhost:3000`

### Auf Vercel deployen

1. **Repository zu Vercel verbinden**
   ```bash
   vercel
   ```

2. **Environment Variables setzen** (Vercel Dashboard)
   - Settings → Environment Variables
   - `CREATE_REPORT_BASE_URL`: Ihre CreateReport URL

3. **Deployen**
   ```bash
   vercel --prod
   ```

**Wichtig:** Environment Variable Änderungen erfordern ein Redeploy (~3-4 Minuten).

---

## CreateReport Integration

### Features

#### 1. Generate Report Button

Im OHIF Viewer Toolbar:
- Aktuellen Viewport als Key-Image erfassen
- Automatisch an CreateReport senden
- CreateReport Tab öffnet sich automatisch im `/handoff` Modus

#### 2. Inkrementeller Handoff (Issue #21)

- Sammeln mehrerer Key-Images (bis zu 10 pro Session)
- CreateReport Tab bleibt offen für weitere Images
- Manuelle Befunderstellung in CreateReport mit allen gesammelten Bildern
- Stateful: Tracking über Button-Klicks hinweg

#### 3. PostMessage API

Kommunikation zwischen OHIF und CreateReport via `postMessage`:
- `CR_READY` - CreateReport ist bereit
- `CR_ADD_IMAGE` - Image wird gesendet
- `CR_IMAGE_RECEIVED` - Image erfolgreich empfangen

### Workflow

```
User                OHIF Viewer           CreateReport
  |                      |                      |
  |-- Klick Button ---->|                      |
  |                      |-- window.open() --->|
  |                      |                      |
  |                      |<---- CR_READY ------|
  |                      |                      |
  |                      |--- CR_ADD_IMAGE ---->|
  |                      |                      |
  |                      |<- CR_IMAGE_RECEIVED -|
  |                      |                      |
  |-- Weitere Klicks -->|                      |
  |                      |--- CR_ADD_IMAGE ---->|
```

### Konfiguration

Siehe **[ENV_VARIABLES.md](ENV_VARIABLES.md)** für alle Environment Variables.

**Wichtigste Variables:**

| Variable | Beschreibung | Default | Erforderlich |
|----------|-------------|---------|--------------|
| `CREATE_REPORT_BASE_URL` | CreateReport URL | `http://localhost:3001` | Nein |
| `CREATE_REPORT_API_KEY` | API Key (optional) | - | Nein |
| `OHIF_PORT` | Dev-Server Port | `3000` | Nein |

---

## Unterschiede zum Original OHIF

### Neue Files

**Extensions:**
- `extensions/default/src/utils/createReportIncrementalHandoff.ts` - Handoff-Logik (Issue #21)
- `extensions/default/src/utils/handoffToCreateReport.ts` - Legacy Handoff (Issue #18)

**Commands:**
- `generateReport` Command in `extensions/default/src/commandsModule.ts`

### Geänderte Files

**Konfiguration:**
- `platform/app/public/config/default.js` - CreateReport Sektion hinzugefügt
- `platform/app/public/config/demo.js` - CreateReport Config für Vercel
- `rsbuild.config.ts` - Environment Variable Support

**Build:**
- `vercel.json` - Vercel Deployment Config

### Neue Documentation

- `ENV_VARIABLES.md` - Environment Variables Dokumentation
- `.env.example` - Template für lokale Entwicklung
- `OHIF-README.md` - Original OHIF Dokumentation

---

## Deployment

### Vercel (Empfohlen)

**Aktuell deployed:**
- Production: https://ohif-viewer-mu.vercel.app
- Alternative: https://ohif-viewer-neoq.vercel.app

**Setup:**

1. Repository mit Vercel verbinden
2. Environment Variables setzen:
   ```
   CREATE_REPORT_BASE_URL=https://dev-create-report.vercel.app
   ```
3. Deployen (automatisch bei Git Push)

**Wichtig:**
- Alle Environment Variables sind Build-Time Variables
- Änderungen erfordern Redeploy
- Build-Zeit: ~3-4 Minuten

### Docker

Siehe [OHIF-README.md#docker](OHIF-README.md#docker) für Docker Setup.

---

## Entwicklung

### Projekt-Struktur

```
OHIF-Viewers/
├── extensions/
│   └── default/
│       └── src/
│           ├── commandsModule.ts          # CreateReport Commands
│           └── utils/
│               ├── createReportIncrementalHandoff.ts  # Handoff Logic
│               └── handoffToCreateReport.ts          # Legacy
├── platform/
│   ├── app/
│   │   ├── public/
│   │   │   └── config/
│   │   │       ├── default.js            # CreateReport Config
│   │   │       └── demo.js               # Vercel Config
│   │   └── src/
│   │       ├── App.tsx                   # Main App
│   │       └── index.js                  # Entry Point
│   ├── core/                             # OHIF Core
│   └── ui/                               # UI Components
├── modes/                                # Viewer Modes
├── ENV_VARIABLES.md                      # Env Vars Doku
├── .env.example                          # Template
└── OHIF-README.md                        # Original OHIF Docs
```

### Wichtige Dateien (CreateReport)

| File | Beschreibung |
|------|-------------|
| `extensions/default/src/commandsModule.ts` | Commands (generateReport) |
| `extensions/default/src/utils/createReportIncrementalHandoff.ts` | Handoff-Logik |
| `platform/app/public/config/default.js` | CreateReport Config |
| `vercel.json` | Vercel Deployment Config |

### Development Commands

```bash
# Dev-Server
yarn dev:fast              # Port 3000
yarn dev                   # Webpack (langsamer)

# Build
yarn build                 # Production Build
yarn build:dev             # Development Build

# Tests
yarn test:unit             # Unit Tests
yarn test:e2e:ci           # E2E Tests
```

---

## Dokumentation

- **Environment Variables:** [ENV_VARIABLES.md](ENV_VARIABLES.md)
- **Original OHIF Docs:** [OHIF-README.md](OHIF-README.md)
- **OHIF Online Docs:** https://docs.ohif.org
- **CreateReport Repo:** https://github.com/nq-igortoker/CreateReport

---

## Troubleshooting

### CreateReport Handoff funktioniert nicht

**Check 1: Environment Variable**
```javascript
// Browser Console
console.log(window.env.CREATE_REPORT_BASE_URL)
```
Erwartung: Sollte Ihre CreateReport URL zeigen

**Check 2: Popup Blocker**
- Browser erlaubt Popups für diese Site?
- Console Check: "Popup was blocked by the browser"

**Check 3: CreateReport erreichbar?**
```bash
curl https://your-createreport-url.vercel.app
```

**Check 4: Redeploy nach Env Var Änderung?**
- Environment Variables sind Build-Time
- Nach Änderung: `vercel --prod`

Siehe [ENV_VARIABLES.md#troubleshooting](ENV_VARIABLES.md#troubleshooting) für mehr Details.

---

## Issues & Contributing

### CreateReport Integration Issues

Für Issues bezüglich der CreateReport Integration:
- **Dieses Repo:** https://github.com/nq-igortoker/Viewers/issues
- **CreateReport:** https://github.com/nq-igortoker/CreateReport/issues

### OHIF Core Issues

Für generelle OHIF Viewer Issues:
- **Original OHIF:** https://github.com/OHIF/Viewers/issues

---

## Upstream Sync

Um Updates vom Original OHIF zu holen:

```bash
# Upstream hinzufügen (einmalig)
git remote add upstream https://github.com/OHIF/Viewers.git

# Updates holen
git fetch upstream

# Merge (vorsichtig, könnte Konflikte geben)
git merge upstream/master

# Oder Rebase
git rebase upstream/master
```

**Wichtig:** Testen Sie nach Merge, ob CreateReport Integration noch funktioniert.

---

## Related Issues

**Implementiert:**
- ✅ Issue #17 - OHIF Erweiterung (Generate Report Button)
- ✅ Issue #18 - CreateReport Handoff (Auto-Open + Login)
- ✅ Issue #21 - Inkrementeller Image-Handoff

**Geplant:**
- 🔄 Issue #34 - Wartungsmodus Implementation

Siehe [CreateReport Issues](https://github.com/nq-igortoker/CreateReport/issues?q=label%3AOHIF)

---

## Lizenz

Apache 2.0 - Siehe [LICENSE](LICENSE)

Basierend auf [OHIF Viewers](https://github.com/OHIF/Viewers) © OHIF

---

## Related Projects

- **OHIF Viewers (Original):** https://github.com/OHIF/Viewers
- **CreateReport:** https://github.com/nq-igortoker/CreateReport
- **OHIF Platform:** https://ohif.org
- **OHIF Docs:** https://docs.ohif.org

---

## Kontakt

- **Issues:** https://github.com/nq-igortoker/Viewers/issues
- **CreateReport Issues:** https://github.com/nq-igortoker/CreateReport/issues
