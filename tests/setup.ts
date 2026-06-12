import { mkdtempSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const root = mkdtempSync(path.join(tmpdir(), 'pano-test-'));
mkdirSync(path.join(root, 'data'), { recursive: true });

process.env.PANO_DATA_DIR = root;
process.env.JWT_SECRET = 'test-secret-test-secret-test-secret-123456';
