/**
 * Loopback classification for the host route families: the socket address and
 * the URL hostname. RFC 5735 IPv4 127/8, `::1`, the IPv4-mapped `::ffff:127/8`
 * form Node reports for dual-stack sockets, and `localhost` hostnames.
 */

/**
 * Whether a dotted-quad string is an IPv4 loopback address (127/8).
 * @param v4 - the candidate address.
 * @returns true for four decimal octets with a leading 127.
 */
function isIPv4Loopback(v4: string): boolean {
  const parts = v4.split('.')
  return parts.length === 4
    && parts[0] === '127'
    && parts.every(part => /^\d{1,3}$/.test(part) && Number(part) <= 255)
}

/**
 * Whether a socket peer address names the loopback range.
 * @param address - the socket's remote address (undefined when unknown).
 * @returns true for 127/8, `::1`, or the IPv4-mapped form of 127/8.
 */
export function isLoopbackAddress(address: string | undefined): boolean {
  if (address === undefined) return false
  const normalized = address.toLowerCase()
  if (normalized === '::1') return true
  if (normalized.startsWith('::ffff:')) return isIPv4Loopback(normalized.slice('::ffff:'.length))
  return isIPv4Loopback(normalized)
}

/**
 * Whether a normalized URL hostname names the loopback authority.
 * @param hostname - WHATWG hostname (`localhost`, `[::1]`, or a dotted quad).
 * @returns true for localhost or a 127/8 literal.
 */
export function isLoopbackHostname(hostname: string): boolean {
  if (hostname === 'localhost' || hostname === '[::1]') return true
  return isIPv4Loopback(hostname)
}
