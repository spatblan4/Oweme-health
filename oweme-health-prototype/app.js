const USD = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

const DATE = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const STORAGE_KEY = "oweme-health-visits-v1";
const MAX_FILES_PER_BUCKET = 5;
let pdfJsPromise = null;

const providerDirectory = [
  {
    name: "Stone Creek Village Dentistry",
    address: "463 Canyon Del Rey Blvd, Del Rey Oaks, CA 93940",
    phone: "(831) 920-6900",
    type: "Dental",
    insurance: "GEHA Dental",
    aliases: [
      "Stone Creek Village DE",
      "Stone Creek",
      "Monterey",
      "Del Rey Oaks",
      "KIM,JAMES,D,DDS",
      "Kim James DDS",
      "James Kim DDS",
      "James D Kim DDS",
    ],
  },
];

const sampleClaims = [
  {
    id: "C-1001",
    provider: "Provider A Dental Surgery",
    serviceDate: "2026-02-18",
    responsibility: 125,
    billed: 750,
  },
  {
    id: "C-1002",
    provider: "Provider A Dental Surgery",
    serviceDate: "2026-02-27",
    responsibility: 605.2,
    billed: 2240,
  },
  {
    id: "C-1003",
    provider: "Provider B Dental Care",
    serviceDate: "2026-05-13",
    responsibility: 12.4,
    billed: 952,
  },
];

const samplePayments = [
  {
    id: "P-2001",
    merchant: "Provider A Dental Surgery",
    paymentDate: "2026-02-19",
    amount: 275,
    source: "HSA",
  },
  {
    id: "P-2002",
    merchant: "Provider A Dental Surgery",
    paymentDate: "2026-03-04",
    amount: 1079.1,
    source: "HSA",
  },
  {
    id: "P-2003",
    merchant: "Provider B Dental Care",
    paymentDate: "2026-05-13",
    amount: 275,
    source: "Card",
  },
];

const ISSUE_META = {
  none: {
    label: "No issue",
    shortLabel: "Normal visit",
    statusLabel: "",
    className: "waiting",
    actionLabel: "No issue selected",
  },
  possible_credit: {
    label: "Possible provider credit",
    shortLabel: "Possible credit",
    statusLabel: "Credit found",
    className: "confirmed",
    actionLabel: "Refund / credit review",
  },
  canceled: {
    label: "Questionable canceled visit charge",
    shortLabel: "Canceled visit",
    statusLabel: "Canceled charge",
    className: "review",
    actionLabel: "Cancellation + ledger review",
  },
  unrecognized: {
    label: "I do not recognize this charge",
    shortLabel: "Not recognized",
    statusLabel: "Review charge",
    className: "review",
    actionLabel: "Service verification",
  },
  allocation_unclear: {
    label: "Payment allocation unclear",
    shortLabel: "Allocation unclear",
    statusLabel: "Allocation unclear",
    className: "review",
    actionLabel: "Payment allocation",
  },
  claim_in_process: {
    label: "Claim or EOB still in process",
    shortLabel: "Claim check due",
    statusLabel: "Check claim",
    className: "ready",
    actionLabel: "Claim status check",
  },
};

const ISSUE_ORDER = ["canceled", "unrecognized", "allocation_unclear", "claim_in_process", "possible_credit"];

const personalAuditFindings = [
  {
    issue: "canceled",
    provider: "Vladimir Leibovsky",
    serviceDate: "2026-05-08",
  },
];

let state = {
  claims: [],
  payments: [],
  auditResults: [],
  auditHasRun: false,
  uploadExpanded: true,
  selectedProviderKey: null,
  selectedActionProviderKey: null,
  scriptMode: "call",
  uploadFiles: {
    claims: [],
    payments: [],
  },
  manualClaims: [],
  manualPayments: [],
  fileWarnings: [],
  auditNotices: [],
  auditFlags: {},
  auditYearScope: "focus",
  futureVisits: loadVisits(),
  editingVisitId: null,
  futureVisitFilter: "all",
  openVisitMenuId: null,
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

function money(value) {
  return USD.format(Number(value || 0));
}

function parseDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  const text = String(value).trim();
  const slashRange = text.match(/^(\d{1,2}\/\d{1,2}\/\d{2,4})\s*[-–—]\s*\d{1,2}\/\d{1,2}\/\d{2,4}$/);
  if (slashRange) return parseDate(slashRange[1]);
  const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) {
    return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  }
  const slash = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (slash) {
    const year = Number(slash[3].length === 2 ? `20${slash[3]}` : slash[3]);
    return new Date(year, Number(slash[1]) - 1, Number(slash[2]));
  }
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toIsoDate(date) {
  if (!date) return "";
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function formatDate(value) {
  const date = parseDate(value);
  return date ? DATE.format(date) : "Unknown";
}

function daysUntil(value) {
  const date = parseDate(value);
  if (!date) return null;
  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((date.getTime() - startOfToday.getTime()) / 86400000);
}

function relativeReminderLabel(value, dueWord = "Check") {
  const days = daysUntil(value);
  if (days === null) return "";
  if (days < 0) return `${dueWord} ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} overdue`;
  if (days === 0) return `${dueWord} today`;
  return `${dueWord} in ${days} day${days === 1 ? "" : "s"}`;
}

function daysBetween(a, b) {
  const da = parseDate(a);
  const db = parseDate(b);
  if (!da || !db) return 9999;
  const ms = db.getTime() - da.getTime();
  return Math.round(ms / 86400000);
}

function addDays(value, days) {
  const date = parseDate(value) || new Date();
  date.setDate(date.getDate() + Number(days));
  return toIsoDate(date);
}

function parseMoney(value) {
  if (value === null || value === undefined || value === "") return 0;
  const text = String(value).replace(/\$/g, "").replace(/,/g, "").trim();
  const negative = /^\(.*\)$/.test(text);
  const number = Number(text.replace(/[()]/g, ""));
  if (Number.isNaN(number)) return 0;
  return negative ? -number : number;
}

function normalizeKey(key) {
  return String(key || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function pick(row, keys) {
  const normalized = Object.fromEntries(
    Object.entries(row).map(([key, value]) => [normalizeKey(key), value])
  );
  for (const key of keys) {
    const value = normalized[normalizeKey(key)];
    if (value !== undefined && value !== "") return value;
  }
  return "";
}

function parseCsv(text) {
  const rows = [];
  let current = "";
  let row = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      i += 1;
      continue;
    }
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (char === "," && !inQuotes) {
      row.push(current);
      current = "";
      continue;
    }
    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(current);
      if (row.some((cell) => String(cell).trim() !== "")) rows.push(row);
      row = [];
      current = "";
      continue;
    }
    current += char;
  }

  if (current || row.length) {
    row.push(current);
    if (row.some((cell) => String(cell).trim() !== "")) rows.push(row);
  }

  if (rows.length < 2) return [];
  const headers = rows[0].map((cell) => String(cell).trim());
  return rows.slice(1).map((cells) => {
    const object = {};
    headers.forEach((header, index) => {
      object[header] = String(cells[index] ?? "").trim();
    });
    return object;
  });
}

function rowHasContent(row) {
  return Array.from(row || []).some((cell) => String(cell ?? "").trim() !== "");
}

function tableRowsToObjects(rows, bucket) {
  const nonEmptyRows = Array.from(rows || []).filter(rowHasContent);
  if (nonEmptyRows.length < 2) return [];

  const claimHints = ["claim number", "service date", "provider", "billed amount", "you pay", "patient responsibility", "claim status"];
  const paymentHints = ["transaction date", "payment date", "merchant", "description", "amount", "paid", "payee"];
  const hints = bucket === "claims" ? claimHints : paymentHints;

  let headerIndex = 0;
  let bestScore = -1;
  nonEmptyRows.forEach((row, index) => {
    const normalizedCells = row.map((cell) => normalizeKey(cell));
    const score = hints.reduce((sum, hint) => {
      const normalizedHint = normalizeKey(hint);
      return sum + (normalizedCells.some((cell) => cell === normalizedHint || cell.includes(normalizedHint)) ? 1 : 0);
    }, 0);
    if (score > bestScore) {
      bestScore = score;
      headerIndex = index;
    }
  });

  if (bestScore < 2) headerIndex = 0;

  const headers = nonEmptyRows[headerIndex].map((cell, index) => {
    const header = String(cell ?? "").trim();
    return header || `Column ${index + 1}`;
  });

  return nonEmptyRows.slice(headerIndex + 1)
    .filter(rowHasContent)
    .map((cells) => {
      const object = {};
      headers.forEach((header, index) => {
        object[header] = String(cells[index] ?? "").trim();
      });
      return object;
    });
}

function isWorkbookFile(file) {
  const name = String(file?.name || "").toLowerCase();
  return name.endsWith(".xlsx") || name.endsWith(".xls");
}

function isPdfFile(file) {
  const name = String(file?.name || "").toLowerCase();
  return file?.type === "application/pdf" || name.endsWith(".pdf");
}

async function loadPdfJs() {
  if (window.pdfjsLib) {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = new URL("./vendor/pdf.legacy.worker.min.js", window.location.href).href;
    return window.pdfjsLib;
  }
  if (!pdfJsPromise) {
    pdfJsPromise = import("./vendor/pdf.min.mjs").then((pdfjsLib) => {
      pdfjsLib.GlobalWorkerOptions.workerSrc = new URL("./vendor/pdf.worker.min.mjs", window.location.href).href;
      return pdfjsLib;
    });
  }
  return pdfJsPromise;
}

async function extractPdfLines(file) {
  const pdfjsLib = await loadPdfJs();
  const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
  const lines = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const positioned = content.items
      .filter((item) => String(item.str || "").trim())
      .map((item) => ({
        text: String(item.str || "").trim(),
        x: item.transform?.[4] || 0,
        y: item.transform?.[5] || 0,
      }))
      .sort((a, b) => Math.abs(b.y - a.y) > 3 ? b.y - a.y : a.x - b.x);

    const pageLines = [];
    positioned.forEach((item) => {
      const current = pageLines[pageLines.length - 1];
      if (!current || Math.abs(current.y - item.y) > 3) {
        pageLines.push({ y: item.y, parts: [item] });
      } else {
        current.parts.push(item);
      }
    });

    pageLines.forEach((line) => {
      const text = line.parts
        .sort((a, b) => a.x - b.x)
        .map((part) => part.text)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      if (text) lines.push(text);
    });
  }

  return lines;
}

function moneyFromLines(lines, labelPattern) {
  const moneyPattern = /\$?\(?\d{1,3}(?:,\d{3})*(?:\.\d{2})?\)?/;
  for (let index = 0; index < lines.length; index += 1) {
    if (!labelPattern.test(lines[index])) continue;
    const windowText = lines.slice(index, index + 4).join(" ");
    const matches = Array.from(windowText.matchAll(new RegExp(moneyPattern.source, "g")))
      .map((match) => match[0])
      .filter((value) => /[$.]|,/.test(value));
    if (matches.length) return matches[matches.length - 1];
  }
  return "";
}

function dateFromLines(lines, labelPattern) {
  const datePattern = /\d{1,2}\/\d{1,2}\/\d{2,4}(?:\s*[-–—]\s*\d{1,2}\/\d{1,2}\/\d{2,4})?/;
  for (let index = 0; index < lines.length; index += 1) {
    if (!labelPattern.test(lines[index])) continue;
    const windowText = lines.slice(index, index + 4).join(" ");
    const match = windowText.match(datePattern);
    if (match) return match[0];
  }
  const fallback = lines.join(" ").match(datePattern);
  return fallback ? fallback[0] : "";
}

function providerFromClaimLines(lines, claimIndex = 0) {
  const labelMatch = lines.join("\n").match(/(?:provider|dentist|facility)\s*:?\s*([^\n]{3,90})/i);
  if (labelMatch) return labelMatch[1].trim();

  const blocked = /^(completed|new|claim number|member|date of service|billed amount|you may owe|you pay|plan pays|patient|status|view eob|view details)$/i;
  for (let index = claimIndex - 1; index >= Math.max(0, claimIndex - 6); index -= 1) {
    const line = lines[index].trim();
    if (!line || blocked.test(line) || /\$/.test(line) || /\d{1,2}\/\d{1,2}\/\d{2,4}/.test(line)) continue;
    return line;
  }
  return "";
}

