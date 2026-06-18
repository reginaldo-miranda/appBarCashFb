import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPrintContent } from '../lib/print.js';
import { formatWhatsappMessage } from '../lib/whatsapp.js';

test('buildPrintContent includes setor, ref, item and qty', () => {
  const content = buildPrintContent({ setorNome: 'Comandas', saleRef: { mesa: 12 }, productNome: 'X-Burguer', quantidade: 3, observacao: 'Sem cebola' });
  assert.ok(content.includes('Comandas'));
  assert.ok(content.includes('Mesa 12'));
  assert.ok(content.includes('Item: X-Burguer'));
  assert.ok(content.includes('Qtd: 3'));
  assert.ok(content.includes('Sem cebola'));
});

test('formatWhatsappMessage lists items and total', () => {
  const sale = { mesa: 5, observacoes: 'Urgente' };
  const itens = [
    { quantidade: 2, product: { nome: 'Pizza', precoVenda: 50 } },
    { quantidade: 1, product: { nome: 'Refri', precoVenda: 8 } },
  ];
  const msg = formatWhatsappMessage({ sale, itens });
  assert.ok(msg.includes('Mesa 5'));
  assert.ok(msg.includes('Pizza x2'));
  assert.ok(msg.includes('Refri x1'));
  assert.ok(msg.includes('Total: R$ 108.00'));
  assert.ok(msg.includes('Urgente'));
});