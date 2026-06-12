#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { parseVersionInput, updatePackageVersion } = require('./lib/version-bump');
const { colors, createPrompt, ask, log, exec } = require('./lib/cli');

const rootDir = path.join(__dirname, '..');

async function main() {
  const packagePath = path.join(rootDir, 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  const currentVersion = packageJson.version;

  console.log(
    `\n${colors.bold}${colors.cyan}RELEASE${colors.reset} (current: ${colors.cyan}v${currentVersion}${colors.reset})\n`
  );

  const rl = createPrompt();
  const versionInput = await ask(rl, `Version [${currentVersion}]: `);
  const parsedVersion = parseVersionInput(versionInput, currentVersion);

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

  const message = await ask(rl, 'Message (optional): ');
  const finalMessage = message
    ? `${formattedVersionLabel} ${message}`
    : formattedVersionLabel;

  rl.close();

  console.log('');

  if (parsedVersion.changed) {
    const previous = updatePackageVersion(rootDir, finalVersion);
    log(`package.json: ${previous} -> ${finalVersion}`);
  }

  try {
    log('Staging all changes...');
    exec('git add -A', { cwd: rootDir, silent: true });

    log(`Committing: "${finalMessage}"`);
    exec(`git commit -m "${finalMessage}"`, { cwd: rootDir, silent: true });

    log('Pushing to remote...');
    exec('git push', { cwd: rootDir, silent: true });
  } catch {
    process.exit(1);
  }

  console.log(
    `\n${colors.green}${colors.bold}Done!${colors.reset} ${formattedVersionLabel} released.\n`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
