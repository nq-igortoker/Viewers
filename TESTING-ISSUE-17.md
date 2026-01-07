# Testing Guide: Issue #17 (Generate Report Button)

## Übersicht

Dieser Guide hilft dir, Issue #17 lokal zu testen, auch wenn die CreateReport API noch nicht implementiert ist.

## Option 1: Test mit Mock API (Empfohlen für schnelles Testen)

### Schritt 1: Einfache Mock API erstellen

Erstelle eine einfache Mock-API, die die Requests empfängt und simuliert:

**Datei:** `mock-create-report-server.js` (im OHIF-Viewers Root)

```javascript
const express = require('express');
const multer = require('multer');
const cors = require('cors');

const app = express();
const port = 3001;

// CORS für OHIF erlauben
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));

// Multer für multipart/form-data
const upload = multer({
  dest: 'uploads/', // Temporäre Speicherung
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB max
});

app.post('/api/generate-report', upload.array('images[]'), (req, res) => {
  console.log('📥 Request received:');
  console.log('  - Files:', req.files?.length || 0);
  console.log('  - Language:', req.body.selectedLanguage || 'not provided');

  if (req.files) {
    req.files.forEach((file, index) => {
      console.log(`  - File ${index + 1}: ${file.originalname} (${file.size} bytes)`);
    });
  }

  // Simuliere erfolgreiche Antwort
  res.status(200).json({
    success: true,
    message: 'Report generation initiated (MOCK)',
    filesReceived: req.files?.length || 0,
    language: req.body.selectedLanguage || 'en'
  });
});

app.listen(port, () => {
  console.log(`🚀 Mock CreateReport API running on http://localhost:${port}`);
  console.log(`📡 Ready to receive requests from OHIF`);
});
```

### Schritt 2: Mock Server Dependencies installieren

```bash
cd /Users/igor/Code/OHIF-Viewers

# Installiere Express, Multer, CORS (falls nicht vorhanden)
npm install express multer cors --save-dev
# ODER mit yarn:
yarn add express multer cors --dev
```

### Schritt 3: Mock Server starten

```bash
# In einem Terminal
node mock-create-report-server.js
```

Du solltest sehen:
```
🚀 Mock CreateReport API running on http://localhost:3001
📡 Ready to receive requests from OHIF
```

### Schritt 4: OHIF starten

```bash
# In einem anderen Terminal
cd /Users/igor/Code/OHIF-Viewers
yarn dev
```

### Schritt 5: Config prüfen

Stelle sicher, dass `platform/app/public/config/local_static.js` die richtige URL hat:

```javascript
createReport: {
  baseUrl: 'http://localhost:3001', // ← Muss mit Mock Server Port übereinstimmen
  selectedLanguage: 'en',
}
```

### Schritt 6: Test durchführen

1. **Browser öffnen:** `http://localhost:3000/local` oder `http://localhost:3000/localbasic`
2. **Demo Study laden:** DICOM-Dateien per Drag & Drop hochladen
3. **Viewport aktivieren:** Auf einen Viewport klicken
4. **Button finden:** "Generate Report" Button in der Toolbar (zwischen Capture und Layout)
5. **Button klicken:**
   - Toast "Exporting viewport image..." sollte erscheinen
   - Toast "Uploading to CreateReport..." sollte erscheinen
   - Toast "Report generation initiated successfully!" sollte erscheinen
6. **Mock Server prüfen:** Im Terminal sollte der Request geloggt werden
7. **Network Tab prüfen:** Browser DevTools → Network → POST Request zu `/api/generate-report`

---

## Option 2: Test ohne API (nur UI/Export testen)

Falls du nur die UI und den Export testen willst, ohne Upload:

### Schritt 1: Config anpassen

Ändere die Config auf eine nicht-existierende URL, um den Upload-Fehler zu sehen:

```javascript
createReport: {
  baseUrl: 'http://localhost:9999', // Nicht existierender Port
  selectedLanguage: 'en',
}
```

### Schritt 2: Test durchführen

1. OHIF starten: `yarn dev`
2. Browser öffnen: `http://localhost:3000/local`
3. Study laden
4. Button klicken
5. **Erwartung:**
   - Export sollte funktionieren
   - Upload sollte fehlschlagen
   - Error Toast sollte erscheinen: "Failed to generate report..."

---

## Option 3: Test mit Browser DevTools (Network Inspection)

### Schritt 1: OHIF starten

```bash
yarn dev
```

### Schritt 2: Browser DevTools öffnen

1. Browser: `http://localhost:3000/local`
2. **F12** drücken → DevTools öffnen
3. **Network Tab** öffnen
4. **Filter:** "generate-report" eingeben

### Schritt 3: Button klicken und Request analysieren

