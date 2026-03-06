import type { Router, Request, Response } from "express";
import express from "express";
import type { Pool } from "pg";
import type { PluginRegistry } from "../plugin-registry/types";
import type {
  ValidateContentRequest,
  ValidateContentResponse
} from "../api-model";
import { validateContentWithLLM } from "../llm/validator";

interface Deps {
  pool: Pool;
  pluginRegistry: PluginRegistry;
  logDir: string;
}

export function createValidateApi({ logDir }: Deps): Router {
  const router = express.Router();

  router.post("/", async (req: Request, res: Response) => {
    const body = req.body as ValidateContentRequest;
    const result: ValidateContentResponse = await validateContentWithLLM(
      body,
      logDir
    );
    res.json(result);
  });

  return router;
}

