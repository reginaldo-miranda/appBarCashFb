# Manual de Configuração e Uso do Sistema AppBarCash

Este manual contém as instruções técnicas e operacionais para instalar, configurar e operar o sistema **AppBarCash**. Ele é estruturado tanto para o administrador de TI responsável pela implantação quanto para o operador do sistema no dia a dia.

---

## 1. Visão Geral da Arquitetura

O **AppBarCash** é um sistema moderno de automação para bares e restaurantes que opera em tempo real. Sua arquitetura é composta por:
1. **Banco de Dados**: MySQL para armazenamento seguro e rápido dos dados locais.
2. **Backend (API Servidor)**: Servidor Node.js + Prisma ORM para processar regras de negócios, imprimir e disparar atualizações instantâneas.
3. **Frontend (Aplicativo Móvel/Desktop)**: Aplicativo React Native (Expo) que roda em tablets de preparação (Cozinha/Bar) e nos celulares dos garçons ou telas de caixa.

---

## 2. Requisitos de Sistema e Instalação

Para que o sistema funcione corretamente, a máquina servidora local e os dispositivos clientes precisam atender aos requisitos abaixo.

### 2.1. Instalação e Configuração do MySQL (Servidor)
O banco de dados do sistema precisa estar ativo na máquina principal que servirá de servidor.

