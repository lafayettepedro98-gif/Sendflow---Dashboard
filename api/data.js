const SUPABASE_URL  = 'https://dpiovtnsztstvybyrieq.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwaW92dG5zenRzdHZ5YnlyaWVxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzMDczOTQsImV4cCI6MjA5NDg4MzM5NH0.tsaZJxF4CF7tyrcUnO9HqMdzhcoJX2zwEZjmkNKabaE';
const SENDFLOW_BASE = 'https://sendflow.pro/sendapi';
const CAMPAIGN_ID   = 'NaPAFwR1JpgfYsnXJf1L';
const ADMINS        = 5;

export default async function handler(req, res) {
  const apiKey      = process.env.SENDFLOW_API_KEY;
  const supaKey     = process.env.SUPABASE_SERVICE_KEY;
  const anonHeaders = { 'apikey': SUPABASE_ANON, 'Authorization': `Bearer ${SUPABASE_ANON}` };
  const svcHeaders  = supaKey
    ? { 'apikey': supaKey, 'Authorization': `Bearer ${supaKey}`, 'Content-Type': 'application/json' }
    : anonHeaders;

  try {
    let liveGroups  = [];
    let liveMetrics = null;

    // 1. Tenta buscar dados frescos da SendAPI
    if (apiKey) {
      try {
        const sfHeaders = { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' };
        const [groupsRes, analyticsRes] = await Promise.all([
          fetch(`${SENDFLOW_BASE}/releases/${CAMPAIGN_ID}/groups`,    { headers: sfHeaders }),
          fetch(`${SENDFLOW_BASE}/releases/${CAMPAIGN_ID}/analytics`, { headers: sfHeaders }),
        ]);
        if (groupsRes.ok) {
          const raw = await groupsRes.json();
          liveGroups = Array.isArray(raw) ? raw : (raw.groups || raw.data || []);
        }
        if (analyticsRes.ok && liveGroups.length) {
          const analytics  = await analyticsRes.json();
          const totalParts = liveGroups.reduce((s, g) => s + (g.participantsAmount || 0), 0);
          const synced     = totalParts > liveGroups.length * ADMINS;

          if (synced) {
            const totalAdmins = liveGroups.length * ADMINS;
            liveMetrics = {
              participants_amount: Math.max(0, totalParts - totalAdmins),
              groups_total:  liveGroups.length,
              groups_full:   liveGroups.filter(g => g.full).length,
              groups_open:   liveGroups.filter(g => !g.full).length,
              input_amount:  analytics?.add?.total    || 0,
              output_amount: analytics?.remove?.total || 0,
              clicks_total:  analytics?.clicks?.total || 0,
              source: 'api',
            };

            if (supaKey) {
              const upserts = liveGroups.map(g => ({
                campaign_id: CAMPAIGN_ID,
                group_id:    g.id,
                group_name:  g.name,
                is_full:     g.full || false,
                count:       g.count || 0,
              }));
              await fetch(`${SUPABASE_URL}/rest/v1/groups_cache`, {
                method: 'POST',
                headers: { ...svcHeaders, 'Prefer': 'resolution=merge-duplicates' },
                body: JSON.stringify(upserts),
              }).catch(e => console.warn('Failed to cache groups:', e));

              const snapshot = {
                campaign_id:         CAMPAIGN_ID,
                participants_amount: liveMetrics.participants_amount,
                groups_total:        liveMetrics.groups_total,
                groups_full:         liveMetrics.groups_full,
                groups_open:         liveMetrics.groups_open,
                input_amount:        liveMetrics.input_amount,
                output_amount:       liveMetrics.output_amount,
                clicks_total:        liveMetrics.clicks_total,
              };
              await fetch(`${SUPABASE_URL}/rest/v1/group_snapshots`, {
                method: 'POST',
                headers: svcHeaders,
                body: JSON.stringify(snapshot),
              }).catch(e => console.warn('Failed to save snapshot:', e));
            }
          }
        }
      } catch (e) {
        console.warn('SendAPI error:', e.message);
      }
    }

    // 2. Busca grupos do cache Supabase se API não retornou grupos válidos
    let cachedGroups = liveGroups;
    if (!cachedGroups.length) {
      const gcRes = await fetch(
        `${SUPABASE_URL}/rest/v1/groups_cache?campaign_id=eq.${CAMPAIGN_ID}&order=count.asc`,
        { headers: anonHeaders }
      );
      if (gcRes.ok) {
        const gc = await gcRes.json();
        cachedGroups = gc.map(g => ({
          id:                g.group_id,
          name:              g.group_name,
          full:              g.is_full,
          count:             g.count,
          participantsAmount: 0,
        }));
      }
    }

    // 3. Busca métricas do Supabase se API dessincronizada
    const snapRes = await fetch(
      `${SUPABASE_URL}/rest/v1/group_snapshots?campaign_id=eq.${CAMPAIGN_ID}&order=created_at.desc&limit=1`,
      { headers: anonHeaders }
    );
    const snapshots   = snapRes.ok ? await snapRes.json() : [];
    const latestSnap  = snapshots[0] || null;
    const supaMetrics = latestSnap ? {
      participants_amount: latestSnap.participants_amount,
      groups_total:  latestSnap.groups_total,
      groups_full:   latestSnap.groups_full,
      groups_open:   latestSnap.groups_open,
      input_amount:  latestSnap.input_amount,
      output_amount: latestSnap.output_amount,
      clicks_total:  latestSnap.clicks_total,
      source: 'supabase',
    } : null;

    const latest = liveMetrics || supaMetrics || null;

    // 4. Histórico
    const histRes = await fetch(
      `${SUPABASE_URL}/rest/v1/group_snapshots?campaign_id=eq.${CAMPAIGN_ID}&order=created_at.asc&limit=500`,
      { headers: anonHeaders }
    );
    const history = histRes.ok ? await histRes.json() : [];

    // 5. Eventos hoje (a partir da meia-noite de Brasília = 03:00 UTC)
    const now = new Date();
    const meianoite = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 3, 0, 0));
    if (now < meianoite) meianoite.setUTCDate(meianoite.getUTCDate() - 1);
    const since = meianoite.toISOString();

    const eventsRes = await fetch(
      `${SUPABASE_URL}/rest/v1/realtime_events?campaign_id=eq.${CAMPAIGN_ID}&created_at=gte.${since}&order=created_at.desc&limit=1000`,
      { headers: anonHeaders }
    );
    const events = eventsRes.ok ? await eventsRes.json() : [];
    const inputsHoje  = events.filter(e => e.event_type==='input' ).reduce((s,e)=>s+(e.amount||1),0);
    const outputsHoje = events.filter(e => e.event_type==='output').reduce((s,e)=>s+(e.amount||1),0);

    res.setHeader('Cache-Control','no-cache');
    res.setHeader('Access-Control-Allow-Origin','*');
    return res.status(200).json({
      latest,
      history,
      inputsHoje,
      outputsHoje,
      hasData: !!(latest || cachedGroups.length > 0),
      groups: cachedGroups,
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
