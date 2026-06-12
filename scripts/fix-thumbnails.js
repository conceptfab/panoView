#!/usr/bin/env node

/**
 * Fix thumbnailUrl for existing projects.
 * Sets thumbnailUrl to /uploads/projects/{id}/thumbnails/thumb.webp
 */

const fs = require('fs');
const path = require('path');

const DATA_ROOT = process.env.PANO_DATA_DIR || process.cwd();
const PROJECTS_FILE = path.join(DATA_ROOT, 'data', 'projects.json');
const UPLOADS_DIR = path.join(DATA_ROOT, 'uploads', 'projects');

async function main() {
  console.log('Fixing project thumbnails...\n');

  const projectsData = JSON.parse(fs.readFileSync(PROJECTS_FILE, 'utf-8'));
  let fixed = 0;

  for (const project of projectsData.projects) {
    const thumbPath = path.join(UPLOADS_DIR, project.id, 'thumbnails', 'thumb.webp');
    const expectedUrl = `/uploads/projects/${project.id}/thumbnails/thumb.webp`;

    if (fs.existsSync(thumbPath)) {
      if (project.thumbnailUrl !== expectedUrl) {
        project.thumbnailUrl = expectedUrl;
        project.updatedAt = new Date().toISOString();
        console.log(`[FIXED] ${project.id} -> ${expectedUrl}`);
        fixed++;
      } else {
        console.log(`[OK] ${project.id}`);
      }
    } else {
      console.log(`[NO THUMB] ${project.id} - run thumbnail generation from viewer`);
    }
  }

  fs.writeFileSync(PROJECTS_FILE, JSON.stringify(projectsData, null, 2));
  console.log(`\nDone! Fixed ${fixed} project(s).`);
}

main().catch(console.error);
