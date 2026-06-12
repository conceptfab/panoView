const fs = require('fs');
const path = require('path');
const { exec } = require('./cli');

function assertVercelProject(rootDir) {
  const vercelDir = path.join(rootDir, '.vercel');
  const projectJson = path.join(vercelDir, 'project.json');
  const repoJson = path.join(vercelDir, 'repo.json');
  if (!fs.existsSync(projectJson) && !fs.existsSync(repoJson)) {
    throw new Error(
      'Brak .vercel/project.json — uruchom `vercel link` w katalogu projektu.'
    );
  }
}

function runPreflight(rootDir, { skipBuild = false } = {}) {
  assertVercelProject(rootDir);
  exec('npx vercel --version', { cwd: rootDir, silent: true });
  if (!skipBuild) {
    exec('npm run build', { cwd: rootDir });
  }
}

module.exports = { assertVercelProject, runPreflight };
