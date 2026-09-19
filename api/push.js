import webpush from 'web-push';
import { kv } from '@vercel/kv';
import { buildMessage } from '../lib/messages.js';

webpush.setVapidDetails(
  'mailto:hello@solulu.app',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

function localHour(tz) {
  return parseInt(
    new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: tz }).format(new Date()),
    10
  );
}
function localDateKey(tz) {
  const p = new Intl.DateTimeFormat('en-CA', { year:'numeric', month:'2-digit', day:'2-digit', timeZone: tz })
    .formatToParts(new Date());
  return `${p.find(x=>x.type==='year').value}-${p.find(x=>x.type==='month').value}-${p.find(x=>x.type==='day').value}`;
}

export default async function handler(req, res) {
  const body = req.body || {};

  /* ─── SAVE / UPDATE SUBSCRIPTION ─── */
  if (body.action === 'subscribe') {
    if (!body.subscription?.endpoint) return res.status(400).json({ error: 'no_subscription' });
    const id = body.subscription.endpoint;

    const existingRaw = await kv.hget('solulu:subs', id);
    const existing = existingRaw ? JSON.parse(existingRaw) : null;

    const record = {
      subscription: body.subscription,
      timezone: body.timezone || 'UTC',
      name: body.name || 'friend',
      goal: body.goal || '',
      reminderTime: body.reminderTime || '07:30',
      preferences: body.preferences || { morning:true, tasks:true, streak:true, reflect:true, focus:true, goal:true, vision:true, discovery:true },
      // live state from client
      streak: body.streak || 0,
      tasksLeft: body.tasksLeft || 0,
      prayerDone: body.prayerDone || false,
      moodLogged: body.moodLogged || false,
      focusDone: body.focusDone || false,
      visionDays: body.visionDays || 0,
      levelName: body.levelName || '',
      levelUp: body.levelUp || false,
      createdAt: existing?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await kv.hset('solulu:subs', { [id]: JSON.stringify(record) });
    await kv.sadd('solulu:all', id);
    return res.json({ ok: true });
  }

  /* ─── UNSUBSCRIBE ─── */
  if (body.action === 'unsubscribe') {
    const id = body.endpoint;
    if (!id) return res.status(400).json({ error: 'no_endpoint' });
    await kv.hdel('solulu:subs', id);
    await kv.srem('solulu:all', id);
    return res.json({ ok: true });
  }

  /* ─── CRON: SEND DUE NOTIFICATIONS ─── */
  if (body.action === 'cron') {
    const ids = (await kv.smembers('solulu:all')) || [];
    let sent = 0, skipped = 0, failed = 0;

    for (const id of ids) {
      try {
        const raw = await kv.hget('solulu:subs', id);
        if (!raw) { skipped++; continue; }
        const u = JSON.parse(raw);

        const tz = u.timezone || 'UTC';
        const hour = localHour(tz);
        const dateKey = localDateKey(tz);

        // quiet hours
        if (hour >= 22 || hour < 6) { skipped++; continue; }

        const sentToday = (await kv.get(`solulu:count:${id}:${dateKey}`)) || 0;
        const lastRaw = await kv.get(`solulu:last:${id}`);
        const last = lastRaw ? JSON.parse(lastRaw) : null;

        // frequency cap and spacing
        if (sentToday >= 4) { skipped++; continue; }
        if (last?.at && Date.now() - new Date(last.at).getTime() < 90 * 60 * 1000) { skipped++; continue; }

        const msg = buildMessage({
          ...u,
          hour, sentToday,
          lastTag: last?.tag || null
        });
        if (!msg) { skipped++; continue; }

        await webpush.sendNotification(u.subscription, JSON.stringify({
          title: msg.title,
          body: msg.body,
          url: msg.url,
          tag: msg.tag
        }));

        await kv.incr(`solulu:count:${id}:${dateKey}`);
        await kv.set(`solulu:last:${id}`, JSON.stringify({ tag: msg.tag, at: new Date().toISOString() }), { ex: 60 * 60 * 24 * 30 });
        sent++;
      } catch (err) {
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          await kv.hdel('solulu:subs', id);
          await kv.srem('solulu:all', id);
        } else {
          console.warn('push failed', id, err?.message);
        }
        failed++;
      }
    }

    return res.json({ ok: true, sent, skipped, failed, total: ids.length });
  }

  return res.status(400).json({ error: 'unknown_action' });
}
