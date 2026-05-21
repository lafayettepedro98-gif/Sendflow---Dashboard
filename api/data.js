const SUPABASE_URL  = 'https://dpiovtnsztstvybyrieq.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwaW92dG5zenRzdHZ5YnlyaWVxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzMDczOTQsImV4cCI6MjA5NDg4MzM5NH0.tsaZJxF4CF7tyrcUnO9HqMdzhcoJX2zwEZjmkNKabaE';
const SENDFLOW_BASE = 'https://sendflow.pro/sendapi';
const CAMPAIGN_ID   = 'Q8ezymXY1DNIi8JR2t3z';
 
export default async function handler(req, res) {
  const apiKey      = process.env.SENDFLOW_API_KEY;
  const supaHeaders = {
    'apikey': SUPABASE_ANON,
    'Authorization': `Bearer ${SUPABASE_ANON}`,
  };
 
  try {
    // 1. Tenta buscar dados frescos da SendAPI
    let liveData = null;
    if (apiKey) {
      try {
        const sfHeaders = {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        };
        const [groupsRes, analyticsRes] = await Promise.all([
          fetch(`${SENDFLOW_BASE}/releases/${CAMPAIGN_ID}/groups`,    { headers: sfHeaders }),
          fetch(`${SENDFLOW_BASE}/releases/${CAMPAIGN_ID}/analytics`, { headers: sfHeaders }),
        ]);
        if (groupsRes.ok && analyticsRes.ok) {
          const rawGroups   = await groupsRes.json();
          const analytics   = await analyticsRes.json();
          const groups      = Array.isArray(rawGroups) ? rawGroups : (rawGroups.groups || rawGroups.data || []);
          const totalParts  = groups.reduce((s, g) => s + (g.participantsAmount || 0), 0);
 
          // Só usa dados da API se participantes > 0 (não dessincronizado)
          if (totalParts > 0) {
            liveData = {
              participants_amount: totalParts,
              groups_total:        groups.length,
              groups_full:         groups.filter(g => g.full).length,
              groups_open:         groups.filter(g => !g.full).length,
              input_amount:        analytics?.add?.total    || 0,
              output_amount:       analytics?.remove?.total || 0,
              clicks_total:        analytics?.clicks?.total || 0,
              source: 'api',
            };
          }
        }
      } catch (e) {
        console.warn('SendAPI error, falling back to Supabase:', e.message);
      }
    }
 
    // 2. Busca último snapshot do Supabase (fallback ou complemento)
    const snapRes = await fetch(
      `${SUPABASE_URL}/rest/v1/group_snapshots?order=created_at.desc&limit=1`,
      { headers: supaHeaders }
    );
    const snapshots = snapRes.ok ? await snapRes.json() : [];
    const latestSnap = snapshots[0] || null;
 
    // 3. Usa dados da API se disponíveis, senão usa Supabase
    const latest = liveData || (latestSnap ? {
      participants_amount: latestSnap.participants_amount,
      groups_total:        latestSnap.groups_total,
      groups_full:         latestSnap.groups_full,
      groups_open:         latestSnap.groups_open,
      input_amount:        latestSnap.input_amount,
      output_amount:       latestSnap.output_amount,
      clicks_total:        latestSnap.clicks_total,
      source: 'supabase',
    } : null);
 
    // 4. Histórico dos snapshots para os gráficos
    const histRes = await fetch(
      `${SUPABASE_URL}/rest/v1/group_snapshots?order=created_at.asc&limit=500`,
      { headers: supaHeaders }
    );
    const history = histRes.ok ? await histRes.json() : [];
 
    // 5. Eventos em tempo real das últimas 24h
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const eventsRes = await fetch(
      `${SUPABASE_URL}/rest/v1/realtime_events?created_at=gte.${since}&order=created_at.desc&limit=100`,
      { headers: supaHeaders }
    );
    const events = eventsRes.ok ? await eventsRes.json() : [];
 
    const inputsHoje  = events.filter(e => e.event_type === 'input' ).reduce((s, e) => s + (e.amount || 1), 0);
    const outputsHoje = events.filter(e => e.event_type === 'output').reduce((s, e) => s + (e.amount || 1), 0);
 
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