function extractPdfClaimRows(lines, fileName) {
  const claimIndexes = lines
    .map((line, index) => (/claim\s*(number|#)/i.test(line) ? index : -1))
    .filter((index) => index >= 0);
  const ranges = claimIndexes.length
    ? claimIndexes.map((index, rangeIndex) => ({
      start: Math.max(0, index - 4),
      claimIndex: index,
      end: claimIndexes[rangeIndex + 1] ? Math.max(index + 1, claimIndexes[rangeIndex + 1] - 4) : lines.length,
    }))
    : [{ start: 0, claimIndex: 0, end: lines.length }];

  return ranges
    .map((range, index) => {
      const block = lines.slice(range.start, range.end);
      return {
        "source file": fileName,
        "claim number": pick({ line: lines[range.claimIndex] || "" }, ["line"]).replace(/claim\s*(number|#)\s*:?\s*/i, "").trim(),
        provider: providerFromClaimLines(lines, range.claimIndex),
        "service date": dateFromLines(block, /date of service|service date|dos/i),
        "billed amount": moneyFromLines(block, /billed amount|billed|charge/i),
        "you may owe": moneyFromLines(block, /you may owe|you pay|patient responsibility|member responsibility|amount you owe/i),
        "pdf row": String(index + 1),
      };
    })
    .filter((row) => row.provider && row["service date"] && row["you may owe"] !== "");
}

function extractPdfPaymentRows(lines, fileName) {
  const allText = lines.join("\n");
  const providerMatch = allText.match(/(?:merchant|provider|clinic|payee|paid to)\s*:?\s*([^\n]{3,90})/i);
  const amount = moneyFromLines(lines, /co-?pay paid|copay paid|payment paid|paid by|amount paid/i)
    || moneyFromLines(lines, /amount|paid|payment/i);
  const date = dateFromLines(lines, /transaction date|payment date|paid on|date/i);
  const merchant = providerMatch ? providerMatch[1].trim() : lines.find((line) => /[a-z]/i.test(line) && !/\$|\d{1,2}\/\d{1,2}\/\d{2,4}/.test(line)) || "";
  if (!merchant || !date || !amount) return [];
  return [{
    "source file": fileName,
    merchant,
    "payment date": date,
    amount,
    source: "PDF",
  }];
}

async function parsePdfFile(file, bucket) {
  const lines = await extractPdfLines(file);
  if (!lines.length) {
    throw new Error(`PDF_NEEDS_OCR:${file.name}`);
  }
  return bucket === "payments"
    ? extractPdfPaymentRows(lines, file.name)
    : extractPdfClaimRows(lines, file.name);
}

async function parseTabularFile(file, bucket) {
  if (!file) return [];
  if (isPdfFile(file)) return parsePdfFile(file, bucket);
  if (!isWorkbookFile(file)) return parseCsv(await file.text());
  if (!window.XLSX) {
    throw new Error("Excel parser is not loaded.");
  }

  const workbook = window.XLSX.read(await file.arrayBuffer(), {
    type: "array",
    cellDates: true,
  });
  const sheetName = workbook.SheetNames.find((name) => {
    const rows = window.XLSX.utils.sheet_to_json(workbook.Sheets[name], {
      defval: "",
      raw: false,
      header: 1,
      blankrows: false,
    });
    return rows.some(rowHasContent);
  });

  if (!sheetName) return [];
  const rows = window.XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
    defval: "",
    raw: false,
    header: 1,
    blankrows: false,
  });
  return tableRowsToObjects(rows, bucket);
}

async function parseTabularFiles(files, bucket) {
  const selectedFiles = Array.from(files || []).slice(0, MAX_FILES_PER_BUCKET);
  const rowSets = await Promise.all(selectedFiles.map(async (file) => {
    try {
      return await parseTabularFile(file, bucket);
    } catch (error) {
      if (String(error?.message || "").startsWith("PDF_NEEDS_OCR:")) {
        state.fileWarnings.push(`${file.name} needs OCR`);
        return [];
      }
      throw error;
    }
  }));
  return rowSets.flat();
}

function mapClaims(rows) {
  return rows
    .map((row, index) => {
      const provider = pick(row, ["provider", "provider name", "rendering provider", "dentist", "facility", "merchant"]);
      const serviceDate = pick(row, ["date of service", "service date", "dos", "date"]);
      const responsibility = parseMoney(
        pick(row, ["you may owe", "you pay", "patient responsibility", "member responsibility", "amount you owe", "allowed patient"])
      );
      const billed = parseMoney(pick(row, ["billed amount", "billed", "charge", "submitted amount"]));
      const claimStatus = pick(row, ["claim status", "status"]);
      const claimStatusDescription = pick(row, ["claim status description", "status description", "description"]);
      return {
        id: `C-upload-${index + 1}`,
        provider,
        serviceDate: toIsoDate(parseDate(serviceDate)),
        responsibility,
        billed,
        claimStatus,
        claimStatusDescription,
      };
    })
    .filter((claim) => claim.provider && claim.serviceDate && claim.responsibility >= 0);
}

function mapPayments(rows) {
  return rows
    .map((row, index) => {
      const merchant = pick(row, ["merchant", "description", "provider", "name", "payee"]);
      const paymentDate = pick(row, ["transaction date", "date", "posted date", "payment date"]);
      const amount = Math.abs(parseMoney(pick(row, ["amount", "amount usd", "amount (usd)", "debit", "paid", "transaction amount"])));
      const source = pick(row, ["source", "account", "card", "payment method", "type", "category"]) || "Payment";
      return {
        id: `P-upload-${index + 1}`,
        merchant,
        paymentDate: toIsoDate(parseDate(paymentDate)),
        amount,
        source,
      };
    })
    .filter((payment) => payment.merchant && payment.paymentDate && payment.amount > 0);
}

function tokenize(value) {
  const stop = new Set([
    "the",
    "and",
    "dds",
    "dmd",
    "md",
    "llc",
    "inc",
    "pllc",
    "dental",
    "dentist",
    "medical",
    "care",
    "clinic",
    "center",
    "centre",
    "health",
    "village",
    "group",
    "dr",
    "doctor",
  ]);
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((token) => token.length > 1 && !stop.has(token));
}

function nameScore(a, b) {
  const left = tokenize(a);
  const right = tokenize(b);
  if (!left.length || !right.length) return 0;
  const rightSet = new Set(right);
  const overlap = left.filter((token) => rightSet.has(token)).length;
  return overlap / Math.min(left.length, right.length);
}

function knownProviderVariants(provider) {
  return [provider.name, ...(provider.aliases || [])];
}

function knownProviderScore(value, provider) {
  const text = String(value || "");
  const normalized = normalizeKey(text);
  return knownProviderVariants(provider).reduce((best, variant) => {
    const variantNormalized = normalizeKey(variant);
    if (normalized && normalized === variantNormalized) return 1;
    return Math.max(best, nameScore(text, variant));
  }, 0);
}

function knownProviderFor(value) {
  let best = null;
  providerDirectory.forEach((provider) => {
    const score = knownProviderScore(value, provider);
    if (score >= 0.66 && (!best || score > best.score)) {
      best = { provider, score };
    }
  });
  return best?.provider || null;
}

function canonicalProviderName(value) {
  return knownProviderFor(value)?.name || String(value || "").trim();
}

function providerMatchScore(a, b) {
  const leftProvider = knownProviderFor(a);
  const rightProvider = knownProviderFor(b);
  const score = nameScore(a, b);
  if (leftProvider && rightProvider && leftProvider.name === rightProvider.name) {
    return Math.max(score, 0.95);
  }
  return score;
}

function titleCaseWords(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

function displayProviderName(value) {
  const known = knownProviderFor(value);
  if (known) return known.name;

  const parts = String(value || "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length >= 2) {
    const suffixes = parts.slice(2).map((part) => part.toUpperCase()).join(", ");
    return `${titleCaseWords(parts[1])} ${titleCaseWords(parts[0])}${suffixes ? `, ${suffixes}` : ""}`;
  }
  return titleCaseWords(value);
}

function providerMatchReason(provider) {
  const hasAliasMatch = provider.results.some((result) =>
    (result.sourceProviders || []).some((sourceProvider) =>
      normalizeKey(sourceProvider) !== normalizeKey(result.provider)
        && canonicalProviderName(sourceProvider) === result.provider
    )
  );
  if (hasAliasMatch) return "Matched by provider alias";
  if (provider.results.every((result) => result.confidence === "High")) return "High confidence";
  return "Review match";
}

function normalizeIssue(value) {
  const text = String(value || "none").trim().toLowerCase().replace(/[-\s]+/g, "_");
  if (text === "normal" || text === "attended" || text === "clear") return "none";
  if (text === "cancelled") return "canceled";
  if (text === "unknown" || text === "not_recognized" || text === "not_mine") return "unrecognized";
  if (text === "allocation" || text === "unclear") return "allocation_unclear";
  if (ISSUE_META[text]) return text;
  return "none";
}

function issueMeta(value) {
  return ISSUE_META[normalizeIssue(value)] || ISSUE_META.none;
}

function issueOptions(selected) {
  const current = normalizeIssue(selected);
  const options = [
    ["none", "Attended / expected"],
    ["canceled", "I canceled this"],
    ["unrecognized", "I do not recognize this"],
    ["allocation_unclear", "Payment allocation unclear"],
  ];
  return options
    .map(([value, label]) => `<option value="${value}"${current === value ? " selected" : ""}>${label}</option>`)
    .join("");
}

function issueBadge(issue, className = "issue-badge") {
  const type = normalizeIssue(issue);
  if (type === "none") return "";
  const meta = issueMeta(type);
  return `<span class="${className} is-${escapeHtml(meta.className)}">${escapeHtml(meta.shortLabel)}</span>`;
}

function auditResultKey(result) {
  return String(result?.id || `${result?.provider || "provider"}|${result?.serviceDate || "date"}`);
}

function knownAuditIssue(result) {
  const serviceDate = toIsoDate(parseDate(result?.serviceDate));
  const providerText = [
    result?.provider,
    displayProviderName(result?.provider),
    ...(result?.sourceProviders || []),
  ].filter(Boolean).join(" ");
  const providerKeyText = normalizeKey(providerText);
  const match = personalAuditFindings.find((finding) => {
    const findingProviderKey = normalizeKey(finding.provider);
    return finding.serviceDate === serviceDate
      && (
        providerKeyText.includes(findingProviderKey)
        || providerMatchScore(providerText, finding.provider) > 0.5
      );
  });
  return normalizeIssue(match?.issue);
}

function auditResultIssue(result) {
  const key = auditResultKey(result);
  if (Object.prototype.hasOwnProperty.call(state.auditFlags, key)) {
    return normalizeIssue(state.auditFlags[key]);
  }
  return knownAuditIssue(result);
}

function auditResultFindingType(result) {
  const flagged = auditResultIssue(result);
  if (flagged !== "none") return flagged;
  if (Number(result?.credit || 0) > 0) return "possible_credit";
  const statusText = String((result?.claimStatuses || []).join(" ") || result?.claimStatus || "").toLowerCase();
  if (/in[-\s]?process|pending|processing|received/.test(statusText)) return "claim_in_process";
  if (paymentRowsMissingForAudit() && Number(result?.responsibility || 0) > 0) return "allocation_unclear";
  return "none";
}

function paymentRowsMissingForAudit() {
  return Boolean(
    state.auditHasRun
    && state.claims.length
    && !state.payments.length
    && (state.uploadFiles.payments.length || state.fileWarnings.length)
  );
}

function auditFocusYear() {
  const years = state.auditResults
    .map((result) => parseDate(result.serviceDate)?.getFullYear())
    .filter((year) => Number.isFinite(year));
  return years.length ? Math.max(...years) : new Date().getFullYear();
}

function auditScopeIsActive() {
  return paymentRowsMissingForAudit() && state.auditYearScope !== "all";
}

function auditResultInVisibleScope(result) {
  if (!auditScopeIsActive()) return true;
  return parseDate(result.serviceDate)?.getFullYear() === auditFocusYear();
}

function auditScopeStats() {
  const allProviders = getPastFindingProviders({ includeAll: true });
  const visibleProviders = getPastFindingProviders();
  const allItems = allProviders.reduce((sum, provider) => sum + provider.reviewCount, 0);
  const visibleItems = visibleProviders.reduce((sum, provider) => sum + provider.reviewCount, 0);
  return {
    focusYear: auditFocusYear(),
    allItems,
    visibleItems,
    hiddenItems: Math.max(0, allItems - visibleItems),
    visibleProviders: visibleProviders.length,
    allProviders: allProviders.length,
  };
}

function hasEobAmount(visit) {
  return visit.eobOwe !== null && visit.eobOwe !== undefined && visit.eobOwe !== "";
}

function isClaimCheckDue(visit) {
  if (hasEobAmount(visit)) return false;
  const reminder = parseDate(visit.reminderDate);
  return Boolean(reminder && reminder <= new Date());
}

function likelyProviderPayment(payment) {
  const text = `${payment?.merchant || ""} ${payment?.source || ""}`.toLowerCase();
  if (knownProviderFor(payment?.merchant)) return true;
  if (/\b(dental|dentist|dds|dmd|medical|clinic|hospital|health|care|orthodont|vision|pharmacy|rx|doctor|physician|surgery|dermatology|radiology|laboratory|labcorp|quest)\b/i.test(text)) {
    return true;
  }
  return state.auditResults.some((result) => providerMatchScore(result.provider, payment?.merchant) > 0.28);
}

function unmatchedPayments() {
  if (!state.auditHasRun) return [];
  const matched = new Set();
  state.auditResults.forEach((result) => {
    (result.matchedPayments || []).forEach((payment) => matched.add(payment.id));
  });
  return state.payments.filter((payment) => !matched.has(payment.id) && likelyProviderPayment(payment));
}

function groupClaims(claims) {
  const groups = new Map();
  claims.forEach((claim) => {
    const provider = canonicalProviderName(claim.provider);
    const key = `${provider}|${claim.serviceDate}`;
    if (!groups.has(key)) {
      groups.set(key, {
        id: `G-${groups.size + 1}`,
        provider,
        serviceDate: claim.serviceDate,
        responsibility: 0,
        billed: 0,
        claimIds: [],
        matchedPayments: [],
        sourceProviders: [],
        claimStatuses: [],
      });
    }
    const group = groups.get(key);
    group.responsibility += Number(claim.responsibility || 0);
    group.billed += Number(claim.billed || 0);
    group.claimIds.push(claim.id);
    if (claim.provider && !group.sourceProviders.includes(claim.provider)) {
      group.sourceProviders.push(claim.provider);
    }
    const statusText = [claim.claimStatus, claim.claimStatusDescription].filter(Boolean).join(" - ");
    if (statusText && !group.claimStatuses.includes(statusText)) {
      group.claimStatuses.push(statusText);
    }
  });
  return Array.from(groups.values());
}

function runAudit(claims, payments) {
  const groups = groupClaims(claims);

  payments.forEach((payment) => {
    let best = null;
    groups.forEach((group) => {
      const diff = daysBetween(group.serviceDate, payment.paymentDate);
      const score = providerMatchScore(group.provider, payment.merchant);
      const dateScore = diff >= 0 && diff <= 60 ? 1 - diff / 80 : 0;
      const finalScore = score * 0.72 + dateScore * 0.28;
      if (score > 0.25 && diff >= 0 && diff <= 60 && (!best || finalScore > best.finalScore)) {
        best = { group, score, diff, finalScore };
      }
    });

    if (best) {
      best.group.matchedPayments.push({
        ...payment,
        score: best.score,
        daysAfterService: best.diff,
      });
    }
  });

  return groups.map((group) => {
    const paid = group.matchedPayments.reduce((sum, payment) => sum + payment.amount, 0);
    const credit = Math.max(0, paid - group.responsibility);
    const maxScore = group.matchedPayments.reduce((max, payment) => Math.max(max, payment.score), 0);
    const maxGap = group.matchedPayments.reduce((max, payment) => Math.max(max, payment.daysAfterService), 0);
    const confidence = maxScore >= 0.7 && maxGap <= 30 ? "High" : credit > 0 ? "Medium" : "Needs review";
    return {
      ...group,
      paid,
      credit,
      confidence,
      status: credit > 0 ? "Needs provider ledger" : "All clear",
    };
  });
}

function loadVisits() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(stored) ? stored : [];
  } catch {
    return [];
  }
}

function saveVisits() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.futureVisits));
  renderVisitStorageStatus();
}

