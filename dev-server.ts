import { createApp } from "./server";

/**
 * Local development server - unchanged behaviour from before the Vercel split.
 *
 * Serves the API and mounts Vite in middleware mode on the same origin and the
 * same port, so `npm run dev` works exactly as it always has. Vite is imported
 * dynamically and only here, which is what keeps it out of the production and
 * serverless runtimes entirely.
 */
const PORT = Number(process.env.PORT) || 3000;

async function startDevServer() {
  const app = createApp();

  const { createServer: createViteServer } = await import("vite");
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Veggie Story Studio running on http://localhost:${PORT}`);
  });
}

startDevServer().catch((err) => {
  console.error("Fatal error starting Veggie Story Studio dev server:", err);
  process.exit(1);
});
