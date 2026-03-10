import type { Router, Request, Response } from "express";
import express from "express";
import type { Pool } from "pg";
import type { PluginRegistry } from "../plugin-registry/types";
import type {
  CreateRuleRequest,
  GenerateRuleKeywordsResponse,
  ListRulesQuery,
  SaveRuleRequest,
  SupplementRuleKeywordsRequest
} from "../api-model";
import {
  generateRuleKeywords,
  supplementRuleKeywords
} from "../llm/rule-keywords";

interface Deps {
  pool: Pool;
  pluginRegistry: PluginRegistry;
  logDir: string;
}

export function createRulesController({ pool, logDir }: Deps): Router {
  const router = express.Router();

  router.get("/", async (req: Request, res: Response) => {
    const query = req.query as unknown as ListRulesQuery;

    try {
      const dbResult = await pool.query(
        `SELECT
           id,
           name,
           keyword_description AS "keywordDescription",
           description,
           keywords,
           negative_keywords AS "negativeKeywords",
           disabled,
           plugins,
           prompt_file AS "promptFile",
           last_run_at AS "lastRunAt",
           remark,
           extra,
           content_length AS "contentLength",
           content_min_length AS "contentMinLength",
           created_at AS "createdAt",
           updated_at AS "updatedAt"
         FROM rules
         ORDER BY created_at DESC`
      );

      // 目前暂不按 plugin 过滤，后续可在 schema 中增加映射表
      void query;

      const total = dbResult.rowCount ?? 0;
      res.json({ items: dbResult.rows, total });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("GET /web/rules error", err);
      res.status(500).json({ message: "Failed to load rules" });
    }
  });

  router.get("/:id", async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
      const dbResult = await pool.query(
        `SELECT
           id,
           name,
           keyword_description AS "keywordDescription",
           description,
           keywords,
           negative_keywords AS "negativeKeywords",
           disabled,
           plugins,
           prompt_file AS "promptFile",
           last_run_at AS "lastRunAt",
           remark,
           extra,
           content_length AS "contentLength",
           content_min_length AS "contentMinLength",
           created_at AS "createdAt",
           updated_at AS "updatedAt"
         FROM rules
         WHERE id = $1`,
        [id]
      );
      if (dbResult.rows.length === 0) {
        res.status(404).json({ message: "Rule not found" });
        return;
      }
      res.json(dbResult.rows[0]);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("GET /web/rules/:id error", err);
      res.status(500).json({ message: "Failed to load rule" });
    }
  });

  // req0310: 规则关联的 Reddit subreddit 黑/白名单维护
  router.get("/:id/subreddit-filters", async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
      const bl = await pool.query<{ name: string }>(
        `SELECT name
           FROM reddit_subreddit_blacklist
          WHERE rule_id = $1::uuid
          ORDER BY name ASC`,
        [id]
      );
      const wl = await pool.query<{ name: string }>(
        `SELECT name
           FROM reddit_subreddit_whitelist
          WHERE rule_id = $1::uuid
          ORDER BY name ASC`,
        [id]
      );
      res.json({
        blacklist: bl.rows.map((r) => r.name),
        whitelist: wl.rows.map((r) => r.name)
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("GET /web/rules/:id/subreddit-filters error", err);
      res.status(500).json({ message: "Failed to load subreddit filters" });
    }
  });

  router.post("/:id/subreddit-blacklist", async (req: Request, res: Response) => {
    const { id } = req.params;
    const name = String((req.body as any)?.name ?? "").trim();
    if (!name) {
      res.status(400).json({ message: "name required" });
      return;
    }
    try {
      await pool.query(
        `INSERT INTO reddit_subreddit_blacklist (rule_id, name)
         VALUES ($1::uuid, $2)
         ON CONFLICT DO NOTHING`,
        [id, name]
      );
      res.status(204).end();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("POST /web/rules/:id/subreddit-blacklist error", err);
      res.status(500).json({ message: "Failed to add subreddit blacklist" });
    }
  });

  router.delete(
    "/:id/subreddit-blacklist",
    async (req: Request, res: Response) => {
      const { id } = req.params;
      const name = String((req.body as any)?.name ?? "").trim();
      if (!name) {
        res.status(400).json({ message: "name required" });
        return;
      }
      try {
        await pool.query(
          `DELETE FROM reddit_subreddit_blacklist
            WHERE rule_id = $1::uuid AND lower(name) = lower($2)`,
          [id, name]
        );
        res.status(204).end();
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("DELETE /web/rules/:id/subreddit-blacklist error", err);
        res.status(500).json({ message: "Failed to delete subreddit blacklist" });
      }
    }
  );

  router.post("/:id/subreddit-whitelist", async (req: Request, res: Response) => {
    const { id } = req.params;
    const name = String((req.body as any)?.name ?? "").trim();
    if (!name) {
      res.status(400).json({ message: "name required" });
      return;
    }
    try {
      await pool.query(
        `INSERT INTO reddit_subreddit_whitelist (rule_id, name)
         VALUES ($1::uuid, $2)
         ON CONFLICT DO NOTHING`,
        [id, name]
      );
      res.status(204).end();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("POST /web/rules/:id/subreddit-whitelist error", err);
      res.status(500).json({ message: "Failed to add subreddit whitelist" });
    }
  });

  router.delete(
    "/:id/subreddit-whitelist",
    async (req: Request, res: Response) => {
      const { id } = req.params;
      const name = String((req.body as any)?.name ?? "").trim();
      if (!name) {
        res.status(400).json({ message: "name required" });
        return;
      }
      try {
        await pool.query(
          `DELETE FROM reddit_subreddit_whitelist
            WHERE rule_id = $1::uuid AND lower(name) = lower($2)`,
          [id, name]
        );
        res.status(204).end();
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("DELETE /web/rules/:id/subreddit-whitelist error", err);
        res.status(500).json({ message: "Failed to delete subreddit whitelist" });
      }
    }
  );

  router.post("/generate-keywords", async (req: Request, res: Response) => {
    const body = req.body as CreateRuleRequest;
    const result: GenerateRuleKeywordsResponse =
      await generateRuleKeywords(body, logDir);
    res.json(result);
  });

  router.post("/supplement-keywords", async (req: Request, res: Response) => {
    const body = req.body as SupplementRuleKeywordsRequest;
    const result: GenerateRuleKeywordsResponse =
      await supplementRuleKeywords(body, logDir);
    res.json(result);
  });

  router.post("/", async (req: Request, res: Response) => {
    const body = req.body as SaveRuleRequest;

    try {
      if (body.id) {
        await pool.query(
          `UPDATE rules
             SET name = $1,
                 keyword_description = $2,
                 description = $3,
                 keywords = $4,
                 negative_keywords = $5,
                 plugins = $6,
                 prompt_file = $7,
                 content_length = $8,
                 content_min_length = $9,
                 disabled = COALESCE($10, disabled),
                 updated_at = now()
           WHERE id = $11`,
          [
            body.name,
            body.keywordDescription ?? null,
            body.description,
            body.keywords,
            body.negativeKeywords ?? null,
            body.plugins ?? null,
            body.promptFile ?? null,
            body.contentLength ?? null,
            body.contentMinLength ?? null,
            body.disabled ?? null,
            body.id
          ]
        );
        res.status(200).json({ id: body.id });
      } else {
        const insertResult = await pool.query(
          `INSERT INTO rules (name, keyword_description, description, keywords, negative_keywords, plugins, prompt_file, content_length, content_min_length, disabled, remark)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, COALESCE($10, false), NULL)
           RETURNING id`,
          [
            body.name,
            body.keywordDescription ?? null,
            body.description,
            body.keywords,
            body.negativeKeywords ?? null,
            body.plugins ?? null,
            body.promptFile ?? null,
            body.contentLength ?? null,
            body.contentMinLength ?? null,
            body.disabled ?? null
          ]
        );
        res.status(201).json({ id: insertResult.rows[0].id });
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("POST /web/rules error", err);
      res.status(500).json({ message: "Failed to save rule" });
    }
  });

  router.post("/:id/state", async (req: Request, res: Response) => {
    const { id } = req.params;
    const { disabled } = req.body as { disabled: boolean };
    try {
      await pool.query(
        `UPDATE rules
           SET disabled = $1,
               updated_at = now()
         WHERE id = $2`,
        [disabled, id]
      );
      res.status(204).end();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("POST /web/rules/:id/state error", err);
      res.status(500).json({ message: "Failed to update rule state" });
    }
  });

  router.delete("/:id", async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
      await pool.query(`DELETE FROM rules WHERE id = $1`, [id]);
      res.status(204).end();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("DELETE /web/rules/:id error", err);
      res.status(500).json({ message: "Failed to delete rule" });
    }
  });

  return router;
}

