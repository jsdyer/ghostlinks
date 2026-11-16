export function normalizeAddress(raw) {
  const value = raw.trim();
  if (!value || value.length > 2048 || /[\u0000-\u0020\u007f]/u.test(value)) {
    throw new Error("Enter a public URL or domain without spaces.");
  }
  let url;
  try {
    url = new URL(value.includes("://") ? value : "https://" + value);
  } catch {
    throw new Error("That address could not be read. Try a full address such as https://example.ca/old-page.");
  }
  const host = url.hostname.toLowerCase();
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password ||
      !host.includes(".") || /[\s*]/u.test(host) ||
      /(?:^|\.)(?:localhost|local|internal)\.?$/u.test(host)) {
    throw new Error("Use a public HTTP or HTTPS address without a username or password.");
  }
  url.hash = "";
  return url.href;
}

export function addressKey(address) {
  try {
    const url = new URL(address);
    return url.hostname.toLowerCase().replace(/^www\./u, "").replace(/\.$/u, "") +
      (url.port ? ":" + url.port : "") + url.pathname + url.search;
  } catch {
    return "";
  }
}

export function validStamp(stamp) {
  if (!/^\d{14}$/u.test(stamp)) return false;
  const pieces = [stamp.slice(0,4),stamp.slice(4,6),stamp.slice(6,8),stamp.slice(8,10),stamp.slice(10,12),stamp.slice(12,14)];
  const expected = `${pieces.slice(0,3).join("-")}T${pieces.slice(3).join(":")}.000Z`;
  const actual = new Date(expected);
  return !Number.isNaN(actual.getTime()) && actual.toISOString() === expected;
}

export function captureLabel(stamp) {
  if (!validStamp(stamp)) return "Unknown capture date";
  return `${stamp.slice(0,4)}-${stamp.slice(4,6)}-${stamp.slice(6,8)} ${stamp.slice(8,10)}:${stamp.slice(10,12)} UTC`;
}

export function availableURL(address, day = "") {
  const params = new URLSearchParams({ url: address });
  if (day) params.set("timestamp", day.replaceAll("-", ""));
  return "https://archive.org/wayback/available?" + params;
}

export function waybackCalendar(address) {
  return "https://web.archive.org/web/*/" + address;
}

export function replayURL(result, stamp) {
  try {
    const url = new URL(result);
    if (url.hostname !== "web.archive.org" || url.username || url.password || url.port ||
        !["http:", "https:"].includes(url.protocol) || !url.pathname.startsWith("/web/" + stamp + "/") ||
        !validStamp(stamp)) return "";
    url.protocol = "https:";
    return url.href;
  } catch {
    return "";
  }
}

function normalizedRow(row, format) {
  if (row === null || typeof row !== "object") return null;
  const stamp = String(row.timestamp ?? "");
  if (!validStamp(stamp)) return null;
  let url;
  try { url = normalizeAddress(String(row.original ?? row.url ?? "")); } catch { return null; }
  const status = String(row.statuscode ?? row.status ?? "");
  return {
    url, date: stamp, status: /^\d{3}$/u.test(status) ? status : "",
    mime: String(row.mimetype ?? row.mime ?? "").slice(0,120),
    format,
    replay: format === "Wayback CDX" ? "https://web.archive.org/web/" + stamp + "/" + url : "",
  };
}

export function parseIndex(text) {
  const raw = text.trim();
  if (!raw) throw new Error("The file is empty.");
  let source;
  try { source = JSON.parse(raw); } catch {
    const lines = raw.split(/\r?\n/u).filter(line => line.trim());
    try { source = lines.slice(0,10000).map(line => JSON.parse(line)); } catch {
      throw new Error("Expected a Wayback CDX JSON export or a Common Crawl JSON-lines index export.");
    }
  }
  if (!Array.isArray(source)) source = [source];
  let input = source;
  let format = source[0]?.filename || source[0]?.url ? "Common Crawl index" : "Wayback CDX";
  if (Array.isArray(source[0])) {
    const header = source[0];
    if (!header.includes("original") || !header.includes("timestamp")) {
      throw new Error("The CDX export must include timestamp and original URL columns.");
    }
    input = source.slice(1,10001).filter(Array.isArray)
      .map(row => Object.fromEntries(header.map((name, index) => [name, row[index]])));
    format = "Wayback CDX";
  }
  const unique = new Map();
  for (const row of input.slice(0,10000)) {
    const entry = normalizedRow(row, format);
    if (entry) unique.set(`${entry.date}|${entry.url}|${entry.status}`, entry);
  }
  if (!unique.size) throw new Error("No valid timestamp and URL pairs were found in this export.");
  return [...unique.values()].sort((a,b) => a.date.localeCompare(b.date));
}
