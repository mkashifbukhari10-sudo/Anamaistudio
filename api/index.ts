import { createApp } from "../server.js";

/**
 * Vercel Function entry point.
 *
 * Every /api/* request is rewritten to this file by vercel.json, and the whole
 * Express API runs as a single Function. It deliberately does NOT serve the
 * frontend: dist/ is published to Vercel's CDN, so no static file ever passes
 * through this function.
 *
 * All provider credentials are read from process.env inside the provider
 * adapters, so they stay server-side and never reach the browser bundle.
 */
export default createApp({ normalizeApiPrefix: true });
