const SUPABASE_URL = 'https://dpiovtnsztstvybyrieq.supabase.co';
 
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
 
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseKey) {
    return res.status(500).json({ error: 'SUPABASE_SERVICE_KEY not configured' });
  }
 
  const headers = {
    'Content-Type': 'application/json',
    'apikey': supabaseKey,
    'Authorization': `Bearer ${supabaseKey}`,
  };
 
  try {
    const body = req.body || {};
    const event = body.event || '';
    const data  = body.data || body;
    const campaignId = data.campaignId || data.campaign_id || 'unknown';
 
    console.log('Webhook received event:', event, JSON.stringify(body).slice(0, 300));
 
    // Métricas gerais da campanha (enviadas 3x por dia)
    if (event === 'campaign.metrics') {
      const snapshot = {
        campaign_id:         campaignId,
        group_name:          null,
        participants_amount: data.participantsAmount  || 0,
        clicks_amount:       data.clicksTotalCount    || 0,
        is_full:             false,
        groups_total:        data.groupsTotalAmount   || 0,
        groups_open:         data.groupsOpenAmount    || 0,
        groups_full:         data.groupsFullAmount    || 0,
        input_amount:        data.inputAmount         || 0,
        output_amount:       data.outputAmount        || 0,
        clicks_total:        data.clicksTotalCount    || 0,
      };
 
      const r = await fetch(`${SUPABASE_URL}/rest/v1/group_snapshots`, {
        method: 'POST',
        headers,
        body: JSON.stringify(snapshot),
      });
 
      if (!r.ok) {
        const err = await r.text();
        console.error('Supabase error:', err);
        return res.status(500).json({ error: err });
      }
 
      return res.status(200).json({ ok: true, saved: 'snapshot', event });
    }
 
    // Membro adicionado
    if (event === 'group.updated.members.added') {
      const evt = {
        campaign_id: campaignId,
        event_type:  'input',
        amount:      1,
        group_name:  data.groupName || null,
        raw:         body,
      };
 
      const r = await fetch(`${SUPABASE_URL}/rest/v1/realtime_events`, {
        method: 'POST',
        headers,
        body: JSON.stringify(evt),
      });
 
      if (!r.ok) {
        const err = await r.text();
        console.error('Supabase error:', err);
        return res.status(500).json({ error: err });
      }
 
      return res.status(200).json({ ok: true, saved: 'event', event });
    }
 
    // Membro removido
    if (event === 'group.updated.members.removed') {
      const evt = {
        campaign_id: campaignId,
        event_type:  'output',
        amount:      1,
        group_name:  data.groupName || null,
        raw:         body,
      };
 
      const r = await fetch(`${SUPABASE_URL}/rest/v1/realtime_events`, {
        method: 'POST',
        headers,
        body: JSON.stringify(evt),
      });
 
      if (!r.ok) {
        const err = await r.text();
        return res.status(500).json({ error: err });
      }
 
      return res.status(200).json({ ok: true, saved: 'event', event });
    }
 
    // Evento desconhecido — salva como snapshot genérico
    const snapshot = {
      campaign_id:         campaignId,
      group_name:          data.groupName || null,
      participants_amount: data.participantsAmount || 0,
      clicks_amount:       data.clicksTotalCount   || 0,
      is_full:             data.isFull             || false,
      groups_total:        data.groupsTotalAmount  || 0,
      groups_open:         data.groupsOpenAmount   || 0,
      groups_full:         data.groupsFullAmount   || 0,
      input_amount:        data.inputAmount        || 0,
      output_amount:       data.outputAmount       || 0,
      clicks_total:        data.clicksTotalCount   || 0,
    };
 
    await fetch(`${SUPABASE_URL}/rest/v1/group_snapshots`, {
      method: 'POST', headers,
      body: JSON.stringify(snapshot),
    });
 
    return res.status(200).json({ ok: true, saved: 'generic', event });
 
  } catch (err) {
    console.error('Webhook error:', err);
    return res.status(500).json({ error: err.message });
  }
}
