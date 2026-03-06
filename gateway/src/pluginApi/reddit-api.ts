import type { Router, Request, Response } from "express";
import express from "express";
import type { Pool } from "pg";

export interface RedditPostRow {
  id: string;
  subreddit: string | null;
  title: string | null;
  created_utc: number | null;
  fetched_at: string | null;
  source: string | null;
  content: string | null;
  process_at: string | null;
}

interface Deps {
  pool: Pool;
}

export function createRedditApi({ pool }: Deps): Router {
  const router = express.Router();

  /** 获取所有 process_at 为空的 reddit_posts */
  router.get("/posts", async (_req: Request, res: Response) => {
    try {
      const result = await pool.query<RedditPostRow>(
        `SELECT id, subreddit, title, created_utc, fetched_at, source, content, process_at
         FROM reddit_posts
         WHERE process_at IS NULL
         ORDER BY created_utc ASC NULLS LAST`
      );
      res.json({ items: result.rows });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("GET /api/reddit/posts error", err);
      res.status(500).json({ message: "Failed to load reddit posts" });
    }
  });

  /** 将指定 id 的帖子标记为已处理（process_at = 当前时间，Asia/Shanghai） */
  router.post("/posts/mark-processed", async (req: Request, res: Response) => {
    const body = req.body as { ids?: string[] };
    const ids = Array.isArray(body.ids) ? body.ids : [];
    if (ids.length === 0) {
      res.status(400).json({ message: "ids array required" });
      return;
    }
    try {
      const formatter = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Shanghai",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false
      });
      const parts = formatter.formatToParts(new Date());
      const get = (t: Intl.DateTimeFormatPartTypes) =>
        parts.find((p) => p.type === t)?.value ?? "00";
      const now = `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}:${get("second")}`;
      await pool.query(
        `UPDATE reddit_posts SET process_at = $1::timestamp WHERE id = ANY($2::text[])`,
        [now, ids]
      );
      res.json({ ok: true, count: ids.length });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("POST /api/reddit/posts/mark-processed error", err);
      res.status(500).json({ message: "Failed to mark reddit posts processed" });
    }
  });

  return router;
}
