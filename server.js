require('dotenv').config();
const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;

const GROQ_MODEL =
  process.env.GROQ_MODEL || 'openai/gpt-oss-120b';

function getGroqKey() {
  return process.env.GROQ_API_KEY || '';
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon'
};

function send(
  res,
  status,
  data,
  type = 'application/json; charset=utf-8'
) {
  res.writeHead(status, {
    'Content-Type': type,
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*'
  });

  res.end(
    typeof data === 'string' ? data : JSON.stringify(data)
  );
}

function body(req) {
  return new Promise((resolve, reject) => {
    let s = '';

    req.on('data', c => {
      s += c;

      if (s.length > 1000000) {
        req.destroy();
      }
    });

    req.on('end', () => {
      try {
        resolve(s ? JSON.parse(s) : {});
      } catch (e) {
        reject(e);
      }
    });

    req.on('error', reject);
  });
}

function systemPrompt() {
  return `You are Solulu, a warm, practical personal accountability companion. Preserve the user's autonomy: never make AI feel required for journaling, meditation, prayer, reflection, or everyday app use. Be concise, supportive, specific, and non-judgmental. Use the supplied user context only when relevant. For progress reports, distinguish clearly between AI-generated progress analysis and the user's own written reflection. Do not invent activity data.`;
}

async function ai(reqBody) {
  const GROQ_API_KEY = getGroqKey();

  if (!GROQ_API_KEY) {
    throw new Error(
      'GROQ_API_KEY is not configured on the server.'
    );
  }

  const message = String(reqBody.message || '').trim();

  if (!message) {
    throw new Error('Message is required.');
  }

  const context = reqBody.context || {};

  const prompt = `${systemPrompt()}

User message:
${message}

User context:
${JSON.stringify(context)}`;

  const r = await fetch(
    'https://api.groq.com/openai/v1/chat/completions',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          {
            role: 'system',
            content: systemPrompt()
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 900,
        temperature: 0.7
      })
    }
  );

  const data = await r.json();

  if (!r.ok) {
    throw new Error(
      data?.error?.message ||
        `Groq request failed (${r.status})`
    );
  }

  const text = String(
    data?.choices?.[0]?.message?.content || ''
  ).trim();

  if (!text) {
    throw new Error('AI returned no text.');
  }

  return text;
}

const server = http.createServer(async (req, res) => {
  try {
    const u = new URL(
      req.url,
      `http://${req.headers.host || 'localhost'}`
    );

    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
      });

      return res.end();
    }

    if (req.method === 'POST' && u.pathname === '/api/ai') {
      const b = await body(req);

      if (b.type === 'ping') {
        return send(
          res,
          getGroqKey() ? 200 : 503,
          {
            ok: !!getGroqKey(),
            service: 'solulu-ai'
          }
        );
      }

      const response = await ai(b);

      return send(res, 200, { response });
    }

    if (
      req.method === 'GET' &&
      u.pathname === '/api/health'
    ) {
      return send(res, 200, {
        ok: true,
        aiConfigured: !!getGroqKey()
      });
    }

    let pathname = decodeURIComponent(u.pathname);

    if (pathname === '/' || pathname === '') {
      pathname = '/index-pub.html';
    }

    const file = path.normalize(
      path.join(ROOT, pathname)
    );

    if (!file.startsWith(ROOT)) {
      return send(res, 403, {
        error: 'Forbidden'
      });
    }

    fs.stat(file, (err, st) => {
      if (err || !st.isFile()) {
        return send(res, 404, {
          error: 'Not found'
        });
      }

      res.writeHead(200, {
        'Content-Type':
          MIME[path.extname(file).toLowerCase()] ||
          'application/octet-stream'
      });

      fs.createReadStream(file).pipe(res);
    });
  } catch (e) {
    console.error(e);

    send(res, 500, {
      error: e.message || 'Server error'
    });
  }
});

if (require.main === module) {
  server.listen(PORT, () =>
    console.log(`Solulu running on port ${PORT}`)
  );
}

module.exports = {
  ai,
  isAIConfigured: () => !!getGroqKey()
};

