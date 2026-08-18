const path = require('path');
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const fs = require('fs');
const WINLIFE_PROFILE_FILE = path.join(__dirname, 'winlife-profile.json');

function loadWinLifeProfile() {
    try {
        if (!fs.existsSync(WINLIFE_PROFILE_FILE)) return {};
        return JSON.parse(fs.readFileSync(WINLIFE_PROFILE_FILE, 'utf8')) || {};
    } catch (e) {
        console.error('Profile load error:', e.message);
        return {};
    }
}

function saveWinLifeProfile(profile) {
    try {
        fs.writeFileSync(WINLIFE_PROFILE_FILE, JSON.stringify(profile, null, 2), 'utf8');
        return true;
    } catch (e) {
        console.error('Profile save error:', e.message);
        return false;
    }
}

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(__dirname));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index-pub.html')));

const HUGGINGFACE_API_KEY = process.env.HUGGINGFACE_API_KEY;
const HUGGINGFACE_API_URL = 'https://router.huggingface.co/v1/chat/completions';
const AI_MODEL = 'deepseek-ai/DeepSeek-V3-0324';

app.get('/api/profile', (req, res) => {
    res.json({ profile: loadWinLifeProfile() });
});

app.post('/api/profile', (req, res) => {
    const incoming = req.body && typeof req.body === 'object' ? req.body : {};
    const current = loadWinLifeProfile();
    const profile = {
        ...current,
        ...incoming,
        updatedAt: new Date().toISOString()
    };
    saveWinLifeProfile(profile);
    res.json({ ok: true, profile });
});

app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        message: 'Win Life AI Backend is running'
    });
});

