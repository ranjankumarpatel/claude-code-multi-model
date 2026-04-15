#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync, cpSync, rmSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { homedir, tmpdir, platform } from 'node:os';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';

const REPO = 'https://github.com/ranjankumarpatel/claude-code-multi-model.git';
const CACHE_DIR = join(homedir(), '.cache', 'claude-code-multi-model');

const { values: args } = parseArgs({
  options: {
    cache: { type: 'boolean', default: false },
    global: { type: 'boolean', default: false },
    copy: { type: 'boolean', default: false },
    'with-codex': { type: 'boolean', default: false },
    env: { type: 'boolean', default: false },
    target: { type: 'string', default: process.cwd() },
    help: { type: 'boolean', short: 'h', default: false },
  },
});

if (args.help) {
  console.log(`cmm-install — install claude-code-multi-model plugin

Usage: npx cmm-install [options]

Options:
  --cache          Reuse ~/.cache/claude-code-multi-model (default: temp, fresh clone)
  --global         Install to ~/.claude/plugins/multi-model (all projects)
  --copy           Copy plugin into <target>/plugins/ instead of linking via marketplace
  --with-codex     Also add openai/codex-plugin-cc entry to marketplace.json
  --env            Write MCP_GLOBAL_MODULES to shell profile + prompt NVIDIA_API_KEY
  --target <dir>   Target project dir (default: cwd)
  -h, --help       Show this help`);
  process.exit(0);
}

const log = (m) => console.log(`[cmm] ${m}`);
const run = (cmd, opts = {}) => execSync(cmd, { stdio: 'inherit', ...opts });

function ensureRepo() {
  const dir = args.cache ? CACHE_DIR : join(tmpdir(), `cmm-${Date.now()}`);
  if (args.cache && existsSync(join(dir, '.git'))) {
    log(`cache hit: ${dir} — pulling latest`);
    try { run('git pull --ff-only', { cwd: dir, stdio: 'pipe' }); } catch { log('pull failed, using cached copy'); }
    return dir;
  }
  mkdirSync(dir, { recursive: true });
  log(`cloning ${REPO} → ${dir}`);
  run(`git clone --depth 1 ${REPO} "${dir}"`);
  return dir;
}

function ensureNpmDeps() {
  try {
    execSync('npm ls -g @modelcontextprotocol/sdk zod', { stdio: 'pipe' });
    log('mcp sdk + zod already global');
  } catch {
    log('installing @modelcontextprotocol/sdk zod globally');
    run('npm i -g @modelcontextprotocol/sdk zod');
  }
}

function installGlobal(repoDir) {
  const dest = join(homedir(), '.claude', 'plugins', 'multi-model');
  if (existsSync(dest)) rmSync(dest, { recursive: true, force: true });
  mkdirSync(dest, { recursive: true });
  cpSync(join(repoDir, 'plugins', 'multi-model'), dest, { recursive: true });
  log(`installed globally at ${dest}`);
}

function installMarketplace(repoDir) {
  const target = resolve(args.target);
  const cfgDir = join(target, '.claude-plugin');
  mkdirSync(cfgDir, { recursive: true });
  const cfgPath = join(cfgDir, 'marketplace.json');

  let source;
  if (args.copy) {
    const dest = join(target, 'plugins', 'multi-model');
    mkdirSync(join(target, 'plugins'), { recursive: true });
    if (existsSync(dest)) rmSync(dest, { recursive: true, force: true });
    cpSync(join(repoDir, 'plugins', 'multi-model'), dest, { recursive: true });
    source = './plugins/multi-model';
    log(`copied plugin → ${dest}`);
  } else {
    const abs = join(repoDir, 'plugins', 'multi-model').replace(/\\/g, '/');
    source = { source: 'local', path: abs };
  }

  const cfg = existsSync(cfgPath)
    ? JSON.parse(readFileSync(cfgPath, 'utf8'))
    : { name: 'local-marketplace', owner: { name: 'local' }, plugins: [] };
  cfg.plugins = cfg.plugins.filter((p) => p.name !== 'multi-model' && p.name !== 'codex');
  cfg.plugins.push({ name: 'multi-model', source, version: '1.1.0' });
  if (args['with-codex']) {
    cfg.plugins.push({ name: 'codex', source: { source: 'github', repo: 'openai/codex-plugin-cc' }, version: 'latest' });
  }
  writeFileSync(cfgPath, JSON.stringify(cfg, null, 2) + '\n');
  log(`wrote ${cfgPath}`);
}

function writeEnv() {
  const mcpGlobal = execSync('npm root -g').toString().trim();
  if (platform() === 'win32') {
    run(`setx MCP_GLOBAL_MODULES "${mcpGlobal}"`);
    log('set MCP_GLOBAL_MODULES (new shells pick up)');
  } else {
    const rc = join(homedir(), process.env.SHELL?.includes('zsh') ? '.zshrc' : '.bashrc');
    const line = `export MCP_GLOBAL_MODULES="${mcpGlobal}"\n`;
    const existing = existsSync(rc) ? readFileSync(rc, 'utf8') : '';
    if (!existing.includes('MCP_GLOBAL_MODULES')) {
      writeFileSync(rc, existing + '\n' + line);
      log(`appended MCP_GLOBAL_MODULES to ${rc}`);
    } else log('MCP_GLOBAL_MODULES already in profile');
  }
  log('NVIDIA_API_KEY: set manually if using NVIDIA tools (https://build.nvidia.com)');
}

(async () => {
  const repoDir = ensureRepo();
  ensureNpmDeps();
  if (args.global) installGlobal(repoDir);
  else installMarketplace(repoDir);
  if (args.env) writeEnv();
  log('done. launch Claude Code in target project, verify with /multi-model:models');
})();
