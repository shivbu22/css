#!/usr/bin/env node
/**
 * Browser-only build.
 *
 * `output: 'export'` refuses to build while route handlers exist, so this script
 * parks `app/api` for the duration of the build and restores it afterwards, even
 * when the build fails.
 *
 * Result: `out/` is a plain static site — no server, no Ollama, model runs in the
 * visitor's browser via WebLLM.
 */
import { existsSync, mkdirSync, renameSync, rmSync } from 'node:fs';
import { spawn } from 'node:child_process';

const API_DIR = 'app/api';
const PARKED_ROOT = '.static-build-excluded';
const PARKED_DIR = `${PARKED_ROOT}/api`;

function park() {
  if (!existsSync(API_DIR)) return false;
  rmSync(PARKED_ROOT, { recursive: true, force: true });
  mkdirSync(PARKED_ROOT, { recursive: true });
  renameSync(API_DIR, PARKED_DIR);
  return true;
}

function restore(parked) {
  if (!parked) return;
  renameSync(PARKED_DIR, API_DIR);
  rmSync(PARKED_ROOT, { recursive: true, force: true });
}

const parked = park();
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const child = spawn(npm, ['run', 'build'], {
  stdio: 'inherit',
  env: { ...process.env, NEXT_PUBLIC_RUNTIME: 'client' },
  shell: process.platform === 'win32',
});

child.on('exit', (code) => {
  restore(parked);
  if (code === 0) {
    console.log('\nStatic site written to out/ — serve it with any static host.');
  } else {
    console.error(`\nStatic build failed (exit ${code}). app/api was restored.`);
  }
  process.exit(code ?? 1);
});
