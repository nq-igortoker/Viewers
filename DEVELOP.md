# Entwicklungs-Tagebuch: OHIF → CreateReport Integration

> **Projekt:** Integration von OHIF Medical Imaging Viewer mit CreateReport (AI-powered radiology report generator)
> **Repository:** [nq-igortoker/CreateReport](https://github.com/nq-igortoker/CreateReport)
> **OHIF Fork:** [nq-igortoker/Viewers](https://github.com/nq-igortoker/Viewers)
> **Baseline Commit:** `a51552a2e` (branch: `master`)

---

## 📋 Epic #10: OHIF (Local File Mode) → CreateReport (Key Images per Button)

**Status:** 🟡 In Progress
**Epic Issue:** [#10](https://github.com/nq-igortoker/CreateReport/issues/10)

### Ziel (kleinstes funktionsfähiges PoC)
Radiolog:innen öffnen eine Studie in einem echten Viewer (OHIF), erstellen/zeigen **1–5 (max. 10)** Schlüsselbilder und triggern per Button unsere CreateReport-Pipeline.

**Ergebnis:** CreateReport öffnet sich (Login wie bisher) und generiert automatisch einen strukturierten Befund.

---

## 🎯 Phase 1: OHIF Local File Mode → PNG/JPG → CreateReport

**Fokus:** End-to-End Demo-Flow, ohne PACS/DICOMweb-Backend (Orthanc) und ohne Persistenz/Job-System.

### Workflow
1. OHIF läuft im **Local File Mode** (Demo-DICOMs lokal laden)
2. Custom Toolbar-Button `Generate Report` in OHIF
3. Button exportiert **1–5 (max. 10)** relevante Bilder als **gerenderte Viewports** (PNG/JPG, Canvas → Blob)
4. Button startet Handoff zu CreateReport:
   - öffnet CreateReport in neuem Tab/Fenster
   - übergibt die Images per HTTP POST (multipart/FormData) an die bestehende Report-API
   - optional: Übergabe des fertigen Reports an das neue Fenster via `window.postMessage` (kein Job/DB nötig)

### Tracking

- [x] **#16** - OHIF Setup: Local File Mode ✅ **ABGESCHLOSSEN**
- [x] **#17** - OHIF Erweiterung: Generate Report Button + PNG/JPG Upload ✅ **ABGESCHLOSSEN** (2025-01-07) - **GETESTET & FUNKTIONSFÄHIG**
- [x] **#18** - CreateReport Handoff: Auto-Open + Login + Report anzeigen ✅ **ABGESCHLOSSEN** (2025-01-08) - **LEGACY** (ersetzt durch #21)
- [x] **#20** - OHIF → CreateReport: Inkrementelles Key-Image Sammeln (CreateReport-Seite) 🟡 **IN PROGRESS**
- [x] **#21** - OHIF: bestehenden Toolbar-Button wiederverwenden → inkrementell Key-Images senden ✅ **ABGESCHLOSSEN** (2026-01-08) - **IMPLEMENTIERT**

---

## 📝 Issue Details

### Issue #16: OHIF Setup (Local File Mode) ✅
**Status:** CLOSED
**Link:** [#16](https://github.com/nq-igortoker/CreateReport/issues/16)

**Ziel:** Reproduzierbare OHIF-Instanz im Local File Mode bereitstellen.

**Setup:**
- **Lokaler Pfad:** `/Users/igor/Code/OHIF-Viewers`
- **Baseline:** `a51552a2e`
- **Node.js:** >= 18
- **Yarn:** >= 1.20

**Commands:**
```bash
yarn install:frozen
yarn dev
```

**Local Mode URLs:**
- `http://localhost:3000/local` (Worklist-Flow)
- `http://localhost:3000/localbasic` (direkt in `viewer/dicomlocal`)

**Akzeptanzkriterien:** ✅
- OHIF kann in <10 Minuten gestartet werden
- Lokale Demo-Study kann geöffnet und durchgescrollt werden

---

### Issue #17: OHIF Erweiterung (Generate Report Button + PNG Upload) ✅
**Status:** CLOSED
**Link:** [#17](https://github.com/nq-igortoker/CreateReport/issues/17)

**Ziel:** Toolbar-Button `Generate Report` + Export von Viewports als PNG/JPG + Upload an CreateReport.

#### Anforderungen

1. **Toolbar-Button:** `Generate Report`
2. **Export:** Viewport → PNG/JPG (Canvas → Blob → File), **1–10** Images
3. **Request:** `multipart/form-data`
   - `images[]` (Files)
   - optional `selectedLanguage` (ISO 639-1, z. B. `en`, `de`, ...)
4. **Ergonomie:** klare UX (Disabled-State während Export/Upload, kurzer Erfolg/Fehler-Toast)

#### Tasks

1. **OHIF Extension/Mode Setup**
   - geeigneten Extension-Point wählen (Toolbar/Commands)
   - Button in Toolbar integrieren

2. **Viewport Export**
   - aktiven Viewport (und optional weitere Viewports) als PNG/JPG extrahieren
   - Limitierung auf max. 10 Images
   - optional: Downscale/Compression-Strategie festlegen (nur falls nötig)

3. **Upload zu CreateReport**
   - `FormData` bauen: `images[]`, optional `selectedLanguage`
   - `fetch` POST auf CreateReport Endpoint (für PoC zunächst `/api/generate-report`)
   - Fehler-/Timeout-Handling

4. **Konfigurierbarkeit**
   - CreateReport Base URL als Config/Env für OHIF
   - optional: Default-Language

#### Akzeptanzkriterien
- [x] In OHIF ist der Toolbar-Button sichtbar ✅ **GETESTET**
- [x] Klick exportiert aktiven Viewport als JPG ✅ **GETESTET** (54KB JPG erstellt)
- [x] Upload per multipart/FormData funktioniert (`images[]` wird serverseitig empfangen) ✅ **GETESTET** (Mock-Server bestätigt)
- [x] Optionales `selectedLanguage` wird mitgesendet ✅ **GETESTET** (Language: 'en' übertragen)

**Implementierungsdetails:**
- Button-ID: `GenerateReport`
- Icon: `tool-generate-report` (Custom "R" Icon)
- Command: `generateReport`
- Position: Primary Toolbar (zwischen Capture und Layout)
- Export: Nutzt `html2canvas` für Viewport-Capture
- Format: JPG mit 0.9 Qualität
- Fehlerhandling: Try-Catch mit detaillierten Toast-Notifications
- Timeout: 60 Sekunden für Upload
- **Status:** ✅ Vollständig implementiert und getestet

---

### Issue #18: CreateReport Handoff (Auto-Open + Login + Report anzeigen) ✅
**Status:** CLOSED (OHIF-Seite implementiert)
**Link:** [#18](https://github.com/nq-igortoker/CreateReport/issues/18)

**Ziel:** CreateReport öffnet sich automatisch, Login erfolgt, Report wird angezeigt.

#### Implementierung (OHIF-Seite) ✅

**Gewählte Option:** Option C (Hybrid) - `postMessage` mit Report-Daten

**Flow:**
1. Button-Klick → `window.open('/handoff')` (synchron, vor async Operationen)
2. Viewport als JPG exportieren
3. API-Call an `/api/generate-report` (mit 5 Min Timeout für KI-Generierung)
4. Warten auf `CR_READY` Message (optional, mit Timeout)
5. Report via `postMessage(CR_HANDOFF_REPORT)` an CreateReport senden

**Implementierte Dateien:**
- `extensions/default/src/utils/handoffToCreateReport.ts` (NEU)
  - `waitForReady()` - Wartet auf CR_READY Message
  - `uploadAndGenerateReport()` - API-Call mit Report-Rückgabe
  - `sendReportToCreateReport()` - postMessage an CreateReport
  - `handoffToCreateReport()` - Orchestriert gesamten Flow
- `extensions/default/src/commandsModule.ts` (ANGEPASST)
  - `generateReport` Command nutzt jetzt Handoff-Flow

**Message-Protokoll:**
```typescript
// CreateReport → OHIF (optional)
{ type: 'CR_READY' }

// OHIF → CreateReport
{ type: 'CR_HANDOFF_REPORT', report: string, conversations?: array, selectedLanguage?: string }
```

**Technische Details:**
- Popup-Blocker: `window.open()` wird SYNCHRON im Click-Handler aufgerufen
- Timeout: 5 Minuten für API-Call (KI-Befund-Generierung)
- Origin-Validierung: postMessage nur an konfigurierte baseUrl
- Fehlerbehandlung: Tab wird bei Fehler automatisch geschlossen

#### Akzeptanzkriterien (OHIF-Seite)
- [x] Nach Button-Klick öffnet sich CreateReport in neuem Tab (`/handoff`)
- [x] Viewport wird als JPG exportiert und an API gesendet
- [x] Report wird via postMessage an CreateReport gesendet
- [x] Popup-Blocker wird erkannt und User informiert
- [x] Fehler werden sauber behandelt (Tab schließen, Toast anzeigen)

#### Voraussetzungen (CreateReport-Seite)
- [ ] `/handoff` Route muss existieren
- [ ] Route muss auf `CR_HANDOFF_REPORT` Message hören
- [ ] Route muss Auto-Login durchführen
- [ ] Route muss Report anzeigen

---

## 🔧 Technische Herausforderungen

### 1. Viewport Export
- Canvas → PNG/JPG aus OHIF/Cornerstone3D Viewports extrahieren
- Mehrere Viewports gleichzeitig exportieren (1–10)
- Performance bei mehreren großen Bildern

### 2. CORS
- CreateReport API muss Requests von OHIF-Domain erlauben
- Konfiguration auf CreateReport-Seite notwendig

### 3. Session/Auth
- Token/Session zwischen Tab-Fenstern teilen
- Auto-Login mit fixed credentials für Demo

### 4. State Management
- Report-State in CreateReport setzen (wie nach normalem Upload)
- Synchronisation zwischen OHIF und CreateReport

### 5. Pop-up Blocker
- Handling wenn CreateReport in neuem Tab öffnet
- User-Experience bei blockierten Pop-ups

---

## 📦 Bestehende OHIF CreateReport-Funktionalität

Das OHIF-Projekt hat bereits eine Basis-Implementierung für Report-Erstellung:

### Wichtige Dateien

- `extensions/default/src/Panels/createReportDialogPrompt.tsx`
  - Dialog zum Erstellen von Reports
  - Unterstützt verschiedene Modalities (SR, SEG, RTSTRUCT)
  - Series-Auswahl und DataSource-Konfiguration

- `extensions/default/src/Actions/createReportAsync.tsx`
  - Asynchrones Erstellen/Speichern von Reports
  - Integration mit DicomMetadataStore
  - Notification-Handling

- `extensions/default/src/customizations/reportDialogCustomization.tsx`
  - UI-Komponente für den Report-Dialog
  - React-Komponente mit InputDialog und Select

- `extensions/default/src/utils/promptSaveReport.tsx`
  - Speichern von Messungen als DICOM SR
  - Integration mit MeasurementService

### Unterschied zu unserem Use Case

Die bestehende Implementierung:
- Fokussiert auf **DICOM SR (Structured Report)** Export
- Speichert Messungen/Annotations als DICOM-Format
- Integriert mit DICOMweb/PACS-Backend

Unser Use Case:
- Exportiert **Viewport-Screenshots** als PNG/JPG
- Sendet an externe CreateReport-API (nicht DICOM)
- Fokus auf Demo/Prototyping (Local File Mode)

**→ Wir müssen eine neue Extension/Command erstellen, die Viewport-Export und externen Upload implementiert.**

---

## 🧪 Testing Guide (Issue #17)

### Voraussetzungen für manuellen Test
1. OHIF läuft lokal: `yarn dev` (Port 3000)
2. CreateReport API läuft und ist erreichbar (Config: `window.config.createReport.baseUrl`)
3. CORS ist korrekt konfiguriert (CreateReport muss Requests von localhost:3000 akzeptieren)

### Test-Schritte
1. **OHIF starten**
   ```bash
   cd /Users/igor/Code/OHIF-Viewers
   yarn dev
   ```

2. **Local Mode öffnen**
   - Browser: `http://localhost:3000/local` oder `http://localhost:3000/localbasic`
   - Demo-Study laden (Drag & Drop DICOM Dateien)

3. **Generate Report Button testen**
   - Viewport aktiv machen (darauf klicken)
   - Button "Generate Report" in Toolbar finden und klicken
   - Erwartete Toast-Sequenz:
     1. "Exporting viewport image..." (Info)
     2. "Uploading to CreateReport..." (Info)
     3. "Report generation initiated successfully!" (Success)
   - **Bei Fehler:** Fehlermeldung in Toast prüfen

4. **Network Tab prüfen**
   - Browser DevTools → Network Tab öffnen
   - Nach Button-Klick: `POST` Request zu `<baseUrl>/api/generate-report`
   - Request Type: `multipart/form-data`
   - Payload sollte enthalten:
     - `images[]`: JPG File
     - `selectedLanguage`: 'en' (oder konfigurierter Wert)

5. **Troubleshooting**
   - **Button nicht sichtbar:** Prüfe ob basic mode geladen ist
   - **CORS Error:** CreateReport muss `Access-Control-Allow-Origin: http://localhost:3000` Header senden
   - **Config Error:** Prüfe `window.config.createReport.baseUrl` in Browser Console
   - **Timeout:** Upload dauert >60s → CreateReport API Performance prüfen

### Erwartetes Verhalten
- ✅ Button ist in Toolbar sichtbar (zwischen Capture und Layout)
- ✅ Klick exportiert aktiven Viewport als JPG
- ✅ Upload erfolgt an CreateReport API
- ✅ Toasts zeigen Fortschritt/Status
- ✅ Fehler werden sauber behandelt

## 🚀 Nächste Schritte

### Issue #21 (OHIF → Inkrementeller Image-Handoff) ✅
1. [x] Neue Utility für inkrementelles Senden (`createReportIncrementalHandoff.ts`) ✅
2. [x] Viewport Export auf ArrayBuffer umstellen (`exportViewportToImagePayload`) ✅
3. [x] Command `generateReport` auf neuen Flow umbauen ✅
4. [x] Tab-Reuse + Max-10 Limit + Popup-Handling ✅
5. [x] Dokumentation aktualisieren ✅

### CreateReport-Seite (Issue #20)
1. [ ] `/handoff` Route: `CR_ADD_IMAGE` Message empfangen
2. [ ] Bilder in Images-Liste anzeigen (wie manueller Upload)
3. [ ] Origin-Whitelist: `ALLOWED_ORIGINS` konfigurieren
4. [ ] Auto-Login für OHIF-Flow
5. [ ] `CR_READY` Message bei Page-Load senden

### Abgeschlossen (Legacy)
- [x] **Issue #17:** Generate Report Button + Upload ✅
- [x] **Issue #18:** Handoff-Flow (Legacy, ersetzt durch #21) ✅

### Demo-Vorbereitung
1. [ ] Demo-Daten: 1–2 anonymisierte Demo-Studien (CT/MRT) definieren
2. [ ] Dokumentation: Demo-Guide erstellen
3. [ ] Troubleshooting: CORS, Pop-up Blocker, Origin-Whitelist dokumentieren

---

## 📚 Phase 2 (später): Orthanc + DICOMweb

- Orthanc als DICOM/DICOMweb-Backend hinzufügen
- OHIF Studien wie im PACS laden können
- Optionaler Upgrade-Pfad: Übergabe via UIDs/KOS + DICOMweb Fetch statt Screenshots (production-näher)

---

## 🎯 Akzeptanzkriterien (Phase 1 - Gesamt)

- [x] In OHIF kann eine lokale Demo-Study geöffnet werden ✅
- [x] Ein Klick auf `Generate Report` sendet **1** Viewport-Image (aktuell aktiver) an CreateReport ✅ **Issue #21 IMPLEMENTIERT**
- [x] Mehrere Klicks senden Images inkrementell (max 10) ✅ **Issue #21 IMPLEMENTIERT**
- [ ] CreateReport sammelt die Bilder und User generiert Report manuell (Issue #20)
- [ ] Der Flow ist dokumentiert und in <10 Minuten für Dritte reproduzierbar

---

## 📝 Notizen & Erkenntnisse

### 2025-01-07: Issue #17 Implementierung abgeschlossen & getestet ✅

**Implementierung:**
- **Generate Report Button** implementiert und zur Toolbar hinzugefügt
- **Command `generateReport`** in extensions/default/src/commandsModule.ts registriert
- **Viewport Export Utility** (`exportViewportToJpg.ts`) erstellt - exportiert aktiven Viewport als JPG mit Qualität 0.9
- **Upload Utility** (`uploadToCreateReport.ts`) erstellt - sendet Bilder via multipart/FormData mit 60s Timeout
- **Konfiguration** in `default.js` und `local_static.js` hinzugefügt: `window.config.createReport` mit baseUrl und selectedLanguage
- **Toolbar Button** in basic mode eingebunden - erscheint zwischen Capture und Layout
- **Custom Icon:** "R" Icon (`tool-generate-report`) erstellt und registriert
- **UX**: Loading/Success/Error Toasts implementiert, gutes Fehlerhandling
- Format: JPG (Qualität 0.9) wie geplant
- Scope: Nur aktiver Viewport (1 Bild) wie in der Planung festgelegt

**Implementierte Dateien:**
- `extensions/default/src/commandsModule.ts` (Command registriert)
- `extensions/default/src/utils/exportViewportToJpg.ts` (NEU - Viewport → JPG Export)
- `extensions/default/src/utils/uploadToCreateReport.ts` (NEU - multipart/FormData Upload)
- `extensions/default/src/Components/ReportIcon.tsx` (NEU - Custom "R" Icon)
- `extensions/default/src/init.ts` (Icon-Registrierung hinzugefügt)
- `modes/basic/src/toolbarButtons.ts` (Button Definition hinzugefügt)
- `modes/basic/src/index.tsx` (Button zur primary toolbar hinzugefügt)
- `platform/app/public/config/default.js` (Config hinzugefügt - wichtig für Standard-Config)
- `platform/app/public/config/local_static.js` (Config hinzugefügt)

**Technische Details:**
- **Dependencies:** Nutzt bereits vorhandenes `html2canvas` Package
- **Icon:** Custom "R" Icon (`tool-generate-report`) - SVG mit Text-Element
- **Fehlerbehandlung:** Comprehensive try-catch mit spezifischen Fehlermeldungen für:
  - Kein aktiver Viewport
  - Viewport Element nicht gefunden
  - Canvas → Blob Konvertierung fehlgeschlagen
  - CreateReport Config fehlt
  - Network/CORS Fehler
  - Timeout (60s)
- **TypeScript:** Alle neuen Utility-Dateien sind in TypeScript geschrieben
- **Logging:** Console-Logs für Debugging hinzugefügt

**Test-Ergebnisse (2025-01-07):**
✅ **Erfolgreich getestet mit Mock-Server:**
- Config wird korrekt geladen: `{baseUrl: 'http://localhost:3001', selectedLanguage: 'en'}`
- Viewport Export funktioniert: JPG-Datei erstellt (54.07 KB)
- Upload erfolgreich: POST Request an Mock-Server gesendet
- Response: `200 OK` mit Success-Response
- Mock-Server empfängt Request korrekt:
  - 1 File empfangen
  - Language: 'en'
  - File gespeichert im `uploads/` Ordner
- Button ist sichtbar und funktional
- Icon "R" wird angezeigt

**Wichtige Erkenntnisse:**
- OHIF verwendet standardmäßig `config/default.js` (nicht `local_static.js`) wenn keine `APP_CONFIG` Environment-Variable gesetzt ist
- Config muss in beiden Dateien hinzugefügt werden, oder OHIF mit `APP_CONFIG=config/local_static.js` gestartet werden
- Mock-Server für Testing ist sehr hilfreich und funktioniert einwandfrei

**Nächste Schritte:**
- ~~Issue #17 manuell testen (Smoke Test)~~ ✅
- ~~Issue #18 angehen (CreateReport Handoff)~~ ✅

### 2025-01-08: Issue #18 Handoff-Flow implementiert ✅ (Legacy)

**Hinweis:** Dieser Flow wurde durch Issue #21 ersetzt (siehe unten).

**Implementierung:**
- **Handoff-Flow** komplett implementiert (OHIF-Seite)
- **Neue Utility:** `handoffToCreateReport.ts` für postMessage-Kommunikation
- **Command angepasst:** `generateReport` nutzt jetzt den Handoff-Flow
- **Popup-Blocker:** `window.open()` wird SYNCHRON vor async Operationen aufgerufen
- **Timeout erhöht:** 5 Minuten für KI-Befund-Generierung (statt 60s)

**Implementierte Dateien:**
- `extensions/default/src/utils/handoffToCreateReport.ts` (NEU - jetzt LEGACY)
- `extensions/default/src/commandsModule.ts` (ANGEPASST)
- `extensions/default/src/utils/uploadToCreateReport.ts` (Timeout erhöht)

**Flow (Legacy #18):**
1. Button-Klick → `window.open('/handoff')` synchron öffnen
2. Viewport als JPG exportieren
3. API-Call an `/api/generate-report` (5 Min Timeout)
4. Warten auf `CR_READY` Message (optional)
5. Report via `postMessage(CR_HANDOFF_REPORT)` senden

### 2026-01-08: Issue #21 Inkrementeller Image-Handoff implementiert ✅

**Ziel:** Nachfolger von #18. Statt eines einzelnen API-Calls + Report-Generierung wird jetzt **pro Klick 1 Bild** an CreateReport gesendet. User generiert Report manuell in CreateReport.

**Implementierung:**
- **Neuer Flow:** `CR_ADD_IMAGE` postMessage (kein API-Call)
- **Tab-Reuse:** Gleicher Tab bei wiederholten Klicks
- **Limit:** Max 10 Bilder pro Session
- **Neue Utility:** `createReportIncrementalHandoff.ts` für stateful Tab-Management und postMessage
- **Viewport Export:** `exportViewportToImagePayload()` für ArrayBuffer-Transfer

**Implementierte/Geänderte Dateien:**
- `extensions/default/src/utils/createReportIncrementalHandoff.ts` (NEU)
  - `setupCRReadyListener()` - Listener für CR_READY
  - `openOrReuseCreateReportTab()` - Sync-freundliches Tab-Öffnen/Wiederverwenden
  - `sendViewportImage()` - postMessage mit CR_ADD_IMAGE
  - `canSendMore()` / `getImageCount()` / `getMaxImages()` - Limit-Management
  - `waitForReady()` - Optional auf CR_READY warten
- `extensions/default/src/utils/exportViewportToJpg.ts` (ERWEITERT)
  - `exportViewportToImagePayload()` - Neuer Export für ArrayBuffer + Metadaten
- `extensions/default/src/commandsModule.ts` (ANGEPASST)
  - `generateReport` Command nutzt jetzt inkrementellen Flow

**Flow (Issue #21 - Aktuell):**
1. Button-Klick → Tab öffnen/wiederverwenden (`window.open(..., 'createreport')`)
2. Limit prüfen (max 10)
3. Aktiven Viewport als PNG exportieren (ArrayBuffer)
4. Optional auf `CR_READY` warten (3s Timeout)
5. Image via `postMessage(CR_ADD_IMAGE)` senden (zero-copy Transfer)
6. Toast: "Image x/10 sent to CreateReport"

**Message-Format:**
```typescript
interface CRAddImageMessage {
  type: 'CR_ADD_IMAGE';
  fileName: string;      // z.B. "viewport_1704712345678.png"
  mimeType: string;      // "image/png"
  arrayBuffer: ArrayBuffer;  // Raw image data (transferable)
}
```

**Testing (Issue #21):**
1. OHIF starten: `yarn dev`
2. CreateReport starten: `npm run dev` (Port 3000)
3. Config prüfen: `window.config.createReport.baseUrl` sollte `http://localhost:3000` sein
4. `http://localhost:3000/localbasic` öffnen, DICOM-Dateien laden
5. Viewport aktiv klicken, dann "Generate Report" Button klicken
6. Erwartet:
   - CreateReport Tab öffnet sich (`/handoff`)
   - Toast: "Image 1/10 sent to CreateReport"
7. Weitere Klicks: Images werden inkrementell gesendet
8. Nach 10 Bildern: Toast "Maximum 10 images reached"

**Troubleshooting:**
- **Popup blockiert:** Browser-Popup-Blocker für localhost deaktivieren
- **Config fehlt:** `window.config.createReport.baseUrl` prüfen (Browser Console)
- **Images erscheinen nicht:** CreateReport Console auf Fehler prüfen (Origin-Whitelist)
- **CR_READY timeout:** Kein Problem, Images werden trotzdem gesendet

**Nächste Schritte:**
- CreateReport: `/handoff` Route muss `CR_ADD_IMAGE` Messages empfangen
- CreateReport: Bilder in Images-Liste anzeigen
- CreateReport: Origin-Whitelist konfigurieren (ALLOWED_ORIGINS)

### 2024-XX-XX: Initiale Analyse
- Epic #10 analysiert
- Bestehende OHIF CreateReport-Funktionalität identifiziert
- Unterschied zwischen DICOM SR Export und unserem PNG/JPG Use Case klar
- Nächste Schritte: Issue #17 implementieren

---

## 🔗 Wichtige Links

- **CreateReport Repo:** https://github.com/nq-igortoker/CreateReport
- **OHIF Fork:** https://github.com/nq-igortoker/Viewers
- **Epic #10:** https://github.com/nq-igortoker/CreateReport/issues/10
- **Issue #16:** https://github.com/nq-igortoker/CreateReport/issues/16
- **Issue #17:** https://github.com/nq-igortoker/CreateReport/issues/17
- **Issue #18:** https://github.com/nq-igortoker/CreateReport/issues/18
- **Issue #20:** https://github.com/nq-igortoker/CreateReport/issues/20 (Inkrementelles Key-Image Sammeln)
- **Issue #21:** https://github.com/nq-igortoker/CreateReport/issues/21 (OHIF Button → inkrementell senden)
- **Handoff-Doku:** https://github.com/nq-igortoker/CreateReport/blob/development/docs/OHIF_HANDOFF_INTEGRATION.md
- **OHIF Upstream:** https://github.com/OHIF/Viewers
- **OHIF Docs:** https://docs.ohif.org/