function removeLegacyDemoVisits() {
  const before = state.futureVisits.length;
  state.futureVisits = state.futureVisits.filter((visit) => !String(visit.id).startsWith("V-demo-"));
  if (state.futureVisits.length !== before) saveVisits();
}

function visitBackupPayload() {
  return {
    app: "OweMe Health",
    kind: "future-visits-backup",
    version: 1,
    exportedAt: new Date().toISOString(),
    visits: state.futureVisits,
  };
}

function visitsFromBackupPayload(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.visits)) return payload.visits;
  return [];
}

function renderVisitStorageStatus() {
  const status = $("#visitStorageStatus");
  if (!status) return;
  const count = state.futureVisits.length;
  status.textContent = count
    ? `${count} saved locally`
    : "Saved locally";
}

function exportVisitBackup() {
  const payload = visitBackupPayload();
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `oweme-health-visits-${toIsoDate(new Date())}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showToast("Visit backup exported.");
}

async function importVisitBackup(file) {
  if (!file) return;
  try {
    const payload = JSON.parse(await file.text());
    const visits = visitsFromBackupPayload(payload)
      .filter((visit) => visit && typeof visit === "object" && visit.provider && visit.date)
      .map((visit, index) => ({
        ...visit,
        id: String(visit.id || `V-import-${Date.now()}-${index}`),
        eobOwe: visit.eobOwe === "" || visit.eobOwe === undefined ? null : visit.eobOwe,
      }));
    if (!visits.length) {
      showToast("No visits found in backup.");
      return;
    }

    const existingIds = new Set(state.futureVisits.map((visit) => String(visit.id)));
    const imported = [];
    visits.forEach((visit) => {
      if (existingIds.has(String(visit.id))) return;
      existingIds.add(String(visit.id));
      imported.push(visit);
    });
    if (!imported.length) {
      showToast("Backup already imported.");
      return;
    }

    state.futureVisits = [...imported, ...state.futureVisits];
    state.futureVisitFilter = "all";
    state.editingVisitId = null;
    state.openVisitMenuId = null;
    saveVisits();
    render();
    showToast(`${imported.length} visit${imported.length === 1 ? "" : "s"} imported.`);
  } catch (error) {
    console.error(error);
    showToast("Could not read backup file.");
  }
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("is-visible");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    toast.classList.remove("is-visible");
  }, 2200);
}

function switchView(view) {
  $$(".view").forEach((section) => section.classList.remove("is-visible"));
  $(`#view-${view}`).classList.add("is-visible");
  document.body.classList.toggle("home-mode", view === "overview");
  $$(".nav-item").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.view === view);
  });
}

function loadSample(options = {}) {
  state.claims = sampleClaims.map((item) => ({ ...item }));
  state.payments = samplePayments.map((item) => ({ ...item }));
  state.auditResults = runAudit(state.claims, state.payments).map((result) => ({
    ...result,
    status: result.credit > 0 ? "Credit confirmed" : result.status,
  }));
  state.auditFlags = {};
  state.auditNotices = [];
  state.auditYearScope = "focus";
  state.auditHasRun = true;
  state.uploadExpanded = false;
  state.selectedProviderKey = null;

  $("#uploadStatus").textContent = "Anonymized demo case loaded.";
  render();
  if (!options.silent) showToast("Demo case loaded.");
}

function render() {
  renderImportPanel();
  renderAuditNotices();
  renderAuditSummary();
  renderMetrics();
  renderOverviewFindings();
  renderAuditScopeBar();
  renderProviderCredits();
  renderVisitDetail();
  renderVisitStorageStatus();
  renderFutureVisits();
  renderActions();
}

function renderAuditNotices() {
  const container = $("#auditNoticeList");
  if (!container) return;
  if (!state.auditNotices.length) {
    container.innerHTML = "";
    return;
  }
  container.innerHTML = state.auditNotices
    .map((notice) => `
      <div class="audit-notice ${notice.tone === "warning" ? "is-warning" : ""}">
        <strong>${escapeHtml(notice.title)}</strong>
        <p>${escapeHtml(notice.body)}</p>
      </div>
    `)
    .join("");
}

function renderAuditScopeBar() {
  const container = $("#auditScopeBar");
  if (!container) return;
  if (!paymentRowsMissingForAudit()) {
    container.innerHTML = "";
    return;
  }

  const stats = auditScopeStats();
  const focusActive = state.auditYearScope !== "all";
  container.innerHTML = `
    <div class="audit-scope-copy">
      <strong>${stats.focusYear} first</strong>
      <span>${focusActive && stats.hiddenItems ? `${stats.hiddenItems} older review item${stats.hiddenItems === 1 ? "" : "s"} hidden` : "Showing all claim years"}</span>
    </div>
    <div class="audit-scope-tabs" role="tablist" aria-label="Audit year scope">
      <button class="${focusActive ? "is-active" : ""}" type="button" role="tab" aria-selected="${focusActive ? "true" : "false"}" data-audit-scope="focus">${stats.focusYear} only</button>
      <button class="${!focusActive ? "is-active" : ""}" type="button" role="tab" aria-selected="${!focusActive ? "true" : "false"}" data-audit-scope="all">All years</button>
    </div>
  `;
}

function renderImportPanel() {
  const panel = $("#importPanel");
  if (!panel) return;
  panel.classList.toggle("is-complete", state.auditHasRun);
  panel.classList.toggle("is-expanded", state.uploadExpanded || !state.auditHasRun);

  const toggle = $("#toggleImportBtn");
  if (toggle) {
    toggle.textContent = state.uploadExpanded ? "Collapse files" : "Change files";
    toggle.hidden = !state.auditHasRun;
  }
  renderManualRows();
}

function renderManualRows() {
  const container = $("#manualRowList");
  if (!container) return;
  const rows = [
    ...state.manualClaims.map((row, index) => ({ ...row, kind: "claim", index })),
    ...state.manualPayments.map((row, index) => ({ ...row, kind: "payment", index })),
  ];
  if (!rows.length) {
    container.innerHTML = "";
    return;
  }

  container.innerHTML = rows
    .map((row) => `
      <span class="manual-row-chip">
        <strong>${row.kind === "claim" ? "EOB" : "Paid"}</strong>
        <span>${escapeHtml(row.provider || row.merchant)} · ${formatDate(row.serviceDate || row.paymentDate)} · ${money(row.responsibility || row.amount)}</span>
        <button type="button" aria-label="Remove manual row" data-remove-manual-row data-kind="${row.kind}" data-index="${row.index}">x</button>
      </span>
    `)
    .join("");
}

