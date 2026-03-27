---
description: reimprimir cupom fiscal
---

Preciso que você implemente uma funcionalidade de reimpressão de cupons em um sistema de vendas (PDV), considerando dois tipos:

Cupom comum (não fiscal)
Cupom fiscal (já autorizado/emittedo)
Contexto:

Pode ocorrer falha na impressão (ex: falta de papel na impressora) no momento da emissão do cupom fiscal, então é necessário permitir a reimpressão posterior.

Requisitos:
Tela de Histórico de Vendas:
Criar um botão de ação chamado "Reimprimir Cupom"
Exibir uma lista de vendas realizadas
Cada venda deve indicar claramente:
Se é cupom comum ou cupom fiscal
Data, valor e identificador da venda
Seleção da Venda:
O usuário deve conseguir selecionar uma venda da lista
Após seleção, acionar a reimpressão
Regra de Reimpressão:
Para cupom comum:
Reimprimir normalmente com base nos dados da venda
Para cupom fiscal:
NÃO gerar um novo cupom fiscal
Apenas reimprimir o DANFE/NFC-e já autorizado
Garantir que os dados fiscais originais sejam preservados
Validações:
Só permitir reimpressão de vendas já finalizadas
Exibir mensagem de erro caso a venda não seja elegível
Logar a ação de reimpressão (usuário, data/hora)
UX/UI:
Destacar visualmente o tipo de cupom (ex: badge ou label)
Confirmar ação antes de reimprimir
Exibir feedback de sucesso ou erro
Extras (opcional, se aplicável):
Permitir filtro por data/período
Permitir busca por número da venda, CPF, nome do cliente
Objetivo:

Garantir que o usuário consiga reimprimir cupons com segurança e sem risco de duplicidade fiscal.