/**
 * 解析 rules 的 keywords 数组：每项为单个关键字或组合关键字（用 + 连接）。
 * 例如 ["a", "b+c", "d"] => [["a"], ["b","c"], ["d"]]
 */
export function parseKeywordRules(keywords: string[]): string[][] {
  return keywords.map((k) => k.split("+").map((s) => s.trim()).filter(Boolean));
}

/**
 * 单条规则是否匹配：对 parseKeywordRules 后的单条规则（可能是组合），
 * 单个关键字在 title 或 content 任一出现即可；
 * 组合关键字各部分可在标题或内容中，只要都出现即可。
 */
export function ruleMatches(
  ruleParts: string[][],
  title: string,
  content: string
): boolean {
  const text = `${title ?? ""}\n${content ?? ""}`.toLowerCase();
  for (const parts of ruleParts) {
    if (parts.length === 0) continue;
    const allFound = parts.every((p) =>
      text.includes(p.toLowerCase())
    );
    if (allFound) return true;
  }
  return false;
}
