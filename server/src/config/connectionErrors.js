const messages = {
  DNS: 'تعذّر حل اسم مضيف Atlas في DNS. تحقق من عنوان المضيف من Connect → Drivers ومن أن الكتلة متاحة.',
  AUTHENTICATION: 'رفض MongoDB المصادقة. تحقق من بيانات مستخدم قاعدة البيانات وترميز كلمة المرور وauthSource.',
  AUTHORIZATION: 'اتصل الخادم، لكن المستخدم لا يملك الإذن المطلوب على قاعدة family_menu.',
  NETWORK: 'تعذّر الوصول إلى خوادم Atlas. تحقق من Network Access وجدار الحماية واتصال الشبكة.',
  TLS: 'تعذّر التحقق من اتصال TLS. تحقق من الشهادات ووقت الجهاز واعتراض الاتصال، دون تعطيل TLS.',
  CONFIGURATION: 'إعداد اتصال MongoDB غير صالح. راجع بنية URI وخياراته وترميز كلمة المرور.',
  UNKNOWN: 'تعذّر الاتصال بقاعدة البيانات. راجع تفاصيل الخطأ الآمنة أدناه.',
};

export function connectionFailure(error, uri = '') {
  const queue = [error];
  const seen = new Set();
  const errors = [];
  while (queue.length && seen.size < 30) {
    const current = queue.shift();
    if (!current || typeof current !== 'object' || seen.has(current)) continue;
    seen.add(current);
    if (current.message || current.code) errors.push(current);
    queue.push(current.cause, current.reason, current.error);
    if (current.servers instanceof Map) for (const server of current.servers.values()) queue.push(server.error);
  }
  const matches = (pattern) => errors.some((entry) => pattern.test(`${entry.name || ''} ${entry.code || ''} ${entry.syscall || ''} ${entry.message || ''}`));
  let category = 'UNKNOWN';
  if (errors.some((entry) => entry.code === 18) || matches(/authentication failed|bad auth|AuthenticationFailed/i)) category = 'AUTHENTICATION';
  else if (errors.some((entry) => entry.code === 13) || matches(/not authorized|Unauthorized/i)) category = 'AUTHORIZATION';
  else if (matches(/querySrv|queryTxt|getaddrinfo|ENOTFOUND|EAI_AGAIN|ESERVFAIL|DNSHostNotFound/i)) category = 'DNS';
  else if (matches(/MongoParseError|MongoInvalidArgumentError|Invalid scheme|Invalid connection string/i)) category = 'CONFIGURATION';
  else if (matches(/certificate|TLS|SSL|CERT_HAS_EXPIRED|UNABLE_TO_VERIFY/i)) category = 'TLS';
  else if (matches(/MongoServerSelectionError|MongooseServerSelectionError|MongoNetwork|ECONN|ETIMEDOUT|ETIMEOUT|EHOSTUNREACH|ENETUNREACH|EACCES/i)) category = 'NETWORK';

  const secrets = [];
  try { const parsed = new URL(uri); secrets.push(parsed.password, decodeURIComponent(parsed.password)); } catch { /* No unvalidated URI is logged. */ }
  function sanitize(value) {
    let result = String(value || '');
    if (uri) result = result.split(uri).join('[MongoDB URI redacted]');
    for (const secret of secrets.filter(Boolean).sort((a, b) => b.length - a.length)) result = result.split(secret).join('[redacted]');
    return result.replace(/mongodb(?:\+srv)?:\/\/[^\s"'<>]+/gi, '[MongoDB URI redacted]').replace(/[\r\n\t]+/g, ' ').slice(0, 1200);
  }
  const identifier = (value) => typeof value === 'number' && Number.isFinite(value) ? value : /^[A-Za-z0-9_]{1,80}$/.test(String(value || '')) ? String(value) : undefined;
  const diagnostics = errors.map((entry) => ({ name: identifier(entry.name) || 'Error', ...(identifier(entry.code) !== undefined ? { code: identifier(entry.code) } : {}), ...(identifier(entry.codeName) ? { codeName: identifier(entry.codeName) } : {}), ...(identifier(entry.syscall) ? { syscall: identifier(entry.syscall) } : {}), message: sanitize(entry.message) }));
  const unique = [...new Map(diagnostics.map((entry) => [JSON.stringify(entry), entry])).values()];
  const primary = unique.find((entry) => entry.code !== undefined) || unique[0];
  const failure = new Error(`تعذّر الاتصال بقاعدة family_menu في MongoDB Atlas. [${category}${primary?.code ? `: ${primary.code}` : ''}] ${messages[category]}`);
  failure.name = 'DatabaseConnectionError';
  failure.code = `DATABASE_${category}`;
  failure.category = category;
  failure.diagnostics = unique;
  return failure;
}

export function printDatabaseFailure(error) {
  console.error(error.message);
  if (error.diagnostics) console.error(JSON.stringify({ event: 'database_connection_failed', category: error.category, diagnostics: error.diagnostics }));
}
