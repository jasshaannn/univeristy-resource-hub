#!/usr/bin/env node

/**
 * UniFold Unified Fullstack Runner
 * Starts both the Express backend and the Vite frontend concurrently.
 */

const { spawn } = require('child_process');
const path = require('path');

const cyan = '\x1b[36m';
const green = '\x1b[32m';
const reset = '\x1b[0m';
const bold = '\x1b[1m';
const yellow = '\x1b[33m';

console.log(`${bold}====================================================${reset}`);
console.log(`${bold}🚀 Starting University Resource Hub (UniFold)...${reset}`);
console.log(`${bold}====================================================${reset}`);
console.log(`${cyan}⚙️  Backend:  http://localhost:5001${reset}`);
console.log(`${green}💻 Frontend: http://localhost:5173${reset}`);
console.log(`${yellow}Press Ctrl+C at any time to stop both servers.${reset}\n`);

const backendDir = path.join(__dirname, 'uni fold backend');
const frontendDir = path.join(__dirname, 'uni fold frontend');

function startProcess(name, color, commandString, cwd) {
  const proc = spawn(commandString, {
    cwd,
    shell: true,
    stdio: ['inherit', 'pipe', 'pipe'],
    env: { ...process.env, FORCE_COLOR: 'true' },
  });

  proc.stdout.on('data', (data) => {
    const lines = data.toString().split('\n');
    lines.forEach((line) => {
      if (line.trim().length > 0) {
        console.log(`${color}[${name}]${reset} ${line}`);
      }
    });
  });

  proc.stderr.on('data', (data) => {
    const lines = data.toString().split('\n');
    lines.forEach((line) => {
      if (line.trim().length > 0) {
        console.error(`${color}[${name}]${reset} ${line}`);
      }
    });
  });

  proc.on('close', (code) => {
    console.log(`${color}[${name}]${reset} process exited with code ${code}`);
  });

  return proc;
}

const backend = startProcess('BACKEND', cyan, 'npm run dev', backendDir);
const frontend = startProcess('FRONTEND', green, 'npm run dev', frontendDir);

function cleanup() {
  console.log(`\n${yellow}Shutting down both servers...${reset}`);
  backend.kill('SIGINT');
  frontend.kill('SIGINT');
  process.exit();
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
