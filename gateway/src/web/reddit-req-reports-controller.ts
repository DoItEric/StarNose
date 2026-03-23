import fs from "node:fs/promises";
import path from "node:path";
import type { Router, Request, Response } from "express";
import express from "express";
import type { Pool } from "pg";

interface Deps {
  pool: Pool;
}

interface ReportWord {
  word: string;
  count: number;
}

interface ReportItem {
  id: string;
  title?: string;
  read?: number;
  [key: string]: unknown;
}

interface ReportNode {
  name: string;
  data?: ReportNode[] | ReportItem[];
  word_cloud?: Record<string, ReportWord[]>;
}

interface RedditReqReport {
  overview?: Record<string, unknown>;
  analysis?: ReportNode[];
  word_cloud?: Record<string, ReportWord[]>;
  ai_summary?: string;
}

interface ReportState {
  pinnedNodeKeys: string[];
}

const REPORT_NAME = "reddit_req";

function parseTimestampFromFolder(folder: string): number {
  const m = /^(\d{8})_(\d{6})$/.exec(folder);
  if (!m) return 0;
  const date = m[1];
  const time = m[2];
  const s = `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}T${time.slice(0, 2)}:${time.slice(2, 4)}:${time.slice(4, 6)}Z`;
  const ts = Date.parse(s);
  return Number.isFinite(ts) ? ts : 0;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function isLeafItem(v: unknown): v is ReportItem {
  return isObject(v) && typeof v.id === "string";
}

function collectLeafIdsFromNode(node: ReportNode, bucket: string[]): void {
  const list = Array.isArray(node.data) ? node.data : [];
  for (const child of list) {
    if (isLeafItem(child)) {
      bucket.push(child.id);
      continue;
    }
    if (isObject(child) && typeof child.name === "string") {
      collectLeafIdsFromNode(child as ReportNode, bucket);
    }
  }
}

function getNodeByPath(analysis: ReportNode[], pathParts: string[]): ReportNode | null {
  let current: ReportNode | null = null;
  let list: ReportNode[] = analysis;
  for (const name of pathParts) {
    const next = list.find((n) => n.name === name) ?? null;
    if (!next) return null;
    current = next;
    const dataList = Array.isArray(next.data) ? next.data : [];
    list = dataList.filter((v): v is ReportNode => isObject(v) && typeof v.name === "string");
  }
  return current;
}

function getReportDir(): string {
  return path.resolve(__dirname, "../../../report", REPORT_NAME);
}

function getReportPath(reportId: string): string {
  return path.resolve(getReportDir(), reportId, "report.json");
}

function getStatePath(reportId: string): string {
  return path.resolve(getReportDir(), reportId, "state.json");
}

async function readReport(reportId: string): Promise<RedditReqReport> {
  const filePath = getReportPath(reportId);
  const raw = await fs.readFile(filePath, "utf-8");
  return JSON.parse(raw) as RedditReqReport;
}

async function readState(reportId: string): Promise<ReportState> {
  const filePath = getStatePath(reportId);
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    const json = JSON.parse(raw) as Partial<ReportState>;
    return {
      pinnedNodeKeys: Array.isArray(json.pinnedNodeKeys)
        ? json.pinnedNodeKeys.filter((x): x is string => typeof x === "string")
        : []
    };
  } catch {
    return { pinnedNodeKeys: [] };
  }
}

async function writeState(reportId: string, state: ReportState): Promise<void> {
  const filePath = getStatePath(reportId);
  await fs.writeFile(filePath, JSON.stringify(state, null, 2), "utf-8");
}

