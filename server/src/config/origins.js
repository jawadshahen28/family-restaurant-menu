import { networkInterfaces } from 'node:os';
import { isIP } from 'node:net';

function privateAddress(address) {
  if (isIP(address) === 4) {
    const [first, second] = address.split('.').map(Number);
    return first === 10 || (first === 172 && second >= 16 && second <= 31) || (first === 192 && second === 168);
  }
  return isIP(address) === 6 && /^(fc|fd)/i.test(address);
}
function localHostname(hostname) {
  const host = hostname.replace(/^\[|\]$/g, '');
  return host === 'localhost' || host === '127.0.0.1' || host === '::1' || host.endsWith('.local') || privateAddress(host);
}
function parseOrigins(value, { production = false, localOnly = false } = {}) {
  return String(value || '').split(',').map((entry) => entry.trim()).filter(Boolean).map((origin) => {
    try {
      const url = new URL(origin);
      if (!['http:', 'https:'].includes(url.protocol) || url.origin !== origin || url.username || url.password || (production && url.protocol !== 'https:') || (localOnly && !localHostname(url.hostname))) throw new Error();
      return origin;
    } catch { throw new Error(localOnly ? 'DEV_CLIENT_ORIGINS يجب أن يحتوي أصول تطوير محلية صريحة فقط، دون wildcard أو مسارات.' : 'CLIENT_ORIGIN يجب أن يحتوي عناوين أصل صريحة وصحيحة، وHTTPS في الإنتاج.'); }
  });
}

export function buildAllowedOrigins({ clientOrigin, nodeEnv, devClientOrigins = '', devClientPorts = '5173,5174', devAllowLan = true, interfaces = networkInterfaces() }) {
  const configured = parseOrigins(clientOrigin, { production: nodeEnv === 'production' });
  if (!configured.length) throw new Error('CLIENT_ORIGIN يجب أن يحتوي أصلًا صريحًا واحدًا على الأقل.');
  if (nodeEnv !== 'development') return configured;
  const ports = String(devClientPorts).split(',').map((entry) => entry.trim());
  if (!ports.length || ports.length > 20 || ports.some((port) => !/^\d{1,5}$/.test(port) || Number(port) < 1 || Number(port) > 65535)) throw new Error('DEV_CLIENT_PORTS يجب أن يحتوي قائمة منافذ صريحة بين 1 و65535.');
  const allowed = new Set([...configured, ...parseOrigins(devClientOrigins, { localOnly: true })]);
  const hosts = new Set(['localhost', '127.0.0.1', '[::1]']);
  if (devAllowLan) {
    for (const entry of Object.values(interfaces).flat()) {
      if (!entry || entry.internal || !privateAddress(entry.address)) continue;
      hosts.add(isIP(entry.address) === 6 ? `[${entry.address}]` : entry.address);
    }
  }
  for (const host of hosts) for (const port of new Set(ports)) allowed.add(new URL(`http://${host}:${port}`).origin);
  return [...allowed];
}

export function safeOriginForLog(origin) {
  try { const url = new URL(origin); return ['http:', 'https:'].includes(url.protocol) && url.origin === origin ? origin : '[invalid origin]'; }
  catch { return '[invalid origin]'; }
}
