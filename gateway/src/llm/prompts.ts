import fs from "node:fs";
import path from "node:path";

export interface PromptPair {
  system: string;
  userTemplate: string;
}

function getPromptsDir() {
  // 当前文件位于：src/gateway/src/llm
  // 实际 prompts 目录位于：src/prompts
  // 因此需要向上三级：llm -> src -> gateway -> src，再到 prompts
  return path.resolve(__dirname, "../../../prompts");
}

export function loadPromptPair(name: string): PromptPair {
  const filePath = path.join(getPromptsDir(), `${name}.md`);
  const raw = fs.readFileSync(filePath, "utf8");

  const systemMarker = "---system---";
  const userMarker = "---user---";

  const systemIndex = raw.indexOf(systemMarker);
  const userIndex = raw.indexOf(userMarker);

  if (systemIndex === -1 || userIndex === -1) {
    throw new Error(`Invalid prompt file format: ${filePath}`);
  }

  const system = raw
    .slice(systemIndex + systemMarker.length, userIndex)
    .trim();
  const userTemplate = raw.slice(userIndex + userMarker.length).trim();

  return { system, userTemplate };
}

export function fillTemplate(
  template: string,
  vars: Record<string, string>
): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replaceAll(`{{${key}}}`, value);
  }
  return result;
}

