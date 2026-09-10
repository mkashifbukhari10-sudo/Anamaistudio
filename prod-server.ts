import path from "path";
import express from "express";
import { createApp } from "./server.js";

/**
 * Self-hosted production server (`npm start`).
 *
 * This is NOT the Vercel path - on Vercel the frontend is served by the CDN and
 * api/index.ts handles the API. This entry exists so the app can still run on a
 * plain Node host, where something has to serve the built frontend.
 *
 * The server bundle is emitted to build/server/, deliberately outside dist/, so
 * the public directory contains only frontend assets - no server bundle and no
 * server source map are reachable over HTTP.
 */
const PORT = Number(process.env.PORT) || 3000;
const DIST_PATH = path.resolve(process.cwd(), "dist");

const app = createApp();

app.use(express.static(DIST_PATH));
app.get("*", (_req, res) => {
  res.sendFile(path.join(DIST_PATH, "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Veggie Story Studio running on http://localhost:${PORT}`);
});
