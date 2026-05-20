const BASE = 'https://sendflow.pro/sendapi';
const CAMPAIGN_ID = 'Q8ezymXY1DNIi8JR2t3z';

export default async function handler(req, res) {
  const apiKey = process.env.SENDFLOW_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'API key nao configurada.' });
  }

  const headers = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };

  try {
    const [groupsRes, analyticsRes, campaignRes] = await Promise.all([
      fetch(`${BASE}/releases/${CAMPAIGN_ID}/groups`,    { headers }),
      fetch(`${BASE}/releases/${CAMPAIGN_ID}/analytics`, { headers }),
      fetch(`${BASE}/releases/${CAMPAIGN_ID}`,           { headers }),
    ]);

    let groups = [];
    if (groupsRes.ok) {
      const raw = await groupsRes.json();
      groups = Array.isArray(raw) ? raw : (raw.groups || raw.data || []);
    }

    const analytics = analyticsRes.ok ? await analyticsRes.json() : null;
    const campaign  = campaignRes.ok  ? await campaignRes.json()  : {};

    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json({ campaign, groups, analytics });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
