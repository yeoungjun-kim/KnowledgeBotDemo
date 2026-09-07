// Serverless function: proxies embedding requests to Gemini so the API key
// stays server-side. Deployed on Vercel, this file is automatically exposed
// at /api/embed. Locally, run with `vercel dev` (see README).

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

  const { texts } = req.body || {};
  if (!Array.isArray(texts) || texts.length === 0) {
    res.status(400).json({ error: '"texts" must be a non-empty array of strings.' });
    return;
  }

  try {
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:batchEmbedContents?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: texts.map(text => ({
            model: 'models/gemini-embedding-001',
            content: { parts: [{ text }] }
          }))
        })
      }
    );
    const data = await geminiRes.json();
    if (data.error) {
      res.status(502).json({ error: data.error.message });
      return;
    }
    res.status(200).json({ embeddings: data.embeddings.map(e => e.values) });
  } catch (err) {
    res.status(502).json({ error: 'Could not reach the embedding API.' });
  }
};
