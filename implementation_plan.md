# Plano de Implementação: Cardápio Eletrônico via QR Code (Rede Local)

Este plano descreve a viabilidade e a arquitetura técnica para implementar um **Cardápio Eletrônico Autônomo** para o sistema `appBarCash`. O sistema funcionará inteiramente na rede local (Wi-Fi) do estabelecimento, permitindo que os clientes escaneiem um QR Code na mesa e façam seus próprios pedidos diretamente de seus celulares, sem a necessidade de baixar aplicativos, integrando-se em tempo real com o banco de dados e as impressoras de produção existentes.

---

## Arquitetura e Funcionamento na Rede Local

Como o sistema `appBarCash` roda localmente (usando banco de dados MySQL e uma API Node.js/Express), o cardápio eletrônico pode ser servido diretamente pelo computador principal (Servidor Local) do estabelecimento.

```
+---------------------+
| Celular do Cliente  |
+----------+----------+
           | 1. Escaneia QR Code Mesa 05
           v
+----------+-------------------------------------------------------------+
| Abre URL: http://192.168.1.100:8081/cardapio/5                         |
+----------+-------------------------------------------------------------+
           | 2. Carrega Web App Leve e faz o pedido
           v
+----------+-----------------------------------------+
| API Local: http://192.168.1.100:4000/api            |
+----------+-----------------------------------------+
           | 3. Banco de Dados MySQL
           v
+----------+-----------------------------------------+
| Atualiza tabelas Sale, SaleItem e cria PrintJob |
+----------+-----------------------------------------+
```

### 1. Infraestrutura de Rede
* **IP do Servidor**: O computador que atua como servidor central no bar/restaurante receberá um IP estático na rede local (ex: `192.168.1.100`).
* **Acesso do Cliente**: O cliente conecta-se ao Wi-Fi local do estabelecimento. Ao escanear o QR Code da mesa, o celular dele acessará diretamente o servidor local.
* **Porta de Acesso**: O cardápio digital roda diretamente na aplicação do Expo (porta `8081` ou `8082`), acessando de forma pública a rota `/cardapio/[mesaId]`.

---

## Jornada do Cliente (Fluxo de Uso)

1. **Chegada e Identificação**: O cliente senta-se à mesa (ex: Mesa 5) e aponta a câmera do celular para o QR Code colado na mesa.
2. **Navegação**: O celular abre o navegador web em uma página moderna, bonita e otimizada para mobile. O sistema identifica automaticamente: *"Você está na Mesa 5"*.
3. **Seleção de Produtos**: O cliente visualiza as categorias de produtos (bebidas, porções, pratos), imagens, preços e variações (ex: tamanho da pizza ou adicionais de um hambúrguer).
4. **Carrinho e Envio**: O cliente revisa sua seleção e clica em **"Enviar Pedido"**.
5. **Confirmação**: O pedido é enviado para a API e o cliente recebe uma mensagem de sucesso na tela: *"Seu pedido foi enviado para a cozinha! Acompanhe o status aqui."*

---

## Integração Técnica com o Sistema appBarCash Existente

O cardápio digital reutilizará e se integrará perfeitamente às estruturas de dados e regras de negócios que você já possui rodando de forma estável:

### A. Banco de Dados (MySQL / Prisma)
O banco de dados atual já está preparado para receber essa funcionalidade:
* **Tabela `Mesa`**: O cardápio usará o endpoint da mesa para verificar se ela está disponível e buscar os dados de consumo atuais se necessário.
* **Tabela `Product` e `ProductGroup`**: O cardápio digital lerá diretamente os produtos e grupos cadastrados no sistema central, respeitando se estão ativos (`ativo: true`) e disponíveis (`disponivel: true`).
* **Tabela `Sale` e `SaleItem`**: Ao finalizar o pedido, o sistema criará ou atualizará uma venda do tipo `mesa` associada à mesa correspondente, inserindo os novos itens com o status `pendente`.
* **Tabela `PrintJob`**: O envio do pedido pelo cliente cria automaticamente registros na tabela `PrintJob`, disparando a impressão automática dos itens nas impressoras corretas (ex: bebidas no bar, porções na cozinha).

### B. Backend (API Node.js)
Criamos endpoints públicos e seguros para o cliente:
1. `GET /api/public/menu`: Retorna apenas os produtos e categorias ativos para exibição no cardápio digital.
2. `POST /api/public/pedido`: Endpoint público para o cliente enviar o carrinho. Este endpoint valida os dados e insere na mesa.
3. **WebSockets (`websocket-server.js`)**: O servidor disparará um evento WebSocket para o painel de controle do caixa/garçom toda vez que um cliente fizer um pedido, gerando um alerta sonoro e visual imediato.

### C. Frontend (Cardápio Mobile-Web)
Criamos uma rota dedicada e leve no Expo Router:
* **Nova Rota**: `app/cardapio/[mesaId].tsx`.
* **Design Premium e Limpo**: O design é focado 100% na experiência do celular (mobile-first), com carregamento instantâneo, visualização em grade elegante, busca rápida de pratos, suporte a fotos e uma sacola de compras flutuante e intuitiva.
