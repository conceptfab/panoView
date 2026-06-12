const readline = require('readline');
const { execSync } = require('child_process');

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

function createPrompt() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

function ask(rl, question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer.trim()));
  });
}

function log(msg) {
  console.log(`${colors.green}>${colors.reset} ${msg}`);
}

function exec(command, { cwd, silent = false } = {}) {
  try {
    return execSync(command, {
      cwd,
      encoding: 'utf8',
      stdio: silent ? 'pipe' : 'inherit',
    });
  } catch (error) {
    console.error(`${colors.red}Błąd: ${command}${colors.reset}`);
    if (error.message) console.error(error.message);
    throw error;
  }
}

module.exports = { colors, createPrompt, ask, log, exec };