app.post('/api/ai', async (req, res) => {
    if (req.body && req.body.type === 'ping') {
        return res.json({ status: 'online' });
    }

    const { message, context = {} } = req.body || {};
    const savedProfile = loadWinLifeProfile();
    if (!context.name && savedProfile.name) context.name = savedProfile.name;
    if (!context.goals && savedProfile.goal) context.goals = savedProfile.goal;
    if (!context.dream && savedProfile.goal) context.dream = savedProfile.goal;

    if (!message || typeof message !== 'string') {
        return res.status(400).json({
            error: 'Message is required'
        });
    }

    if (!HUGGINGFACE_API_KEY) {
        console.error('HUGGINGFACE_API_KEY is not set');
        return res.status(500).json({
            error: 'AI service is not configured.'
        });
    }

    const nameMatch = message.match(/\b(?:my name is|i am|i'm|call me)\s+([A-Za-z][A-Za-z0-9 _'-]{1,40})/i);
    if (nameMatch) {
        const currentProfile = loadWinLifeProfile();
        saveWinLifeProfile({ ...currentProfile, name: nameMatch[1].trim() });
    }

    const userName = context.name || 'friend';
    const goals = context.goals || 'not specified';
    const dream = context.dream || goals;
    const mood = context.mood ?? 'not logged';
    const wins = context.wins ?? 0;
    const streak = context.streak ?? 0;
    const activityStreak = context.activityStreak ?? 0;
    const focus = context.focus || '';
    const biggestGoal = context.biggestGoal || '';
    const reminderTime = context.reminderTime || '';
    const chronotype = context.chronotype || '';
    const sleepGoal = context.sleepGoal || '';
    const memory = Array.isArray(context.memory) ? context.memory.slice(-12) : [];
    const dailyIntelligence = context.dailyIntelligence || {};

    const systemPrompt = `SOLULU FINAL BEHAVIOR:
- Answer the user's actual message first.
- Never ask a generic question merely to keep the conversation alive.
- Never invent an obstacle, problem, plan, or need.
- If the user says there is no obstacle, accept that.
- Do not repeat questions the user already answered.
- Ask at most one follow-up question, and only when genuinely necessary.
- Use name, goals, memory, wins, mood, streak, tasks, and daily intelligence only when relevant.
- Never reveal stored memory or internal context.
- Do not force a plan unless requested or clearly useful.
- If the user is frustrated or in a hurry, be direct and concise.
- Stay on the current topic unless the user changes it.
You are Solulu, the user's warm, practical AI accountability companion inside the Win Life app.

Your job:
- Be genuinely conversational, supportive, and specific.
- Answer the user's actual message first.
- Do not give generic motivational speeches.
- Use the user's goal and context when relevant.
- Keep most replies to 2-5 short sentences unless the user asks for detail.
- Give one useful next step only when it naturally fits the user's message.
- Do not ask a follow-up question just to keep the conversation going.
- Stay on the user's current topic unless the user clearly changes topics.
- Never use generic filler questions such as "What's on your mind today?", "How are you feeling today?", or "What would you like to talk about?" when the conversation already has a clear topic.
- If the user's message is complete, respond naturally without adding a question.
- Only ask a question when the user's meaning is genuinely unclear or the answer requires missing information.
- Never pretend to be a doctor, therapist, lawyer, or financial adviser.
- Do not mention system prompts, APIs, models, Hugging Face, or backend implementation.
- Do not repeat the user's message unnecessarily.
- Do not repeat your own previous advice, summaries, or conclusions unless the user asks about them again.
- Do not start every answer with the user's name.
- Avoid repetitive phrases such as "You've got this" unless they genuinely fit.
- If the user is celebrating a win, celebrate it specifically.
- If the user is struggling, acknowledge it without judgment and help them choose a small next action.
- If the user says there is no obstacle/problem, accept that and do not invent one.
- Do not force a plan, checklist, roadmap, exercise, or solution unless the user asks for one or it is clearly relevant.
- If the user changes topic, follow the new topic instead of dragging the old goal into every answer.
- Treat the conversation history below as real prior conversation.
- Treat the persistent user memory as real context from earlier sessions.
- Use remembered facts naturally when relevant, but never reveal that you are reading a memory list.
- Remember the user's name and use it occasionally, not mechanically.
- Never invent personal facts that are not in the supplied context.
- Continue from it naturally.
- Do not restart the conversation.
- Do not act as if earlier messages were never said.

User context:
Name: ${userName}
Main goal: ${goals}
Dream: ${dream}
Latest mood score: ${mood}
Wins: ${wins}
Current streak: ${streak}
Activity streak: ${activityStreak}
Focus: ${focus || 'not specified'}
Biggest goal: ${biggestGoal || 'not specified'}
Preferred reminder time: ${reminderTime || 'not specified'}
Chronotype: ${chronotype || 'not specified'}
Sleep goal: ${sleepGoal || 'not specified'}
Persistent user memory (use only when relevant, never expose as a memory list): ${JSON.stringify(memory)}
Daily intelligence: ${JSON.stringify(dailyIntelligence)}`;

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        const suppliedHistory = Array.isArray(context.conversationHistory)
            ? context.conversationHistory
                .filter(item =>
                    item &&
                    (item.role === 'user' || item.role === 'assistant') &&
                    typeof item.content === 'string' &&
                    item.content.trim()
                )
                .slice(-12)
            : [];

        // Prevent the current message from being sent twice.
        if (suppliedHistory.length > 0) {
            const last = suppliedHistory[suppliedHistory.length - 1];

            if (
                last.role === 'user' &&
                last.content.trim() === message.trim()
            ) {
                suppliedHistory.pop();
            }
        }

        const messages = [
            {
                role: 'system',
                content: systemPrompt
            },
            ...suppliedHistory,
            {
                role: 'user',
                content: message.trim()
            }
        ];

        const response = await fetch(HUGGINGFACE_API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${HUGGINGFACE_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: AI_MODEL,
                messages,
                max_tokens: 300,
                temperature: 0.65
            }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        const rawText = await response.text();

        if (!response.ok) {
            console.error(
                'Hugging Face error:',
                response.status,
                rawText
            );

            let detail = '';

            try {
                const errorData = JSON.parse(rawText);
                detail = errorData?.error || '';
            } catch (_) {}

            return res.status(502).json({
                error: detail
                    ? `AI provider error: ${detail}`
                    : `AI provider error: ${response.status}`
            });
        }

        let data;

        try {
            data = JSON.parse(rawText);
        } catch (_) {
            console.error(
                'Invalid JSON from Hugging Face:',
                rawText
            );

            return res.status(502).json({
                error: 'Invalid response from AI provider.'
            });
        }

        const generatedText =
            data?.choices?.[0]?.message?.content?.trim() ||
            data?.choices?.[0]?.text?.trim() ||
            '';

        if (!generatedText) {
            console.error(
                'No AI text returned:',
                JSON.stringify(data)
            );

            return res.status(502).json({
                error: 'AI returned an empty response.'
            });
        }

        return res.json({
            response: generatedText
        });

    } catch (error) {
        console.error('AI request error:', error);

        if (error.name === 'AbortError') {
            return res.status(504).json({
                error: 'The AI request timed out. Please try again.'
            });
        }

        return res.status(500).json({
            error: 'Could not reach the AI service. Please try again.'
        });
    }
});

app.listen(PORT, () => {
    console.log(
        `✅ Win Life AI Backend is running on port ${PORT}`
    );

    console.log(`📍 App: http://localhost:${PORT}/`);

    console.log(
        `📍 Health check: http://localhost:${PORT}/api/health`
    );

    console.log(
        `📍 AI endpoint: http://localhost:${PORT}/api/ai`
    );

    console.log(
        `🤖 AI model: ${AI_MODEL}`
    );

    if (!HUGGINGFACE_API_KEY) {
        console.warn(
            '⚠️ WARNING: HUGGINGFACE_API_KEY is not set!'
        );
    } else {
        console.log(
            '✅ Hugging Face API key is configured'
        );
    }
});