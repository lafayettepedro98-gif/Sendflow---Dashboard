// /api/data.js — Lê dados do Supabase para o dashboard

const SUPABASE_URL  = 'https://dpiovtnsztstvybyrieq.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwaW92dG5zenRzdHZ5YnlyaWVxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzMDczOTQsImV4cCI6MjA5NDg4MzM5NH0.tsaZJxF4CF7tyrcUnO9HqMdzhcoJX2zwEZjmkNKabaE';
const CAMPAIGN_ID   = 'Q8ezymXY1DNIi8JR2t3z';

export default async function handler(req, res) {
  const headers = {
    'apikey': SUPABASE_ANON,
    'Authorization': `Bearer ${SUPABASE_ANON}`,
  };

  try {
    // Busca snapshot mais recente (qualquer campanha)
    const snapRes = await fetch(
      `${SUPABASE_URL}/rest/v1/group_snapshots?order=created_at.desc&limit=1`,
      { headers }
    );
    const snapshots = snapRes.ok ? await snapRes.json() : [];
    const latest = snapshots[0] || null;
    const activeCampaignId = latest?.campaign_id || CAMPAIGN_ID;

    // Busca todos snapshots para histórico
    const histRes = await fetch(
      `${SUPABASE_URL}/rest/v1/group_snapshots?order=created_at.asc&limit=500`,
      { headers }
    );
    const history = histRes.ok ? await histRes.json() : [];

    // Busca eventos em tempo real das últimas 24h
    const since = new Date(Date.now() - 24*60*60*1000).toISOString();
    const eventsRes = await fetch(
      `${SUPABASE_URL}/rest/v1/realtime_events?created_at=gte.${since}&order=created_at.desc&limit=100`,
      { headers }
    );
    const events = eventsRes.ok ? await eventsRes.json() : [];

    // Calcula entradas/saídas hoje dos eventos em tempo real
    const inputsHoje  = events.filter(e => e.event_type === 'input' ).reduce((s,e)=>s+(e.amount||1),0);
    const outputsHoje = events.filter(e => e.event_type === 'output').reduce((s,e)=>s+(e.amount||1),0);

    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json({
      latest,
      history,
      inputsHoje,
      outputsHoje,
      hasData: !!latest,
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
