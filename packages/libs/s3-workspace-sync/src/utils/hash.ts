import * as crypto from 'crypto';
import * as fs from 'fs';

/**
 * Calculate the MD5 hash of a file using streaming reads.
 *
 * @param filePath - Absolute path to the file
 * @returns Hex-encoded MD5 hash string
 */
export function calculateFileHash(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('md5');
    const stream = fs.createReadStream(filePath);

    stream.on('data', (data) => hash.update(data));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}
