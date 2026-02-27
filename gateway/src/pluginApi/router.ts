import type { Router } from "express";
import express from "express";
import type { Pool } from "pg";
import type { PluginRegistry } from "../plugin-registry/types";
import { createRulesApi } from "./rules-api";
import { createTrackingApi } from "./tracking-api";
import { createDataApi } from "./data-api";
import { createValidateApi } from "./validate-api";

interface Deps {
  pool: Pool;
  pluginRegistry: PluginRegistry;
  logDir: string;
}

export function createPluginApiRouter(deps: Deps): Router {
  const router = express.Router();

  router.use("/rules", createRulesApi(deps));
  router.use("/tracking", createTrackingApi(deps));
  router.use("/data", createDataApi(deps));
  router.use("/validate", createValidateApi(deps));

  return router;
}

