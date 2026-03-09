import path from "node:path";
import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import morgan from "morgan";
import { createWebRouter } from "./web/router";
import { createPluginApiRouter } from "./pluginApi/router";
import { initScheduler } from "./scheduler";
import { initPluginRegistry } from "./plugin-registry";
import { createPgPool } from "./storage/pg";

// 显式从工作区根目录加载 .env（../.. 即 src 根）
dotenv.config({
  path: path.resolve(__dirname, "../../.env")
});

const app = express();

app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(morgan("dev"));

const logDir = path.join(__dirname, "../logs");

const pool = createPgPool();
const pluginRegistry = initPluginRegistry(
  path.join(__dirname, "plugins"),
  logDir
);

// 应用启动时，将插件注册信息初始化到 plugins 表中（若不存在则插入）
(async () => {
  const plugins = pluginRegistry.listPlugins();
  for (const plugin of plugins) {
    try {
      const existing = await pool.query(
        `SELECT id FROM plugins WHERE key = $1`,
        [plugin.key]
      );
      if (!existing.rowCount) {
        await pool.query(
          `INSERT INTO plugins (key, name, type, version, description)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            plugin.key,
            plugin.name,
            plugin.type,
            plugin.version,
            plugin.description ?? null
          ]
        );
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Failed to init plugins table for key:", plugin.key, err);
    }
  }
})();

app.use("/web", createWebRouter({ pool, pluginRegistry, logDir }));
app.use("/api", createPluginApiRouter({ pool, pluginRegistry, logDir }));

initScheduler({ pool, pluginRegistry, logDir });

const port = Number(process.env.PORT || 3000);

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`StarNose gateway listening on http://localhost:${port}`);
});
