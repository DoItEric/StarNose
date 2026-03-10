import type { Router, Request, Response } from "express";
import express from "express";
import axios from "axios";

/** 免费翻译：先试 Google 未公开接口，失败则用 MyMemory。目标语言默认中文。 */
export function createTranslateController(): Router {
  const router = express.Router();

  router.post("/", async (req: Request, res: Response) => {
    const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
    const targetLang = typeof req.body?.targetLang === "string"
      ? req.body.targetLang.trim() || "zh-CN"
      : "zh-CN";

    if (!text) {
      res.status(400).json({ error: "Missing or empty text" });
      return;
    }

    // 限制长度，避免超时与配额；MyMemory 匿名约 5000 字符/天
    const maxLen = 3000;
    const toTranslate = text.length > maxLen ? text.slice(0, maxLen) + "…" : text;

    try {
      const translated = await translateWithGoogle(toTranslate, targetLang)
        .catch(() => translateWithMyMemory(toTranslate, targetLang));
      res.json({ translated });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Translation failed";
      res.status(502).json({ error: message });
    }
  });

  return router;
}

/** Google 免费翻译端点（无 key，可能不稳定） */
async function translateWithGoogle(text: string, targetLang: string): Promise<string> {
  const url = "https://translate.googleapis.com/translate_a/single";
  const params = new URLSearchParams({
    client: "gtx",
    sl: "auto",
    tl: targetLang,
    dt: "t",
    q: text
  });
  const { data } = await axios.get<unknown[]>(`${url}?${params.toString()}`, {
    timeout: 10000,
    headers: { "User-Agent": "StarNose/1.0" }
  });
  if (!Array.isArray(data) || !data[0]) return text;
  const parts = (data[0] as unknown[]).map((row: unknown) => {
    if (Array.isArray(row) && typeof row[0] === "string") return row[0];
    return "";
  });
  return parts.join("").trim() || text;
}

/** MyMemory 免费 API，无需 key，CORS 友好，日限额约 5000 字符 */
async function translateWithMyMemory(text: string, targetLang: string): Promise<string> {
  const langPair = `auto|${targetLang}`;
  const { data } = await axios.get<{
    responseData?: { translatedText?: string };
    responseStatus?: number;
  }>("https://api.mymemory.translated.net/get", {
    params: { q: text, langpair: langPair },
    timeout: 10000
  });
  const translated = data.responseData?.translatedText;
  if (typeof translated === "string" && translated.trim()) return translated.trim();
  throw new Error("MyMemory returned no translation");
}
