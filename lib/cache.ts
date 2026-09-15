import crypto from 'crypto';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

export async function ensureCacheDir() {
  const cacheDir = join(process.cwd(), 'tmp', 'cache');
  try {
    await mkdir(cacheDir, { recursive: true });
  } catch (e) {
    // Ignore error if directory exists
  }
  return cacheDir;
}

export function generateHash(data: string | Buffer): string {
  return crypto.createHash('md5').update(data).digest('hex');
}

export async function getCachedData<T>(hash: string): Promise<T | null> {
  const cacheDir = await ensureCacheDir();
  const cachePath = join(cacheDir, `${hash}.json`);
  
  try {
    const data = await readFile(cachePath, 'utf8');
    return JSON.parse(data) as T;
  } catch (e) {
    return null;
  }
}

export async function setCachedData(hash: string, data: any): Promise<void> {
  const cacheDir = await ensureCacheDir();
  const cachePath = join(cacheDir, `${hash}.json`);
  
  try {
    await writeFile(cachePath, JSON.stringify(data), 'utf8');
  } catch (e) {
    console.error('Failed to write to cache', e);
  }
}
