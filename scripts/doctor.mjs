import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();
const envPath = path.join(projectRoot, '.env.local');
const envExamplePath = path.join(projectRoot, 'env.local.example');

function fail(message) {
  console.error(message);
  process.exit(1);
}

const majorVersion = Number.parseInt(process.versions.node.split('.')[0], 10);
if (Number.isNaN(majorVersion) || majorVersion < 22) {
  fail(`Node.js 22 or newer is required. Current version: ${process.versions.node}`);
}

if (!process.env.npm_config_user_agent?.includes('pnpm')) {
  fail('Run this repo with pnpm so installs and scripts stay consistent.');
}

if (!fs.existsSync(envExamplePath)) {
  fail('Missing env.local.example. Restore the tracked template before continuing.');
}

if (!fs.existsSync(envPath)) {
  fail('Missing .env.local. Copy env.local.example to .env.local before running the app.');
}

const envContents = fs.readFileSync(envPath, 'utf8');
for (const key of ['NEXT_PUBLIC_AGORA_APP_ID', 'NEXT_AGORA_APP_CERTIFICATE']) {
  const matcher = new RegExp(`^${key}=.+$`, 'm');
  if (!matcher.test(envContents)) {
    fail(`.env.local is missing a value for ${key}`);
  }
}

// Not fatal (CI builds without them), but the agent cannot act without these.
const warnings = [];
if (!/^MURF_API_KEY=.+$/m.test(envContents)) warnings.push('MURF_API_KEY is empty: calls cannot speak (Murf Falcon).');
if (!/^PUBLIC_BASE_URL=https:\/\/.+$/m.test(envContents)) warnings.push('PUBLIC_BASE_URL is not an https URL: Agora cannot reach the tools, so calls will be refused.');
if (!/^TOOL_SECRET=.{16,}$/m.test(envContents)) warnings.push('TOOL_SECRET is missing or shorter than 16 characters: calls will be refused.');
for (const w of warnings) console.warn(`Warning: ${w}`);

console.log('Doctor checks passed');
