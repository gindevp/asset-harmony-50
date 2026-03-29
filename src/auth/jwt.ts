/** JHipster JWT claim chứa authorities, cách nhau bằng khoảng trắng */
function decodeJwtPayload(token: string): Record<string, unknown> {
  const parts = token.split('.');
  if (parts.length < 2) return {};
  let b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4;
  if (pad) b64 += '='.repeat(4 - pad);
  return JSON.parse(atob(b64)) as Record<string, unknown>;
}

export function parseJwtAuthorities(token: string): string[] {
  try {
    const payload = decodeJwtPayload(token);
    const auth = payload.auth ?? payload.authorities;
    if (typeof auth === 'string') return auth.split(/\s+/).filter(Boolean);
    if (Array.isArray(auth)) return auth as string[];
    return [];
  } catch {
    return [];
  }
}

export function hasAnyAuthority(token: string | null, roles: string[]): boolean {
  if (!token) return false;
  const have = new Set(parseJwtAuthorities(token));
  return roles.some(r => have.has(r));
}
