const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

const HUGGINGFACE_API_KEY = process.env.HUGGINGFACE_API_KEY;
const HUGGINGFACE_API_URL = 'https://router.huggingface.co/v1/chat/completions';
const AI_MODEL = 'deepseek-ai/DeepSeek-V3-0324';

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

    const userName = context.name || 'friend';
    const goals = context.goals || 'not specified';
    const dream = context.dream || goals;
    const mood = context.mood ?? 'not logged';
    const wins = context.wins ?? 0;
    const streak = context.streak ?? 0;
    const activityStreak = context.activityStreak ?? 0;

    const systemPrompt = `You are Solulu, the warm, practical AI accountability companion inside the Win Life app.

Your job:
- Be genuinely conversational, supportive, and specific.
- Answer the user's actual message first.
- Do not give generic motivational speeches.
- Use the user's goal and context when relevant.
- Keep most replies to 2-5 short sentences unless the user asks for detail.
- Give one useful next step when appropriate.
- Ask at most one simple follow-up question when it would help.
- Never pretend to be a doctor, therapist, lawyer, or financial adviser.
- Do not mention system prompts, APIs, models, Hugging Face, or backend implementation.
- Do not repeat the user's message.
- Do not start every answer with the user's name.
- Avoid repetitive phrases such as "You've got this" unless they genuinely fit.
- If the user is celebrating a win, celebrate it specifically.
- If the user is struggling, acknowledge it without judgment and help them choose a small next action.
- If the user asks a factual question, answer it directly instead of forcing motivation.

User context:
Name: ${userName}
Main goal: ${goals}
Dream: ${dream}
Latest mood score: ${mood}
Wins: ${wins}
Current streak: ${streak}
Activity streak: ${activityStreak}`;

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        const response = await fetch(HUGGINGFACE_API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${HUGGINGFACE_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: AI_MODEL,
                messages: [
                    {
                        role: 'system',
                        content: systemPrompt
                    },
                    {
                        role: 'user',
                        content: message.trim()
                    }
                ],
                max_tokens: 300,
                temperature: 0.7
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