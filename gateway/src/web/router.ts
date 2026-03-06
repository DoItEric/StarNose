import type { Router } from "express";
import express from "express";
import type { Pool } from "pg";
import type { PluginRegistry } from "../plugin-registry/types";
import { createRulesController } from "./rules-controller";
import { createPluginsController } from "./plugins-controller";
import { createDataController } from "./data-controller";
import { createDataAbandonController } from "./data-abandon-controller";
import { createAnalysisController } from "./analysis-controller";
import { createStatusController } from "./status-controller";

interface Deps {
  pool: Pool;
  pluginRegistry: PluginRegistry;
  logDir: string;
}

export function createWebRouter(deps: Deps): Router {
  const router = express.Router();

  router.use("/rules", createRulesController(deps));
  router.use("/plugins", createPluginsController(deps));
  router.use("/data", createDataController(deps));
  router.use("/data-abandon", createDataAbandonController(deps));
  router.use("/analysis", createAnalysisController(deps));
  router.use("/status", createStatusController(deps));

  return router;
}

