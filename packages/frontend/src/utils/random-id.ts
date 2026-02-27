const URL_SAFE_ALPHABET = 'useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict';

/**
 * Generate a random string ID (nanoid-compatible).
 * Uses crypto.getRandomValues() for cryptographically secure random generation.
 */
export function randomId(size = 21): string {
  const bytes = new Uint8Array(size);
  crypto.getRandomValues(bytes);
  let id = '';
  for (let i = 0; i < size; i++) {
    id += URL_SAFE_ALPHABET[bytes[i] & 63];
  }
  return id;
}

/**
 * Create a random ID generator with a custom alphabet.
 */
export function customAlphabetId(alphabet: string, defaultSize: number) {
  return (size = defaultSize): string => {
    const bytes = new Uint8Array(size);
    crypto.getRandomValues(bytes);
    let id = '';
    for (let i = 0; i < size; i++) {
      id += alphabet[bytes[i] % alphabet.length];
    }
    return id;
  };
}
