const { Translate } = require('@google-cloud/translate').v2;

// Initialize the client (will use GOOGLE_APPLICATION_CREDENTIALS env var or default credentials)
const translate = new Translate();

const translateText = async (req, res) => {
  try {
    const { text, target = 'en', source = 'auto' } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    // Translate the text
    const [translation] = await translate.translate(text, {
      from: source,
      to: target
    });

    res.json({
      originalText: text,
      translatedText: translation,
      sourceLanguage: source,
      targetLanguage: target
    });

  } catch (error) {
    console.error('Translation error:', error);
    res.status(500).json({
      error: 'Translation failed',
      message: error.message,
      fallback: 'Translation service temporarily unavailable'
    });
  }
};

const translateBatch = async (req, res) => {
  try {
    const { texts, target = 'en', source = 'auto' } = req.body;

    if (!Array.isArray(texts) || texts.length === 0) {
      return res.status(400).json({ error: 'Texts array is required' });
    }

    // Translate all texts
    const translations = await Promise.all(
      texts.map(async (text) => {
        try {
          const [translation] = await translate.translate(text, {
            from: source,
            to: target
          });
          return {
            originalText: text,
            translatedText: translation,
            success: true
          };
        } catch (error) {
          return {
            originalText: text,
            translatedText: text, // fallback to original
            success: false,
            error: error.message
          };
        }
      })
    );

    res.json({
      translations,
      targetLanguage: target,
      sourceLanguage: source
    });

  } catch (error) {
    console.error('Batch translation error:', error);
    res.status(500).json({
      error: 'Batch translation failed',
      message: error.message,
      fallback: 'Translation service temporarily unavailable'
    });
  }
};

const getSupportedLanguages = async (req, res) => {
  try {
    const [languages] = await translate.getLanguages();

    res.json({
      languages: languages.map(lang => ({
        code: lang.code,
        name: lang.name
      }))
    });

  } catch (error) {
    console.error('Get languages error:', error);
    res.status(500).json({
      error: 'Failed to fetch supported languages',
      message: error.message
    });
  }
};

module.exports = {
  translateText,
  translateBatch,
  getSupportedLanguages
};