/**
 * 解析 rules 的 keywords 数组：每项为单个关键字或组合关键字（用 + 连接）。
 */
export function parseKeywordRules(keywords: string[]): string[][] {
  return keywords.map((k) => k.split("+").map((s) => s.trim()).filter(Boolean));
}

/**
 * 单条规则是否匹配：
 * - 单关键字（parts.length === 1）：在 title 或 content 任一出现即可；
 * - 组合关键字（parts.length > 1）：各部分可在标题或内容中任意位置，但必须全部出现才算匹配。
 */
export function ruleMatches(
  ruleParts: string[][],
  title: string,
  content: string
): boolean {
  const text = `${title ?? ""}\n${content ?? ""}`.toLowerCase();
  for (const parts of ruleParts) {
    if (parts.length === 0) continue;
    // 单关键字：parts 只有 1 个；组合关键字：parts 多个，需全部在 text 中出现
    const allFound = parts.every((p) =>
      text.includes(p.toLowerCase())
    );
    if (allFound) return true;
  }
  return false;
}
