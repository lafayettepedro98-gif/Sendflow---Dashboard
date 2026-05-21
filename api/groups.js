const SENDFLOW_BASE = 'https://sendflow.pro/sendapi';
const CAMPAIGN_ID   = 'Q8ezymXY1DNIi8JR2t3z';

export default async function handler(req, res) {
  const apiKey = process.env.SENDFLOW_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'SENDFLOW_API_KEY not configured' });
  }

  try {
    const r = await fetch(`${SENDFLOW_BASE}/releases/${CAMPAIGN_ID}/groups`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      }
    });

    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const raw    = await r.json();
    const groups = Array.isArray(raw) ? raw : (raw.groups || raw.data || []);

    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json(groups);

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