1. **Baixar o MySQL**:
   - Acesse o site oficial: [MySQL Community Server](https://dev.mysql.com/downloads/mysql/)
   - Baixe o instalador recomendado para o seu sistema operacional (Windows, macOS ou Linux).
2. **Durante a Instalação**:
   - Escolha o tipo de instalação padrão (**Developer Default** ou **Server Only**).
   - Defina um método de autenticação forte ou padrão (recomenda-se manter a porta padrão do MySQL: `3306`).
   - **IMPORTANTE**: Defina uma senha para o usuário padrão `root` e anote-a. Você usará essa senha para conectar o sistema ao banco.
3. **Criar a base de dados**:
   - Abra o terminal ou uma ferramenta visual como o *MySQL Workbench* e conecte-se ao banco de dados com seu usuário `root` e senha.
   - Execute o comando para criar a base de dados do sistema:
     ```sql
     CREATE DATABASE appbarcash;
     ```

### 2.2. Instalação do Node.js (Servidor)
O servidor principal do sistema exige a instalação do ambiente Node.js.
- Acesse [nodejs.org](https://nodejs.org) e baixe a versão **LTS** (versão 18 ou superior recomendada).

### 2.3. Aplicativo Móvel (Dispositivos Móveis dos Garçons / Tablets)
- Os dispositivos móveis (smartphones e tablets) que rodarão o sistema devem ter o aplicativo **Expo Go** instalado (disponível gratuitamente na Google Play Store e Apple App Store).

---

## 3. Configuração do Ambiente do Sistema

Após instalar o MySQL e o Node.js na máquina servidora, siga os passos abaixo para configurar a aplicação:

### 3.1. Configuração do Backend (`api/.env`)
Vá até a pasta `api` do projeto. Você encontrará um arquivo chamado `.env` (ou `env_exemplo` que pode ser copiado e renomeado para `.env`). Configure a string de conexão com o banco de dados MySQL instalado:

```env
# Porta da API do servidor
PORT=4000

# String de conexão do MySQL
# Estrutura: mysql://USUARIO:SENHA@HOST:PORTA/NOME_DO_BANCO
DATABASE_URL_LOCAL="mysql://root:SUA_SENHA_AQUI@localhost:3306/appbarcash"
```
*Substitua `SUA_SENHA_AQUI` pela senha que você configurou para o usuário `root` na instalação do MySQL.*

### 3.2. Carga Inicial do Banco de Dados
Para carregar a estrutura inicial de tabelas do sistema, na pasta raiz do projeto, execute no terminal o comando de migração:
```bash
cd api
npx prisma db push
```

---

## 4. Como Iniciar o Sistema (Servidor e Clientes)

### 4.1. Iniciando o Servidor (Backend)
O servidor deve ser iniciado apontando para o IP da sua rede local (LAN), para que todos os tablets e celulares consigam se conectar a ele.

Na raiz do projeto, execute o script de inicialização do backend:
```bash
./start-api.sh local
```
*O console exibirá o endereço IP local de inicialização, por exemplo: `http://192.168.0.176:4000/api`.*

### 4.2. Iniciando o Aplicativo Móvel (Frontend)
Na pasta raiz do projeto, inicialize o aplicativo apontando para a rede local:
```bash
npx expo start --host lan
```
*Isso gerará um QR Code no console. Abra o aplicativo **Expo Go** no celular ou tablet e escaneie o QR Code para carregar a aplicação instantaneamente.*

---

## 5. Guia Operacional de Uso

O sistema é dividido em três fluxos operacionais principais que trabalham sincronizados em tempo real.

### 5.1. Fluxo de Venda Balcão (Caixa Rápido)
1. O operador abre a tela de venda rápida no caixa.
2. Adiciona os produtos desejados pelo cliente ao carrinho de compras.
3. Clica em **Pagar/Finalizar**, escolhe a forma de pagamento (Dinheiro, Cartão, PIX, etc.) e conclui a venda.
4. **Envio automático para preparação**: Como a venda foi paga e finalizada, os produtos do tipo alimentos/bebidas são enviados de forma transparente com o status de preparação para a fila de pendentes do tablet na Cozinha ou no Bar.

### 5.2. Fluxo de Venda por Mesa ou Comanda (Garçons)
1. O garçom, utilizando o celular, acessa a mesa correspondente ou abre uma nova comanda.
2. Lança os produtos solicitados pelos clientes. Os produtos em aberto são gravados com status de preparação "pendente".
3. Os produtos são direcionados instantaneamente aos respectivos setores de preparação.
4. Após o cliente consumir tudo o que deseja, o operador do caixa fecha a mesa/comanda e realiza o recebimento no terminal de vendas principal.

### 5.3. Operação dos Tablets de Preparação (Cozinha e Bar)
1. Cada setor de preparação possui um tablet que exibe a fila de pedidos pendentes para o seu setor.
2. **Setor Padrão (Fallback)**: Produtos que não possuem setor cadastrado são direcionados por padrão para o setor configurado como padrão no sistema (geralmente a Cozinha principal).
3. **Produção**:
   - Assim que um novo pedido é lançado (seja mesa/comanda aberta ou venda balcão finalizada), o item surge no topo da fila do tablet em tempo real.
   - Ao terminar a produção de um item, o cozinheiro ou barista dá um **toque sobre o item na tela**.
   - O status do item é atualizado automaticamente para **"Pronto"** e ele sai da fila de pendentes.
   - O garçom recebe um aviso visual imediato de que o item da mesa/comanda correspondente está pronto para ser servido!

---

## 6. Configurações Administrativas do Sistema

O painel de gerenciamento de produtos permite ter controle total sobre a logística de impressão física e digital:
* **Vinculação de Setor**: No cadastro do produto, o administrador seleciona para qual setor de impressão o item deve ir (ex: Bebidas -> Bar, Pratos -> Cozinha).
* **Alerta visual de Produtos Sem Setor**: Para garantir que nenhum produto fique "perdido" sem ser preparado, a tela de produtos no celular do administrador exibe um alerta laranja claro com o rótulo `⚠️ Sem Setor` em cada card de produto que não possua setor de impressão vinculado, facilitando a rápida visualização e correção pelo gerente.
* **Filtro Rápido**: O administrador pode clicar no filtro **"Sem Setor"** no topo da tela para isolar e exibir de uma vez apenas os produtos que necessitam de vinculação de setor de impressão.

---

## 7. Resolução de Dúvidas e Problemas Comuns

* **O aplicativo no celular/tablet não conecta ao servidor local**:
  - Certifique-se de que a máquina servidora e os celulares/tablets estejam conectados **à mesma rede Wi-Fi**.
  - Verifique se o Firewall do computador servidor não está bloqueando conexões nas portas `4000` (API) e `4001` (WebSocket). Se necessário, adicione uma regra de permissão para essas portas.
* **O banco de dados não conecta**:
  - Certifique-se de que o serviço do MySQL local está rodando no computador servidor.
  - Verifique se a senha informada no arquivo `api/.env` confere exatamente com a senha configurada no MySQL durante a instalação.
