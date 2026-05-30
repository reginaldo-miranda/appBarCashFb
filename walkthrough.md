# Walkthrough: Cardápio Eletrônico via QR Code (Rede Local)

Este documento resume as mudanças implementadas de ponta a ponta para habilitar a funcionalidade de **Cardápio Eletrônico por QR Code** funcionando na rede local (LAN) do seu estabelecimento, totalmente integrado ao sistema `appBarCash`.

---

## 🛠️ Mudanças Realizadas

A implementação foi dividida entre o Backend (API) e o Frontend (Expo/React Native) de forma 100% modular, sem alterar ou impactar qualquer funcionalidade administrativa estável que você já possui.

### 1. Backend: Rotas Públicas de Autoatendimento
Criamos uma nova estrutura pública de endpoints que não exige tokens de autenticação administrativa (JWT):
* **[public.js](file:///Users/reginaldomiranda/Documents/appBarCashFb/api/routes/public.js)**: 
  * `GET /api/public/menu`: Lista produtos e categorias disponíveis e ativos para o cardápio.
  * `GET /api/public/mesa/:numero`: Valida o status atual de uma mesa de forma rápida.
  * `POST /api/public/pedido`: Processa pedidos anônimos enviados pelo cliente na mesa. Se a mesa estiver livre ou sem venda em aberto, o sistema a **abre automaticamente** e vincula o pedido a ela. Se a mesa estiver ocupada, ele acumula o pedido na venda aberta.
  * **Integração Realtime & Impressão**: Os pedidos inseridos ativam a rotina de impressão (`PrintJob`) para cozinha e bar em tempo real e disparam avisos via WebSockets/SSE para que o garçom e o caixa recebam imediatamente o alerta sonoro de novo pedido!
* **[server.js](file:///Users/reginaldomiranda/Documents/appBarCashFb/api/server.js)**:
  * Importação e registro seguro das rotas públicas em `/api/public` fora do middleware de autenticação, protegendo o resto dos endpoints.

### 2. Frontend: Tela do Cliente & Autoatendimento
Criamos a interface moderna de cardápio focada na experiência do celular do cliente:
* **[[mesaId].tsx](file:///Users/reginaldomiranda/Documents/appBarCashFb/mobile/app/cardapio/[mesaId].tsx)**:
  * Desenvolvido um web-app responsivo (mobile-first) em React Native/Expo.
  * O app detecta de qual mesa veio o acesso pela URL `/cardapio/[mesaId]`.
  * Apresenta abas de categoria roláveis, busca de produtos em tempo real, carrinho de compras moderno e modal de personalização (para escolher tamanhos com preços dinâmicos e adicionar observações como "sem cebola").
  * O fechamento do carrinho dispara o pedido diretamente para a API local (utilizando dinamicamente o IP da rede local da máquina servidora).
  * Exibe feedbacks de sucesso e tratamento amigável de erro de conexão Wi-Fi.

### 3. Painel Administrativo: QR Code por Mesa
Permitimos ao administrador gerar e visualizar os QR Codes correspondentes de cada mesa de forma dinâmica:
* **[mesas.tsx](file:///Users/reginaldomiranda/Documents/appBarCashFb/mobile/app/(tabs)/mesas.tsx)**:
  * Adicionada a importação e o uso da biblioteca `react-native-qrcode-svg`.
  * Inserido um botão moderno e sutil de QR Code ao lado do título "Mesa X" no card de cada mesa na listagem do admin.
  * Desenvolvido um Modal de QR Code que detecta o IP atual da rede LAN do servidor de forma automática (nunca usando `127.0.0.1` ou `localhost` em dispositivos externos) e renderiza o QR Code do cardápio e o link em formato texto para o administrador colar ou acessar diretamente.

---

## 🔍 Como Testar de Ponta a Ponta

Para verificar a funcionalidade, certifique-se de que sua API e o Frontend estão rodando na LAN local:

1. **Iniciar os Serviços (Terminais separados)**:
   * **Terminal 1 (API)**:
     ```bash
     cd api
     npm start
     ```
   * **Terminal 2 (Mobile/Expo)**:
     ```bash
     cd mobile
     npx expo start --host lan -c
     ```
2. **Visualizar QR Code no Admin**:
   * Acesse a aba **Mesas** no painel administrativo do seu desktop/tablet.
   * Clique no pequeno ícone de QR Code amarelo/laranja ao lado do número de qualquer mesa (ex: Mesa 5).
   * O modal abrirá exibindo o QR Code gerado e a URL correspondente (ex: `http://192.168.0.176:8081/cardapio/5`).
3. **Acessar o Cardápio no Celular**:
   * Conecte o celular na mesma rede Wi-Fi e aponte a câmera para o QR Code da tela (ou digite a URL exibida no navegador do celular).
   * Escolha alguns produtos, adicione tamanhos e observações e envie o pedido!
4. **Validar Integração**:
   * O painel administrativo da mesa atualizará o consumo em tempo real com alerta sonoro de novo pedido.
   * Se houver setores e impressoras físicas associadas aos produtos, a impressão será disparada automaticamente no servidor local.
