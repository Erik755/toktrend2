#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const readline = require("node:readline/promises");

const ROOT = process.cwd();
const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const yes = args.has("--yes") || process.env.GITHUB_SETUP_YES === "1";

const defaults = {
  repoName: process.env.GITHUB_REPO_NAME || "toktrend",
  visibility: process.env.GITHUB_REPO_VISIBILITY || "private",
  description: process.env.GITHUB_REPO_DESCRIPTION || "TokTrend - AI-powered TikTok automation app",
  branch: process.env.GITHUB_DEFAULT_BRANCH || "main",
  createRemote: parseBool(process.env.GITHUB_CREATE_REMOTE, true),
  pushInitial: parseBool(process.env.GITHUB_PUSH_INITIAL, true)
};

const requiredIgnoreEntries = [
  ".env",
  ".env.local",
  ".env.production",
  ".env.development",
  "node_modules/",
  ".tiktok_token.json",
  ".tiktok_oauth_state.json",
  "*.pem",
  "*.key",
  "secrets.json",
  "credentials.json",
  "token.json",
  "_external/"
];

const sensitiveExact = new Set([
  ".env",
  ".env.local",
  ".env.production",
  ".env.development",
  ".env.test",
  ".tiktok_token.json",
  ".tiktok_oauth_state.json",
  "secrets.json",
  "credentials.json",
  "token.json",
  "id_rsa",
  "id_rsa.pub"
]);

const secretPatterns = [
  { name: "OpenAI API key", pattern: /\bsk-(?:proj-)?[A-Za-z0-9_-]{24,}\b/g },
  { name: "GitHub token", pattern: /\b(?:ghp|gho|ghu|ghs|ghr|github_pat)_[A-Za-z0-9_]{20,}\b/g },
  { name: "Google API key", pattern: /\bAIza[A-Za-z0-9_-]{20,}\b/g },
  { name: "Private key block", pattern: /-----BEGIN (?:RSA |OPENSSH |EC |DSA )?PRIVATE KEY-----/g }
];

main().catch((error) => {
  console.error("");
  console.error(`ERROR: ${error.message}`);
  process.exit(1);
});

async function main() {
  if (args.has("--help") || args.has("-h")) {
    printHelp();
    return;
  }

  console.log("TokTrend GitHub setup");
  if (dryRun) console.log("Modo dry-run: no se crearan repositorios, commits ni push.");

  requireCommand("git", ["--version"], "Git no esta instalado o no esta disponible en PATH.");
  const gh = resolveGh();
  if (!commandWorks(gh, ["--version"])) {
    printGhManualInstructions();
    throw new Error("GitHub CLI no esta instalado.");
  }
  if (!commandWorks(gh, ["auth", "status"])) {
    console.error("ERROR: GitHub CLI no esta autenticado.");
    console.error("");
    console.error("Ejecuta:");
    console.error("  gh auth login");
    process.exit(1);
  }

  ensureGitRepository();
  ensureGitignore();
  assertNoSensitiveFiles();

  const config = yes ? defaults : await promptConfig(defaults);
  if (!dryRun) {
    run("git", ["add", "."]);
    assertNoSensitiveFiles();
    if (!hasGitHistory()) {
      run("git", ["commit", "-m", "Initial TokTrend portable setup"]);
    } else if (hasStagedChanges()) {
      run("git", ["commit", "-m", "Prepare TokTrend GitHub deployment"]);
    }
    run("git", ["branch", "-M", config.branch]);
    await ensureGithubRepository(gh, config);
    if (config.pushInitial) run("git", ["push", "-u", "origin", config.branch]);
  }

  console.log("GitHub setup finalizado.");
}

function parseBool(value, fallback) {
  if (value === undefined || value === "") return fallback;
  return ["1", "true", "yes", "si"].includes(String(value).toLowerCase());
}

function resolveGh() {
  const portable = path.join(process.env.LOCALAPPDATA || "", "Programs", "GitHubCLI", "bin", "gh.exe");
  return fs.existsSync(portable) ? portable : "gh";
}

function run(command, commandArgs, options = {}) {
  if (dryRun && options.mutates !== false) {
    console.log(`[dry-run] ${command} ${commandArgs.join(" ")}`);
    return "";
  }
  return execFileSync(command, commandArgs, { cwd: ROOT, stdio: options.capture ? "pipe" : "inherit", encoding: "utf8" });
}

function requireCommand(command, commandArgs, message) {
  if (!commandWorks(command, commandArgs)) throw new Error(message);
}

