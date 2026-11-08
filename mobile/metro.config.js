const { getDefaultConfig } = require('expo/metro-config');
const os = require('os');
const { execSync, exec } = require('child_process');
const path = require('path');

// Detectar IP da LAN (filtrando adaptadores virtuais como vEthernet, Hyper-V, WSL, Docker, VMware, VirtualBox)
function getLanIp() {
  const ifaces = os.networkInterfaces();
  const candidates = [];

  for (const name of Object.keys(ifaces)) {
    const lowerName = name.toLowerCase();
    if (
      lowerName.includes('vmware') ||
      lowerName.includes('virtualbox') ||
      lowerName.includes('vbox') ||
      lowerName.includes('wsl') ||
      lowerName.includes('docker') ||
      lowerName.includes('vethernet') ||
      lowerName.includes('host-only') ||
      lowerName.includes('virtual')
    ) {
      continue;
    }

    for (const iface of ifaces[name] || []) {
      if (!iface.internal && iface.family === 'IPv4') {
        candidates.push(iface.address);
      }
    }
  }

  // 1º Prioridade: 192.168.x.x (Rede Wi-Fi / Ethernet comum de roteadores)
  const ip192 = candidates.find(ip => ip.startsWith('192.168.'));
  if (ip192) return ip192;

  // 2º Prioridade: 10.x.x.x (Redes corporativas)
  const ip10 = candidates.find(ip => ip.startsWith('10.'));
  if (ip10) return ip10;

  // 3º Fallback: qualquer IP não virtual
  const fallback = candidates.find(ip => !ip.startsWith('172.') && !ip.startsWith('169.254.'));
  if (fallback) return fallback;

  return '';
}

// Configurar IP da LAN automaticamente para o Expo e a API
const lanIp = getLanIp();
if (lanIp) {
  process.env.REACT_NATIVE_PACKAGER_HOSTNAME = lanIp;
  if (!process.env.EXPO_PUBLIC_API_URL || process.env.EXPO_PUBLIC_API_URL.includes('172.')) {
    process.env.EXPO_PUBLIC_API_URL = `http://${lanIp}:4000/api`;
  }
}
process.env.EXPO_PUBLIC_WEB_API_URL = process.env.EXPO_PUBLIC_WEB_API_URL || 'http://localhost:4000/api';

// ============================================================
// Verificar e iniciar API automaticamente antes do Expo subir
// ============================================================
function isApiRunning() {
  const hosts = [lanIp, 'localhost'].filter(Boolean);
  for (const host of hosts) {
    try {
      execSync(`curl -s --max-time 3 "http://${host}:4000/api/health"`, { stdio: 'pipe' });
      return true;
    } catch {}
  }
  return false;
}

if (!isApiRunning()) {
  console.log('');
  console.log('🚀 API não está rodando. Iniciando automaticamente...');
  const apiDir = path.resolve(__dirname, '..', 'api');

  // Verificar se diretório da API existe
  const fs = require('fs');
  if (fs.existsSync(apiDir)) {
    // Liberar porta 4000 se ocupada
    try {
      const pids = execSync('lsof -tiTCP:4000 -sTCP:LISTEN 2>/dev/null', { encoding: 'utf8' }).trim();
      if (pids) {
        console.log(`🧹 Encerrando processos na porta 4000: ${pids}`);
        execSync(`kill -9 ${pids} 2>/dev/null`);
      }
    } catch {}

    // Iniciar API em nova janela do Terminal (macOS)
    try {
      const escapedApiDir = apiDir.replace(/'/g, "'\\''");
      execSync(`osascript -e '
tell application "Terminal"
    activate
    do script "cd '"'"'${escapedApiDir}'"'"' && export HOST=0.0.0.0 && export PORT=4000 && export DB_TARGET=local && echo '"'"'🚀 appBarCash API - Porta 4000'"'"' && echo '"'"''"'"' && node server.js"
end tell
'`, { stdio: 'pipe' });
      console.log('📂 Nova janela do Terminal aberta com a API');
    } catch {
      // Fallback: iniciar em background
      console.log('⚠️  Iniciando API em background...');
      const child = exec(`cd "${apiDir}" && HOST=0.0.0.0 PORT=4000 DB_TARGET=local node server.js`, {
        detached: true,
        stdio: 'ignore',
      });
      if (child.unref) child.unref();
    }

    // Aguardar API ficar pronta (máximo 12 segundos)
    console.log('⏳ Aguardando API ficar pronta...');
    let ready = false;
    for (let i = 0; i < 12; i++) {
      try {
        if (process.platform === 'win32') {
          execSync('powershell -Command "Start-Sleep -Seconds 1"', { stdio: 'pipe' });
        } else {
          execSync('sleep 1', { stdio: 'pipe' });
        }
      } catch {}
      if (isApiRunning()) {
        ready = true;
        break;
      }
    }
    if (ready) {
      console.log('✅ API iniciada com sucesso!');
    } else {
      console.log('⚠️  API pode ainda estar iniciando. Continuando mesmo assim...');
    }
  } else {
    console.log(`❌ Diretório da API não encontrado: ${apiDir}`);
  }
  console.log('');
} else {
  console.log('✅ API já está rodando!');
}

console.log(`🔗 REACT_NATIVE_PACKAGER_HOSTNAME=${lanIp || 'não detectado'}`);
console.log(`🔗 EXPO_PUBLIC_API_URL=${process.env.EXPO_PUBLIC_API_URL || 'não configurado'}`);

const config = getDefaultConfig(__dirname);
module.exports = config;

