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
           disabled,
           plugins,
           prompt_file AS "promptFile",
           last_run_at AS "lastRunAt",
           remark,
           extra,
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
           disabled,
           plugins,
           prompt_file AS "promptFile",
           last_run_at AS "lastRunAt",
           remark,
           extra,
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
                 plugins = $5,
                 prompt_file = $6,
                 disabled = COALESCE($7, disabled),
                 updated_at = now()
           WHERE id = $8`,
          [
            body.name,
            body.keywordDescription ?? null,
            body.description,
            body.keywords,
            body.plugins ?? null,
            body.promptFile ?? null,
            body.disabled ?? null,
            body.id
          ]
        );
        res.status(200).json({ id: body.id });
      } else {
        const insertResult = await pool.query(
          `INSERT INTO rules (name, keyword_description, description, keywords, plugins, prompt_file, disabled, remark)
           VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, false), NULL)
           RETURNING id`,
          [
            body.name,
            body.keywordDescription ?? null,
            body.description,
            body.keywords,
            body.plugins ?? null,
            body.promptFile ?? null,
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

