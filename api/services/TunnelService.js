import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BIN_DIR = path.join(__dirname, '..', 'bin');
const IS_WIN = process.platform === 'win32';
const BIN_PATH = path.join(BIN_DIR, IS_WIN ? 'cloudflared.exe' : 'cloudflared');

let tunnelProc = null;
let tunnelUrl = null;
let isStarting = false;
let lastError = null;
let pendingPromise = null;

async function ensureCloudflaredBinary() {
  if (fs.existsSync(BIN_PATH)) {
    return BIN_PATH;
  }

  fs.mkdirSync(BIN_DIR, { recursive: true });
  const downloadUrl = IS_WIN
    ? 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe'
    : 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64';

  console.log('⬇️ [TunnelService] Baixando binário cloudflared...');
  const res = await fetch(downloadUrl, { redirect: 'follow' });
  if (!res.ok) {
    throw new Error(`Falha ao baixar cloudflared (HTTP ${res.status})`);
  }
  const arrayBuffer = await res.arrayBuffer();
  fs.writeFileSync(BIN_PATH, Buffer.from(arrayBuffer));
  if (!IS_WIN) {
    fs.chmodSync(BIN_PATH, 0o755);
  }
  console.log('✅ [TunnelService] Binário cloudflared pronto!');
  return BIN_PATH;
}

export function getTunnelStatus() {
  return {
    ok: true,
    active: Boolean(tunnelProc && tunnelUrl),
    starting: isStarting,
    url: tunnelUrl || null,
    error: lastError || null,
  };
}

export async function startTunnel(port = process.env.PORT || 4000) {
  if (tunnelProc && tunnelUrl) {
    return getTunnelStatus();
  }
  if (isStarting && pendingPromise) {
    return pendingPromise;
  }

  isStarting = true;
  lastError = null;

  pendingPromise = new Promise(async (resolve) => {
    try {
      const bin = await ensureCloudflaredBinary();

      if (tunnelProc) {
        try { tunnelProc.kill(); } catch {}
        tunnelProc = null;
      }

      const targetLocal = `http://127.0.0.1:${port}`;
      console.log(`🌐 [TunnelService] Iniciando túnel HTTPS para ${targetLocal}...`);

      const proc = spawn(bin, ['tunnel', '--url', targetLocal, '--no-autoupdate'], {
        windowsHide: true,
      });
      tunnelProc = proc;

      let settled = false;
      const timeout = setTimeout(() => {
        if (!settled) {
          settled = true;
          isStarting = false;
          if (!tunnelUrl) {
            lastError = 'Tempo limite excedido ao aguardar link do túnel.';
            try { proc.kill(); } catch {}
            tunnelProc = null;
          }
          resolve(getTunnelStatus());
        }
      }, 20000);

      const handleOutput = (chunk) => {
        const text = String(chunk || '');
        const match = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i);
        if (match && match[0]) {
          tunnelUrl = match[0];
          isStarting = false;
          lastError = null;
          console.log(`✅ [TunnelService] Túnel HTTPS ativo em: ${tunnelUrl}`);
          if (!settled) {
            settled = true;
            clearTimeout(timeout);
            resolve(getTunnelStatus());
          }
        }
      };

      proc.stdout.on('data', handleOutput);
      proc.stderr.on('data', handleOutput);

      proc.on('error', (err) => {
        console.error('❌ [TunnelService] Erro no processo do túnel:', err.message);
        lastError = err.message;
        isStarting = false;
        tunnelUrl = null;
        tunnelProc = null;
        if (!settled) {
          settled = true;
          clearTimeout(timeout);
          resolve(getTunnelStatus());
        }
      });

      proc.on('exit', (code) => {
        console.log(`🛑 [TunnelService] Túnel encerrado (código ${code})`);
        tunnelProc = null;
        tunnelUrl = null;
        isStarting = false;
        if (!settled) {
          settled = true;
          clearTimeout(timeout);
          resolve(getTunnelStatus());
        }
      });
    } catch (error) {
      lastError = error?.message || 'Erro ao iniciar túnel';
      isStarting = false;
      tunnelUrl = null;
      tunnelProc = null;
      resolve(getTunnelStatus());
    }
  });

  try {
    return await pendingPromise;
  } finally {
    pendingPromise = null;
  }
}

export function stopTunnel() {
  try {
    if (tunnelProc) {
      tunnelProc.kill();
    }
  } catch (e) {
    console.warn('⚠️ [TunnelService] Aviso ao encerrar túnel:', e?.message);
  }
  tunnelProc = null;
  tunnelUrl = null;
  isStarting = false;
  lastError = null;
  return getTunnelStatus();
}