export function createRedditReqReportsController({ pool }: Deps): Router {
  const router = express.Router();

  router.get("/", async (req: Request, res: Response) => {
    try {
      const fromRaw =
        typeof req.query.generatedFrom === "string" ? req.query.generatedFrom.trim() : "";
      const toRaw =
        typeof req.query.generatedTo === "string" ? req.query.generatedTo.trim() : "";
      const tsFrom = fromRaw ? Date.parse(fromRaw) : NaN;
      const tsTo = toRaw ? Date.parse(toRaw) : NaN;
      const hasFrom = Number.isFinite(tsFrom);
      const hasTo = Number.isFinite(tsTo);
      const useTimeFilter = hasFrom || hasTo;

      const dir = getReportDir();
      const entries = await fs.readdir(dir, { withFileTypes: true });
      const items = entries
        .filter((e) => e.isDirectory())
        .map((e) => ({
          id: e.name,
          timestamp: parseTimestampFromFolder(e.name)
        }))
        .filter((x) => {
          if (!useTimeFilter) return true;
          if (x.timestamp <= 0) return false;
          if (hasFrom && x.timestamp < tsFrom) return false;
          if (hasTo && x.timestamp > tsTo) return false;
          return true;
        })
        .sort((a, b) => b.timestamp - a.timestamp)
        .map((x) => ({
          id: x.id,
          generatedAt: x.timestamp > 0 ? new Date(x.timestamp).toISOString() : null
        }));
      res.json({ items });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("GET /web/reports/reddit-req error", err);
      res.status(500).json({ message: "Failed to list reports" });
    }
  });

  router.get("/:reportId", async (req: Request, res: Response) => {
    const reportId = req.params.reportId;
    try {
      const report = await readReport(reportId);
      const state = await readState(reportId);
      res.json({
        reportId,
        data: report,
        state
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("GET /web/reports/reddit-req/:reportId error", err);
      res.status(500).json({ message: "Failed to load report" });
    }
  });

  router.post("/:reportId/node-pin", async (req: Request, res: Response) => {
    const reportId = req.params.reportId;
    const nodeKey = String(req.body?.nodeKey ?? "");
    const pinned = !!req.body?.pinned;
    if (!nodeKey) {
      res.status(400).json({ message: "nodeKey is required" });
      return;
    }
    try {
      const state = await readState(reportId);
      const set = new Set(state.pinnedNodeKeys);
      if (pinned) {
        set.add(nodeKey);
      } else {
        set.delete(nodeKey);
      }
      const next: ReportState = {
        pinnedNodeKeys: Array.from(set)
      };
      await writeState(reportId, next);
      res.json(next);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("POST /web/reports/reddit-req/:reportId/node-pin error", err);
      res.status(500).json({ message: "Failed to update pin state" });
    }
  });

  router.post("/:reportId/mark-read", async (req: Request, res: Response) => {
    const reportId = req.params.reportId;
    const nodeKey = String(req.body?.nodeKey ?? "");
    if (!nodeKey) {
      res.status(400).json({ message: "nodeKey is required" });
      return;
    }
    try {
      const report = await readReport(reportId);
      const analysis = Array.isArray(report.analysis) ? report.analysis : [];
      const pathParts = nodeKey.split("/").filter(Boolean);
      if (pathParts.length === 0) {
        res.status(400).json({ message: "Invalid nodeKey" });
        return;
      }
      const rootName = pathParts.shift() as string;
      const root = analysis.find((n) => n.name === rootName) ?? null;
      if (!root) {
        res.status(404).json({ message: "Node not found" });
        return;
      }
      let target: ReportNode | null = root;
      if (pathParts.length > 0) {
        const rootChildren = Array.isArray(root.data)
          ? root.data.filter((x): x is ReportNode => isObject(x) && typeof x.name === "string")
          : [];
        target = getNodeByPath(rootChildren, pathParts);
      }
      if (!target) {
        res.status(404).json({ message: "Node not found" });
        return;
      }
      const leafIds: string[] = [];
      collectLeafIdsFromNode(target, leafIds);
      if (leafIds.length === 0) {
        res.json({ updated: 0 });
        return;
      }
      const result = await pool.query(
        `UPDATE data_items
         SET read = 1, updated_at = now()
         WHERE id = ANY($1::uuid[])`,
        [leafIds]
      );
      res.json({ updated: result.rowCount ?? 0 });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("POST /web/reports/reddit-req/:reportId/mark-read error", err);
      res.status(500).json({ message: "Failed to mark read" });
    }
  });

  return router;
}
