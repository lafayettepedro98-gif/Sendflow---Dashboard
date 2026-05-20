const BASE = 'https://sendflow.pro/sendapi';
const CAMPAIGN_ID = 'Q8ezymXY1DNIi8JR2t3z';

export default async function handler(req, res) {
  const apiKey = process.env.SENDFLOW_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'API key não configurada.' });
  }

  const headers = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };

  try {
    const groupsRes = await fetch(`${BASE}/releases/${CAMPAIGN_ID}/groups`, { headers });
    const groupsText = await groupsRes.text();
    
    const analyticsRes = await fetch(`${BASE}/releases/${CAMPAIGN_ID}/analytics`, { headers });
    const analyticsText = await analyticsRes.text();

    const campaignRes = await fetch(`${BASE}/releases/${CAMPAIGN_ID}`, { headers });
    const campaignText = await campaignRes.text();

    return res.status(200).json({
      debug: {
        groupsStatus: groupsRes.status,
        analyticsStatus: analyticsRes.status,
        campaignStatus: campaignRes.status,
        groupsBody: groupsText.slice(0, 500),
        campaignBody: campaignText.slice(0, 500),
      }
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
