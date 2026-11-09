function encode(value: string) {
  return new TextEncoder().encode(value)
}

/** Constant-time string compare for secrets. */
export async function secretsEqual(a: string, b: string) {
  const left = encode(a)
  const right = encode(b)
  if (left.byteLength !== right.byteLength) {
    return false
  }
  return crypto.subtle.timingSafeEqual(left, right)
}
