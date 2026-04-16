import type { Router, Request, Response } from "express";
import express from "express";
import type { Deps } from "./router";
import type { SaveWorkerScheduleRequest } from "../api-model";

export function createWorkersController({ bizPool }: Deps): Router {
  const router = express.Router();

  router.get("/schedules", async (_req: Request, res: Response) => {
    try {
      const result = await bizPool.query(
        `SELECT
           id,
           name,
           worker_kind AS "workerKind",
           worker_type AS "workerType",
           enabled,
           source_id AS "sourceId",
           config,
           fetch_config AS "fetchConfig",
           max_instances AS "maxInstances",
           timeout_seconds AS "timeoutSeconds",
           last_run_at AS "lastRunAt",
           last_status AS "lastStatus",
           run_count AS "runCount",
           created_at AS "createdAt",
           updated_at AS "updatedAt"
         FROM worker_schedule
         ORDER BY created_at DESC`
      );
      res.json({ items: result.rows, total: result.rowCount ?? 0 });
    } catch (err) {
      console.error("GET /web/workers/schedules error", err);
      res.status(500).json({ message: "Failed to load worker schedules" });
    }
  });

  router.get("/schedules/:id", async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
      const result = await bizPool.query(
        `SELECT
           id, name,
           worker_kind AS "workerKind",
           worker_type AS "workerType",
           enabled,
           source_id AS "sourceId",
           config,
           fetch_config AS "fetchConfig",
           max_instances AS "maxInstances",
           timeout_seconds AS "timeoutSeconds",
           last_run_at AS "lastRunAt",
           last_status AS "lastStatus",
           run_count AS "runCount",
           created_at AS "createdAt",
           updated_at AS "updatedAt"
         FROM worker_schedule WHERE id = $1`,
        [id]
      );
      if (!result.rows.length) {
        res.status(404).json({ message: "Worker schedule not found" });
        return;
      }
      res.json(result.rows[0]);
    } catch (err) {
      console.error("GET /web/workers/schedules/:id error", err);
      res.status(500).json({ message: "Failed to load worker schedule" });
    }
  });

  router.post("/schedules", async (req: Request, res: Response) => {
    const body = req.body as SaveWorkerScheduleRequest;
    try {
      if (body.id) {
        await bizPool.query(
          `UPDATE worker_schedule
             SET name = $1,
                 worker_kind = $2,
                 worker_type = $3,
                 enabled = COALESCE($4, enabled),
                 source_id = $5,
                 config = COALESCE($6, config),
                 fetch_config = COALESCE($7, fetch_config),
                 max_instances = COALESCE($8, max_instances),
                 timeout_seconds = COALESCE($9, timeout_seconds),
                 updated_at = now()
           WHERE id = $10`,
          [
            body.name,
            body.workerKind,
            body.workerType,
            body.enabled ?? null,
            body.sourceId,
            body.config ? JSON.stringify(body.config) : null,
            body.fetchConfig ? JSON.stringify(body.fetchConfig) : null,
            body.maxInstances ?? null,
            body.timeoutSeconds ?? null,
            body.id,
          ]
        );
        res.json({ id: body.id });
      } else {
        const result = await bizPool.query(
          `INSERT INTO worker_schedule
             (name, worker_kind, worker_type, enabled, source_id, config, fetch_config, max_instances, timeout_seconds)
           VALUES ($1, $2, $3, COALESCE($4, false), $5, $6, $7, COALESCE($8, 10), COALESCE($9, 300))
           RETURNING id`,
          [
            body.name,
            body.workerKind,
            body.workerType,
            body.enabled ?? null,
            body.sourceId,
            JSON.stringify(body.config ?? {}),
            JSON.stringify(body.fetchConfig ?? {}),
            body.maxInstances ?? null,
            body.timeoutSeconds ?? null,
          ]
        );
        res.status(201).json({ id: result.rows[0].id });
      }
    } catch (err) {
      console.error("POST /web/workers/schedules error", err);
      res.status(500).json({ message: "Failed to save worker schedule" });
    }
  });

  router.post("/schedules/:id/toggle", async (req: Request, res: Response) => {
    const { id } = req.params;
    const { enabled } = req.body as { enabled: boolean };
    try {
      await bizPool.query(
        `UPDATE worker_schedule SET enabled = $1, updated_at = now() WHERE id = $2`,
        [enabled, id]
      );
      res.status(204).end();
    } catch (err) {
      console.error("POST /web/workers/schedules/:id/toggle error", err);
      res.status(500).json({ message: "Failed to toggle worker" });
    }
  });

  router.delete("/schedules/:id", async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
      await bizPool.query(`DELETE FROM worker_schedule WHERE id = $1`, [id]);
      res.status(204).end();
    } catch (err) {
      console.error("DELETE /web/workers/schedules/:id error", err);
      res.status(500).json({ message: "Failed to delete worker schedule" });
    }
  });

  router.get("/run-logs", async (req: Request, res: Response) => {
    const { scheduleId, status } = req.query;
    const limit = Math.min(Number(req.query.limit) || 50, 200);

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (scheduleId) {
      params.push(scheduleId);
      conditions.push(`schedule_id = $${params.length}`);
    }
    if (status) {
      params.push(status);
      conditions.push(`status = $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    try {
      const result = await bizPool.query(
        `SELECT
           id,
           schedule_id AS "scheduleId",
           worker_kind AS "workerKind",
           worker_type AS "workerType",
           started_at AS "startedAt",
           finished_at AS "finishedAt",
           status,
           items_count AS "itemsCount",
           elapsed_ms AS "elapsedMs",
           error,
           context
         FROM worker_run_log
         ${where}
         ORDER BY started_at DESC
         LIMIT $${params.length + 1}`,
        [...params, limit]
      );
      res.json({ items: result.rows });
    } catch (err) {
      console.error("GET /web/workers/run-logs error", err);
      res.status(500).json({ message: "Failed to load run logs" });
    }
  });

  return router;
}
