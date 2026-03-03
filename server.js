const express = require('express');
const cors = require('cors');
const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args));

const app = express();
const PORT = process.env.PORT || 3000;

// ── Env vars (set these in Railway dashboard) ──────────────────────────
const ANTHROPIC_KEY  = process.env.ANTHROPIC_API_KEY;
const ELEVENLABS_KEY = process.env.ELEVENLABS_API_KEY;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';
// ────────────────────────────────────────────────────────────────────────

app.use(cors({ origin: ALLOWED_ORIGIN }));
app.use(express.json({ limit: '1mb' }));

// ── Serve the Sapo app at root ────────────────────────────────────────
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/amiguito-habla-FINAL.html');
});

// ── Health check ──────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: '🐸 Sapo proxy running!', time: new Date().toISOString() });
});

// ── Claude (Anthropic) ───────────────────────────────────────────────────
app.post('/api/chat', async (req, res) => {
  if (!ANTHROPIC_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not set in Railway environment' });
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(req.body)
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data });
    }

    res.json(data);
  } catch (err) {
    console.error('Anthropic error:', err.message);
    res.status(500).json({ error: 'Anthropic request failed' });
  }
});

// ── ElevenLabs TTS ───────────────────────────────────────────────────────
app.post('/api/tts/:voiceId', async (req, res) => {
  if (!ELEVENLABS_KEY) {
    return res.status(500).json({ error: 'ELEVENLABS_API_KEY not set in Railway environment' });
  }

  const { voiceId } = req.params;

  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key':   ELEVENLABS_KEY
        },
        body: JSON.stringify(req.body)
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({ error: errText });
    }

    res.set('Content-Type', 'audio/mpeg');
    res.set('Cache-Control', 'no-cache');
    response.body.pipe(res);
  } catch (err) {
    console.error('ElevenLabs error:', err.message);
    res.status(500).json({ error: 'ElevenLabs request failed' });
  }
});

app.listen(PORT, () => {
  console.log(`🐸 Sapo proxy listening on port ${PORT}`);
});
