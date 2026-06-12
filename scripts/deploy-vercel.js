#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const {
  parseVersionInput,
  updatePackageVersion,
  restorePackageVersion,
} = require('./lib/version-bump');
const { colors, createPrompt, ask, log, exec } = require('./lib/cli');
const { runPreflight } = require('./lib/preflight');

const rootDir = path.join(__dirname, '..');
const preview = process.argv.includes('--preview');
const skipBuild = process.argv.includes('--skip-build');
const nonInteractive =
  process.argv.includes('--yes') || !process.stdin.isTTY;

async function main() {
  const packagePath = path.join(rootDir, 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  const currentVersion = packageJson.version;
  const target = preview ? 'preview' : 'production';

  console.log(
    `\n${colors.bold}${colors.cyan}DEPLOY VERCEL${colors.reset} → ${colors.yellow}${target}${colors.reset}`
  );
  console.log(
    `Aktualna wersja strony: ${colors.cyan}v:${currentVersion}${colors.reset}\n`
  );

  let versionInput = '';
  let rl = null;

  if (nonInteractive) {
    versionInput = process.env.DEPLOY_VERSION ?? '';
  } else {
    console.log(`Formaty: 0.1.55-beta | beta 0.1.55 | Enter = bez zmiany\n`);
    rl = createPrompt();
    versionInput = await ask(rl, `Nowa wersja [${currentVersion}]: `);
  }

  const parsedVersion = parseVersionInput(versionInput, currentVersion);

  if (!parsedVersion) {
    console.error(`${colors.red}Nieprawidłowy format wersji${colors.reset}`);
    rl?.close();
    process.exit(1);
  }

  const deployVersion = parsedVersion.packageVersion;

  if (!preview && !nonInteractive) {
    const confirm = await ask(
      rl,
      `Wypuścić na PRODUKCJĘ v:${deployVersion}? [y/N]: `
    );
    if (confirm.toLowerCase() !== 'y') {
      log('Anulowano.');
      rl.close();
      process.exit(0);
    }
  }

  rl?.close();

  log('Preflight: weryfikacja projektu i build...');
  try {
    runPreflight(rootDir, { skipBuild });
  } catch (error) {
    console.error(`${colors.red}${error.message}${colors.reset}`);
    process.exit(1);
  }
  log('Preflight OK');

  let previousVersion = null;

  if (parsedVersion.changed) {
    previousVersion = updatePackageVersion(rootDir, deployVersion);
    log(`package.json: ${previousVersion} → ${deployVersion}`);
  } else {
    log(`Wersja bez zmian: v:${deployVersion}`);
  }

  console.log('');
  log(
    `Uruchamiam: npx vercel deploy${preview ? '' : ' --prod'} (v:${deployVersion})`
  );
  console.log('');

  try {
    exec(`npx vercel deploy${preview ? '' : ' --prod'}`, { cwd: rootDir });
  } catch {
    if (previousVersion !== null) {
      restorePackageVersion(rootDir, previousVersion);
      console.error(
        `${colors.red}Deploy nieudany — przywrócono wersję ${previousVersion}${colors.reset}`
      );
    }
    process.exit(1);
  }

  console.log(
    `\n${colors.green}${colors.bold}Gotowe!${colors.reset} v:${deployVersion} → ${target}\n`
  );

  if (parsedVersion.changed && !nonInteractive) {
    const rl2 = createPrompt();
    const doCommit = await ask(
      rl2,
      `Commitnąć v:${deployVersion} w git? [y/N]: `
    );
    rl2.close();

    if (doCommit.toLowerCase() === 'y') {
      try {
        exec('git add package.json', { cwd: rootDir, silent: true });
        exec(`git commit -m "chore: bump version to v:${deployVersion}"`, {
          cwd: rootDir,
          silent: true,
        });
        log(
          'Commit utworzony. Uruchom `git push` ręcznie lub użyj `npm run release`.'
        );
      } catch {
        process.exit(1);
      }
    } else {
      console.log(
        `${colors.yellow}Uwaga: package.json zmieniony lokalnie, brak commita.${colors.reset}`
      );
      console.log(
        `${colors.yellow}Auto-deploy z GitHuba może nadpisać wersję w produkcji.${colors.reset}`
      );
    }
  } else if (parsedVersion.changed && nonInteractive) {
    console.log(
      `${colors.yellow}Uwaga: package.json zmieniony — brak commita (tryb --yes).${colors.reset}`
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
