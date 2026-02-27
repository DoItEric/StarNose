import type { Router, Request, Response } from "express";
import express from "express";
import type { Pool } from "pg";
import type { PluginRegistry } from "../plugin-registry/types";
import type { ListTrackingResponse } from "starnose-api-model";

interface Deps {
  pool: Pool;
  pluginRegistry: PluginRegistry;
  logDir: string;
}

export function createTrackingApi({ pool }: Deps): Router {
  const router = express.Router();

  router.get("/", async (_req: Request, res: Response) => {
    try {
      const dbResult = await pool.query(
        `SELECT
           unique_key AS "uniqueKey",
           source
         FROM tracking_items`
      );

      const result: ListTrackingResponse = {
        items: dbResult.rows
      };
      res.json(result);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("GET /api/tracking error", err);
      res.status(500).json({ message: "Failed to load tracking list" });
    }
  });

  return router;
}

