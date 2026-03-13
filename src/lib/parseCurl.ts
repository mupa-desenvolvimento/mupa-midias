export type CurlVariable = {
  name: string;
  locations: Array<"url" | "query" | "headers" | "body">;
};

export type ParsedCurl = {
  original: string;
  method: string;
  url: string;
  urlWithoutQuery: string;
  origin: string;
  path: string;
  headers: Record<string, string>;
  query: Record<string, string | string[]>;
  bodyText: string | null;
  bodyJson: any | null;
  variables: CurlVariable[];
};

const normalizeWhitespace = (value: string) => {
  return String(value ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\n+/g, " ")
    .trim();
};

const stripWrappingQuotesAndTicks = (value: string) => {
  let v = String(value ?? "").trim();
  v = v.replace(/^`+|`+$/g, "");
  if ((v.startsWith("'") && v.endsWith("'")) || (v.startsWith('"') && v.endsWith('"'))) {
    v = v.slice(1, -1);
  }
  v = v.replace(/^`+|`+$/g, "");
  return v.trim();
};

const tokenizeShellLike = (input: string) => {
  const tokens: string[] = [];
  let cur = "";
  let inSingle = false;
  let inDouble = false;
  let escape = false;

  const push = () => {
    const t = cur.trim();
    if (t) tokens.push(t);
    cur = "";
  };

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];

    if (escape) {
      cur += ch;
      escape = false;
      continue;
    }

    if (!inSingle && ch === "\\") {
      escape = true;
      continue;
    }

    if (!inDouble && ch === "'" && !escape) {
      inSingle = !inSingle;
      continue;
    }

    if (!inSingle && ch === '"' && !escape) {
      inDouble = !inDouble;
      continue;
    }

    if (!inSingle && !inDouble && /\s/.test(ch)) {
      push();
      continue;
    }

    cur += ch;
  }

  push();
  return tokens;
};

