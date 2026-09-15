import { readdir, stat, unlink } from 'fs/promises';
import { join } from 'path';

/**
 * Asynchronously deletes files in a directory that are older than the specified age in hours.
 * Errors are caught and logged so it doesn't interrupt the main process.
 */
export async function cleanupOldFiles(dirPath: string, maxAgeHours: number = 24) {
  try {
    const files = await readdir(dirPath);
    const now = Date.now();
    const maxAgeMs = maxAgeHours * 60 * 60 * 1000;

    for (const file of files) {
      if (file.startsWith('.')) continue; // skip hidden files

      const filePath = join(dirPath, file);
      try {
        const stats = await stat(filePath);
        if (stats.isFile() && (now - stats.mtimeMs > maxAgeMs)) {
          await unlink(filePath);
          console.log(`Cleaned up old file: ${filePath}`);
        }
      } catch (err) {
        console.error(`Error checking/deleting file ${filePath}:`, err);
      }
    }
  } catch (err: any) {
    // Ignore ENOENT if directory doesn't exist yet
    if (err.code !== 'ENOENT') {
      console.error(`Error reading directory for cleanup ${dirPath}:`, err);
    }
  }
}
