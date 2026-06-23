export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { imageContent, systemPrompt, userText } = req.body;

  if (!imageContent || !systemPrompt || !userText) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 3000,
        system: systemPrompt,
        messages: [{
          role: 'user',
          content: [
            ...imageContent,
            { type: 'text', text: userText }
          ]
        }]
      })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      return res.status(response.status).json({
        error: errData.error?.message || `Anthropic API error ${response.status}`
      });
    }

    const data = await response.json();
    const text = data.content.map(b => b.text || '').join('');

    // Strip markdown code fences if present
    let clean = text.replace(/```json/gi, '').replace(/```/g, '').trim();

    // Extract just the JSON object in case there's any stray text before/after it
    const firstBrace = clean.indexOf('{');
    const lastBrace = clean.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      clean = clean.slice(firstBrace, lastBrace + 1);
    }

    let parsed;
    try {
      parsed = JSON.parse(clean);
    } catch (e) {
      console.error('JSON parse failed. Raw text was:', text);
      return res.status(500).json({
        error: 'AI returned invalid JSON. Please try again.',
        debug: text.slice(0, 500)
      });
    }

    return res.status(200).json(parsed);

  } catch (err) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
