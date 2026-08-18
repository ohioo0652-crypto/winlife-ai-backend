const { ai, isAIConfigured } = require('../server');

function parseBody(req) {
  if (!req.body) return {};

  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      throw new Error('Invalid JSON body.');
    }
  }

  return req.body;
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return res.status(405).json({
      error: 'Method not allowed'
    });
  }

  try {
    const body = parseBody(req);

    if (body.type === 'ping') {
      return res.status(isAIConfigured() ? 200 : 503).json({
        ok: isAIConfigured(),
        service: 'solulu-ai'
      });
    }

    const response = await ai(body);

    return res.status(200).json({
      response
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: error.message || 'Server error'
    });
  }
};
