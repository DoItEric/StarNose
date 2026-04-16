import type { Router, Request, Response } from "express";
import express from "express";
import { eq } from "drizzle-orm";
import type { Deps } from "./router";
import { schema } from "../db";

export function createTrackingController({ bizPool, uiDb }: Deps): Router {
  const router = express.Router();

  router.get("/", async (req: Request, res: Response) => {
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(200, Math.max(1, Number(req.query.pageSize) || 50));
    const offset = (page - 1) * pageSize;

    try {
      const trackRows = await uiDb
        .select()
        .from(schema.uiTracking)
        .orderBy(schema.uiTracking.createdAt)
        .limit(pageSize)
        .offset(offset);

      if (!trackRows.length) {
        res.json({ items: [], total: 0 });
        return;
      }

      const dataItemIds = trackRows.map((r) => r.dataItemId);
      const placeholders = dataItemIds.map((_, i) => `$${i + 1}`).join(",");

      const bizRes = await bizPool.query(
        `SELECT
           id,
           source_id AS "sourceId",
           content_type AS "contentType",
           content,
           url,
           attrs,
           channel,
           author,
           fetch_at AS "fetchAt",
           post_at AS "postAt"
         FROM data_items
         WHERE id IN (${placeholders})`,
        dataItemIds
      );

      const bizMap = new Map<string, any>();
      for (const row of bizRes.rows) bizMap.set(row.id, row);

      const items = trackRows.map((t) => ({
        ...t,
        dataItem: bizMap.get(t.dataItemId) ?? null,
      }));

      res.json({ items, total: items.length });
    } catch (err) {
      console.error("GET /web/tracking error", err);
      res.status(500).json({ message: "Failed to load tracking items" });
    }
  });

  router.delete("/:dataItemId", async (req: Request, res: Response) => {
    const { dataItemId } = req.params;
    try {
      await uiDb
        .delete(schema.uiTracking)
        .where(eq(schema.uiTracking.dataItemId, dataItemId));
      res.status(204).end();
    } catch (err) {
      console.error("DELETE /web/tracking/:dataItemId error", err);
      res.status(500).json({ message: "Failed to remove tracking" });
    }
  });

  return router;
}
