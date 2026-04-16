import type { Router, Request, Response } from "express";
import express from "express";
import { eq, sql } from "drizzle-orm";
import type { Deps } from "./router";
import { schema } from "../db";

export function createFavoritesController({ uiDb }: Deps): Router {
  const router = express.Router();

  router.get("/lists", async (_req: Request, res: Response) => {
    try {
      const lists = await uiDb
        .select({
          id: schema.uiFavoriteLists.id,
          name: schema.uiFavoriteLists.name,
          createdAt: schema.uiFavoriteLists.createdAt,
          updatedAt: schema.uiFavoriteLists.updatedAt,
          count: sql<number>`(
            SELECT COUNT(*) FROM ui_favorites
            WHERE ui_favorites.list_id = ${schema.uiFavoriteLists.id}
          )`.as("count"),
        })
        .from(schema.uiFavoriteLists)
        .orderBy(schema.uiFavoriteLists.name);

      res.json({ items: lists });
    } catch (err) {
      console.error("GET /web/favorites/lists error", err);
      res.status(500).json({ message: "Failed to load favorite lists" });
    }
  });

  router.post("/lists", async (req: Request, res: Response) => {
    const name = String((req.body as any)?.name ?? "").trim();
    if (!name) {
      res.status(400).json({ message: "name required" });
      return;
    }
    try {
      const existing = await uiDb
        .select()
        .from(schema.uiFavoriteLists)
        .where(eq(schema.uiFavoriteLists.name, name))
        .limit(1);
      if (existing.length) {
        res.json({ id: existing[0].id });
        return;
      }
      const [created] = await uiDb
        .insert(schema.uiFavoriteLists)
        .values({ name })
        .returning({ id: schema.uiFavoriteLists.id });
      res.status(201).json({ id: created.id });
    } catch (err) {
      console.error("POST /web/favorites/lists error", err);
      res.status(500).json({ message: "Failed to create favorite list" });
    }
  });

  router.delete("/lists/:id", async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
      await uiDb
        .delete(schema.uiFavorites)
        .where(eq(schema.uiFavorites.listId, id));
      await uiDb
        .delete(schema.uiFavoriteLists)
        .where(eq(schema.uiFavoriteLists.id, id));
      res.status(204).end();
    } catch (err) {
      console.error("DELETE /web/favorites/lists/:id error", err);
      res.status(500).json({ message: "Failed to delete favorite list" });
    }
  });

  return router;
}
