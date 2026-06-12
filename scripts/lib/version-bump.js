const fs = require('fs');
const path = require('path');

function parseVersionInput(input, fallbackVersion) {
  if (!input) {
    return {
      packageVersion: fallbackVersion,
      displayVersion: fallbackVersion,
      changed: false,
    };
  }

  if (/^\d+\.\d+\.\d+(?:-[0-9A-Za-z][0-9A-Za-z.-]*)?$/.test(input)) {
    return {
      packageVersion: input,
      displayVersion: input,
      changed: input !== fallbackVersion,
    };
  }

  const betaMatch = input.match(/^(?:β|beta)\s*(\d+\.\d+\.\d+)$/i);
  if (betaMatch) {
    const baseVersion = betaMatch[1];
    const packageVersion = `${baseVersion}-beta`;
    return {
      packageVersion,
      displayVersion: `β ${baseVersion}`,
      changed: packageVersion !== fallbackVersion,
    };
  }

  return null;
}

function updatePackageVersion(rootDir, newVersion) {
  const packagePath = path.join(rootDir, 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  const previous = packageJson.version;
  packageJson.version = newVersion;
  fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2) + '\n');
  return previous;
}

function restorePackageVersion(rootDir, previousVersion) {
  return updatePackageVersion(rootDir, previousVersion);
}

module.exports = {
  parseVersionInput,
  updatePackageVersion,
  restorePackageVersion,
};
