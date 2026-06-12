#!/usr/bin/env node

// oxlint-disable react-doctor/async-parallel

/**
 * Initialization script for Railway deployment.
 * Creates default data files if they don't exist.
 * Run this before starting the app: node scripts/init-data.js
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_ROOT = process.env.PANO_DATA_DIR || process.cwd();
const DATA_DIR = path.join(DATA_ROOT, 'data');
const UPLOADS_DIR = path.join(DATA_ROOT, 'uploads', 'projects');

// Default data structures
const defaultUsers = {
  users: [
    {
      id: 'user-admin',
      email: process.env.ADMIN_EMAIL || 'admin@example.com',
      name: 'Administrator',
      role: 'admin',
      passwordHash: '', // Will be set below
      groupIds: [],
      createdAt: new Date().toISOString(),
      lastLogin: null,
      isActive: true,
    },
  ],
};

const defaultGroups = {
  groups: [],
};

const defaultProjects = {
  projects: [],
};

const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
const defaultAccessControl = {
  whitelist: [
    {
      id: 'wl-admin',
      pattern: adminEmail,
      isActive: true,
      createdAt: new Date().toISOString(),
      notes: 'Konto admina (init)',
    },
  ],
  blacklist: [],
  pending: [],
};

// Simple password hash (same as in the app)
function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

async function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`Created directory: ${dirPath}`);
  }
}

async function initFile(filename, defaultData) {
  const filePath = path.join(DATA_DIR, filename);
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(defaultData, null, 2));
    console.log(`Created: ${filePath}`);
    return true;
  }
  console.log(`Exists: ${filePath}`);
  return false;
}

async function main() {
  console.log('\n=== Panorama Platform - Data Initialization ===\n');
  console.log(`Data root: ${DATA_ROOT}`);

  // Create directories
  await ensureDir(DATA_DIR);
  await ensureDir(UPLOADS_DIR);

  // Set admin password
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
  defaultUsers.users[0].passwordHash = hashPassword(adminPassword);

  // Create default files
  const usersCreated = await initFile('users.json', defaultUsers);
  await initFile('groups.json', defaultGroups);
  await initFile('projects.json', defaultProjects);
  await initFile('access-control.json', defaultAccessControl);

  if (usersCreated) {
    console.log('\n--- Default Admin Account ---');
    console.log(`Email: ${defaultUsers.users[0].email}`);
    console.log(`Password: ${adminPassword}`);
    console.log('(Set ADMIN_EMAIL and ADMIN_PASSWORD env vars to customize)\n');
  }

  console.log('\n=== Initialization Complete ===\n');
}

main().catch(console.error);
