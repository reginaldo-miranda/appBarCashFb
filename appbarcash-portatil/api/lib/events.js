let saleUpdates = [];
let listeners = [];

export function recordSaleUpdate(id) {
  try {
    const ts = Date.now();
    saleUpdates.push({ id: Number(id) || id, ts });
    if (saleUpdates.length > 1000) saleUpdates = saleUpdates.slice(-500);
    try { listeners.forEach((fn) => fn({ id: Number(id) || id, ts })); } catch {}
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