function commandWorks(command, commandArgs) {
  try {
    execFileSync(command, commandArgs, { cwd: ROOT, stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function ensureGitRepository() {
  if (!fs.existsSync(path.join(ROOT, ".git"))) run("git", ["init"]);
}

function ensureGitignore() {
  const file = path.join(ROOT, ".gitignore");
  if (!fs.existsSync(file)) throw new Error("Falta .gitignore.");
  const content = fs.readFileSync(file, "utf8");
  const missing = requiredIgnoreEntries.filter((entry) => !content.includes(entry));
  if (missing.length) throw new Error(`.gitignore no protege: ${missing.join(", ")}`);
}

function assertNoSensitiveFiles() {
  const tracked = list("git", ["ls-files"]);
  const staged = list("git", ["diff", "--cached", "--name-only"]);
  const candidates = [...new Set([...tracked, ...staged])].filter(Boolean);

  for (const file of candidates) {
    const normalized = file.replace(/\\/g, "/");
    const base = path.basename(normalized);
    if (sensitiveExact.has(base) || normalized.includes("node_modules/") || /\.(pem|key)$/i.test(base)) {
      console.error("ERROR: Archivo sensible detectado. No se hara commit ni push hasta corregirlo.");
      console.error(`Sugerencia si ya esta rastreado: git rm --cached ${file}`);
      process.exit(1);
    }
    scanFileForSecrets(file);
  }
}

function scanFileForSecrets(file) {
  const absolute = path.join(ROOT, file);
  if (!fs.existsSync(absolute) || fs.statSync(absolute).isDirectory()) return;
  if (/\.(png|jpg|jpeg|webp|webm|mp4|keystore)$/i.test(file)) return;
  const content = fs.readFileSync(absolute, "utf8");
  for (const { name, pattern } of secretPatterns) {
    pattern.lastIndex = 0;
    if (pattern.test(content) && file !== ".env.example") {
      console.error("ERROR: Archivo sensible detectado. No se hara commit ni push hasta corregirlo.");
      console.error(`${name} en ${file}`);
      process.exit(1);
    }
  }
}

function list(command, commandArgs) {
  try {
    return execFileSync(command, commandArgs, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function hasGitHistory() {
  return commandWorks("git", ["rev-parse", "--verify", "HEAD"]);
}

function hasStagedChanges() {
  return list("git", ["diff", "--cached", "--name-only"]).length > 0;
}

async function promptConfig(defaultConfig) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    return {
      repoName: await ask(rl, "Nombre del repo", defaultConfig.repoName),
      visibility: await ask(rl, "Visibilidad private/public", defaultConfig.visibility),
      description: await ask(rl, "Descripcion", defaultConfig.description),
      branch: await ask(rl, "Rama principal", defaultConfig.branch),
      createRemote: parseBool(await ask(rl, "Crear remote origin true/false", String(defaultConfig.createRemote)), defaultConfig.createRemote),
      pushInitial: parseBool(await ask(rl, "Hacer push inicial true/false", String(defaultConfig.pushInitial)), defaultConfig.pushInitial)
    };
  } finally {
    rl.close();
  }
}

async function ask(rl, label, fallback) {
  const answer = (await rl.question(`${label} [${fallback}]: `)).trim();
  return answer || fallback;
}

async function ensureGithubRepository(gh, config) {
  if (!config.createRemote) return;
  const remote = list("git", ["remote"]);
  if (remote.includes("origin")) return;

  const exists = commandWorks(gh, ["repo", "view", config.repoName]);
  if (exists && !yes && process.env.GITHUB_USE_EXISTING !== "true") {
    throw new Error("El repositorio ya existe. Usa --yes o GITHUB_USE_EXISTING=true para conectarlo.");
  }
  if (!exists) {
    run(gh, ["repo", "create", config.repoName, `--${config.visibility}`, "--description", config.description, "--source", ".", "--remote", "origin"]);
  } else {
    const owner = execFileSync(gh, ["api", "user", "--jq", ".login"], { encoding: "utf8" }).trim();
    run("git", ["remote", "add", "origin", `https://github.com/${owner}/${config.repoName}.git`]);
  }
}

function printGhManualInstructions() {
  console.error("GitHub CLI no esta instalado.");
  console.error("1. Instala GitHub CLI: https://cli.github.com/");
  console.error("2. Autenticate: gh auth login");
  console.error("3. Crea el repo manualmente si hace falta.");
  console.error("4. Ejecuta git init/add/commit/remote/push.");
}

function printHelp() {
  console.log("Uso: npm run github:setup -- [--dry-run] [--yes]");
  console.log("Variables: GITHUB_REPO_NAME, GITHUB_REPO_VISIBILITY, GITHUB_REPO_DESCRIPTION, GITHUB_DEFAULT_BRANCH");
}
