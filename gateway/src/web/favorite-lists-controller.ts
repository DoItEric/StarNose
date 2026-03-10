import type { Router, Request, Response } from "express";
import express from "express";
import type { Pool } from "pg";

interface Deps {
  pool: Pool;
}

export function createFavoriteListsController({ pool }: Deps): Router {
  const router = express.Router();

  router.get("/", async (_req: Request, res: Response) => {
    try {
      const listsRes = await pool.query<{
        id: string;
        name: string;
        createdAt: string;
        updatedAt: string;
      }>(
        `SELECT id, name, created_at AS "createdAt", updated_at AS "updatedAt"
           FROM favorite_lists
          ORDER BY lower(name) ASC`
      );
      const cntRes = await pool.query<{ id: string; cnt: string }>(
        `SELECT fl.id, COUNT(fi.id) AS cnt
           FROM favorite_lists fl
           LEFT JOIN favorite_items fi ON fi.list_id = fl.id
          GROUP BY fl.id`
      );
      const countMap: Record<string, number> = {};
      for (const r of cntRes.rows) countMap[r.id] = Number(r.cnt ?? 0);
      res.json({
        items: listsRes.rows.map((r) => ({
          ...r,
          count: countMap[r.id] ?? 0
        }))
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("GET /web/favorite-lists error", err);
      res.status(500).json({ message: "Failed to load favorite lists" });
    }
  });

  router.post("/", async (req: Request, res: Response) => {
    const name = String((req.body as any)?.name ?? "").trim();
    if (!name) {
      res.status(400).json({ message: "name required" });
      return;
    }
    try {
      const existed = await pool.query<{ id: string }>(
        `SELECT id FROM favorite_lists WHERE lower(name) = lower($1) LIMIT 1`,
        [name]
      );
      if (existed.rowCount && existed.rows[0]) {
        res.json({ id: existed.rows[0].id });
        return;
      }
      const created = await pool.query<{ id: string }>(
        `INSERT INTO favorite_lists (name) VALUES ($1) RETURNING id`,
        [name]
      );
      res.status(201).json({ id: created.rows[0].id });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("POST /web/favorite-lists error", err);
      res.status(500).json({ message: "Failed to create favorite list" });
    }
  });

  router.delete("/:id", async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
      // 删除该列表下所有收藏记录，使其恢复为「未收藏」状态
      await pool.query(`DELETE FROM favorite_items WHERE list_id = $1::uuid`, [id]);
      await pool.query(`DELETE FROM favorite_lists WHERE id = $1::uuid`, [id]);
      res.status(204).end();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("DELETE /web/favorite-lists/:id error", err);
      res.status(500).json({ message: "Failed to delete favorite list" });
    }
  });

  return router;
}

