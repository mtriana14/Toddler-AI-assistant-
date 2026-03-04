const express = require('express');
const cors = require('cors');
const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args));

const app = express();
const PORT = process.env.PORT || 3000;

const ANTHROPIC_KEY  = process.env.ANTHROPIC_API_KEY;
const ELEVENLABS_KEY = process.env.ELEVENLABS_API_KEY;
const OPENAI_KEY     = process.env.OPENAI_API_KEY;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';

app.use(cors({ origin: ALLOWED_ORIGIN }));
app.use(express.json({ limit: '2mb' }));

// ── Serve app ─────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/amiguito-habla-end.html');
});

// ── Health ────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: '🐸 Sapo proxy running!', time: new Date().toISOString() });
});

// ── Debug ─────────────────────────────────────────────────────────────
app.get('/debug', (req, res) => {
  res.json({
    elevenlabs_key_set: !!ELEVENLABS_KEY,
    openai_key_set: !!OPENAI_KEY,
    anthropic_key_set: !!ANTHROPIC_KEY
  });
});

// ── OpenAI Chat ───────────────────────────────────────────────────────
app.post('/api/chat', async (req, res) => {
  if (!OPENAI_KEY) {
    return res.status(500).json({ error: 'OPENAI_API_KEY not set' });
  }

  try {
    const { messages, system } = req.body;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 120,
        temperature: 0.7,
        messages: [
          { role: 'system', content: system },
          ...messages
        ]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('OpenAI error:', JSON.stringify(data));
      return res.status(response.status).json({ error: data });
    }

    // Return in same format as Anthropic so frontend doesn't change
    const text = data.choices?.[0]?.message?.content || '¡Qué chévere!';
    res.json({ content: [{ type: 'text', text }] });

  } catch (err) {
    console.error('OpenAI error:', err.message);
    res.status(500).json({ error: 'OpenAI request failed' });
  }
});

// ── ElevenLabs TTS ────────────────────────────────────────────────────
app.post('/api/tts/:voiceId', async (req, res) => {
  if (!ELEVENLABS_KEY) {
    return res.status(500).json({ error: 'ELEVENLABS_API_KEY not set' });
  }

  const { voiceId } = req.params;
  console.log('TTS request for voice:', voiceId);

  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': ELEVENLABS_KEY
        },
        body: JSON.stringify(req.body)
      }
    );

    console.log('ElevenLabs status:', response.status);

    if (!response.ok) {
      const errText = await response.text();
      console.log('ElevenLabs error:', errText);
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