function renderAuditSummary() {
  const summary = $("#auditSummary");
  if (!summary) return;
  summary.classList.toggle("is-hidden", !state.auditHasRun);
  if (!state.auditHasRun) return;

  const providers = getProviderCredits();
  const findingProviders = getPastFindingProviders();
  const totalCredit = providers.reduce((sum, provider) => sum + provider.totalCredit, 0);
  const totalVisits = providers.reduce((sum, provider) => sum + provider.visitCount, 0);
  const reviewItems = findingProviders.reduce((sum, provider) => sum + provider.reviewCount, 0);
  const stats = auditScopeStats();
  const claimRows = state.claims.length || state.auditResults.reduce((sum, result) => sum + result.claimIds.length, 0);
  const paymentRows = state.payments.length;
  const hiddenText = stats.hiddenItems && state.auditYearScope !== "all"
    ? ` · ${stats.hiddenItems} older hidden`
    : "";
  const reviewText = reviewItems ? ` · ${reviewItems} review item${reviewItems === 1 ? "" : "s"} shown${hiddenText}` : "";

  const title = summary.querySelector("h3");
  if (title) {
    if (totalCredit > 0) {
      title.innerHTML = `<span id="auditTotalCredit">${money(totalCredit)}</span> possible credits found`;
    } else if (reviewItems > 0) {
      title.innerHTML = `<span id="auditTotalCredit">${reviewItems}</span> review item${reviewItems === 1 ? "" : "s"} to check`;
    } else {
      title.innerHTML = `<span id="auditTotalCredit">${money(0)}</span> possible credits found`;
    }
  }
  $("#auditSummaryMeta").textContent = totalCredit > 0
    ? `${providers.length} provider${providers.length === 1 ? "" : "s"} · ${totalVisits} matched visit${totalVisits === 1 ? "" : "s"} · ${claimRows} claim rows · ${paymentRows} payment rows checked${reviewText}`
    : `${claimRows} claim rows · ${paymentRows} payment rows checked${reviewText} · no possible credits found`;
}

function renderMetrics() {
  const credit = state.auditResults.reduce((sum, result) => sum + result.credit, 0)
    + state.futureVisits.reduce((sum, visit) => sum + futureCredit(visit), 0);
  const waiting = state.futureVisits.filter((visit) => visit.eobOwe === null || visit.eobOwe === undefined).length;
  const actionCount = getActionItems().length;

  const metricCredit = $("#metricCredit");
  const metricCreditHint = $("#metricCreditHint");
  const metricReviewed = $("#metricReviewed");
  const metricWaiting = $("#metricWaiting");
  const metricActions = $("#metricActions");
  const creditProviderKeys = new Set(getProviderCredits().map((provider) => provider.id));
  state.futureVisits
    .filter((visit) => futureCredit(visit) > 0)
    .forEach((visit) => creditProviderKeys.add(providerKey(visit.provider)));
  const providerCount = creditProviderKeys.size;

  if (metricCredit) metricCredit.textContent = money(credit);
  if (metricCreditHint) {
    metricCreditHint.textContent = credit > 0
      ? `across ${providerCount} provider${providerCount === 1 ? "" : "s"}`
      : "load demo case";
  }
  if (metricReviewed) metricReviewed.textContent = String(state.auditResults.length);
  if (metricWaiting) metricWaiting.textContent = String(waiting);
  if (metricActions) metricActions.textContent = String(actionCount);
}

function renderOverviewFindings() {
  const container = $("#overviewFindings");
  if (!container) return;
  const findings = getActionItems().slice(0, 5);
  if (!findings.length) {
    container.innerHTML = `<div class="empty-state">No findings yet. Load the demo case or run an audit.</div>`;
    return;
  }
  container.innerHTML = findings
    .map(
      (item) => `
        <article class="finding-card">
          <div>
            ${issueBadge(item.type, "issue-badge")}
            <strong>${escapeHtml(item.provider)}</strong>
            <span class="muted">${formatDate(item.date)} · ${escapeHtml(item.source)}</span>
          </div>
          <div>
            <span class="muted">Paid</span>
            <strong>${money(item.paid)}</strong>
          </div>
          <div>
            <span class="muted">Owe</span>
            <strong>${item.owe === null || item.owe === undefined ? "Unknown" : money(item.owe)}</strong>
          </div>
          <div>
            <span class="muted">Credit</span>
            <strong class="money-good">${money(item.credit)}</strong>
          </div>
        </article>
      `
    )
    .join("");
}

function providerKey(value) {
  return normalizeKey(value) || String(value || "provider");
}

function getProviderCredits() {
  const groups = new Map();
  state.auditResults
    .filter((result) => result.credit > 0)
    .forEach((result) => {
      const id = providerKey(result.provider);
      if (!groups.has(id)) {
        groups.set(id, {
          id,
          provider: result.provider,
          displayName: displayProviderName(result.provider),
          totalCredit: 0,
          totalPaid: 0,
          totalOwe: 0,
          claimRows: 0,
          latestServiceDate: result.serviceDate,
          results: [],
        });
      }
      const group = groups.get(id);
      group.displayName = displayProviderName(group.provider);
      group.totalCredit += Number(result.credit || 0);
      group.totalPaid += Number(result.paid || 0);
      group.totalOwe += Number(result.responsibility || 0);
      group.claimRows += result.claimIds.length;
      group.results.push(result);
      if (parseDate(result.serviceDate) > parseDate(group.latestServiceDate)) {
        group.latestServiceDate = result.serviceDate;
      }
    });

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      visitCount: group.results.length,
      results: group.results.sort((a, b) => parseDate(a.serviceDate) - parseDate(b.serviceDate)),
    }))
    .sort((a, b) => b.totalCredit - a.totalCredit || parseDate(b.latestServiceDate) - parseDate(a.latestServiceDate));
}

function getPastFindingProviders(options = {}) {
  const includeAll = options.includeAll === true;
  const groups = new Map();

  function ensureGroup(providerName, date) {
    const provider = canonicalProviderName(providerName);
    const id = providerKey(provider);
    if (!groups.has(id)) {
      groups.set(id, {
        id,
        provider,
        displayName: displayProviderName(provider),
        totalCredit: 0,
        totalPaid: 0,
        totalOwe: 0,
        reviewCount: 0,
        claimRows: 0,
        latestServiceDate: date,
        results: [],
      });
    }
    const group = groups.get(id);
    if (!group.latestServiceDate || parseDate(date) > parseDate(group.latestServiceDate)) {
      group.latestServiceDate = date;
    }
    return group;
  }

  state.auditResults
    .filter((result) => auditResultFindingType(result) !== "none")
    .filter((result) => includeAll || auditResultInVisibleScope(result))
    .forEach((result) => {
      const issue = auditResultFindingType(result);
      const group = ensureGroup(result.provider, result.serviceDate);
      group.totalCredit += Number(result.credit || 0);
      group.totalPaid += Number(result.paid || 0);
      group.totalOwe += Number(result.responsibility || 0);
      group.claimRows += result.claimIds.length;
      if (issue !== "possible_credit") group.reviewCount += 1;
      group.results.push({
        ...result,
        kind: "audit-result",
        findingType: issue,
      });
    });

  unmatchedPayments()
    .filter((payment) => includeAll || !auditScopeIsActive() || parseDate(payment.paymentDate)?.getFullYear() === auditFocusYear())
    .forEach((payment) => {
    const group = ensureGroup(payment.merchant, payment.paymentDate);
    group.totalPaid += Number(payment.amount || 0);
    group.reviewCount += 1;
    group.results.push({
      id: payment.id,
      kind: "unmatched-payment",
      findingType: "allocation_unclear",
      provider: canonicalProviderName(payment.merchant),
      serviceDate: payment.paymentDate,
      paid: Number(payment.amount || 0),
      responsibility: null,
      credit: 0,
      confidence: "Needs review",
      source: payment.source,
      sourceProviders: [payment.merchant],
      matchedPayments: [payment],
      claimIds: [],
    });
  });

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      visitCount: group.results.length,
      primaryIssue: primaryIssue(group.results.map((result) => result.findingType)),
      results: group.results.sort((a, b) => parseDate(a.serviceDate) - parseDate(b.serviceDate)),
    }))
    .sort((a, b) =>
      b.reviewCount - a.reviewCount
      || b.totalCredit - a.totalCredit
      || parseDate(b.latestServiceDate) - parseDate(a.latestServiceDate)
    );
}

function primaryIssue(types) {
  const normalized = new Set(types.map(normalizeIssue));
  return ISSUE_ORDER.find((type) => normalized.has(type)) || "possible_credit";
}

function selectedProviderCredit() {
  const providers = getPastFindingProviders();
  if (!providers.length) {
    state.selectedProviderKey = null;
    return null;
  }
  if (!providers.some((provider) => provider.id === state.selectedProviderKey)) {
    state.selectedProviderKey = providers[0].id;
  }
  return providers.find((provider) => provider.id === state.selectedProviderKey) || providers[0];
}

function renderProviderCredits() {
  const shell = $("#auditResultsLayout");
  if (shell) shell.classList.toggle("is-hidden", !state.auditHasRun);
  if (!state.auditHasRun) return;

  const list = $("#providerCreditList");
  const providers = getPastFindingProviders();
  const selected = selectedProviderCredit();
  if (!providers.length) {
    list.innerHTML = `<div class="empty-state">No audit findings yet. Use the sample or upload Excel/CSV files.</div>`;
    return;
  }

  list.innerHTML = providers
    .map(
      (provider) => {
        const meta = issueMeta(provider.primaryIssue);
        const amountText = provider.totalCredit > 0 ? money(provider.totalCredit) : `${provider.reviewCount} review`;
        const amountLabel = provider.totalCredit > 0 ? "possible credit" : meta.shortLabel.toLowerCase();
        return `
        <button class="provider-credit-card ${selected?.id === provider.id ? "is-selected" : ""}" type="button" data-provider-key="${escapeHtml(provider.id)}">
          <span class="provider-credit-main">
            <strong>${escapeHtml(provider.displayName)}</strong>
            <span>${provider.visitCount} visit${provider.visitCount > 1 ? "s" : ""} · latest ${formatDate(provider.latestServiceDate)}</span>
            <em class="is-${escapeHtml(meta.className)}">${escapeHtml(meta.shortLabel)} · ${escapeHtml(providerMatchReason(provider))}</em>
          </span>
          <span class="provider-credit-amount">
            <strong class="${provider.totalCredit > 0 ? "" : "is-review"}">${escapeHtml(amountText)}</strong>
            <span>${escapeHtml(amountLabel)}</span>
            <em>View timeline</em>
          </span>
        </button>
      `;
      }
    )
    .join("");
}

function renderVisitDetail() {
  const detail = $("#visitDetail");
  const provider = selectedProviderCredit();
  if (!provider) {
    detail.innerHTML = `<div class="empty-state">Select a provider to see the credit timeline.</div>`;
    return;
  }

  const contactHelp = provider.primaryIssue === "claim_in_process"
    ? `Ask ${provider.displayName} whether the claim/EOB is finalized and request the ledger.`
    : `Ask ${provider.displayName} for the ledger, refund, or charge correction.`;

  detail.innerHTML = `
    <div class="timeline-total">
      <span>${provider.reviewCount ? "Findings to review" : "Possible credit"}</span>
      <strong>${provider.totalCredit > 0 ? money(provider.totalCredit) : provider.reviewCount}</strong>
      <small>${provider.visitCount} visit${provider.visitCount > 1 ? "s" : ""} matched${provider.reviewCount ? ` · ${provider.reviewCount} review item${provider.reviewCount > 1 ? "s" : ""}` : ""}</small>
    </div>
    <div class="detail-timeline">
      ${provider.results
        .map(
          (result) => {
            const issue = result.kind === "audit-result" ? auditResultFindingType(result) : normalizeIssue(result.findingType);
            const manualIssue = result.kind === "audit-result" ? auditResultIssue(result) : "none";
            const effectiveIssue = issue === "none" && result.credit > 0 ? "possible_credit" : issue;
            const meta = issueMeta(effectiveIssue);
            if (result.kind === "unmatched-payment") {
              return `
                <div class="timeline-row is-review">
                  <strong>${formatDate(result.serviceDate)}</strong>
                  <p>${money(result.paid)} payment found · no matching EOB/claim in this upload</p>
                  <em>${escapeHtml(meta.label)}</em>
                </div>
              `;
            }

            const key = auditResultKey(result);
            return `
              <div class="timeline-row ${issue !== "possible_credit" ? "is-review" : ""}">
                <div class="timeline-row-title">
                  <strong>${formatDate(result.serviceDate)}</strong>
                  ${issueBadge(effectiveIssue, "issue-badge")}
                </div>
                <p>${money(result.paid)} paid · ${money(result.responsibility)} EOB owe</p>
                <em>${result.credit > 0 ? `${money(result.credit)} possible credit` : escapeHtml(meta.label)}</em>
                <div class="audit-row-actions" aria-label="Audit row flags">
                  <button class="${manualIssue === "canceled" ? "is-active" : ""}" type="button" data-audit-flag-key="${escapeHtml(key)}" data-audit-flag="canceled">Canceled</button>
                  <button class="${manualIssue === "unrecognized" ? "is-active" : ""}" type="button" data-audit-flag-key="${escapeHtml(key)}" data-audit-flag="unrecognized">Not mine</button>
                  ${manualIssue !== "none" ? `<button type="button" data-audit-flag-key="${escapeHtml(key)}" data-audit-flag="none">Clear</button>` : ""}
                </div>
              </div>
            `;
          }
        )
        .join("")}
    </div>
    <button class="formula-box timeline-action" type="button" data-open-provider-action="${escapeHtml(provider.id)}">
      <span>
        <strong>Contact provider</strong>
        <small>${escapeHtml(contactHelp)}</small>
      </span>
      <strong>Open</strong>
    </button>
  `;
}

function renderFutureVisits() {
  const list = $("#futureVisitList");
  renderFutureVisitTabs();

  const visits = filteredFutureVisits();
  if (!state.futureVisits.length) {
    list.innerHTML = `<div class="empty-state">No tracked visits yet. Add a real visit on the left to start tracking its claim.</div>`;
    return;
  }
  if (!visits.length) {
    list.innerHTML = `<div class="empty-state">No ${state.futureVisitFilter} visits tracked yet.</div>`;
    return;
  }

  list.innerHTML = visits
    .map((visit) => {
      const credit = futureCredit(visit);
      const status = visitStatus(visit);
      const hasCredit = credit > 0;
      const hasEob = hasEobAmount(visit);
      const visitIssue = normalizeIssue(visit.auditFlag);
      const visitIssueMeta = issueMeta(visitIssue);
      const eobLabel = hasCredit || hasEob ? "EOB saved" : "EOB amount";
      const eobButtonLabel = hasEob ? "Update" : "Save";
      const isEditing = state.editingVisitId === visit.id;
      const claimCheckDue = isClaimCheckDue(visit);
      const nextAppointmentDate = toIsoDate(parseDate(visit.nextAppointmentDate));
      const paymentMethod = String(visit.paymentMethod || "").trim();
      const compactInsurance = compactInsuranceName(visit.insurance, visit.type);
      const primaryMeta = [`Visit ${formatDate(visit.date)}`, `Paid ${money(visit.paid)}`];
      if (paymentMethod) primaryMeta.push(paymentMethod);
      const secondaryMeta = [];
      if (state.futureVisitFilter === "all" && visit.type) secondaryMeta.push(visit.type);
      if (compactInsurance) secondaryMeta.push(compactInsurance);
      if (visit.needsReimbursement) secondaryMeta.push("Reimbursement needed");
      const primaryMetaHtml = primaryMeta.map((item) => `<span>${escapeHtml(item)}</span>`).join("");
      const secondaryMetaHtml = secondaryMeta.map((item) => `<span>${escapeHtml(item)}</span>`).join("");
      const issueBadgeHtml = visitIssue !== "none"
        ? `<span class="audit-issue-badge is-${escapeHtml(visitIssueMeta.className)}">${escapeHtml(visitIssueMeta.shortLabel)}</span>`
        : "";
      const note = String(visit.notes || "").trim();
      const noteWarningClass = visitIssue !== "none" || /cancel|cancelled|canceled|no show|did not go|didn't go|取消/.test(note.toLowerCase()) ? " is-warning" : "";
      const issueGuidance = visitIssue === "canceled"
        ? "Ask for the cancellation record, itemized ledger, claim correction or void, and refund/credit review."
        : visitIssue === "unrecognized"
          ? "Ask the provider to verify the service details and send an itemized ledger before paying more."
          : "Ask how the payment was allocated across visits, claims, insurance payments, and current balance.";
      const noteBlock = note || visitIssue !== "none"
        ? `
          <div class="visit-note${noteWarningClass}">
            <span>${visitIssue !== "none" ? "Review" : "Note"}</span>
            <div>
              ${visitIssue !== "none" ? `<strong>${escapeHtml(visitIssueMeta.label)}</strong>` : ""}
              ${note ? `<p>${escapeHtml(note)}</p>` : `<p>${escapeHtml(issueGuidance)}</p>`}
              ${visitIssue !== "none" && note ? `<small>${escapeHtml(issueGuidance)}</small>` : ""}
            </div>
          </div>
        `
        : "";
      const creditSummary = hasCredit
        ? `
          <div class="visit-credit-summary">
            <div>
              <span>Possible provider credit</span>
              <strong>${money(credit)}</strong>
            </div>
            <p>${money(visit.paid)} paid - ${money(visit.eobOwe)} EOB owe</p>
          </div>
        `
        : "";
      const appointmentBlock = nextAppointmentDate
        ? `
          <div class="visit-appointment">
            <span>Next appointment</span>
            <strong>${formatDate(nextAppointmentDate)}</strong>
            <small>${escapeHtml(relativeReminderLabel(nextAppointmentDate, "Visit"))}</small>
          </div>
        `
        : "";
      const claimReminderBlock = `
        <div class="visit-reminder ${claimCheckDue ? "is-due" : "is-waiting"}">
          <span>${claimCheckDue ? "Check now" : "EOB watch"}</span>
          <strong>${formatDate(visit.reminderDate)}</strong>
          <small>${escapeHtml(relativeReminderLabel(visit.reminderDate, "Check"))}</small>
        </div>
      `;
      const topFollowupBlock = `
        <div class="visit-followups">
          ${appointmentBlock}
          ${hasCredit ? `
            <div class="visit-credit-top">
              <span>Possible credit</span>
              <strong>${money(credit)}</strong>
            </div>
          ` : claimReminderBlock}
        </div>
      `;
      const menuOpen = state.openVisitMenuId === visit.id;
      return `
        <article class="visit-card is-${status.className}" data-visit-id="${visit.id}">
          <div class="visit-main">
            <div class="visit-identity">
              <div class="visit-title-row">
                <strong>${escapeHtml(visit.provider)}</strong>
                ${issueBadgeHtml}
              </div>
              <p class="visit-primary-line">${primaryMetaHtml}</p>
              ${secondaryMeta.length ? `<p class="visit-secondary-line">${secondaryMetaHtml}</p>` : ""}
            </div>
            <div class="visit-next">
              <div class="visit-top-actions">
                <span class="status-pill ${status.className}">${status.label}</span>
                <div class="visit-menu-wrap">
                  <button class="visit-menu-button" type="button" aria-label="Visit actions" aria-expanded="${menuOpen ? "true" : "false"}" data-visit-menu="${visit.id}">...</button>
                  <div class="visit-menu ${menuOpen ? "is-open" : ""}">
                    ${visitIssue === "canceled" ? "" : `<button type="button" data-flag-visit="${visit.id}" data-flag-value="canceled">Mark canceled</button>`}
                    ${visitIssue === "unrecognized" ? "" : `<button type="button" data-flag-visit="${visit.id}" data-flag-value="unrecognized">Mark not recognized</button>`}
                    ${visitIssue !== "none" ? `<button type="button" data-flag-visit="${visit.id}" data-flag-value="none">Clear issue</button>` : ""}
                    <button type="button" data-edit-visit="${visit.id}">${isEditing ? "Close edit" : "Edit visit"}</button>
                    <button class="danger" type="button" data-delete-visit="${visit.id}">Delete visit</button>
                  </div>
                </div>
              </div>
              ${topFollowupBlock}
            </div>
          </div>
          ${noteBlock}
          ${creditSummary}
          ${isEditing ? visitEditForm(visit) : `
            <div class="visit-eob-row">
              <label>
                <span>${eobLabel}</span>
                <input type="number" min="0" step="0.01" value="${visit.eobOwe ?? ""}" data-eob-input="${visit.id}" placeholder="EOB amount" />
              </label>
              <button class="ghost-button" type="button" data-save-eob="${visit.id}">${eobButtonLabel}</button>
            </div>
          `}
        </article>
      `;
    })
    .join("");
}

function filteredFutureVisits() {
  if (state.futureVisitFilter === "all") return state.futureVisits;
  return state.futureVisits.filter((visit) => normalizeVisitType(visit.type) === state.futureVisitFilter);
}

function renderFutureVisitTabs() {
  const counts = futureVisitCounts();
  const map = {
    all: "#visitCountAll",
    dental: "#visitCountDental",
    medical: "#visitCountMedical",
  };

  Object.entries(map).forEach(([filter, selector]) => {
    const count = $(selector);
    if (count) count.textContent = counts[filter];
  });

  $$("[data-visit-filter]").forEach((button) => {
    const active = button.dataset.visitFilter === state.futureVisitFilter;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-selected", active ? "true" : "false");
  });
}

function futureVisitCounts() {
  return state.futureVisits.reduce(
    (counts, visit) => {
      counts.all += 1;
      const type = normalizeVisitType(visit.type);
      if (type === "dental") counts.dental += 1;
      if (type === "medical") counts.medical += 1;
      return counts;
    },
    { all: 0, dental: 0, medical: 0 }
  );
}

function normalizeVisitType(type) {
  const value = String(type || "").trim().toLowerCase();
  if (value.includes("dental")) return "dental";
  if (value.includes("medical")) return "medical";
  return value || "other";
}

function visitEditForm(visit) {
  return `
    <form class="visit-edit-form" data-visit-edit-form="${visit.id}">
      <div class="visit-edit-grid">
        <label>
          Provider
          <input name="provider" type="text" value="${escapeHtml(visit.provider)}" required />
        </label>
        <label>
          Visit type
          <select name="type">
            ${visitTypeOptions(visit.type)}
          </select>
        </label>
        <label>
          Date
          <input name="date" type="date" value="${escapeHtml(toIsoDate(parseDate(visit.date)))}" required />
        </label>
        <label>
          Paid
          <input name="paid" type="number" min="0" step="0.01" value="${escapeHtml(visit.paid)}" required />
        </label>
        <label>
          Paid with
          <select name="paymentMethod">
            ${paymentMethodOptions(visit.paymentMethod)}
          </select>
        </label>
        <label>
          Insurance
          <input name="insurance" type="text" value="${escapeHtml(visit.insurance || "")}" placeholder="GEHA Dental" />
        </label>
        <label>
          Claim check date
          <input name="reminderDate" type="date" value="${escapeHtml(toIsoDate(parseDate(visit.reminderDate)))}" required />
        </label>
        <label>
          Next appointment
          <input name="nextAppointmentDate" type="date" value="${escapeHtml(toIsoDate(parseDate(visit.nextAppointmentDate)))}" />
        </label>
        <label>
          Visit status
          <select name="auditFlag">
            ${issueOptions(visit.auditFlag)}
          </select>
        </label>
      </div>
      <label class="checkbox-field edit-checkbox-field">
        <input name="needsReimbursement" type="checkbox"${visit.needsReimbursement ? " checked" : ""} />
        <span>
          <strong>Need reimbursement</strong>
          <small>Paid personally; reimburse later</small>
        </span>
      </label>
      <label class="visit-edit-notes">
        Notes
        <textarea name="notes" rows="3" placeholder="Reason, cancellation, symptoms, or anything to remember">${escapeHtml(visit.notes || "")}</textarea>
      </label>
      <div class="visit-edit-actions">
        <button class="primary-button" type="submit">Save changes</button>
        <button class="ghost-button" type="button" data-cancel-visit-edit="${visit.id}">Cancel</button>
      </div>
    </form>
  `;
}

function visitTypeOptions(selected) {
  const types = ["Dental", "Medical", "Vision", "Pharmacy"];
  const allTypes = selected && !types.includes(selected) ? [selected, ...types] : types;
  return allTypes
    .map((type) => `<option${type === selected ? " selected" : ""}>${escapeHtml(type)}</option>`)
    .join("");
}

function paymentMethodOptions(selected) {
  const methods = ["Personal card", "HSA", "FSA", "Apple Card", "Debit card", "Cash / check", "Other card"];
  const allMethods = selected && !methods.includes(selected) ? [selected, ...methods] : methods;
  return allMethods
    .map((method) => `<option${method === selected ? " selected" : ""}>${escapeHtml(method)}</option>`)
    .join("");
}

function compactInsuranceName(insurance, type) {
  const text = String(insurance || "").trim();
  if (!text) return "";
  const normalizedType = normalizeVisitType(type);
  if (normalizedType !== "medical" && normalizedType !== "dental") return text;
  return text.replace(new RegExp(`\\s+${normalizedType}$`, "i"), "").trim() || text;
}

function renderActions() {
  const providers = getActionProviders();
  const actionList = $("#actionList");
  const scriptTitle = $("#scriptTitle");
  if (!providers.length) {
    actionList.innerHTML = `<div class="empty-state">No provider follow-ups yet.</div>`;
    $("#scriptText").value = defaultScript();
    if (scriptTitle) scriptTitle.textContent = "Request account ledger";
    updateProviderContact(null);
    return;
  }

  const selected = selectedActionProvider();

  actionList.innerHTML = providers
    .map(
      (provider) => {
        const meta = issueMeta(provider.primaryIssue);
        const amountText = provider.totalCredit > 0 ? money(provider.totalCredit) : `${provider.visitCount} item${provider.visitCount === 1 ? "" : "s"}`;
        const amountClass = provider.totalCredit > 0 ? "" : "is-review";
        const amountLabel = provider.totalCredit > 0 ? "Potential refund" : meta.actionLabel;
        return `
        <button class="action-provider-card ${selected?.id === provider.id ? "is-selected" : ""}" type="button" data-action-provider-key="${escapeHtml(provider.id)}">
          <span class="action-provider-main">
            <strong>${escapeHtml(provider.provider)}</strong>
            <span>${provider.visitCount} visit${provider.visitCount > 1 ? "s" : ""} · latest ${formatDate(provider.latestDate)}</span>
            <em class="issue-badge is-${escapeHtml(meta.className)}">${escapeHtml(meta.shortLabel)}</em>
          </span>
          <span class="action-provider-next">
            <strong class="${amountClass}">${escapeHtml(amountText)}</strong>
            <span>${escapeHtml(amountLabel)}</span>
          </span>
        </button>
      `;
      }
    )
    .join("");

  if (scriptTitle) scriptTitle.textContent = state.scriptMode === "email" ? "Email provider" : "Call provider";
  $$(".script-mode button").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.scriptMode === state.scriptMode);
  });
  const scriptText = $("#scriptText");
  scriptText.value = actionProviderScript(selected, state.scriptMode);
  scriptText.scrollTop = 0;
  updateProviderContact(selected);
}

function getActionItems() {
  const past = state.auditResults
    .filter((result) => auditResultFindingType(result) !== "none")
    .filter((result) => auditResultInVisibleScope(result))
    .map((result) => ({
      id: `past-${result.id}`,
      type: auditResultFindingType(result),
      provider: result.provider,
      date: result.serviceDate,
      paid: result.paid,
      owe: result.responsibility,
      credit: result.credit,
      source: "Past audit",
    }));

  const unmatched = unmatchedPayments()
    .map((payment) => ({
      id: `payment-${payment.id}`,
      type: "allocation_unclear",
      provider: canonicalProviderName(payment.merchant),
      date: payment.paymentDate,
      paid: payment.amount,
      owe: null,
      credit: 0,
      source: "Payment file",
      notes: payment.source ? `Source: ${payment.source}` : "",
    }));

  const future = state.futureVisits
    .filter((visit) => normalizeIssue(visit.auditFlag) !== "none" || futureCredit(visit) > 0 || isClaimCheckDue(visit))
    .map((visit) => ({
      id: `future-${visit.id}`,
      type: normalizeIssue(visit.auditFlag) !== "none"
        ? normalizeIssue(visit.auditFlag)
        : futureCredit(visit) > 0
          ? "possible_credit"
          : "claim_in_process",
      provider: visit.provider,
      date: visit.date,
      paid: visit.paid,
      owe: hasEobAmount(visit) ? Number(visit.eobOwe) : null,
      credit: futureCredit(visit),
      source: "Future tracker",
      notes: visit.notes || "",
      reminderDate: visit.reminderDate,
    }));

  return [...past, ...unmatched, ...future].sort((a, b) =>
    ISSUE_ORDER.indexOf(normalizeIssue(a.type)) - ISSUE_ORDER.indexOf(normalizeIssue(b.type))
    || b.credit - a.credit
    || parseDate(b.date) - parseDate(a.date)
  );
}

function getActionProviders() {
  const groups = new Map();
  getActionItems().forEach((item) => {
    const id = providerKey(item.provider);
    if (!groups.has(id)) {
      groups.set(id, {
        id,
        provider: displayProviderName(item.provider),
        latestDate: item.date,
        totalPaid: 0,
        totalOwe: 0,
        totalCredit: 0,
        issueTypes: new Set(),
        items: [],
      });
    }
    const group = groups.get(id);
    group.totalPaid += Number(item.paid || 0);
    group.totalOwe += Number(item.owe || 0);
    group.totalCredit += Number(item.credit || 0);
    group.issueTypes.add(normalizeIssue(item.type));
    group.items.push(item);
    if (parseDate(item.date) > parseDate(group.latestDate)) group.latestDate = item.date;
  });

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      issueTypes: Array.from(group.issueTypes),
      primaryIssue: primaryIssue(Array.from(group.issueTypes)),
      visitCount: group.items.length,
      items: group.items.sort((a, b) => parseDate(a.date) - parseDate(b.date)),
    }))
    .sort((a, b) =>
      ISSUE_ORDER.indexOf(a.primaryIssue) - ISSUE_ORDER.indexOf(b.primaryIssue)
      || b.totalCredit - a.totalCredit
      || parseDate(b.latestDate) - parseDate(a.latestDate)
    );
}

function selectedActionProvider() {
  const providers = getActionProviders();
  if (!providers.length) {
    state.selectedActionProviderKey = null;
    return null;
  }
  if (!providers.some((provider) => provider.id === state.selectedActionProviderKey)) {
    state.selectedActionProviderKey = providers[0].id;
  }
  return providers.find((provider) => provider.id === state.selectedActionProviderKey) || providers[0];
}

function futureCredit(visit) {
  if (visit.eobOwe === null || visit.eobOwe === undefined || visit.eobOwe === "") return 0;
  return Math.max(0, Number(visit.paid || 0) - Number(visit.eobOwe || 0));
}

function visitStatus(visit) {
  const issue = normalizeIssue(visit.auditFlag);
  if (issue !== "none") {
    const meta = issueMeta(issue);
    return { label: meta.statusLabel, className: meta.className };
  }
  if (futureCredit(visit) > 0) return { label: "Credit found", className: "confirmed" };
  if (hasEobAmount(visit)) return { label: "All clear", className: "confirmed" };
  if (isClaimCheckDue(visit)) return { label: "Check now", className: "ready" };
  return { label: "EOB pending", className: "waiting" };
}

function actionProviderScript(provider, mode = "call") {
  if (!provider) return defaultScript();
  const visitLines = provider.items
    .map(actionItemLine)
    .join("\n");
  const hasChargeReview = provider.items.some((item) => ["canceled", "unrecognized", "allocation_unclear"].includes(normalizeIssue(item.type)));
  const hasCredit = provider.totalCredit > 0;
  const reason = hasChargeReview
    ? "charge, claim, and payment allocation review"
    : hasCredit
      ? "credit balance review"
      : "claim status review";
  const correctionAsk = hasChargeReview
    ? "\n\nFor any canceled or unrecognized visit, please send the appointment or cancellation record and confirm whether the claim should be corrected or voided. If a payment was allocated to the wrong visit, please show how it was applied."
    : "";
  const creditAsk = hasCredit
    ? "\n\nIf there is a credit or overpayment, please let me know whether it can be refunded or applied to my account."
    : "";
  const itemPhrase = provider.visitCount > 1 ? "these items" : "this item";

  if (mode === "email") {
    return `Subject: Request for itemized account ledger and ${reason}\n\nHello,\n\nI am writing to request an itemized account ledger for my account with ${provider.provider}.\n\nI need help reviewing ${itemPhrase}:\n${visitLines}\n\nPlease send an itemized ledger showing charges, my payments, insurance adjustments, insurance payments, and current account balance.${correctionAsk}${creditAsk}\n\nThank you.`;
  }

  return `Hi, I am calling about my account with ${provider.provider}.\n\nI need help reviewing ${itemPhrase}:\n${visitLines}\n\nCould you send me an itemized account ledger through the patient portal or by email? I would like it to show charges, my payments, insurance adjustments, insurance payments, and current account balance.${correctionAsk}${creditAsk}`;
}

function actionItemLine(item) {
  const type = normalizeIssue(item.type);
  if (type === "canceled") {
    return `- ${formatDate(item.date)}: I have a charge or claim for this visit, but my records say I canceled or did not attend. Paid ${money(item.paid)}${item.owe !== null && item.owe !== undefined ? `; EOB says I may owe ${money(item.owe)}` : ""}${item.credit > 0 ? `; possible credit ${money(item.credit)}` : ""}.`;
  }
  if (type === "unrecognized") {
    return `- ${formatDate(item.date)}: I do not recognize this visit or charge. Paid ${money(item.paid)}${item.owe !== null && item.owe !== undefined ? `; EOB says I may owe ${money(item.owe)}` : ""}.`;
  }
  if (type === "allocation_unclear") {
    return `- ${formatDate(item.date)}: I see a provider payment of ${money(item.paid)}, but I cannot match it clearly to an EOB, claim, or visit.`;
  }
  if (type === "claim_in_process") {
    return `- ${formatDate(item.date)}: I paid ${money(item.paid)} and expected the claim/EOB around ${formatDate(item.reminderDate || item.date)}, but I still need the final amount.`;
  }
  return `- ${formatDate(item.date)}: I paid ${money(item.paid)}; my EOB says I may owe ${money(item.owe)}; possible credit ${money(item.credit)}.`;
}

function defaultScript() {
  return "Load an audit finding, mark a visit for review, or enter an EOB amount to generate a provider contact script.";
}

function providerContactFor(value) {
  const known = knownProviderFor(value);
  const phone = String(known?.phone || "").trim();
  if (!known || !phone) return null;
  return {
    name: known.name,
    phone,
    phoneHref: `tel:${phone.replace(/[^\d+]/g, "")}`,
  };
}

function updateProviderContact(provider) {
  const contact = $("#providerContact");
  if (!contact) return;

  const details = providerContactFor(provider?.provider);
  const phoneLink = $("#providerPhoneLink");
  const copyPhoneBtn = $("#copyPhoneBtn");
  const note = $("#providerContactNote");

  if (!details) {
    contact.hidden = true;
    if (copyPhoneBtn) copyPhoneBtn.dataset.phone = "";
    return;
  }

  contact.hidden = false;
  if (phoneLink) {
    phoneLink.textContent = details.phone;
    phoneLink.href = details.phoneHref;
    phoneLink.setAttribute("aria-label", `Call ${details.name} at ${details.phone}`);
  }
  if (copyPhoneBtn) copyPhoneBtn.dataset.phone = details.phone;
  if (note) note.textContent = `Public office number for ${details.name}.`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function providerMatches(provider, query) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return false;
  const haystack = `${provider.name} ${provider.address} ${provider.type} ${(provider.aliases || []).join(" ")}`.toLowerCase();
  return q
    .split(/\s+/)
    .filter(Boolean)
    .every((part) => haystack.includes(part));
}

function renderProviderSuggestions(query) {
  const box = $("#providerSuggestions");
  if (!box) return;
  const matches = providerDirectory.filter((provider) => providerMatches(provider, query)).slice(0, 5);
  if (!matches.length) {
    box.classList.remove("is-visible");
    box.innerHTML = "";
    return;
  }

  box.innerHTML = matches
    .map(
      (provider, index) => `
        <button class="provider-suggestion" type="button" role="option" data-provider-index="${index}">
          <span class="provider-suggestion-name">${escapeHtml(provider.name)}</span>
          <span class="provider-suggestion-address">${escapeHtml(provider.address)}</span>
          <span class="provider-suggestion-type">${escapeHtml(provider.type)}</span>
        </button>
      `
    )
    .join("");
  box.dataset.matches = JSON.stringify(matches);
  box.classList.add("is-visible");
}

function closeProviderSuggestions() {
  const box = $("#providerSuggestions");
  if (!box) return;
  box.classList.remove("is-visible");
}

function selectProviderSuggestion(provider) {
  const providerInput = $("#providerInput");
  const addressInput = $("#providerAddressInput");
  const typeSelect = $('#visitForm select[name="type"]');
  if (!providerInput) return;

  providerInput.value = provider.name;
  providerInput.dataset.selectedAddress = provider.address;
  if (addressInput) addressInput.value = provider.address;
  if (typeSelect && provider.type) typeSelect.value = provider.type;
  if (provider.insurance) setInsuranceFieldValue(provider.insurance);
  closeProviderSuggestions();
}

function toggleInsuranceCustom() {
  const preset = $("#insurancePreset");
  const custom = $("#insuranceCustomInput");
  if (!preset || !custom) return;
  const isCustom = preset.value === "__custom__";
  custom.classList.toggle("is-hidden", !isCustom);
  custom.required = isCustom;
  if (!isCustom) custom.value = "";
}

function setInsuranceFieldValue(value) {
  const preset = $("#insurancePreset");
  const custom = $("#insuranceCustomInput");
  if (!preset || !custom) return;

  const insurance = String(value || "").trim();
  if (!insurance) {
    preset.value = "";
    custom.value = "";
    toggleInsuranceCustom();
    return;
  }

  const hasPreset = Array.from(preset.options).some((option) => option.value === insurance);
  if (hasPreset) {
    preset.value = insurance;
    custom.value = "";
  } else {
    preset.value = "__custom__";
    custom.value = insurance;
  }
  toggleInsuranceCustom();
}

function selectedInsuranceValue(formData) {
  const preset = String(formData.get("insurancePreset") || "").trim();
  if (preset === "__custom__") return String(formData.get("insuranceCustom") || "").trim();
  return preset;
}

function isPersonalPaymentMethod(value) {
  const method = String(value || "").trim().toLowerCase();
  return ["personal card", "apple card", "debit card", "cash / check", "other card"].includes(method);
}

function updateReimbursementRow() {
  const row = $("#reimbursementRow");
  const method = $('#visitForm select[name="paymentMethod"]');
  const checkbox = $('#visitForm input[name="needsReimbursement"]');
  if (!row || !method || !checkbox) return;
  const visible = isPersonalPaymentMethod(method.value);
  row.classList.toggle("is-hidden", !visible);
  if (!visible) checkbox.checked = false;
}

function resetVisitFormAfterSubmit(form) {
  form.reset();
  $("#providerAddressInput").value = "";
  setInsuranceFieldValue("");
  const details = $("#visitDetails");
  if (details) details.open = false;
  setDefaultVisitDate();
  updateReimbursementRow();
}

function wireEvents() {
  $$(".nav-item").forEach((button) => {
    button.addEventListener("click", () => switchView(button.dataset.view));
  });

  $$("[data-jump]").forEach((button) => {
    button.addEventListener("click", () => switchView(button.dataset.jump));
  });

  const loadSampleBtn = $("#loadSampleBtn");
  if (loadSampleBtn) loadSampleBtn.addEventListener("click", () => loadSample());
  $("#sampleAuditBtn").addEventListener("click", () => loadSample());

  $("#runAuditBtn").addEventListener("click", async () => {
    const claimFiles = state.uploadFiles.claims;
    const paymentFiles = state.uploadFiles.payments;
    const hasClaimSource = claimFiles.length || state.manualClaims.length;
    const hasPaymentSource = paymentFiles.length || state.manualPayments.length;
    state.auditNotices = [];
    if (!hasClaimSource || !hasPaymentSource) {
      showToast("Add at least one EOB row and one payment row.");
      return;
    }
    try {
      state.fileWarnings = [];
      state.auditYearScope = "focus";
      const [claimRows, paymentRows] = await Promise.all([
        parseTabularFiles(claimFiles, "claims"),
        parseTabularFiles(paymentFiles, "payments"),
      ]);
      state.claims = [...mapClaims(claimRows), ...state.manualClaims];
      state.payments = [...mapPayments(paymentRows), ...state.manualPayments];
      if (!state.claims.length || !state.payments.length) {
        const warningText = state.fileWarnings.length ? state.fileWarnings.join("; ") : "";
        if (state.claims.length && !state.payments.length) {
          state.auditResults = runAudit(state.claims, []);
          state.auditHasRun = true;
          state.uploadExpanded = true;
          state.selectedProviderKey = null;
          state.auditNotices = [{
            tone: "warning",
            title: "Payment PDF needs manual entry",
            body: warningText
              ? `${warningText}. The claims file was parsed, but the payment PDF did not expose selectable text, so OweMe cannot read the allocated payment automatically yet. Claims with patient responsibility are shown below as payment-match review items. Add one manual Payment row from the provider statement, then run the audit again.`
              : "The claims file was parsed, but no payment rows were found. Claims with patient responsibility are shown below as payment-match review items. Add one manual Payment row from the provider statement, then run the audit again.",
          }];
          $("#uploadStatus").textContent = `${state.claims.length} claim rows parsed. No payment rows parsed from the selected payment file.`;
          render();
          showToast("Payment PDF needs manual row.");
          return;
        }

        if (!state.claims.length && state.payments.length) {
          state.auditResults = [];
          state.auditHasRun = true;
          state.uploadExpanded = true;
          state.auditNotices = [{
            tone: "warning",
            title: "Claims file was not parsed",
            body: "OweMe found payment rows, but no claim/EOB rows. Check the claims file or add an EOB row manually.",
          }];
          $("#uploadStatus").textContent = `${state.payments.length} payment rows parsed. No claim rows parsed from the selected claims file.`;
          render();
          showToast("Claims file needs review.");
          return;
        }

        state.auditHasRun = false;
        state.uploadExpanded = true;
        state.auditNotices = [{
          tone: "warning",
          title: "No readable audit rows found",
          body: warningText || "Could not find enough EOB/payment rows. If a PDF is scanned, add the row manually.",
        }];
        render();
        showToast("Could not find audit rows.");
        return;
      }
      state.auditResults = runAudit(state.claims, state.payments);
      state.auditFlags = {};
      state.auditHasRun = true;
      state.uploadExpanded = false;
      state.selectedProviderKey = null;
      const warningText = state.fileWarnings.length ? ` ${state.fileWarnings.join("; ")}.` : "";
      state.auditNotices = state.fileWarnings.map((warning) => ({
        tone: "warning",
        title: "Some PDF content needs OCR",
        body: `${warning}. Parsed rows are shown below, but scanned PDF amounts may need manual entry.`,
      }));
      $("#uploadStatus").textContent = `${claimFiles.length} claim file${claimFiles.length === 1 ? "" : "s"}, ${paymentFiles.length} payment file${paymentFiles.length === 1 ? "" : "s"}, and ${state.manualClaims.length + state.manualPayments.length} manual row${state.manualClaims.length + state.manualPayments.length === 1 ? "" : "s"} read. ${state.claims.length} claim rows and ${state.payments.length} payments parsed.${warningText}`;
      render();
      showToast("Audit complete.");
    } catch (error) {
      console.error(error);
      if (String(error?.message || "").startsWith("PDF_NEEDS_OCR:")) {
        const fileName = String(error.message).replace("PDF_NEEDS_OCR:", "");
        $("#uploadStatus").textContent = `${fileName} needs OCR. This prototype reads selectable-text PDFs.`;
        showToast("This PDF needs OCR.");
        return;
      }
      showToast("Could not read one of the files.");
    }
  });

  $("#claimsFile").addEventListener("change", (event) => addUploadFiles("claims", event.currentTarget));
  $("#paymentsFile").addEventListener("change", (event) => addUploadFiles("payments", event.currentTarget));

  $("#toggleImportBtn")?.addEventListener("click", () => {
    state.uploadExpanded = !state.uploadExpanded;
    renderImportPanel();
  });

  $("#claimsFileChips").addEventListener("click", handleUploadFileRemove);
  $("#paymentsFileChips").addEventListener("click", handleUploadFileRemove);

  $("#manualEntryForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const kind = String(data.get("kind"));
    const provider = String(data.get("provider") || "").trim();
    const date = toIsoDate(parseDate(String(data.get("date") || "")));
    const amount = Number(data.get("amount"));
    if (!provider || !date || !Number.isFinite(amount)) {
      showToast("Add provider, date, and amount.");
      return;
    }

    if (kind === "claim") {
      state.manualClaims.push({
        id: `C-manual-${Date.now()}`,
        provider,
        serviceDate: date,
        responsibility: amount,
        billed: 0,
        source: "Manual",
      });
    } else {
      state.manualPayments.push({
        id: `P-manual-${Date.now()}`,
        merchant: provider,
        paymentDate: date,
        amount,
        source: "Manual",
      });
    }

    state.uploadExpanded = true;
    const form = event.currentTarget;
    form.reset();
    form.elements.kind.value = kind;
    form.elements.provider.value = provider;
    form.elements.date.focus();
    renderImportPanel();
    updateUploadStatus();
    showToast(kind === "claim" ? "EOB row added." : "Payment row added.");
  });

  $("#manualRowList")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-remove-manual-row]");
    if (!button) return;
    const index = Number(button.dataset.index);
    if (button.dataset.kind === "claim") state.manualClaims.splice(index, 1);
    if (button.dataset.kind === "payment") state.manualPayments.splice(index, 1);
    renderImportPanel();
    updateUploadStatus();
  });

  $("#providerCreditList").addEventListener("click", (event) => {
    const card = event.target.closest("[data-provider-key]");
    if (!card) return;
    state.selectedProviderKey = card.dataset.providerKey;
    renderProviderCredits();
    renderVisitDetail();
  });

  $("#visitDetail").addEventListener("click", (event) => {
    const flagButton = event.target.closest("[data-audit-flag-key]");
    if (flagButton) {
      const key = flagButton.dataset.auditFlagKey;
      const issue = normalizeIssue(flagButton.dataset.auditFlag);
      if (issue === "none") {
        state.auditFlags[key] = "none";
      } else {
        state.auditFlags[key] = issue;
      }
      renderProviderCredits();
      renderVisitDetail();
      renderActions();
      showToast(issue === "none" ? "Audit flag cleared." : "Audit row marked for review.");
      return;
    }

    const button = event.target.closest("[data-open-provider-action]");
    if (!button) return;
    state.selectedActionProviderKey = button.dataset.openProviderAction;
    state.scriptMode = "call";
    switchView("actions");
    renderActions();
    showToast("Provider script ready.");
  });

  $("#auditScopeBar")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-audit-scope]");
    if (!button) return;
    state.auditYearScope = button.dataset.auditScope === "all" ? "all" : "focus";
    state.selectedProviderKey = null;
    state.selectedActionProviderKey = null;
    renderAuditSummary();
    renderAuditScopeBar();
    renderProviderCredits();
    renderVisitDetail();
    renderActions();
  });

  const providerInput = $("#providerInput");
  if (providerInput) {
    providerInput.addEventListener("input", (event) => {
      $("#providerAddressInput").value = "";
      event.currentTarget.dataset.selectedAddress = "";
      renderProviderSuggestions(event.currentTarget.value);
    });
    providerInput.addEventListener("focus", (event) => {
      renderProviderSuggestions(event.currentTarget.value);
    });
    providerInput.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      closeProviderSuggestions();
    });
  }

  $("#providerSuggestions")?.addEventListener("mousedown", (event) => {
    event.preventDefault();
    const button = event.target.closest("[data-provider-index]");
    if (!button) return;
    const matches = JSON.parse($("#providerSuggestions").dataset.matches || "[]");
    const provider = matches[Number(button.dataset.providerIndex)];
    if (provider) selectProviderSuggestion(provider);
  });

  $("#insurancePreset")?.addEventListener("change", () => {
    toggleInsuranceCustom();
    if ($("#insurancePreset").value === "__custom__") $("#insuranceCustomInput")?.focus();
  });

  $('#visitForm select[name="paymentMethod"]')?.addEventListener("change", updateReimbursementRow);

  $("#exportVisitsBtn")?.addEventListener("click", () => {
    if (!state.futureVisits.length) {
      showToast("No visits to export yet.");
      return;
    }
    exportVisitBackup();
  });

  $("#importVisitsFile")?.addEventListener("change", async (event) => {
    const input = event.currentTarget;
    const [file] = Array.from(input.files || []);
    await importVisitBackup(file);
    input.value = "";
  });

  $$(".visit-filter-tabs [data-visit-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      state.futureVisitFilter = button.dataset.visitFilter || "all";
      state.editingVisitId = null;
      state.openVisitMenuId = null;
      renderFutureVisits();
    });
  });

  document.addEventListener("mousedown", (event) => {
    if (event.target.closest(".provider-field")) return;
    closeProviderSuggestions();
  });

  document.addEventListener("click", (event) => {
    if (event.target.closest(".visit-menu-wrap")) return;
    if (!state.openVisitMenuId) return;
    state.openVisitMenuId = null;
    renderFutureVisits();
  });

  $("#visitForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const date = String(data.get("date"));
    const weeks = Number(data.get("weeks"));
    const visit = {
      id: `V-${Date.now()}`,
      provider: String(data.get("provider")).trim(),
      providerAddress: String(data.get("providerAddress")).trim(),
      type: String(data.get("type")),
      date,
      paid: Number(data.get("paid")),
      paymentMethod: String(data.get("paymentMethod") || "").trim(),
      needsReimbursement: data.get("needsReimbursement") === "on",
      auditFlag: normalizeIssue(data.get("auditFlag")),
      insurance: selectedInsuranceValue(data),
      weeks,
      reminderDate: addDays(date, weeks * 7),
      nextAppointmentDate: toIsoDate(parseDate(String(data.get("nextAppointmentDate") || ""))),
      notes: String(data.get("notes") || "").trim(),
      eobOwe: null,
      status: "waiting",
    };
    state.futureVisits.unshift(visit);
    const filterType = normalizeVisitType(visit.type);
    state.futureVisitFilter = filterType === "dental" || filterType === "medical" ? filterType : "all";
    saveVisits();
    resetVisitFormAfterSubmit(event.currentTarget);
    render();
    showToast("Visit tracker added.");
  });

  $("#futureVisitList").addEventListener("click", (event) => {
    const menuButton = event.target.closest("[data-visit-menu]");
    if (menuButton) {
      const visitId = menuButton.dataset.visitMenu;
      state.openVisitMenuId = state.openVisitMenuId === visitId ? null : visitId;
      renderFutureVisits();
      return;
    }

    const flagButton = event.target.closest("[data-flag-visit]");
    if (flagButton) {
      const visit = state.futureVisits.find((item) => item.id === flagButton.dataset.flagVisit);
      if (!visit) return;
      visit.auditFlag = normalizeIssue(flagButton.dataset.flagValue);
      state.openVisitMenuId = null;
      saveVisits();
      render();
      showToast(visit.auditFlag === "none" ? "Issue cleared." : "Visit marked for review.");
      return;
    }

    const editButton = event.target.closest("[data-edit-visit]");
    if (editButton) {
      const visitId = editButton.dataset.editVisit;
      state.editingVisitId = state.editingVisitId === visitId ? null : visitId;
      state.openVisitMenuId = null;
      renderFutureVisits();
      return;
    }

    const cancelEditButton = event.target.closest("[data-cancel-visit-edit]");
    if (cancelEditButton) {
      state.editingVisitId = null;
      state.openVisitMenuId = null;
      renderFutureVisits();
      return;
    }

    const deleteButton = event.target.closest("[data-delete-visit]");
    if (deleteButton) {
      const visitId = deleteButton.dataset.deleteVisit;
      const visit = state.futureVisits.find((item) => item.id === visitId);
      if (!visit) return;
      if (!window.confirm(`Delete ${visit.provider}?`)) return;
      state.futureVisits = state.futureVisits.filter((item) => item.id !== visitId);
      state.openVisitMenuId = null;
      saveVisits();
      render();
      showToast("Visit deleted.");
      return;
    }

    const button = event.target.closest("[data-save-eob]");
    if (!button) return;
    const visitId = button.dataset.saveEob;
    const input = $(`[data-eob-input="${CSS.escape(visitId)}"]`);
    const visit = state.futureVisits.find((item) => item.id === visitId);
    if (!visit) return;
    visit.eobOwe = input.value === "" ? null : Number(input.value);
    state.openVisitMenuId = null;
    saveVisits();
    render();
    showToast("EOB amount saved.");
  });

  $("#futureVisitList").addEventListener("submit", (event) => {
    const form = event.target.closest("[data-visit-edit-form]");
    if (!form) return;
    event.preventDefault();

    const visitId = form.dataset.visitEditForm;
    const visit = state.futureVisits.find((item) => item.id === visitId);
    if (!visit) return;

    const data = new FormData(form);
    const date = toIsoDate(parseDate(String(data.get("date") || "")));
    const reminderDate = toIsoDate(parseDate(String(data.get("reminderDate") || "")));
    const nextAppointmentDate = toIsoDate(parseDate(String(data.get("nextAppointmentDate") || "")));
    const paid = Number(data.get("paid"));
    const provider = String(data.get("provider") || "").trim();

    if (!provider || !date || !reminderDate || !Number.isFinite(paid)) {
      showToast("Add provider, date, paid amount, and claim check date.");
      return;
    }

    visit.provider = provider;
    visit.type = String(data.get("type") || visit.type || "Medical");
    visit.date = date;
    visit.paid = paid;
    visit.paymentMethod = String(data.get("paymentMethod") || "").trim();
    visit.needsReimbursement = data.get("needsReimbursement") === "on";
    visit.auditFlag = normalizeIssue(data.get("auditFlag"));
    visit.insurance = String(data.get("insurance") || "").trim();
    visit.reminderDate = reminderDate;
    visit.nextAppointmentDate = nextAppointmentDate;
    visit.notes = String(data.get("notes") || "").trim();

    state.editingVisitId = null;
    state.openVisitMenuId = null;
    saveVisits();
    render();
    showToast("Visit updated.");
  });

  $("#actionList").addEventListener("click", (event) => {
    const card = event.target.closest("[data-action-provider-key]");
    if (!card) return;
    state.selectedActionProviderKey = card.dataset.actionProviderKey;
    renderActions();
  });

  $$("[data-script-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      state.scriptMode = button.dataset.scriptMode;
      renderActions();
    });
  });

  $("#copyScriptBtn").addEventListener("click", async () => {
    const text = $("#scriptText").value;
    try {
      await navigator.clipboard.writeText(text);
      showToast("Script copied.");
    } catch {
      $("#scriptText").select();
      document.execCommand("copy");
      showToast("Script selected for copy.");
    }
  });

  $("#copyPhoneBtn")?.addEventListener("click", async (event) => {
    const text = event.currentTarget.dataset.phone;
    if (!text) {
      showToast("No phone number available.");
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      showToast("Phone copied.");
    } catch {
      const field = document.createElement("textarea");
      field.value = text;
      field.setAttribute("readonly", "");
      field.style.position = "fixed";
      field.style.opacity = "0";
      document.body.append(field);
      field.select();
      document.execCommand("copy");
      field.remove();
      showToast("Phone copied.");
    }
  });
}

function updateUploadStatus() {
  const claimFiles = state.uploadFiles.claims;
  const paymentFiles = state.uploadFiles.payments;
  const claimsName = $("#claimsFileName");
  const paymentsName = $("#paymentsFileName");
  if (claimsName) claimsName.textContent = fileSummary(claimFiles, "claim");
  if (paymentsName) paymentsName.textContent = fileSummary(paymentFiles, "payment");
  renderFileChips("#claimsFileChips", claimFiles);
  renderFileChips("#paymentsFileChips", paymentFiles);

  const total = claimFiles.length + paymentFiles.length;
  const manualTotal = state.manualClaims.length + state.manualPayments.length;
  if (!total && !manualTotal) {
    $("#uploadStatus").textContent = "No files selected.";
    return;
  }
  const filePart = total ? `${total} file${total === 1 ? "" : "s"}` : "No files";
  const manualPart = manualTotal ? `${manualTotal} manual row${manualTotal === 1 ? "" : "s"}` : "no manual rows";
  $("#uploadStatus").textContent = `${filePart} and ${manualPart} ready.`;
  if (claimFiles.length > MAX_FILES_PER_BUCKET || paymentFiles.length > MAX_FILES_PER_BUCKET) {
    showToast(`Using the first ${MAX_FILES_PER_BUCKET} files in each section.`);
  }
}

function addUploadFiles(bucket, input) {
  const incoming = Array.from(input.files || []);
  input.value = "";
  if (!incoming.length) return;

  const existing = state.uploadFiles[bucket] || [];
  const seen = new Set(existing.map(fileFingerprint));
  const next = [...existing];
  let blockedByLimit = false;

  incoming.forEach((file) => {
    if (seen.has(fileFingerprint(file))) return;
    if (next.length >= MAX_FILES_PER_BUCKET) {
      blockedByLimit = true;
      return;
    }
    next.push(file);
    seen.add(fileFingerprint(file));
  });

  state.uploadFiles[bucket] = next;
  state.uploadExpanded = true;
  updateUploadStatus();
  renderImportPanel();

  if (blockedByLimit) {
    showToast(`Maximum ${MAX_FILES_PER_BUCKET} files per section.`);
  }
}

function handleUploadFileRemove(event) {
  const button = event.target.closest("[data-remove-file]");
  if (!button) return;
  const bucket = button.dataset.fileBucket;
  const index = Number(button.dataset.fileIndex);
  if (!state.uploadFiles[bucket]) return;
  state.uploadFiles[bucket].splice(index, 1);
  state.uploadExpanded = true;
  updateUploadStatus();
  renderImportPanel();
}

function fileFingerprint(file) {
  return `${file.name}|${file.size}|${file.lastModified}`;
}

function fileSummary(files, label) {
  if (!files.length) return `Up to ${MAX_FILES_PER_BUCKET} Excel, CSV, or PDF files`;
  return `${files.length} ${label} file${files.length === 1 ? "" : "s"} selected`;
}

function renderFileChips(selector, files) {
  const container = $(selector);
  if (!container) return;
  const visibleFiles = Array.from(files || []);
  if (!visibleFiles.length) {
    container.innerHTML = "";
    return;
  }
  const bucket = selector.includes("claims") ? "claims" : "payments";
  container.innerHTML = `
    ${visibleFiles
      .map((file, index) => `
        <span class="file-chip" title="${escapeHtml(file.name)}">
          <span>${escapeHtml(file.name)}</span>
          <button type="button" aria-label="Remove ${escapeHtml(file.name)}" data-remove-file data-file-bucket="${bucket}" data-file-index="${index}">x</button>
        </span>
      `)
      .join("")}
  `;
}

function setDefaultVisitDate() {
  const input = $('#visitForm input[name="date"]');
  if (input && !input.value) {
    input.value = toIsoDate(new Date());
  }
}

function init() {
  const todayChip = $("#todayChip");
  if (todayChip) todayChip.textContent = `Today · ${formatDate(new Date())}`;
  removeLegacyDemoVisits();
  setDefaultVisitDate();
  wireEvents();
  updateReimbursementRow();
  render();
}

init();
