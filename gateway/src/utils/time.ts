export function getShanghaiISOString(): string {
  const s = new Date().toLocaleString("sv-SE", { timeZone: "Asia/Shanghai" });
  return s.replace(" ", "T") + "+08:00";
}

export function getShanghaiDateHour(): string {
  const iso = getShanghaiISOString();
  return iso.slice(0, 13).replace("T", "-");
}

export function getShanghaiDate(): string {
  const iso = getShanghaiISOString();
  return iso.slice(0, 10);
}

