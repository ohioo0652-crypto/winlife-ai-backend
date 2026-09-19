export function buildMessage(u) {
  const {
    name = 'friend', goal = '', reminderTime = '07:30',
    hour = 12, sentToday = 0, lastTag = null, preferences = {},
    streak = 0, tasksLeft = 0, prayerDone = false, moodLogged = false,
    focusDone = false, visionDays = 99, levelName = '', levelUp = false
  } = u;

  const prefs = { morning:true, tasks:true, streak:true, reflect:true, focus:true, goal:true, vision:true, discovery:true, ...preferences };
  if (sentToday >= 4) return null;
  if (hour >= 22 || hour < 6) return null;

  const shortGoal = goal.length > 60 ? goal.slice(0, 57) + '…' : goal;
  const remindHour = parseInt(String(reminderTime).split(':')[0], 10);

  if (prefs.streak && hour >= 20 && !prayerDone && streak >= 3)
    return { tag:'streak', title:`${name} — your streak is still alive 🔥`, body:`${streak} days of showing up. It just needs one small prayer before midnight. Don't let today be the day it ends.`, url:'./index-pub.html#prayer' };

  if (prefs.morning && hour === remindHour && !prayerDone)
    return { tag:'morning', title:`Good morning, ${name} 🌅`, body:`Today is a blank page. Two minutes with your prayer and one affirmation — and you've already won the morning.`, url:'./index-pub.html#prayer' };

  if (prefs.tasks && tasksLeft > 0 && hour >= 12 && hour < 17)
    return { tag:'tasks', title:`Pick the smallest one, ${name} ✅`, body:`${tasksLeft} ${tasksLeft===1?'thing is':'things are'} waiting today. Start with the easy one — momentum does the rest.`, url:'./index-pub.html#calendar' };

  if (prefs.focus && !focusDone && hour >= 14 && hour < 18)
    return { tag:'focus', title:`Your mind has one good block in it today ⏱️`, body:`25 minutes. No notifications. Just you and one thing. That's the whole ask.`, url:'./index-pub.html#focus' };

  if (prefs.reflect && !moodLogged && hour >= 19 && hour < 22)
    return { tag:'reflect', title:`Before today closes 🌙`, body:`One line about how it actually went. Future you will read this one day — and thank you.`, url:'./index-pub.html#mood-sleep' };

  if (prefs.vision && visionDays >= 3 && hour >= 10 && hour < 21)
    return { tag:'vision', title:`Your dream is still waiting 🖼️`, body:`Add one image to your vision board today. Just one — that's how it stays alive.`, url:'./index-pub.html#vision' };

  if (levelUp && levelName)
    return { tag:'levelup', title:`You just became ${levelName} 👑`, body:`Look at you. This is what showing up looks like. Keep going.`, url:'./index-pub.html#progress' };

  if (prefs.goal && goal && hour >= 10 && hour < 21 && sentToday === 0)
    return { tag:'goal', title:`One small step, ${name} 🎯`, body:`What's one thing today that moves "${shortGoal}" forward — even 1%?`, url:'./index-pub.html#progress' };

  if (prefs.discovery && hour >= 10 && hour < 21 && sentToday === 0)
    return pickDiscovery({ name, shortGoal, goal, lastTag });

  return null;
}

function pickDiscovery({ name, shortGoal, goal, lastTag }) {
  const pool = [
    { tag:'discover-ai', title:`Stuck on something, ${name}? 🦋`, body: goal ? `Ask me to break "${shortGoal}" into 3 small steps. Takes 30 seconds.` : `Ask me anything — I'll help you plan today.`, url:'./index-pub.html#ai' },
    { tag:'discover-sats', title:`Try SATS tonight 🌙`, body:`Right before sleep is when manifestation works best. Two minutes of visualizing your wish fulfilled.`, url:'./index-pub.html#sats' },
    { tag:'discover-wins', title:`Tiny wins count too 🏆`, body:`Check off one win from today. It trains your brain to notice progress — even the small stuff.`, url:'./index-pub.html#wins' },
    { tag:'discover-alterego', title:`Write as your future self 🦋`, body:`Three lines. Present tense. "Today I woke up as the person I'm becoming…" Try it tonight.`, url:'./index-pub.html#future' },
    { tag:'discover-journal', title:`Your journal misses you 📝`, body: goal ? `One small step toward "${shortGoal}" today? Write it down — it becomes real.` : `Two lines. That's all I'm asking.`, url:'./index-pub.html#journal' },
    { tag:'discover-meditate', title:`Two minutes of stillness 🧘`, body:`Breathe in as the orb grows. Breathe out as it falls. That's the whole practice.`, url:'./index-pub.html#meditate' },
    { tag:'discover-affirm', title:`Your affirmations are waiting 🌸`, body:`Even one counts. Say it out loud — your brain believes what it hears.`, url:'./index-pub.html#affirm' },
    { tag:'discover-reflect', title:`A quiet moment with yourself 💭`, body:`What went well this week? What's one thing you'd do differently? Two minutes, that's it.`, url:'./index-pub.html#reflect' }
  ];
  const filtered = pool.filter(m => m.tag !== lastTag);
  return filtered[Math.floor(Math.random() * filtered.length)] || pool[0];
}
