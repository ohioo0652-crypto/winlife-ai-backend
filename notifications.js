const BACKEND = 'https://winlife-ai-backend.vercel.app';
const VAPID_PUBLIC_KEY = 'BHyJEEwNxjMHlEc72kxu9onKGxKUdq0-PbcJzmZ_xMb5mmgqtGAMYzf_xgmwLswNvH3k9ZV5OVGFcU2kudbcYwg';

function urlBase64ToUint8Array(b) {
  const pad = '='.repeat((4 - b.length % 4) % 4);
  const s = (b + pad).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from([...atob(s)].map(c => c.charCodeAt(0)));
}

function buildSnapshot() {
  const d = new Date();
  const today = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const s = window.state || {};
  const tasksLeft = (s.calendarTasks || []).filter(x => x.date === today && !x.done && !x.completedEarly).length;
  const moodLogged = (s.moodLog || []).some(m => m.date === today);
  const prayerDone = s.streak?.lastDate === today;
  const focusDone = s.focusToday?.date === today && (s.focusToday?.count || 0) > 0;
  let visionDays = 99;
  if ((s.board || []).length) {
    const latest = s.board.map(b => b.dateAdded).filter(Boolean).sort().pop();
    if (latest) visionDays = Math.floor((new Date(today) - new Date(latest)) / 86400000);
  }
  return {
    name: s.onboardAnswers?.name || 'friend',
    goal: s.goalAnswers?.dream || s.onboardAnswers?.biggestGoal || '',
    streak: s.activityStreak?.count || s.streak?.count || 0,
    tasksLeft, prayerDone, moodLogged, focusDone, visionDays,
    levelName: (typeof levelForXp === 'function' && s.xp !== undefined) ? levelForXp(s.xp).name : '',
    reminderTime: s.onboardAnswers?.reminderTime || '07:30',
    preferences: s.notificationPrefs || { morning:true, tasks:true, streak:true, reflect:true, focus:true, goal:true, vision:true, discovery:true }
  };
}

window.enableSoluluPush = async function () {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) { if (window.showToast) showToast('⚠️ Not supported'); return false; }
  try {
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) });
    await fetch(`${BACKEND}/api/push`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ action:'subscribe', subscription: sub.toJSON(), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, ...buildSnapshot() })
    });
    if (window.Storage) Storage.set('push-sub', sub.toJSON());
    if (window.showToast) showToast('🔔 Reminders on!');
    return true;
  } catch (e) { console.error(e); if (window.showToast) showToast('⚠️ Could not enable'); return false; }
};

let __syncT = null;
window.syncSoluluPush = function () {
  clearTimeout(__syncT);
  __syncT = setTimeout(async () => {
    const sub = window.Storage ? Storage.get('push-sub', null) : null;
    if (!sub) return;
    try {
      await fetch(`${BACKEND}/api/push`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ action:'subscribe', subscription: sub, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, ...buildSnapshot() })
      });
    } catch {}
  }, 4000);
};

window.testSoluluPush = async function () {
  const reg = await navigator.serviceWorker.ready;
  reg.active?.postMessage({ type:'TEST_NOTIFICATION', title:'SoluluMind 🌸', body:"Everything's working. Your first real reminder arrives soon." });
  if (window.showToast) showToast('📨 Test sent');
};
