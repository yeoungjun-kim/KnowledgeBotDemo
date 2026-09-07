// Serverless function: proxies chat completions to Gemini so the API key
// stays server-side. Deployed on Vercel, this file is automatically exposed
// at /api/generate. Locally, run with `vercel dev` (see README).

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'Server is missing GEMINI_API_KEY.' });
    return;
  }

  const { prompt } = req.body || {};
  if (!prompt || typeof prompt !== 'string') {
    res.status(400).json({ error: '"prompt" must be a non-empty string.' });
    return;
  }

  try {
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      }
    );
    const data = await geminiRes.json();
    if (data.error) {
      res.status(502).json({ error: data.error.message });
      return;
    }
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      res.status(502).json({ error: 'Gemini returned no answer (it may have been blocked by a safety filter).' });
      return;
    }
    res.status(200).json({ text });
  } catch (err) {
    res.status(502).json({ error: 'Could not reach the Gemini API.' });
  }
};
