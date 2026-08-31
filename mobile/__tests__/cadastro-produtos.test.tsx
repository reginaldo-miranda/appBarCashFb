import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { Text, TouchableOpacity } from 'react-native';

jest.mock('expo-router', () => ({
  router: { back: jest.fn() },
  useLocalSearchParams: () => ({ id: '1' })
}));

jest.mock('../src/contexts/AuthContext', () => ({
  useAuth: () => ({ hasPermission: () => true })
}));

jest.mock('../src/contexts/ProductContext', () => ({
  useProduct: () => ({ triggerRefresh: jest.fn() })
}));

// Mock Alert sem substituir o módulo inteiro de react-native

jest.mock('../src/services/api', () => {
  const mProduct = {
    getById: jest.fn(),
    update: jest.fn(),
    create: jest.fn()
  };
  const mCategory = { getAll: jest.fn() };
  const mType = { getAll: jest.fn() };
  const mUn = { getAll: jest.fn() };
  const mSetor = { getAll: jest.fn() };
  return {
    productService: mProduct,
    categoryService: mCategory,
    typeService: mType,
    unidadeMedidaService: mUn,
    setorImpressaoService: mSetor
  };
});

const CadastroProduto = require('../app/produtos/cadastro').default;
const { router } = require('expo-router');
const { Alert } = require('react-native');
jest.spyOn(Alert, 'alert').mockImplementation(() => {});
const { productService, categoryService, typeService, unidadeMedidaService, setorImpressaoService } = require('../src/services/api');

describe('Tela de Cadastro/Edição de Produto', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  const flushPromises = async () => {
    await act(async () => {
      await new Promise(resolve => setImmediate(resolve));
    });
  };

  test.skip('abre e permanece aberta quando há erro de carregamento (não fecha automaticamente)', async () => {
    categoryService.getAll.mockResolvedValueOnce([{ id: '10', nome: 'Refrigerantes' }]);
    typeService.getAll.mockResolvedValueOnce([{ id: '20', nome: 'Geral' }]);
    unidadeMedidaService.getAll.mockResolvedValueOnce([{ id: '30', nome: 'Mililitro', sigla: 'ml' }]);
    productService.getById.mockRejectedValueOnce(new Error('Falha de rede'));

    let tree: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = ReactTestRenderer.create(<CadastroProduto />);
    });
    await flushPromises();

    const titleNodes = tree!.root.findAllByType(Text).filter(n => String(n.props.children).includes('Editar Produto'));
    expect(titleNodes.length).toBeGreaterThan(0);
    expect(router.back).not.toHaveBeenCalled();
    const errorNodes = tree!.root.findAllByType(Text).filter(n => String(n.props.children).includes('Não foi possível carregar os dados do produto.'));
    expect(errorNodes.length).toBeGreaterThan(0);
  }, 15000);

  test.skip('carrega produto e permite salvar em modo edição, retornando ao fim', async () => {
    jest.useFakeTimers();
    categoryService.getAll.mockResolvedValue([{ id: '10', nome: 'Refrigerantes' }]);
    typeService.getAll.mockResolvedValue([{ id: '20', nome: 'Geral' }]);
    unidadeMedidaService.getAll.mockResolvedValue([{ id: '30', nome: 'Mililitro', sigla: 'ml' }]);
    productService.getById.mockResolvedValue({ data: {
      id: 1,
      nome: 'Coca-Cola',
      descricao: '',
      precoVenda: 10,
      precoCusto: 7,
      categoria: 'Refrigerantes',
      grupo: 'Geral',
      unidade: 'ml',
      quantidade: 5,
      ativo: true,
      dataInclusao: new Date().toISOString()
    }});
    productService.update.mockResolvedValue({ data: { ok: true } });

    let tree: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = ReactTestRenderer.create(<CadastroProduto />);
    });
    await flushPromises();

    const saveButtonNode = tree!.root.findAllByType(TouchableOpacity).find(n => {
      const textChildren = n.findAllByType(Text).map(t => String(t.props.children));
      return textChildren.some(c => /Atualizar Produto|Salvar Produto/.test(c));
    });
    await act(async () => {
      saveButtonNode!.props.onPress();
    });
    jest.runOnlyPendingTimers();

    act(() => {
      jest.runAllTimers();
    });

    expect(productService.update).toHaveBeenCalled();
    expect(router.back).toHaveBeenCalledTimes(1);
  }, 15000);

  test('produto não encontrado não fecha a tela e mostra opções', async () => {
    categoryService.getAll.mockResolvedValue([{ id: '10', nome: 'Refrigerantes' }]);
    typeService.getAll.mockResolvedValue([{ id: '20', nome: 'Geral' }]);
    unidadeMedidaService.getAll.mockResolvedValue([{ id: '30', nome: 'Mililitro', sigla: 'ml' }]);
    setorImpressaoService.getAll.mockResolvedValue([]);
    productService.getById.mockResolvedValue({ data: null });

    let tree: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = ReactTestRenderer.create(<CadastroProduto />);
    });
    await flushPromises();

    expect(router.back).not.toHaveBeenCalled();
    const msgs = tree!.root.findAllByType(Text).map(n => String(n.props.children));
    expect(msgs.some(m => m.includes('Produto não encontrado.'))).toBeTruthy();
    expect(msgs.some(m => m.includes('Tentar novamente'))).toBeTruthy();
    expect(msgs.some(m => m.includes('Voltar'))).toBeTruthy();
  }, 15000);

  test('carrega classificacao por texto quando ids nao casam com as listas', async () => {
    categoryService.getAll.mockResolvedValue([{ id: '10', nome: 'Refrigerantes' }]);
    typeService.getAll.mockResolvedValue([{ id: '20', nome: 'Geral' }]);
    unidadeMedidaService.getAll.mockResolvedValue([{ id: '30', nome: 'Mililitro', sigla: 'ml' }]);
    setorImpressaoService.getAll.mockResolvedValue([]);
    productService.getById.mockResolvedValue({
      data: {
        id: 1,
        nome: 'Coca-Cola',
        precoVenda: 10,
        precoCusto: 7,
        categoria: 'Refrigerantes',
        tipo: 'Geral',
        unidade: 'ml',
        quantidade: 5,
        ativo: true,
        dataInclusao: new Date().toISOString(),
      }
    });

    let tree: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = ReactTestRenderer.create(<CadastroProduto />);
    });
    await flushPromises();

    const texts = tree!.root.findAllByType(Text).map(n => String(n.props.children));
    expect(texts.some(t => t.includes('Mililitro (ml)'))).toBeTruthy();
    expect(productService.getById).toHaveBeenCalledWith('1');
  }, 15000);
});