1. Study laden
2. Viewport aktivieren
3. "Generate Report" Button klicken
4. Im Network Tab:
   - **Request Name:** `generate-report`
   - **Method:** `POST`
   - **Status:** (wird fehlschlagen ohne API, aber Request ist sichtbar)
   - **Payload:** Klicke auf Request → "Payload" Tab
     - Sollte `Form Data` zeigen
     - `images[]`: File sollte sichtbar sein
     - `selectedLanguage`: 'en' (oder konfigurierter Wert)

### Schritt 4: Request Details prüfen

**Headers:**
- `Content-Type: multipart/form-data; boundary=...`
- `Origin: http://localhost:3000`

**Payload:**
```
------WebKitFormBoundary...
Content-Disposition: form-data; name="images[]"; filename="viewport-xxx-1234567890.jpg"
Content-Type: image/jpeg

[Binary Data]
------WebKitFormBoundary...
Content-Disposition: form-data; name="selectedLanguage"

en
------WebKitFormBoundary...
```

---

## Troubleshooting

### Problem: Button nicht sichtbar

**Lösung:**
- Prüfe ob `basic` mode geladen ist
- Prüfe Browser Console auf Fehler
- Prüfe ob Button in `toolbarSections.primary` enthalten ist

### Problem: CORS Error

**Fehlermeldung:** `Access to fetch at 'http://localhost:3001/api/generate-report' from origin 'http://localhost:3000' has been blocked by CORS policy`

**Lösung:**
- Mock Server muss CORS Headers senden (siehe Option 1)
- Oder Browser CORS Extension verwenden (nur für Testing!)

### Problem: Config nicht gefunden

**Fehlermeldung:** `CreateReport base URL is not configured`

**Lösung:**
- Prüfe `platform/app/public/config/local_static.js`
- Prüfe Browser Console: `console.log(window.config.createReport)`
- Stelle sicher, dass Config-Datei geladen wird

### Problem: Viewport Element nicht gefunden

**Fehlermeldung:** `Viewport element not found for ID: ...`

**Lösung:**
- Stelle sicher, dass ein Viewport aktiv ist (darauf klicken)
- Prüfe ob Viewport tatsächlich gerendert ist
- Prüfe Browser Console für Viewport IDs

### Problem: Export funktioniert nicht

**Fehlermeldung:** `Failed to convert canvas to blob`

**Lösung:**
- Prüfe ob `html2canvas` korrekt installiert ist
- Prüfe Browser Console auf weitere Fehler
- Stelle sicher, dass Viewport sichtbar ist (nicht versteckt)

### Problem: Upload Timeout

**Fehlermeldung:** `Upload timed out after 60 seconds`

**Lösung:**
- Mock Server läuft nicht → Starte Mock Server
- Port stimmt nicht überein → Prüfe Config
- Firewall blockiert → Prüfe Firewall-Einstellungen

---

## Erwartetes Verhalten (Success Case)

### 1. Button sichtbar
✅ Button "Generate Report" ist in Toolbar sichtbar (zwischen Capture und Layout)

### 2. Toast-Sequenz
✅ **Toast 1:** "Exporting viewport image..." (Info, 2s)
✅ **Toast 2:** "Uploading to CreateReport..." (Info, 2s)
✅ **Toast 3:** "Report generation initiated successfully!" (Success, 3s)

### 3. Network Request
✅ POST Request zu `/api/generate-report`
✅ Content-Type: `multipart/form-data`
✅ Payload enthält:
   - `images[]`: JPG File
   - `selectedLanguage`: 'en' (oder konfigurierter Wert)

### 4. Mock Server Log
✅ Request wird geloggt
✅ File-Details werden angezeigt
✅ Language wird angezeigt

---

## Erwartetes Verhalten (Error Cases)

### Kein aktiver Viewport
❌ Toast: "No active viewport found. Please select a viewport first."

### Config fehlt
❌ Toast: "CreateReport base URL is not configured. Please check your configuration."

### Network Error
❌ Toast: "Failed to generate report. Please try again." + spezifische Fehlermeldung

### Timeout
❌ Toast: "Upload timed out after 60 seconds"

---

## Quick Test Checklist

- [ ] OHIF läuft (`yarn dev`)
- [ ] Mock Server läuft (Option 1) oder Config auf nicht-existierende URL (Option 2)
- [ ] Browser: `http://localhost:3000/local`
- [ ] Demo Study geladen
- [ ] Viewport aktiv (darauf geklickt)
- [ ] Button "Generate Report" sichtbar
- [ ] Button klickbar
- [ ] Toasts erscheinen
- [ ] Network Request sichtbar (DevTools)
- [ ] Mock Server loggt Request (Option 1)

---

## Nächste Schritte nach erfolgreichem Test

1. ✅ Issue #17 ist funktionsfähig
2. 🔄 Issue #19 (CreateReport API) implementieren
3. 🔄 Issue #18 (CreateReport Handoff) angehen

---

**Tipp:** Für schnelles Testen empfehle ich **Option 1 (Mock API)**, da du damit den kompletten Flow testen kannst, ohne die echte API zu benötigen.
