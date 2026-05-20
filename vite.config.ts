import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import type { HandlerEvent } from "@netlify/functions";

function netlifyFunctionsDev(env: Record<string, string>): Plugin {
  return {
    name: "netlify-functions-dev",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url ?? "";
        if (!url.startsWith("/.netlify/functions/talent-report")) {
          return next();
        }

        if (req.method !== "POST") {
          res.statusCode = 405;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "Разрешён только метод POST." }));
          return;
        }

        for (const [key, value] of Object.entries(env)) {
          if (value) process.env[key] = value;
        }

        try {
          const chunks: Buffer[] = [];
          for await (const chunk of req) {
            chunks.push(Buffer.from(chunk));
          }
          const body = Buffer.concat(chunks).toString("utf8");

          const { handler } = await server.ssrLoadModule(
            "/netlify/functions/talent-report.ts",
          );

          const event = {
            httpMethod: "POST",
            body,
            headers: req.headers as HandlerEvent["headers"],
            path: url,
            rawUrl: url,
            isBase64Encoded: false,
          } as HandlerEvent;

          const result = await handler(event, {} as never);
          res.statusCode = result.statusCode ?? 200;
          for (const [key, value] of Object.entries(result.headers ?? {})) {
            if (value) res.setHeader(key, value);
          }
          res.end(result.body ?? "");
        } catch (error) {
          console.error("Dev function error:", error);
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({
              error: "Ошибка локального запуска функции.",
              source: "dev-server",
            }),
          );
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [react(), netlifyFunctionsDev(env)],
  };
});
