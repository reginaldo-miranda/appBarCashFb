let saleUpdates = [];
let listeners = [];

export function recordSaleUpdate(id, eventType = 'sale_updated', meta = {}) {
  try {
    const ts = Date.now();
    const evt = {
      id: Number(id) || id,
      ts,
      eventType: String(eventType || 'sale_updated'),
      ...(meta && typeof meta === 'object' ? meta : {}),
    };
    saleUpdates.push(evt);
    if (saleUpdates.length > 1000) saleUpdates = saleUpdates.slice(-500);
    try { listeners.forEach((fn) => fn(evt)); } catch {}
  } catch {}
}

export function getSaleUpdates(sinceTs) {
  const since = Number(sinceTs) || 0;
  const now = Date.now();
  // Expirar eventos muito antigos (10 minutos)
  saleUpdates = saleUpdates.filter((e) => now - e.ts < 10 * 60 * 1000);
  return saleUpdates.filter((e) => e.ts > since);
}

export function onSaleUpdate(fn) {
  listeners.push(fn);
  return () => { listeners = listeners.filter((f) => f !== fn); };
}