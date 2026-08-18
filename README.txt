SOLULU — PWA + AI READY STAGE

This package preserves the existing app UI and behavior.

PWA added:
• manifest.webmanifest
• service worker with app-shell caching
• Solulu install metadata and icons
• API routes are never cached

AI added/connected:
• Frontend now calls the same-origin /api/ai endpoint instead of localhost.
• server.js serves the app and proxies AI requests securely.
• OPENAI_API_KEY stays on the server, never in the PWA.
• POST /api/ai with {type:"ping"} reports Online when the server has a key.
• POST /api/ai with {message,context} returns {response}.
• Existing personalized context and progress-report frontend flow is preserved.

Run locally: set OPENAI_API_KEY, then `npm start`, then open http://localhost:3000.
For publishing, deploy this Node app to a host that supports Node 18+ and set OPENAI_API_KEY as a server environment variable. No black terminal is required for end users once hosted.

Source reference: OpenAI's current Responses API supports JavaScript client/server calls and server-side API keys.
