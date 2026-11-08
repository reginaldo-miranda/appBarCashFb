export interface ManualTopic {
  id: string;
  title: string;
  content: string;
}

export interface ManualCategory {
  id: string;
  title: string;
  icon: string;
  description: string;
  topics: ManualTopic[];
}

export const MANUAL_DATA: ManualCategory[] = [
  {
    id: 'fiscal',
    title: 'Fiscal & NFC-e 🧾',
    icon: 'receipt',
    description: 'Emissão de cupons fiscais, contingência offline e regras SEFAZ.',
    topics: [
      {
        id: 'fiscal-emissao',
        title: 'Como emitir NFC-e na venda?',
        content: `Para emitir NFC-e ao finalizar uma venda:
1. Monte a venda normalmente com os produtos e quantidades.
2. Na tela de pagamento, clique em **Pagar & Finalizar**.
3. Na janela de confirmação de pagamento, selecione a opção **"Emitir NFC-e"** (ou marque a caixa fiscal).
4. O sistema assinará o XML e enviará diretamente para a SEFAZ.
5. Ao autorizar, o comprovante DANFE com QR Code estará pronto para impressão.`
      },
      {
        id: 'fiscal-retroativa',
        title: 'Como gerar Cupom Fiscal (NFC-e retroativa) de venda comum finalizada?',
        content: `Se uma venda foi finalizada como cupom comum e você precisa emitir a NFC-e retroativa depois:
1. Acesse o menu **Histórico** de vendas.
2. Localize e toque na venda desejada (identificada como 'Cupom Comum').
3. No painel de detalhes, clique no botão laranja: **"🧾 Gerar Cupom Fiscal (NFC-e)"**.
4. O sistema validará os itens e enviará a nota para a SEFAZ.
5. Após autorizada, a venda é atualizada para 'NFC-e Autorizada' e o botão de impressão do DANFE fica disponível.`
      },
      {
        id: 'fiscal-contingencia',
        title: 'Como funciona a Contingência Offline?',
        content: `Quando a SEFAZ estiver fora do ar ou o estabelecimento estiver sem internet:
1. Ao tentar emitir a NFC-e e houver falha de conexão, o sistema perguntará se deseja **Emitir em Contingência Offline**.
2. Confirmando, o sistema gera a nota em contingência e imprime o DANFE com a mensagem legal de contingência.
3. Acesse a aba **Contingência** para visualizar as notas pendentes de envio.
4. Assim que a internet ou a SEFAZ retornar, clique em **"Sincronizar Todas"** para transmitir as notas pendentes à SEFAZ.`
      },
      {
        id: 'fiscal-correcao',
        title: 'Correção Rápida de Dados Fiscais (NCM / CFOP / CSOSN)',
        content: `Se algum produto estiver com dados fiscais incompletos ou inválidos:
1. Ao tentar emitir a NFC-e, o sistema abre automaticamente a tela de **"Validação de Dados Fiscais"**.
2. Nessa janela você pode preencher diretamente o NCM (8 dígitos), CFOP (ex: 5102) e CSOSN (ex: 102).
3. Ao salvar, os dados são gravados permanentemente no cadastro do produto e a emissão prossegue imediatamente, sem precisar refazer a venda.`
      },
      {
        id: 'fiscal-reforma',
        title: 'Reforma Tributária 2026 (IBS e CBS)',
        content: `Para atender às exigências fiscais da Reforma Tributária:
1. O sistema inclui os grupos de apuração de IBS (Estadual/Municipal) e CBS (Federal).
2. No cadastro de produtos (em **Adm Produtos > Dados Fiscais**), os campos de alíquota e classificação tributária (cClassTrib) são preenchidos automaticamente com os valores vigentes.
3. As notas enviadas à SEFAZ já incluem as tags de IBS/CBS quando exigido pelo ambiente fiscal.`
      },
      {
        id: 'fiscal-config',
        title: 'Configuração do Certificado Digital e CSC',
        content: `Para habilitar a empresa para emissão de NFC-e:
1. Acesse **Adm Config > Configurações do App**.
2. Informe o **CSC** (Código de Segurança do Contribuinte) e o **ID do CSC** fornecidos pela SEFAZ.
3. Faça o upload do arquivo do **Certificado Digital (.pfx ou .p12)** e digite a senha.
4. Escolha o ambiente: **Homologação** (para testes) ou **Produção** (para vendas reais).
5. Defina a Série (padrão 1) e o Número Inicial da NFC-e.`
      }
    ]
  },
  {
    id: 'cardapio',
    title: 'Cardápio Digital & QR Code 📱',
    icon: 'qr-code',
    description: 'Divulgação do cardápio online, pedidos via sacola e atendimento.',
    topics: [
      {
        id: 'cardapio-link',
        title: 'Como divulgar o Cardápio com Link e QR Code?',
        content: `O sistema gera automaticamente uma página web do cardápio para o seu negócio:
1. O link de acesso ao cardápio é: **seu-endereco/cardapio/[id-da-empresa]**.
2. Você pode gerar um QR Code com este link e colocar nas mesas, balcão ou cartões de visita.
3. Os clientes acessam pelo celular sem precisar instalar nenhum aplicativo.`
      },
      {
        id: 'cardapio-pedidos',
        title: 'Como o cliente monta pedidos pela Sacola?',
        content: `A experiência do cliente no cardápio digital:
1. O cliente visualiza as categorias de produtos (bebidas, lanches, porções, etc.).
2. Clica no item para ver detalhes, escolher tamanho ou variação e digitar observações (ex: "sem cebola").
3. O item vai para a **Sacola**. Na sacola flutuante, ele confere os itens e clica em **Continuar**.
4. Informa o nome, forma de consumo (mesa ou retirada) e confirma o pedido.`
      },
      {
        id: 'cardapio-recebimento',
        title: 'Como receber e gerenciar pedidos do Cardápio?',
        content: `1. Quando um cliente envia um pedido pelo cardápio digital, ele entra automaticamente no sistema.
2. O pedido pode ser visualizado na aba de **Mesas/Comandas** ou em **Entregas/Delivery**.
3. O operador do caixa pode conferir os itens, imprimir a via de produção para a cozinha e finalizar a cobrança.`
      }
    ]
  },
  {
    id: 'comandas',
    title: 'Comandas e Mesas 🍽️',
    icon: 'restaurant',
    description: 'Gestão de mesas, comandas individuais, adicionais e pedidos.',
    topics: [
      {
        id: 'comandas-abertura',
        title: 'Como abrir uma Mesa ou Comanda?',
        content: `1. Acesse o menu **Mesas/Comandas**.
2. Toque em **Nova Comanda** ou escolha o número da Mesa desejada.
3. Você pode identificar a mesa com o nome do cliente ou número de controle.
4. A mesa ficará com o status 'Ocupada' (indicada em destaque visual).`
      },
      {
        id: 'comandas-itens',
        title: 'Lançar Itens e Observações para a Cozinha',
        content: `1. Com a mesa aberta, clique em **Adicionar Produtos**.
2. Toque no produto desejado e selecione a quantidade.
3. Se o item tiver observação (ex: "bem passado", "sem maionese"), clique no botão de observação rápida.
4. Ao confirmar, os itens são lançados na conta da mesa e podem ser enviados para a impressão de produção.`
      },
      {
        id: 'comandas-fechamento',
        title: 'Fechamento e Pagamento de Mesa',
        content: `1. Na tela da mesa, clique em **Fechar Mesa / Conta**.
2. O sistema mostra o resumo detalhado do consumo.
3. É possível dividir o valor entre diferentes pessoas ou formas de pagamento (Dinheiro, PIX, Cartão).
4. Ao concluir o pagamento, a mesa é liberada automaticamente para novos clientes e o cupom é emitido.`
      }
    ]
  },
  {
    id: 'caixa',
    title: 'Caixa & Movimentações 💵',
    icon: 'cash',
    description: 'Abertura, fechamento, fundo de troco, sangria e suprimento.',
    topics: [
      {
        id: 'caixa-abertura',
        title: 'Abertura de Caixa e Fundo de Troco',
        content: `O caixa deve ser aberto no início de cada turno de trabalho:
1. Acesse o menu **Caixa**.
2. Se o caixa estiver fechado, clique em **Abrir Caixa**.
3. Digite o valor do **Fundo de Troco** (dinheiro que já está na gaveta para troco).
4. Confirme para iniciar as operações do dia.`
      },
      {
        id: 'caixa-sangria-suprimento',
        title: 'Sangria (Retirada) e Suprimento (Entrada)',
        content: `Para movimentar valores durante o turno sem registrar como venda:
1. Na tela do **Caixa**, clique no botão de movimentações.
2. **Sangria:** Use para registrar retiradas de dinheiro da gaveta (ex: pagamento de fornecedor ou recolhimento de segurança).
3. **Suprimento:** Use para registrar reforço de troco ou entrada extra de dinheiro na gaveta.
4. Todas as movimentações ficam registradas com data, hora e responsável.`
      },
      {
        id: 'caixa-fechamento',
        title: 'Fechamento e Conferência de Totais',
        content: `Ao final do expediente ou turno:
1. No menu **Caixa**, clique em **Fechar Caixa**.
2. O sistema exibe o resumo completo separado por modalidade: Dinheiro, Cartão de Crédito, Cartão de Débito, PIX, etc.
3. O operador confere os valores físicos contra os valores registrados no sistema.
4. Ao confirmar, o caixa é encerrado e o relatório de fechamento pode ser impresso.`
      },
      {
        id: 'caixa-totalizador',
        title: 'Totalizador de Seleção Rápida',
        content: `No menu **Caixa**, você pode selecionar vendas específicas marcando a caixa 'Ok' ao lado de cada uma.
O sistema calcula e exibe instantaneamente o **Total Selecionado** na barra de resumos, facilitando conferências parciais de lotes de vendas.`
      }
    ]
  },
  {
    id: 'vendas',
    title: 'Vendas Balcão e Delivery 🛵',
    icon: 'cart',
    description: 'Processos de venda rápida, entrega, taxas e fidelidade.',
    topics: [
      {
        id: 'venda-rapida',
        title: 'Como realizar uma Venda Rápida no Balcão?',
        content: `1. Na tela inicial ou em **Nova Venda**, toque nos produtos para adicioná-los à venda.
2. Você pode buscar produtos pelo nome, categoria ou código de barras.
3. Para ajustar quantidades, use os botões **(+)** e **(-)**.
4. Clique em **Pagar & Finalizar**, selecione a forma de pagamento (Dinheiro, PIX, Cartão) e confirme.`
      },
      {
        id: 'venda-delivery',
        title: 'Lançar Pedido com Delivery (Entrega)',
        content: `1. Na tela de venda, clique no botão laranja com ícone de entrega (moto/caminhão).
2. Selecione um cliente cadastrado ou digite o endereço de entrega com CEP.
3. O sistema calcula a taxa de entrega automaticamente (se configurada) ou você pode inserir manualmente.
4. Selecione o entregador responsável e confirme.
5. O pedido é enviado para a lista de entregas pendentes.`
      },
      {
        id: 'venda-fidelidade',
        title: 'Pontos e Cashback de Clientes',
        content: `Se o módulo de Fidelidade estiver ativado em **Adm Config**:
1. Ao vincular um cliente participante à venda, o sistema calcula os pontos ou cashback acumulados.
2. Se o cliente tiver pontos suficientes para resgate, o sistema exibe o quadro **"Resgate de Pontos"** na tela de pagamento.
3. Use os botões **(+)** e **(-)** para definir quantos pontos abater do total da compra.
4. O desconto é aplicado imediatamente e o cliente paga apenas a diferença.`
      }
    ]
  },
  {
    id: 'cadastros',
    title: 'Cadastros & Configurações ⚙️',
    icon: 'settings',
    description: 'Gestão de produtos, clientes, funcionários e empresa.',
    topics: [
      {
        id: 'cad-produtos',
        title: 'Cadastrar Produtos e Variações',
        content: `1. Acesse **Adm Produtos** e clique em **Novo Produto (+)**.
2. Preencha Nome, Preço de Venda, Categoria e Código de Barras (EAN).
3. Na seção **Dados Fiscais**, informe o NCM (8 dígitos), CFOP (ex: 5102) e CSOSN (ex: 102).
4. Utilize o filtro **'Sem Fiscal'** na listagem para localizar produtos que ainda não têm dados fiscais preenchidos.
5. Salve as alterações.`
      },
      {
        id: 'cad-clientes',
        title: 'Cadastrar Clientes',
        content: `1. Acesse **Adm Clientes** e clique em **Novo Cliente**.
2. Preencha Nome, Telefone/WhatsApp, CPF (essencial para NFC-e identificada) e Endereço.
3. Ao digitar o CEP, o endereço é preenchido automaticamente pela busca online.
4. Marque a opção **"Participa Fidelidade"** caso o cliente acumule pontos/cashback.`
      },
      {
        id: 'cad-empresa',
        title: 'Dados da Empresa e Regime Tributário',
        content: `1. Acesse **Adm Config > Dados da Empresa**.
2. Confira a Razão Social, Nome Fantasia, CNPJ, Inscrição Estadual e Endereço.
3. Defina o **Regime Tributário** (ex: Simples Nacional, MEI ou Regime Normal).
4. Esses dados são impressos nos cupons e utilizados no cabeçalho fiscal da NFC-e.`
      },
      {
        id: 'cad-perfis',
        title: 'Perfis de Acesso (Cargos e Permissões)',
        content: `Para controlar o que cada operador pode acessar:
1. Acesse **Adm Config > Perfis de Acesso**.
2. Crie ou edite perfis como "Caixa", "Garçom" ou "Gerente", marcando apenas as permissões autorizadas.
3. Em **Adm Funcionários**, edite o cadastro do colaborador e associe o perfil correspondente.`
      }
    ]
  }
];
