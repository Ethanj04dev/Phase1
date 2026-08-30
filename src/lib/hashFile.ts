import * as FileSystem from 'expo-file-system/legacy';
import { sha256 } from 'js-sha256';

/**
 * SHA-256 of a file on disk, computed in chunks.
 *
 * The hash is committed to the server the moment capture stops — before the
 * (much larger) upload — which is what makes swapping the file afterwards
 * detectable. Chunked reading keeps memory flat for multi-minute video.
 */

const CHUNK_BYTES = 512 * 1024;

/** Base64 → bytes without pulling in a Buffer polyfill. Hermes ships atob. */
export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

export async function hashFileSha256(uri: string): Promise<{ hash: string; byteSize: number }> {
  const info = await FileSystem.getInfoAsync(uri);
  if (!info.exists) {
    throw new Error('Evidence file is missing.');
  }
  const byteSize = 'size' in info && typeof info.size === 'number' ? info.size : 0;

  const hasher = sha256.create();
  let position = 0;
  while (position < byteSize) {
    const length = Math.min(CHUNK_BYTES, byteSize - position);
    const chunk = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
      position,
      length,
    });
    hasher.update(base64ToBytes(chunk));
    position += length;
  }

  return { hash: hasher.hex(), byteSize };
}