const normalizePlaceholders = (value: string) => {
  let out = String(value ?? "");

  out = out.replace(/\{\{\s*([a-zA-Z_]\w*)\s*\}\}/g, "{$1}");
  out = out.replace(/\$\{\s*([a-zA-Z_]\w*)\s*\}/g, "{$1}");
  out = out.replace(/\$([a-zA-Z_]\w*)/g, "{$1}");
  out = out.replace(/(^|[=/]):([a-zA-Z_]\w*)(?=($|[/?&#]))/g, "$1{$2}");

  return out;
};

const extractVariablesFromString = (
  value: string,
  location: CurlVariable["locations"][number],
  acc: Map<string, Set<CurlVariable["locations"][number]>>,
) => {
  const v = String(value ?? "");
  const re = /\{([a-zA-Z_]\w*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(v))) {
    const name = m[1];
    if (!acc.has(name)) acc.set(name, new Set());
    acc.get(name)!.add(location);
  }
};

const parseHeaderLine = (line: string) => {
  const raw = String(line ?? "");
  const idx = raw.indexOf(":");
  if (idx <= 0) return null;
  const name = raw.slice(0, idx).trim();
  const value = raw.slice(idx + 1).trim();
  if (!name) return null;
  return { name, value };
};

const parseQueryFromUrl = (url: string) => {
  try {
    const u = new URL(url);
    const out: Record<string, string | string[]> = {};
    u.searchParams.forEach((value, key) => {
      if (out[key] == null) {
        out[key] = value;
        return;
      }
      const cur = out[key];
      if (Array.isArray(cur)) {
        cur.push(value);
      } else {
        out[key] = [cur, value];
      }
    });
    return out;
  } catch {
    return {};
  }
};

const stripQueryFromUrl = (url: string) => {
  try {
    const u = new URL(url);
    u.search = "";
    u.hash = "";
    return u.toString();
  } catch {
    const q = url.indexOf("?");
    return q >= 0 ? url.slice(0, q) : url;
  }
};

const parseUrlParts = (url: string) => {
  try {
    const u = new URL(url);
    return {
      origin: u.origin,
      path: u.pathname || "/",
    };
  } catch {
    return { origin: "", path: "" };
  }
};

const tryParseJson = (text: string) => {
  const raw = String(text ?? "").trim();
  if (!raw) return { ok: true as const, value: null };
  if (!(raw.startsWith("{") || raw.startsWith("["))) return { ok: true as const, value: null };
  try {
    return { ok: true as const, value: JSON.parse(raw) };
  } catch {
    return { ok: false as const, value: null };
  }
};

export const parseCurl = (curlText: string): ParsedCurl => {
  const original = String(curlText ?? "");
  const normalized = normalizeWhitespace(original);
  const tokens = tokenizeShellLike(normalized).map(stripWrappingQuotesAndTicks);

  const args = tokens[0] === "curl" ? tokens.slice(1) : tokens.slice(0);

  let explicitMethod = "";
  let url = "";
  const headers: Record<string, string> = {};
  const dataParts: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (!a) continue;

    if (a === "-X" || a === "--request") {
      explicitMethod = String(args[i + 1] || "");
      i++;
      continue;
    }

    if (a === "-H" || a === "--header") {
      const h = args[i + 1];
      i++;
      const parsed = parseHeaderLine(h);
      if (parsed) headers[parsed.name] = parsed.value;
      continue;
    }

    if (
      a === "-d" ||
      a === "--data" ||
      a === "--data-raw" ||
      a === "--data-binary" ||
      a === "--data-urlencode"
    ) {
      const d = args[i + 1];
      i++;
      if (d != null) dataParts.push(String(d));
      continue;
    }

    if (a === "--url") {
      url = String(args[i + 1] || "");
      i++;
      continue;
    }

    if (!a.startsWith("-") && !url && /^https?:\/\//i.test(a)) {
      url = a;
      continue;
    }

    if (!a.startsWith("-") && !url && /https?:\/\//i.test(a)) {
      const m = a.match(/https?:\/\/[^\s'"]+/i);
      if (m) url = m[0];
      continue;
    }
  }

  url = normalizePlaceholders(stripWrappingQuotesAndTicks(url));
  const method = String(explicitMethod || (dataParts.length ? "POST" : "GET")).toUpperCase();

  const bodyTextRaw = dataParts.length ? normalizePlaceholders(dataParts.join("&")) : "";
  const bodyText = bodyTextRaw ? bodyTextRaw : null;
  const bodyJsonParse = bodyText ? tryParseJson(bodyText) : { ok: true as const, value: null as any };
  const bodyJson = bodyJsonParse.ok ? bodyJsonParse.value : null;

  const query = parseQueryFromUrl(url);
  const urlWithoutQuery = stripQueryFromUrl(url);
  const { origin, path } = parseUrlParts(urlWithoutQuery);

  const variablesAcc = new Map<string, Set<CurlVariable["locations"][number]>>();

  extractVariablesFromString(urlWithoutQuery, "url", variablesAcc);
  for (const [k, v] of Object.entries(query)) {
    extractVariablesFromString(k, "query", variablesAcc);
    if (Array.isArray(v)) {
      v.forEach((vv) => extractVariablesFromString(String(vv), "query", variablesAcc));
    } else {
      extractVariablesFromString(String(v), "query", variablesAcc);
    }
  }
  for (const [k, v] of Object.entries(headers)) {
    const nk = normalizePlaceholders(k);
    const nv = normalizePlaceholders(v);
    if (nk !== k) {
      delete headers[k];
      headers[nk] = nv;
    } else {
      headers[k] = nv;
    }
    extractVariablesFromString(nk, "headers", variablesAcc);
    extractVariablesFromString(nv, "headers", variablesAcc);
  }
  if (bodyText) extractVariablesFromString(bodyText, "body", variablesAcc);

  const variables: CurlVariable[] = Array.from(variablesAcc.entries())
    .map(([name, locations]) => ({ name, locations: Array.from(locations) }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    original,
    method,
    url,
    urlWithoutQuery,
    origin,
    path,
    headers,
    query,
    bodyText,
    bodyJson,
    variables,
  };
};

const isDigitString = (value: unknown, minLen: number, maxLen: number) => {
  const s = String(value ?? "").trim();
  if (!/^\d+$/.test(s)) return false;
  return s.length >= minLen && s.length <= maxLen;
};

const keySuggestsBarcode = (key: string) => {
  const k = key.toLowerCase();
  return k.includes("barcode") || k.includes("codigo") || k.includes("barras") || k === "ean" || k === "gtin";
};

const keySuggestsStore = (key: string) => {
  const k = key.toLowerCase();
  return k.includes("store") || k.includes("loja") || k.includes("filial") || k.includes("branch");
};

const replaceInJson = (value: any, replacer: (key: string, v: any) => any): any => {
  if (Array.isArray(value)) return value.map((v) => replaceInJson(v, replacer));
  if (!value || typeof value !== "object") return value;
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(value)) {
    const next = replacer(k, v);
    out[k] = replaceInJson(next, replacer);
  }
  return out;
};

export const inferCommonVariables = (parsed: ParsedCurl) => {
  const variablesAcc = new Map<string, Set<CurlVariable["locations"][number]>>();

  const nextQuery: Record<string, string | string[]> = {};
  for (const [k, v] of Object.entries(parsed.query || {})) {
    if (Array.isArray(v)) {
      nextQuery[k] = v.map((vv) => {
        if (keySuggestsBarcode(k) && isDigitString(vv, 8, 14)) {
          variablesAcc.set("barcode", new Set(["query"]));
          return "{barcode}";
        }
        if (keySuggestsStore(k) && isDigitString(vv, 1, 8)) {
          variablesAcc.set("store", new Set(["query"]));
          return "{store}";
        }
        return String(vv);
      });
      continue;
    }

    if (keySuggestsBarcode(k) && isDigitString(v, 8, 14)) {
      variablesAcc.set("barcode", new Set(["query"]));
      nextQuery[k] = "{barcode}";
      continue;
    }
    if (keySuggestsStore(k) && isDigitString(v, 1, 8)) {
      variablesAcc.set("store", new Set(["query"]));
      nextQuery[k] = "{store}";
      continue;
    }
    nextQuery[k] = String(v);
  }

  let nextBodyJson = parsed.bodyJson;
  if (parsed.bodyJson && typeof parsed.bodyJson === "object") {
    nextBodyJson = replaceInJson(parsed.bodyJson, (k, v) => {
      if (keySuggestsBarcode(k) && isDigitString(v, 8, 14)) {
        variablesAcc.set("barcode", new Set(["body"]));
        return "{barcode}";
      }
      if (keySuggestsStore(k) && isDigitString(v, 1, 8)) {
        variablesAcc.set("store", new Set(["body"]));
        return "{store}";
      }
      return v;
    });
  }

  const mergedVariables = new Map<string, Set<CurlVariable["locations"][number]>>();
  for (const v of parsed.variables || []) {
    mergedVariables.set(v.name, new Set(v.locations));
  }
  for (const [name, locs] of variablesAcc.entries()) {
    if (!mergedVariables.has(name)) mergedVariables.set(name, new Set());
    locs.forEach((l) => mergedVariables.get(name)!.add(l));
  }

  const variables: CurlVariable[] = Array.from(mergedVariables.entries())
    .map(([name, locations]) => ({ name, locations: Array.from(locations) }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    ...parsed,
    query: nextQuery,
    bodyJson: nextBodyJson,
    variables,
  } satisfies ParsedCurl;
};
