import type { Router, Request, Response } from "express";
import express from "express";
import type { Pool } from "pg";
import type { PluginRegistry } from "../plugin-registry/types";
import type { SchedulerStatus } from "../api-model";

interface Deps {
  pool: Pool;
  pluginRegistry: PluginRegistry;
}

export function createStatusController({ pluginRegistry }: Deps): Router {
  const router = express.Router();

  router.get("/", async (_req: Request, res: Response) => {
    const status: SchedulerStatus = {
      registeredPlugins: pluginRegistry.listPlugins().length,
      queueLength: 0,
      recentErrorCount24h: 0
    };
    res.json(status);
  });

  return router;
}

