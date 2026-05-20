// /api/webhook.js — Recebe dados do SendFlow e salva no Supabase

const SUPABASE_URL  = 'https://dpiovtnsztstvybyrieq.supabase.co';
const CAMPAIGN_ID   = 'Q8ezymXY1DNIi8JR2t3z';

export default async function handler(req, res) {
  // Apenas POST
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
    console.log('Webhook received:', JSON.stringify(body));

    const eventType = body.type || body.event || '';

    // Evento em tempo real: entrada ou saída
    if (eventType === 'input' || eventType === 'output' ||
        body.inputAmount !== undefined || body.outputAmount !== undefined) {

      // Se tiver dados agregados (envio 3x/dia)
      if (body.groupsTotalAmount !== undefined || body.participantsAmount !== undefined) {
        const snapshot = {
          campaign_id:         CAMPAIGN_ID,
          group_name:          body.groupName || null,
          participants_amount: body.participantsAmount  || 0,
          clicks_amount:       body.clicksTotalCount    || 0,
          is_full:             body.isFull              || false,
          groups_total:        body.groupsTotalAmount   || 0,
          groups_open:         body.groupsOpenAmount    || 0,
          groups_full:         body.groupsFullAmount    || 0,
          input_amount:        body.inputAmount         || 0,
          output_amount:       body.outputAmount        || 0,
          clicks_total:        body.clicksTotalCount    || 0,
        };

        const r = await fetch(`${SUPABASE_URL}/rest/v1/group_snapshots`, {
          method: 'POST',
          headers,
          body: JSON.stringify(snapshot),
        });

        if (!r.ok) {
          const err = await r.text();
          console.error('Supabase snapshot error:', err);
          return res.status(500).json({ error: 'Failed to save snapshot', detail: err });
        }

        return res.status(200).json({ ok: true, saved: 'snapshot' });
      }

      // Evento simples em tempo real
      const event = {
        campaign_id: CAMPAIGN_ID,
        event_type:  eventType || (body.inputAmount ? 'input' : 'output'),
        amount:      body.inputAmount || body.outputAmount || 1,
        group_name:  body.groupName || null,
        raw:         body,
      };

      const r = await fetch(`${SUPABASE_URL}/rest/v1/realtime_events`, {
        method: 'POST',
        headers,
        body: JSON.stringify(event),
      });

      if (!r.ok) {
        const err = await r.text();
        console.error('Supabase event error:', err);
        return res.status(500).json({ error: 'Failed to save event', detail: err });
      }

      return res.status(200).json({ ok: true, saved: 'event' });
    }

    // Payload genérico — salva como snapshot
    const snapshot = {
      campaign_id:         CAMPAIGN_ID,
      group_name:          body.groupName          || null,
      participants_amount: body.participantsAmount  || 0,
      clicks_amount:       body.clicksTotalCount    || body.clicksAmount || 0,
      is_full:             body.isFull              || false,
      groups_total:        body.groupsTotalAmount   || 0,
      groups_open:         body.groupsOpenAmount    || 0,
      groups_full:         body.groupsFullAmount    || 0,
      input_amount:        body.inputAmount         || 0,
      output_amount:       body.outputAmount        || 0,
      clicks_total:        body.clicksTotalCount    || 0,
    };

    const r = await fetch(`${SUPABASE_URL}/rest/v1/group_snapshots`, {
      method: 'POST',
      headers,
      body: JSON.stringify(snapshot),
    });

    if (!r.ok) {
      const err = await r.text();
      return res.status(500).json({ error: 'Failed to save', detail: err });
    }

    return res.status(200).json({ ok: true, saved: 'snapshot' });

  } catch (err) {
    console.error('Webhook error:', err);
    return res.status(500).json({ error: err.message });
  }
}
