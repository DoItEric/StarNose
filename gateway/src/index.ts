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
  path.resolve(__dirname, "../../plugins"),
  logDir
);

app.use("/web", createWebRouter({ pool, pluginRegistry }));
app.use("/api", createPluginApiRouter({ pool, pluginRegistry, logDir }));

initScheduler({ pool, pluginRegistry, logDir });

const port = Number(process.env.PORT || 3000);

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`StarNose gateway listening on http://localhost:${port}`);
});
