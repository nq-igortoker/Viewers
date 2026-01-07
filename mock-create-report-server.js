/**
 * Mock CreateReport API Server
 *
 * Einfacher Mock-Server zum Testen von Issue #17
 *
 * Usage:
 *   1. npm install express multer cors --save-dev
 *   2. node mock-create-report-server.js
 */

const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const port = 3001;

// Erstelle uploads Ordner falls nicht vorhanden
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// CORS für OHIF erlauben
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));

// Body Parser für JSON (für selectedLanguage)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Multer für multipart/form-data
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    cb(null, `mock-${timestamp}-${file.originalname}`);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB max
  },
  fileFilter: (req, file, cb) => {
    // Nur JPG/JPEG erlauben
    if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/jpg') {
      cb(null, true);
    } else {
      cb(new Error('Only JPG/JPEG files are allowed'), false);
    }
  }
});

// Health Check Endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Mock CreateReport API is running' });
});

// Main Endpoint
app.post('/api/generate-report', upload.array('images[]'), (req, res) => {
  console.log('\n📥 ===== Request Received =====');
  console.log(`Time: ${new Date().toISOString()}`);
  console.log(`Files received: ${req.files?.length || 0}`);
  console.log(`Language: ${req.body.selectedLanguage || 'not provided (default: en)'}`);

  if (req.files && req.files.length > 0) {
    console.log('\n📎 Files:');
    req.files.forEach((file, index) => {
      const sizeKB = (file.size / 1024).toFixed(2);
      console.log(`  ${index + 1}. ${file.originalname}`);
      console.log(`     Size: ${sizeKB} KB`);
      console.log(`     Saved to: ${file.path}`);
    });
  } else {
    console.log('⚠️  No files received!');
  }

  // Simuliere erfolgreiche Antwort
  const response = {
    success: true,
    message: 'Report generation initiated (MOCK)',
    filesReceived: req.files?.length || 0,
    language: req.body.selectedLanguage || 'en',
    timestamp: new Date().toISOString()
  };

  console.log('\n✅ Sending success response');
  console.log('=============================\n');

  res.status(200).json(response);
});

// Error Handler
app.use((error, req, res, next) => {
  console.error('\n❌ Error:', error.message);

  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: 'File too large. Maximum size is 10MB.'
      });
    }
  }

  res.status(500).json({
    success: false,
    error: error.message || 'Internal server error'
  });
});

// Start Server
app.listen(port, () => {
  console.log('\n🚀 ========================================');
  console.log('   Mock CreateReport API Server');
  console.log('   ========================================');
  console.log(`\n📡 Server running on: http://localhost:${port}`);
  console.log(`📂 Upload directory: ${uploadsDir}`);
  console.log(`\n✅ Ready to receive requests from OHIF`);
  console.log(`\n💡 Test health: http://localhost:${port}/health`);
  console.log('   ========================================\n');
});

// Graceful Shutdown
process.on('SIGINT', () => {
  console.log('\n\n👋 Shutting down Mock Server...');
  process.exit(0);
});
