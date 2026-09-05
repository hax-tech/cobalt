import { URL } from 'node:url';

/**
 * Validates that a given target URL is a safe public HTTP/HTTPS URL
 * and prevents Server-Side Request Forgery (SSRF) against internal networks.
 */
export function validateSafeUrl(urlString: string): { valid: boolean; error?: string; url?: URL } {
  if (!urlString || typeof urlString !== 'string') {
    return { valid: false, error: 'URL is required and must be a non-empty string.' };
  }

  const trimmed = urlString.trim();
  if (trimmed.length > 2048) {
    return { valid: false, error: 'URL exceeds maximum permitted length.' };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { valid: false, error: 'Malformed URL format.' };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { valid: false, error: `Protocol "${parsed.protocol}" is not supported. Use http or https.` };
  }

  const hostname = parsed.hostname.toLowerCase();

  // Block localhost, IPv6 localhost, and loopbacks
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname === '0.0.0.0' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal')
  ) {
    return { valid: false, error: 'Access to loopback/local addresses is forbidden.' };
  }

  // Cloud metadata services protection (AWS, GCP, Azure, DigitalOcean)
  if (hostname === '169.254.169.254' || hostname === 'metadata.google.internal') {
    return { valid: false, error: 'Access to cloud metadata services is forbidden.' };
  }

  // Private IPv4 ranges protection (RFC 1918)
  const ipv4Pattern = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const match = hostname.match(ipv4Pattern);
  if (match) {
    const o1 = parseInt(match[1], 10);
    const o2 = parseInt(match[2], 10);

    // 10.0.0.0/8
    if (o1 === 10) {
      return { valid: false, error: 'Access to private RFC 1918 IP addresses is forbidden.' };
    }
    // 172.16.0.0/12 (172.16.0.0 - 172.31.255.255)
    if (o1 === 172 && o2 >= 16 && o2 <= 31) {
      return { valid: false, error: 'Access to private RFC 1918 IP addresses is forbidden.' };
    }
    // 192.168.0.0/16
    if (o1 === 192 && o2 === 168) {
      return { valid: false, error: 'Access to private RFC 1918 IP addresses is forbidden.' };
    }
    // 127.0.0.0/8
    if (o1 === 127) {
      return { valid: false, error: 'Access to loopback IP addresses is forbidden.' };
    }
    // 169.254.0.0/16 (Link-Local)
    if (o1 === 169 && o2 === 254) {
      return { valid: false, error: 'Access to link-local addresses is forbidden.' };
    }
  }

  return { valid: true, url: parsed };
}
