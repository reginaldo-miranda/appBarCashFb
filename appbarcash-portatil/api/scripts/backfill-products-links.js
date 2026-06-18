import prisma from '../lib/prisma.js';

function toStr(v) { return (v ?? '').toString().trim(); }
function isNumericStr(v) { return /^\d+$/.test(toStr(v)); }

async function main() {
  console.log('🔧 Iniciando backfill de vínculos de produtos...');
  const [categorias, tipos, unidades, grupos] = await Promise.all([
    prisma.categoria.findMany({ where: { ativo: true } }),
    prisma.tipo.findMany({ where: { ativo: true } }),
    prisma.unidadeMedida.findMany({ where: { ativo: true } }),
    prisma.productGroup.findMany({ where: { ativo: true } }),
  ]);

  const catByName = new Map(categorias.map(c => [toStr(c.nome).toLowerCase(), c]));
  const catById = new Map(categorias.map(c => [Number(c.id), c]));
  const tipoByName = new Map(tipos.map(t => [toStr(t.nome).toLowerCase(), t]));
  const tipoById = new Map(tipos.map(t => [Number(t.id), t]));
  const unByName = new Map(unidades.map(u => [toStr(u.nome).toLowerCase(), u]));
  const unBySigla = new Map(unidades.map(u => [toStr(u.sigla).toLowerCase(), u]));
  const unById = new Map(unidades.map(u => [Number(u.id), u]));
  const grpByName = new Map(grupos.map(g => [toStr(g.nome).toLowerCase(), g]));
  const grpById = new Map(grupos.map(g => [Number(g.id), g]));

  const produtos = await prisma.product.findMany({});
  let atualizados = 0;

  for (const p of produtos) {
    let categoriaId = p.categoriaId ?? null;
    let tipoId = p.tipoId ?? null;
    let unidadeMedidaId = p.unidadeMedidaId ?? null;
    let groupId = p.groupId ?? null;

    const catVal = toStr(p.categoria);
    if (!categoriaId) {
      if (isNumericStr(catVal) && catById.has(Number(catVal))) {
        categoriaId = Number(catVal);
      } else if (catByName.has(catVal.toLowerCase())) {
        categoriaId = catByName.get(catVal.toLowerCase()).id;
      }
    }

    const tipoVal = toStr(p.tipo);
    if (!tipoId) {
      if (isNumericStr(tipoVal) && tipoById.has(Number(tipoVal))) {
        tipoId = Number(tipoVal);
      } else if (tipoByName.has(tipoVal.toLowerCase())) {
        tipoId = tipoByName.get(tipoVal.toLowerCase()).id;
      }
    }

    const unVal = toStr(p.unidade);
    if (!unidadeMedidaId) {
      if (isNumericStr(unVal) && unById.has(Number(unVal))) {
        unidadeMedidaId = Number(unVal);
      } else if (unBySigla.has(unVal.toLowerCase())) {
        unidadeMedidaId = unBySigla.get(unVal.toLowerCase()).id;
      } else if (unByName.has(unVal.toLowerCase())) {
        unidadeMedidaId = unByName.get(unVal.toLowerCase()).id;
      }
    }

    const grpVal = toStr(p.grupo);
    if (!groupId) {
      if (isNumericStr(grpVal) && grpById.has(Number(grpVal))) {
        groupId = Number(grpVal);
      } else if (grpByName.has(grpVal.toLowerCase())) {
        groupId = grpByName.get(grpVal.toLowerCase()).id;
      }
    }

    const needsUpdate = (
      (p.categoriaId ?? null) !== (categoriaId ?? null) ||
      (p.tipoId ?? null) !== (tipoId ?? null) ||
      (p.unidadeMedidaId ?? null) !== (unidadeMedidaId ?? null) ||
      (p.groupId ?? null) !== (groupId ?? null)
    );

    if (needsUpdate) {
      await prisma.product.update({
        where: { id: p.id },
        data: {
          categoriaId: categoriaId ?? undefined,
          tipoId: tipoId ?? undefined,
          unidadeMedidaId: unidadeMedidaId ?? undefined,
          groupId: groupId ?? undefined,
        },
      });
      atualizados++;
    }
  }

  console.log(`✅ Backfill concluído. Produtos atualizados: ${atualizados}`);
}

main()
  .catch((e) => {
    console.error('❌ Erro no backfill:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });