import fs from "node:fs";
import path from "node:path";

const publicVariableNames = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
];

function readJavaScriptFiles(directory) {
  if (!fs.existsSync(directory)) {
    throw new Error("Cloudflare client assets were not generated.");
  }

  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return readJavaScriptFiles(entryPath);
    }
    return entry.isFile() && entry.name.endsWith(".js") ? [entryPath] : [];
  });
}

function extractInlinedValues(source, variableName) {
  const pattern = new RegExp(
    `(?:["'])?${variableName}(?:["'])?\\s*:\\s*["']([^"']*)["']`,
    "g",
  );
  return [...source.matchAll(pattern)].map((match) => match[1]);
}

function requireSingleNonEmptyValue(sources, variableName, scope) {
  const values = sources.flatMap((source) =>
    extractInlinedValues(source, variableName),
  );

  if (values.length === 0 || values.some((value) => value.length === 0)) {
    throw new Error(`${scope} has a missing public Supabase build variable.`);
  }

  const distinctValues = new Set(values);
  if (distinctValues.size !== 1) {
    throw new Error(`${scope} contains inconsistent public Supabase values.`);
  }

  return values[0];
}

function checkCloudflarePublicConfig(projectRoot) {
  const openNextRoot = path.join(projectRoot, ".open-next");
  const serverRoute = path.join(
    openNextRoot,
    "server-functions",
    "default",
    ".next",
    "server",
    "app",
    "api",
    "admin",
    "reconcile-token-reservations",
    "route.js",
  );
  const clientChunks = path.join(
    openNextRoot,
    "assets",
    "_next",
    "static",
    "chunks",
  );

  if (!fs.existsSync(serverRoute)) {
    throw new Error("Cloudflare server artifact was not generated.");
  }

  const serverSources = [fs.readFileSync(serverRoute, "utf8")];
  const clientSources = readJavaScriptFiles(clientChunks).map((file) =>
    fs.readFileSync(file, "utf8"),
  );

  const serverValues = Object.fromEntries(
    publicVariableNames.map((name) => [
      name,
      requireSingleNonEmptyValue(serverSources, name, "Server artifact"),
    ]),
  );
  const clientValues = Object.fromEntries(
    publicVariableNames.map((name) => [
      name,
      requireSingleNonEmptyValue(clientSources, name, "Client artifact"),
    ]),
  );

  for (const name of publicVariableNames) {
    if (serverValues[name] !== clientValues[name]) {
      throw new Error(
        "Server and client artifacts contain different public Supabase values.",
      );
    }
  }

  const supabaseUrl = new URL(serverValues.NEXT_PUBLIC_SUPABASE_URL);
  if (supabaseUrl.protocol !== "https:") {
    throw new Error("The inlined Supabase URL must use HTTPS.");
  }
  if (serverValues.NEXT_PUBLIC_SUPABASE_ANON_KEY.length < 20) {
    throw new Error("The inlined Supabase anon key is invalid.");
  }
}

function parseProjectRoot(argv) {
  const rootFlag = argv.indexOf("--root");
  if (rootFlag === -1) {
    return process.cwd();
  }
  const value = argv[rootFlag + 1];
  if (!value) {
    throw new Error("--root requires a directory.");
  }
  return path.resolve(value);
}

try {
  checkCloudflarePublicConfig(parseProjectRoot(process.argv.slice(2)));
  console.log(
    "Cloudflare public Supabase build config verified (values hidden).",
  );
} catch (error) {
  const message = error instanceof Error ? error.message : "Unknown error";
  console.error(`Cloudflare public build config check failed: ${message}`);
  process.exitCode = 1;
}
