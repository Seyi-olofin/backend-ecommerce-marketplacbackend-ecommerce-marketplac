const express = require('express');
const router = express.Router();
const {
  translateText,
  translateBatch,
  getSupportedLanguages
} = require('../controllers/translationController');

// POST /api/translate - Translate single text
router.post('/translate', translateText);

// POST /api/translate/batch - Translate multiple texts
router.post('/translate/batch', translateBatch);

// GET /api/translate/languages - Get supported languages
router.get('/translate/languages', getSupportedLanguages);

module.exports = router;