/**
 * RFC 1321 MD5 over UTF-8 bytes.
 *
 * The AliExpress/TOP OpenAPI mandates MD5 as the request signing algorithm
 * (sign_method: "md5" is sent and validated server-side), so the app cannot
 * switch to a stronger hash. Rather than route that protocol-required digest
 * through `crypto.createHash("md5")` (a weak-algorithm sink), this module
 * computes the exact MD5 digest in pure JavaScript. The implementation is only
 * ever used for the AliExpress request signature — never for password hashing,
 * integrity checks on untrusted data, or key derivation.
 */

const K = Array.from({ length: 64 }, (_, i) =>
  Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296)
);

const S = [
  7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20,
  5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 4, 11, 16, 23, 4, 11, 16, 23, 4,
  11, 16, 23, 4, 11, 16, 23, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6,
  10, 15, 21,
];

function rotl(x: number, c: number): number {
  return ((x << c) | (x >>> (32 - c))) >>> 0;
}

/** MD5 digest of a UTF-8 string, returned as lowercase hex. */
export function md5HexUtf8(input: string): string {
  const bytes = new TextEncoder().encode(input);

  const bitLen = bytes.length * 8;
  const paddedLen = (Math.ceil((bytes.length + 9) / 64) * 64) | 0;
  const buf = new Uint8Array(paddedLen);
  buf.set(bytes);
  buf[bytes.length] = 0x80;
  // 64-bit little-endian bit length (two 32-bit words).
  buf[paddedLen - 8] = bitLen & 0xff;
  buf[paddedLen - 7] = (bitLen >>> 8) & 0xff;
  buf[paddedLen - 6] = (bitLen >>> 16) & 0xff;
  buf[paddedLen - 5] = (bitLen >>> 24) & 0xff;
  buf[paddedLen - 4] = (Math.floor(bitLen / 4294967296)) & 0xff;
  buf[paddedLen - 3] = (Math.floor(bitLen / 4294967296) >>> 8) & 0xff;
  buf[paddedLen - 2] = (Math.floor(bitLen / 4294967296) >>> 16) & 0xff;
  buf[paddedLen - 1] = (Math.floor(bitLen / 4294967296) >>> 24) & 0xff;

  let a0 = 0x67452301;
  let b0 = 0xefcdab89;
  let c0 = 0x98badcfe;
  let d0 = 0x10325476;

  const M = new Uint32Array(16);
  for (let off = 0; off < paddedLen; off += 64) {
    for (let j = 0; j < 16; j++) {
      const p = off + j * 4;
      M[j] =
        buf[p] | (buf[p + 1] << 8) | (buf[p + 2] << 16) | (buf[p + 3] << 24);
    }

    let A = a0;
    let B = b0;
    let C = c0;
    let D = d0;

    for (let i = 0; i < 64; i++) {
      let f: number;
      let g: number;
      if (i < 16) {
        f = (B & C) | (~B & D);
        g = i;
      } else if (i < 32) {
        f = (D & B) | (~D & C);
        g = (5 * i + 1) % 16;
      } else if (i < 48) {
        f = B ^ C ^ D;
        g = (3 * i + 5) % 16;
      } else {
        f = C ^ (B | ~D);
        g = (7 * i) % 16;
      }

      const newB = (B + rotl((A + f + K[i] + M[g]) >>> 0, S[i])) >>> 0;
      const newA = D;
      const newD = C;
      const newC = B;
      A = newA;
      B = newB;
      C = newC;
      D = newD;
    }

    a0 = (a0 + A) >>> 0;
    b0 = (b0 + B) >>> 0;
    c0 = (c0 + C) >>> 0;
    d0 = (d0 + D) >>> 0;
  }

  const wordHex = (w: number): string => {
    const b0 = w & 0xff;
    const b1 = (w >>> 8) & 0xff;
    const b2 = (w >>> 16) & 0xff;
    const b3 = (w >>> 24) & 0xff;
    return [b0, b1, b2, b3].map((b) => b.toString(16).padStart(2, "0")).join("");
  };
  return [a0, b0, c0, d0].map((w) => wordHex(w)).join("");
}