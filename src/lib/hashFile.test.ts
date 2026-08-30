import { sha256 } from 'js-sha256';

import { base64ToBytes } from './hashFile';

/**
 * The file walker itself needs a device; what is testable — and what the
 * integrity of the scheme rests on — is that chunked hashing over decoded
 * base64 equals a straight hash of the original bytes.
 */
describe('chunked sha256 building blocks', () => {
  it('decodes base64 to the original bytes', () => {
    const bytes = base64ToBytes(btoa('zero phase'));
    expect(Array.from(bytes)).toEqual(Array.from('zero phase').map((c) => c.charCodeAt(0)));
  });

  it('incremental update over chunks equals one-shot digest', () => {
    const payload = new Uint8Array(100_000).map((_, index) => index % 251);

    const oneShot = sha256.create();
    oneShot.update(payload);

    const chunked = sha256.create();
    for (let position = 0; position < payload.length; position += 4096) {
      chunked.update(payload.subarray(position, position + 4096));
    }

    expect(chunked.hex()).toBe(oneShot.hex());
  });

  it('matches a known sha-256 vector', () => {
    expect(sha256('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });
});
