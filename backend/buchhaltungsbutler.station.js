const BASE_URL = "https://app.buchhaltungsbutler.de/api/v1";
const MAX_CALLS_PER_MINUTE = 90;
const calls = [];

function utf8Base64(value) {
  const bytes = unescape(encodeURIComponent(value));
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let output = "";
  for (let index = 0; index < bytes.length; index += 3) {
    const a = bytes.charCodeAt(index);
    const b = index + 1 < bytes.length ? bytes.charCodeAt(index + 1) : 0;
    const c = index + 2 < bytes.length ? bytes.charCodeAt(index + 2) : 0;
    const packed = (a << 16) | (b << 8) | c;
    output += alphabet[(packed >> 18) & 63];
    output += alphabet[(packed >> 12) & 63];
    output += index + 1 < bytes.length ? alphabet[(packed >> 6) & 63] : "=";
    output += index + 2 < bytes.length ? alphabet[packed & 63] : "=";
  }
  return output;
}

function credentialsFrom(input) {
  let value = input && input.credentials;
  if (typeof value === "string") {
    try { value = JSON.parse(value); } catch { throw new Error("Das Secrets-Feld muss valides JSON mit apiClient, apiSecret und apiKey enthalten."); }
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("BuchhaltungsButler-Zugang fehlt. Bitte über Secrets verbinden.");
  }
  const apiClient = String(value.apiClient || "").trim();
  const apiSecret = String(value.apiSecret || "").trim();
  const apiKey = String(value.apiKey || "").trim();
  if (!apiClient || !apiSecret || !apiKey) {
    throw new Error("Der Secret-Wert benötigt apiClient, apiSecret und apiKey.");
  }
  return { apiClient, apiSecret, apiKey };
}

function assertRateLimit(nowMs) {
  while (calls.length && calls[0] <= nowMs - 60_000) calls.shift();
  if (calls.length >= MAX_CALLS_PER_MINUTE) {
    throw new Error("Lokales Sicherheitslimit erreicht (90 API-Aufrufe pro Minute). Bitte kurz warten.");
  }
  calls.push(nowMs);
}

async function call(path, input, ctx, payload = {}) {
  const credentials = credentialsFrom(input);
  assertRateLimit(ctx.nowMs());
  const response = await ctx.fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
      authorization: `Basic ${utf8Base64(`${credentials.apiClient}:${credentials.apiSecret}`)}`,
    },
    body: JSON.stringify({ ...payload, api_key: credentials.apiKey }),
    timeoutMs: 30_000,
  });
  const text = await response.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  if (!response.ok) {
    const detail = data && typeof data === "object" ? JSON.stringify(data) : String(data);
    throw new Error(`BuchhaltungsButler API ${response.status}: ${detail.slice(0, 800)}`);
  }
  return data;
}

function payload(input) {
  return input && input.payload && typeof input.payload === "object" && !Array.isArray(input.payload)
    ? input.payload
    : {};
}

function findFile(value, depth = 0) {
  if (!value || typeof value !== "object" || depth > 6) return null;
  if (Array.isArray(value)) {
    for (const item of value) { const found = findFile(item, depth + 1); if (found) return found; }
    return null;
  }
  for (const key of ["file", "file_base64", "fileBase64", "document", "content_base64"]) {
    if (typeof value[key] === "string" && value[key].length > 16) return value[key];
  }
  for (const child of Object.values(value)) { const found = findFile(child, depth + 1); if (found) return found; }
  return null;
}

function extensionForMime(mime) {
  if (mime.includes("pdf")) return "pdf";
  if (mime.includes("xml")) return "xml";
  if (mime.includes("png")) return "png";
  if (mime.includes("jpeg")) return "jpg";
  return "bin";
}

module.exports.testConnection = async (input, ctx) => ({ ok: true, accounts: await call("/accounts/get", input, ctx) });
module.exports.listReceipts = async (input, ctx) => call("/receipts/get", input, ctx, payload(input));
module.exports.listTransactions = async (input, ctx) => call("/transactions/get", input, ctx, payload(input));
module.exports.listPostings = async (input, ctx) => call("/postings/get", input, ctx, payload(input));
module.exports.listAccounts = async (input, ctx) => call("/accounts/get", input, ctx);
module.exports.listDebtors = async (input, ctx) => call("/settings/get/debtors", input, ctx, payload(input));
module.exports.listCreditors = async (input, ctx) => call("/settings/get/creditors", input, ctx, payload(input));
module.exports.listPostingAccounts = async (input, ctx) => call("/settings/get/postingaccounts", input, ctx, payload(input));
module.exports.listCostLocations = async (input, ctx) => call("/cost-locations/get", input, ctx, payload(input));

module.exports.uploadReceipt = async (input, ctx) => {
  const fileBase64 = String(input.fileBase64 || "");
  const fileName = String(input.fileName || "").trim();
  const size = Number(input.fileSize || 0);
  if (!fileBase64 || !fileName || !Number.isInteger(size) || size < 1 || size > 25 * 1024 * 1024) {
    throw new Error("Upload benötigt eine gültige Datei bis 25 MiB.");
  }
  return call("/receipts/upload", input, ctx, {
    ...payload(input),
    file: fileBase64,
    file_name: fileName,
    type: String(input.receiptType || "invoice inbound"),
  });
};

module.exports.downloadReceipt = async (input, ctx) => {
  const response = await call("/receipts/get/id_by_customer", input, ctx, {
    ...payload(input),
    id_by_customer: input.idByCustomer,
    get_file: true,
  });
  const dataBase64 = findFile(response);
  if (!dataBase64) throw new Error("Die API-Antwort enthielt keine Belegdatei.");
  const mime = String(input.mimeType || "application/pdf");
  const id = String(input.idByCustomer || "receipt").replace(/[^a-zA-Z0-9_-]/g, "_");
  const size = Math.floor((dataBase64.replace(/=+$/, "").length * 3) / 4);
  return {
    receipt: response,
    attachment: {
      name: `buchhaltungsbutler-${id}.${extensionForMime(mime)}`,
      mime,
      size,
      dataBase64,
    },
    _meta: { embeddedArtifact: true },
  };
};
