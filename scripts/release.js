#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
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

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

function exec(command, silent = false) {
  try {
    return execSync(command, {
      encoding: 'utf8',
      stdio: silent ? 'pipe' : 'inherit',
    });
  } catch (error) {
    console.error(`${colors.red}Error: ${command}${colors.reset}`);
    console.error(error.message);
    process.exit(1);
  }
}

function log(msg) {
  console.log(`${colors.green}>${colors.reset} ${msg}`);
}

function parseVersionInput(input, fallbackVersion) {
  if (!input) {
    return {
      packageVersion: fallbackVersion,
      displayVersion: fallbackVersion,
    };
  }

  // Standard semver format accepted by package.json
  if (/^\d+\.\d+\.\d+(?:-[0-9A-Za-z][0-9A-Za-z.-]*)?$/.test(input)) {
    return {
      packageVersion: input,
      displayVersion: input,
    };
  }

  // Friendly beta format, e.g. "β 0.1.35" or "beta 0.1.35"
  const betaMatch = input.match(/^(?:β|beta)\s*(\d+\.\d+\.\d+)$/i);
  if (betaMatch) {
    const baseVersion = betaMatch[1];
    return {
      packageVersion: `${baseVersion}-beta`,
      displayVersion: `β ${baseVersion}`,
    };
  }

  return null;
}

async function main() {
  const packagePath = path.join(__dirname, '..', 'package.json');
  const versionPath = path.join(__dirname, '..', 'src', 'lib', 'version.ts');
  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  const currentVersion = packageJson.version;

  console.log(`\n${colors.bold}${colors.cyan}RELEASE${colors.reset} (current: ${colors.cyan}v${currentVersion}${colors.reset})\n`);

  // Get version
  const versionInput = await ask(`Version [${currentVersion}]: `);
  const parsedVersion = parseVersionInput(versionInput, currentVersion);

  // Validate
  if (!parsedVersion) {
    console.error(`${colors.red}Invalid version format${colors.reset}`);
    rl.close();
    process.exit(1);
  }

  const finalVersion = parsedVersion.packageVersion;
  const finalVersionLabel = parsedVersion.displayVersion;
  const formattedVersionLabel = finalVersionLabel.startsWith('β')
    ? finalVersionLabel
    : `v${finalVersionLabel}`;

  // Get commit message
  const message = await ask('Message (optional): ');
  const finalMessage = message
    ? `${formattedVersionLabel} ${message}`
    : formattedVersionLabel;

  rl.close();

  console.log('');

  // Update version if changed
  if (versionInput && finalVersion !== currentVersion) {
    packageJson.version = finalVersion;
    fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2) + '\n');
    log(`package.json: ${currentVersion} -> ${finalVersion}`);

    // Update version.ts if exists
    if (fs.existsSync(versionPath)) {
      let versionTs = fs.readFileSync(versionPath, 'utf8');
      versionTs = versionTs.replace(
        /export const APP_VERSION = ['"].*['"]/,
        `export const APP_VERSION = '${finalVersion}'`
      );
      fs.writeFileSync(versionPath, versionTs);
      log(`version.ts: updated`);
    }
  }

  // Stage, commit, push
  log('Staging all changes...');
  exec('git add -A', true);

  log(`Committing: "${finalMessage}"`);
  exec(`git commit -m "${finalMessage}"`, true);

  log('Pushing to remote...');
  exec('git push', true);

  console.log(`\n${colors.green}${colors.bold}Done!${colors.reset} ${formattedVersionLabel} released.\n`);
}

main().catch((error) => {
  console.error(error);
  rl.close();
  process.exit(1);
});
