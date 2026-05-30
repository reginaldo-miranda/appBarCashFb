import React, { useState, useEffect, useRef } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  TextInput,
  Image,
  ActivityIndicator,
  Modal,
  ScrollView,
  SafeAreaView,
  Dimensions,
  Platform,
  Alert,
  StatusBar
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import axios from "axios";
import { getCurrentBaseUrl } from "../../src/services/api";

const { width } = Dimensions.get("window");

interface Tamanho {
  id: number;
  nome: string;
  preco: number;
}

interface Produto {
  id: number;
  nome: string;
  descricao: string | null;
  precoVenda: number;
  categoria: string;
  unidade: string;
  disponivel: boolean;
  temVariacao: boolean;
  imagem: string | null;
  tempoPreparoMinutos: number;
  categoriaId: number | null;
  temTamanhos: boolean;
  tamanhos: Tamanho[];
}

interface Categoria {
  id: number;
  nome: string;
  descricao: string | null;
  ativo: boolean;
}

interface ItemCarrinho {
  produtoId: number;
  produto: Produto;
  quantidade: number;
  tamanho: string | null;
  precoUnitario: number;
  subtotal: number;
  observacao: string;
}

export default function CardapioCliente() {
  const { mesaId } = useLocalSearchParams();
  const router = useRouter();

  // Estados
  const [loading, setLoading] = useState(true);
  const [loadingPedido, setLoadingPedido] = useState(false);
  const [mesaInfo, setMesaInfo] = useState<{ id: number; numero: number; nome: string } | null>(null);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [categoriaAtiva, setCategoriaAtiva] = useState<string>("Tudo");
  const [filtroTexto, setFiltroTexto] = useState<string>("");
  const [carrinho, setCarrinho] = useState<ItemCarrinho[]>([]);
  
  // Modais
  const [modalProduto, setModalProduto] = useState<Produto | null>(null);
  const [modalQuantidade, setModalQuantidade] = useState<number>(1);
  const [modalTamanho, setModalTamanho] = useState<string | null>(null);
  const [modalObservacao, setModalObservacao] = useState<string>("");
  const [mostrarCarrinho, setMostrarCarrinho] = useState<boolean>(false);
  const [pedidoSucesso, setPedidoSucesso] = useState<boolean>(false);
  const [debugError, setDebugError] = useState<string>("");
  const flatListRef = useRef<FlatList>(null);

  // Carregar dados iniciais da API
  useEffect(() => {
    carregarDados();
  }, [mesaId]);

  const carregarDados = async () => {
    setLoading(true);
    try {
      const baseUrl = getCurrentBaseUrl();
      const cleanUrl = baseUrl.replace(/\/$/, "");

      // 1. Buscar informações da mesa
      if (mesaId) {
        try {
          const resMesa = await axios.get(`${cleanUrl}/public/mesa/${mesaId}`);
          if (resMesa.data && resMesa.data.success) {
            setMesaInfo({
              id: resMesa.data.mesa.id,
              numero: resMesa.data.mesa.numero,
              nome: resMesa.data.mesa.nome
            });
          }
        } catch (err) {
          console.warn("Mesa não encontrada na API, usando ID da rota como fallback:", err);
          setMesaInfo({
            id: Number(mesaId),
            numero: Number(mesaId),
            nome: `Mesa ${mesaId}`
          });
        }
      }

      // 2. Buscar Cardápio (Produtos e Categorias)
      const resMenu = await axios.get(`${cleanUrl}/public/menu`);
      if (resMenu.data && resMenu.data.success) {
        setProdutos(resMenu.data.produtos || []);
        setCategorias(resMenu.data.categorias || []);
      }
    } catch (error: any) {
      console.error("Erro ao carregar dados do cardápio:", error);
      const baseUrl = getCurrentBaseUrl();
      setDebugError(`URL TENTADA: ${baseUrl}\nERRO: ${error.message || String(error)}`);
      Alert.alert(
        "Erro de Conexão",
        "Não foi possível carregar o cardápio eletrônico. Certifique-se de que está conectado ao Wi-Fi local do bar e tente novamente.",
        [{ text: "Tentar Novamente", onPress: carregarDados }]
      );
    } finally {
      setLoading(false);
    }
  };

  // Filtrar produtos
  const produtosFiltrados = produtos.filter((prod) => {
    const correspondeCategoria =
      categoriaAtiva === "Tudo" || prod.categoria === categoriaAtiva;
    const correspondeTexto =
      prod.nome.toLowerCase().includes(filtroTexto.toLowerCase()) ||
      (prod.descricao && prod.descricao.toLowerCase().includes(filtroTexto.toLowerCase()));
    return correspondeCategoria && correspondeTexto;
  });

  // Abrir detalhes do produto
  const abrirModalProduto = (prod: Produto) => {
    setModalProduto(prod);
    setModalQuantidade(1);
    setModalObservacao("");
    
    // Se o produto tiver tamanhos, seleciona o primeiro por padrão
    if (prod.temTamanhos && prod.tamanhos.length > 0) {
      setModalTamanho(prod.tamanhos[0].nome);
    } else {
      setModalTamanho(null);
    }
  };

  // Adicionar produto ao carrinho
  const adicionarAoCarrinho = () => {
    if (!modalProduto) return;

    // Calcular preço unitário dependendo do tamanho escolhido
    let precoUnitario = modalProduto.precoVenda;
    if (modalTamanho && modalProduto.temTamanhos) {
      const sizeObj = modalProduto.tamanhos.find(t => t.nome === modalTamanho);
      if (sizeObj) {
        precoUnitario = sizeObj.preco;
      }
    }

    const subtotal = precoUnitario * modalQuantidade;

    const novoItem: ItemCarrinho = {
      produtoId: modalProduto.id,
      produto: modalProduto,
      quantidade: modalQuantidade,
      tamanho: modalTamanho,
      precoUnitario,
      subtotal,
      observacao: modalObservacao.trim()
    };

    // Verificar se já existe um item idêntico no carrinho (mesmo produto e mesmo tamanho)
    const indexExistente = carrinho.findIndex(
      (item) => item.produtoId === modalProduto.id && item.tamanho === modalTamanho
    );

    if (indexExistente > -1) {
      const novoCarrinho = [...carrinho];
      const item = novoCarrinho[indexExistente];
      item.quantidade += modalQuantidade;
      item.subtotal = item.quantidade * item.precoUnitario;
      // Mesclar observações se houver novas
      if (novoItem.observacao) {
        item.observacao = item.observacao 
          ? `${item.observacao} | ${novoItem.observacao}` 
          : novoItem.observacao;
      }
      setCarrinho(novoCarrinho);
    } else {
      setCarrinho([...carrinho, novoItem]);
    }

    setModalProduto(null);
    
    // Exibe aviso flutuante ou micro-alerta de sucesso (feedback CRUD de sucesso)
    if (Platform.OS === 'web') {
      console.log("Sucesso: Item adicionado ao carrinho!");
    }
  };

  // Atualizar quantidade de um item na sacola
  const alterarQuantidadeSacola = (index: number, delta: number) => {
    const novoCarrinho = [...carrinho];
    const item = novoCarrinho[index];
    const novaQtd = item.quantidade + delta;
    
    if (novaQtd <= 0) {
      novoCarrinho.splice(index, 1);
    } else {
      item.quantidade = novaQtd;
      item.subtotal = novaQtd * item.precoUnitario;
    }
    setCarrinho(novoCarrinho);
  };

  // Calcular totais
  const totalItens = carrinho.reduce((sum, item) => sum + item.quantidade, 0);
  const valorTotal = carrinho.reduce((sum, item) => sum + item.subtotal, 0);

  // Enviar Pedido para a Cozinha
  const enviarPedido = async () => {
    if (!mesaInfo) return;
    setLoadingPedido(true);
    try {
      const baseUrl = getCurrentBaseUrl();
      const cleanUrl = baseUrl.replace(/\/$/, "");

      const payload = {
        mesaId: mesaInfo.id,
        itens: carrinho.map((item) => ({
          produtoId: item.produtoId,
          quantidade: item.quantidade,
          tamanho: item.tamanho,
          observacao: item.observacao
        }))
      };

      const response = await axios.post(`${cleanUrl}/public/pedido`, payload);

      if (response.data && response.data.success) {
        setCarrinho([]); // Limpar carrinho
        setMostrarCarrinho(false);
        setPedidoSucesso(true);
      } else {
        throw new Error(response.data.error || "Falha desconhecida");
      }
    } catch (error: any) {
      console.error("Erro ao enviar pedido para o servidor local:", error);
      Alert.alert(
        "Erro ao Lançar Pedido",
        error.message || "Ocorreu um erro ao enviar o seu pedido. Por favor, avise um garçom se o problema persistir."
      );
    } finally {
      setLoadingPedido(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF8C00" />
        <Text style={styles.loadingText}>Carregando cardápio appBarCash...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1A1A1A" />
      
      {/* HEADER PREMIUM */}
      <View style={styles.header}>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>appBarCash 🍻</Text>
          <View style={styles.mesaBadge}>
            <Ionicons name="restaurant" size={14} color="#FFF" style={{ marginRight: 4 }} />
            <Text style={styles.mesaBadgeText}>
              {mesaInfo ? `MESA ${String(mesaInfo.numero).padStart(2, "0")}` : "MESA DIGITAL"}
            </Text>
          </View>
        </View>
        <Text style={styles.headerSubtitle}>Auto-atendimento prático e sem filas</Text>
      </View>

      {/* BUSCA E FILTROS */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={20} color="#888" style={{ marginRight: 8 }} />
          <TextInput
            placeholder="O que você deseja pedir hoje?"
            placeholderTextColor="#888"
            style={styles.searchInput}
            value={filtroTexto}
            onChangeText={setFiltroTexto}
          />
          {filtroTexto.length > 0 && (
            <TouchableOpacity onPress={() => setFiltroTexto("")}>
              <Ionicons name="close-circle" size={18} color="#888" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ROLAGEM DE CATEGORIAS */}
      <View style={styles.categoriasContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriasScroll}
        >
          <TouchableOpacity
            style={[
              styles.categoriaBtn,
              categoriaAtiva === "Tudo" && styles.categoriaBtnAtivo
            ]}
            onPress={() => setCategoriaAtiva("Tudo")}
          >
            <Text
              style={[
                styles.categoriaBtnText,
                categoriaAtiva === "Tudo" && styles.categoriaBtnTextAtivo
              ]}
            >
              🎉 Tudo
            </Text>
          </TouchableOpacity>
          {categorias.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              style={[
                styles.categoriaBtn,
                categoriaAtiva === cat.nome && styles.categoriaBtnAtivo
              ]}
              onPress={() => setCategoriaAtiva(cat.nome)}
            >
              <Text
                style={[
                  styles.categoriaBtnText,
                  categoriaAtiva === cat.nome && styles.categoriaBtnTextAtivo
                ]}
              >
                🍽️ {cat.nome}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* CATÁLOGO DE PRODUTOS */}
      <FlatList
        ref={flatListRef}
        data={produtosFiltrados}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name={debugError ? "warning-outline" : "sad-outline"} size={48} color={debugError ? "#FF4444" : "#666"} />
            <Text style={[styles.emptyText, debugError ? { color: '#FF4444', textAlign: 'center', marginTop: 10 } : {}]}>
              {debugError ? `🚨 ERRO:\n${debugError}` : "Nenhum produto disponível nesta categoria."}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => abrirModalProduto(item)}>
            <View style={styles.cardInfo}>
              <Text style={styles.cardNome}>{item.nome}</Text>
              <Text style={styles.cardDesc} numberOfLines={2}>
                {item.descricao || "Sem descrição disponível."}
              </Text>
              <View style={styles.cardPrecoContainer}>
                <Text style={styles.cardPreco}>
                  R$ {item.precoVenda.toFixed(2)}
                </Text>
                {item.unidade !== "un" && (
                  <Text style={styles.cardUnidade}>/ {item.unidade}</Text>
                )}
                {item.temTamanhos && (
                  <View style={styles.tamanhosBadge}>
                    <Text style={styles.tamanhosBadgeText}>Opções</Text>
                  </View>
                )}
              </View>
            </View>
            
            <View style={styles.cardImageContainer}>
              {item.imagem ? (
                <Image source={{ uri: item.imagem }} style={styles.cardImage} />
              ) : (
                <View style={styles.cardPlaceholderImage}>
                  <Ionicons name="fast-food-outline" size={32} color="#FF8C00" />
                </View>
              )}
              <TouchableOpacity
                style={styles.addBtn}
                onPress={() => abrirModalProduto(item)}
              >
                <Ionicons name="add" size={20} color="#FFF" />
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        )}
      />

      {/* SACOLA DE COMPRAS FLUTUANTE (Vem debaixo) */}
      {totalItens > 0 && (
        <TouchableOpacity
          style={styles.sacolaFlutuante}
          onPress={() => setMostrarCarrinho(true)}
        >
          <View style={styles.sacolaInfo}>
            <View style={styles.sacolaBadge}>
              <Text style={styles.sacolaBadgeText}>{totalItens}</Text>
            </View>
            <Text style={styles.sacolaTexto}>Ver Sacola</Text>
          </View>
          <Text style={styles.sacolaValor}>R$ {valorTotal.toFixed(2)}</Text>
        </TouchableOpacity>
      )}

      {/* MODAL: DETALHES DO PRODUTO (Customizar tamanho, quantidade e obs) */}
      <Modal
        visible={modalProduto !== null}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalProduto(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            {modalProduto && (
              <>
                {/* Header */}
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle} numberOfLines={2}>{modalProduto.nome}</Text>
                  <TouchableOpacity onPress={() => setModalProduto(null)} style={styles.closeModalBtn}>
                    <Ionicons name="close" size={24} color="#FFF" />
                  </TouchableOpacity>
                </View>

                <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
                  {/* Imagem do Produto no Modal */}
                  {modalProduto.imagem ? (
                    <Image source={{ uri: modalProduto.imagem }} style={styles.modalImage} />
                  ) : (
                    <View style={styles.modalPlaceholderImage}>
                      <Ionicons name="fast-food-outline" size={64} color="#FF8C00" />
                    </View>
                  )}

                  {/* Descrição */}
                  <View style={styles.modalSection}>
                    <Text style={styles.modalDesc}>
                      {modalProduto.descricao || "Ingredientes selecionados e preparados com o maior capricho da casa."}
                    </Text>
                    {modalProduto.tempoPreparoMinutos > 0 && (
                      <View style={styles.tempoPreparoBadge}>
                        <Ionicons name="time-outline" size={14} color="#FF8C00" style={{ marginRight: 4 }} />
                        <Text style={styles.tempoPreparoText}>Preparo: ~{modalProduto.tempoPreparoMinutos} min</Text>
                      </View>
                    )}
                  </View>

                  {/* TAMANHOS (Se aplicável) */}
                  {modalProduto.temTamanhos && modalProduto.tamanhos.length > 0 && (
                    <View style={styles.modalSection}>
                      <Text style={styles.modalSectionTitle}>Escolha o tamanho:</Text>
                      <View style={styles.tamanhosContainer}>
                        {modalProduto.tamanhos.map((t) => (
                          <TouchableOpacity
                            key={t.id}
                            style={[
                              styles.tamanhoOpcao,
                              modalTamanho === t.nome && styles.tamanhoOpcaoAtiva
                            ]}
                            onPress={() => setModalTamanho(t.nome)}
                          >
                            <Text
                              style={[
                                styles.tamanhoOpcaoText,
                                modalTamanho === t.nome && styles.tamanhoOpcaoTextAtiva
                              ]}
                            >
                              {t.nome}
                            </Text>
                            <Text
                              style={[
                                styles.tamanhoOpcaoPreco,
                                modalTamanho === t.nome && styles.tamanhoOpcaoPrecoAtiva
                              ]}
                            >
                              R$ {t.preco.toFixed(2)}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  )}

                  {/* INSTRUÇÕES / OBSERVAÇÃO */}
                  <View style={styles.modalSection}>
                    <Text style={styles.modalSectionTitle}>Observações adicionais:</Text>
                    <TextInput
                      placeholder="Ex: sem cebola, ponto da carne bem passado, etc."
                      placeholderTextColor="#666"
                      style={styles.obsInput}
                      multiline
                      numberOfLines={3}
                      value={modalObservacao}
                      onChangeText={setModalObservacao}
                    />
                  </View>
                </ScrollView>

                {/* Footer do Modal (Quantidade e Botão de Adicionar) */}
                <View style={styles.modalFooter}>
                  <View style={styles.quantidadeContainer}>
                    <TouchableOpacity
                      style={styles.qtdBtn}
                      onPress={() => setModalQuantidade(Math.max(1, modalQuantidade - 1))}
                    >
                      <Ionicons name="remove" size={20} color="#FFF" />
                    </TouchableOpacity>
                    <Text style={styles.qtdText}>{modalQuantidade}</Text>
                    <TouchableOpacity
                      style={styles.qtdBtn}
                      onPress={() => setModalQuantidade(modalQuantidade + 1)}
                    >
                      <Ionicons name="add" size={20} color="#FFF" />
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity style={styles.modalAddBtn} onPress={adicionarAoCarrinho}>
                    <Text style={styles.modalAddBtnText}>Adicionar à Sacola</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* MODAL: SACOLA / CARRINHO DE COMPRAS COMPLETO */}
      <Modal
        visible={mostrarCarrinho}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setMostrarCarrinho(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="cart-outline" size={24} color="#FF8C00" style={{ marginRight: 8 }} />
                <Text style={styles.modalTitle}>Minha Sacola</Text>
              </View>
              <TouchableOpacity onPress={() => setMostrarCarrinho(false)} style={styles.closeModalBtn}>
                <Ionicons name="close" size={24} color="#FFF" />
              </TouchableOpacity>
            </View>

            {carrinho.length === 0 ? (
              <View style={[styles.emptyContainer, { flex: 1, justifyContent: 'center' }]}>
                <Ionicons name="cart-outline" size={64} color="#444" />
                <Text style={styles.emptyText}>Sua sacola está vazia.</Text>
              </View>
            ) : (
              <>
                <FlatList
                  data={carrinho}
                  keyExtractor={(item, index) => `${item.produtoId}-${item.tamanho}-${index}`}
                  contentContainerStyle={styles.sacolaItensList}
                  renderItem={({ item, index }) => (
                    <View style={styles.sacolaItemCard}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.sacolaItemNome}>
                          {item.produto.nome}
                          {item.tamanho ? ` (${item.tamanho})` : ""}
                        </Text>
                        {item.observacao.length > 0 && (
                          <Text style={styles.sacolaItemObs}>
                            📝 {item.observacao}
                          </Text>
                        )}
                        <Text style={styles.sacolaItemPreco}>
                          R$ {item.precoUnitario.toFixed(2)} x {item.quantidade}
                        </Text>
                      </View>

                      <View style={{ alignItems: 'flex-end', marginLeft: 8 }}>
                        <Text style={styles.sacolaItemSubtotal}>
                          R$ {item.subtotal.toFixed(2)}
                        </Text>
                        <View style={[styles.quantidadeContainer, { marginTop: 8 }]}>
                          <TouchableOpacity
                            style={[styles.qtdBtn, { width: 28, height: 28 }]}
                            onPress={() => alterarQuantidadeSacola(index, -1)}
                          >
                            <Ionicons name="remove" size={16} color="#FFF" />
                          </TouchableOpacity>
                          <Text style={[styles.qtdText, { fontSize: 14, marginHorizontal: 8 }]}>
                            {item.quantidade}
                          </Text>
                          <TouchableOpacity
                            style={[styles.qtdBtn, { width: 28, height: 28 }]}
                            onPress={() => alterarQuantidadeSacola(index, 1)}
                          >
                            <Ionicons name="add" size={16} color="#FFF" />
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  )}
                />

                <View style={styles.sacolaFooter}>
                  <View style={styles.resumoLinha}>
                    <Text style={styles.resumoLabel}>Resumo da Sacola:</Text>
                    <Text style={styles.resumoValor}>{totalItens} {totalItens === 1 ? 'item' : 'itens'}</Text>
                  </View>
                  <View style={styles.resumoLinha}>
                    <Text style={styles.resumoTotalLabel}>Total a Pagar:</Text>
                    <Text style={styles.resumoTotalValor}>R$ {valorTotal.toFixed(2)}</Text>
                  </View>

                  <TouchableOpacity
                    style={[styles.enviarPedidoBtn, loadingPedido && { opacity: 0.7 }]}
                    onPress={enviarPedido}
                    disabled={loadingPedido}
                  >
                    {loadingPedido ? (
                      <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                      <>
                        <Ionicons name="paper-plane" size={20} color="#FFF" style={{ marginRight: 8 }} />
                        <Text style={styles.enviarPedidoBtnText}>Enviar Pedido para a Cozinha</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* MODAL: SUCESSO DE PEDIDO (Feedback premium visual) */}
      <Modal
        visible={pedidoSucesso}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setPedidoSucesso(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.sucessoContainer}>
            <View style={styles.sucessoIconContainer}>
              <Ionicons name="checkmark-circle" size={80} color="#32CD32" />
            </View>
            <Text style={styles.sucessoTitle}>Pedido Enviado com Sucesso! 🎉</Text>
            <Text style={styles.sucessoDesc}>
              O seu pedido já foi cadastrado na comanda da mesa e enviado diretamente para a cozinha/bar para produção.
            </Text>
            <Text style={styles.sucessoMesaText}>
              {mesaInfo ? `Mesa ${String(mesaInfo.numero).padStart(2, "0")}` : "Mesa Cadastrada"}
            </Text>
            
            <TouchableOpacity
              style={styles.sucessoBtn}
              onPress={() => setPedidoSucesso(false)}
            >
              <Text style={styles.sucessoBtnText}>Pedir Mais Coisas</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212"
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: "#121212",
    justifyContent: "center",
    alignItems: "center"
  },
  loadingText: {
    color: "#FFF",
    marginTop: 12,
    fontSize: 16,
    fontWeight: "bold"
  },
  header: {
    padding: 16,
    backgroundColor: "#1A1A1A",
    borderBottomWidth: 1,
    borderBottomColor: "#2A2A2A"
  },
  headerInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#FF8C00"
  },
  mesaBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FF8C00",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20
  },
  mesaBadgeText: {
    color: "#FFF",
    fontWeight: "bold",
    fontSize: 12
  },
  headerSubtitle: {
    color: "#888",
    fontSize: 13,
    marginTop: 4
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 6
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#222",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#333"
  },
  searchInput: {
    flex: 1,
    color: "#FFF",
    fontSize: 14,
    padding: 0
  },
  categoriasContainer: {
    paddingVertical: 8
  },
  categoriasScroll: {
    paddingHorizontal: 16
  },
  categoriaBtn: {
    backgroundColor: "#222",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: "#333"
  },
  categoriaBtnAtivo: {
    backgroundColor: "#FF8C00",
    borderColor: "#FF8C00"
  },
  categoriaBtnText: {
    color: "#AAA",
    fontSize: 13,
    fontWeight: "600"
  },
  categoriaBtnTextAtivo: {
    color: "#FFF",
    fontWeight: "bold"
  },
  listContent: {
    padding: 16,
    paddingBottom: 90
  },
  card: {
    flexDirection: "row",
    backgroundColor: "#1A1A1A",
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#2A2A2A"
  },
  cardInfo: {
    flex: 1,
    justifyContent: "space-between",
    marginRight: 8
  },
  cardNome: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "bold"
  },
  cardDesc: {
    color: "#888",
    fontSize: 12,
    marginTop: 4,
    lineHeight: 16
  },
  cardPrecoContainer: {
    flexDirection: "row",
    alignItems: "baseline",
    marginTop: 8
  },
  cardPreco: {
    color: "#FF8C00",
    fontSize: 16,
    fontWeight: "bold"
  },
  cardUnidade: {
    color: "#888",
    fontSize: 12,
    marginLeft: 4
  },
  tamanhosBadge: {
    backgroundColor: "#222",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
    borderWidth: 1,
    borderColor: "#444"
  },
  tamanhosBadgeText: {
    color: "#AAA",
    fontSize: 10,
    fontWeight: "bold"
  },
  cardImageContainer: {
    position: "relative",
    width: 90,
    height: 90,
    borderRadius: 8,
    overflow: "hidden"
  },
  cardImage: {
    width: "100%",
    height: "100%"
  },
  cardPlaceholderImage: {
    width: "100%",
    height: "100%",
    backgroundColor: "#222",
    justifyContent: "center",
    alignItems: "center"
  },
  addBtn: {
    position: "absolute",
    bottom: 4,
    right: 4,
    backgroundColor: "#FF8C00",
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 1
  },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: 40
  },
  emptyText: {
    color: "#666",
    marginTop: 8,
    fontSize: 14,
    textAlign: "center"
  },
  sacolaFlutuante: {
    position: "absolute",
    bottom: 20,
    left: 16,
    right: 16,
    backgroundColor: "#FF8C00",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 30,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4
  },
  sacolaInfo: {
    flexDirection: "row",
    alignItems: "center"
  },
  sacolaBadge: {
    backgroundColor: "#FFF",
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8
  },
  sacolaBadgeText: {
    color: "#FF8C00",
    fontWeight: "bold",
    fontSize: 12
  },
  sacolaTexto: {
    color: "#FFF",
    fontWeight: "bold",
    fontSize: 15
  },
  sacolaValor: {
    color: "#FFF",
    fontWeight: "bold",
    fontSize: 15
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    justifyContent: "flex-end"
  },
  modalContainer: {
    backgroundColor: "#1A1A1A",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: "85%",
    paddingBottom: 20
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#2A2A2A"
  },
  modalTitle: {
    color: "#FFF",
    fontSize: 18,
    fontWeight: "bold",
    flex: 1
  },
  closeModalBtn: {
    padding: 4
  },
  modalScroll: {
    flex: 1,
    padding: 16
  },
  modalImage: {
    width: "100%",
    height: 180,
    borderRadius: 12,
    marginBottom: 16
  },
  modalPlaceholderImage: {
    width: "100%",
    height: 140,
    backgroundColor: "#222",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 12,
    marginBottom: 16
  },
  modalSection: {
    marginBottom: 20
  },
  modalDesc: {
    color: "#AAA",
    fontSize: 14,
    lineHeight: 20
  },
  tempoPreparoBadge: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8
  },
  tempoPreparoText: {
    color: "#FF8C00",
    fontSize: 12,
    fontWeight: "600"
  },
  modalSectionTitle: {
    color: "#FFF",
    fontSize: 15,
    fontWeight: "bold",
    marginBottom: 10
  },
  tamanhosContainer: {
    flexDirection: "row",
    flexWrap: "wrap"
  },
  tamanhoOpcao: {
    backgroundColor: "#222",
    borderWidth: 1,
    borderColor: "#333",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    marginRight: 8,
    marginBottom: 8,
    alignItems: "center",
    minWidth: 80
  },
  tamanhoOpcaoAtiva: {
    backgroundColor: "#FF8C00",
    borderColor: "#FF8C00"
  },
  tamanhoOpcaoText: {
    color: "#AAA",
    fontSize: 13,
    fontWeight: "bold"
  },
  tamanhoOpcaoTextAtiva: {
    color: "#FFF"
  },
  tamanhoOpcaoPreco: {
    color: "#888",
    fontSize: 11,
    marginTop: 2
  },
  tamanhoOpcaoPrecoAtiva: {
    color: "#FFF"
  },
  obsInput: {
    backgroundColor: "#222",
    color: "#FFF",
    borderWidth: 1,
    borderColor: "#333",
    borderRadius: 8,
    padding: 10,
    fontSize: 13,
    textAlignVertical: "top",
    height: 70
  },
  modalFooter: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "#2A2A2A",
    paddingHorizontal: 16,
    paddingTop: 16,
    alignItems: "center"
  },
  quantidadeContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#222",
    borderRadius: 20,
    paddingHorizontal: 4,
    paddingVertical: 4
  },
  qtdBtn: {
    backgroundColor: "#FF8C00",
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center"
  },
  qtdText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "bold",
    marginHorizontal: 14
  },
  modalAddBtn: {
    flex: 1,
    backgroundColor: "#FF8C00",
    paddingVertical: 12,
    borderRadius: 20,
    alignItems: "center",
    marginLeft: 16
  },
  modalAddBtnText: {
    color: "#FFF",
    fontSize: 15,
    fontWeight: "bold"
  },
  sacolaItensList: {
    padding: 16
  },
  sacolaItemCard: {
    flexDirection: "row",
    backgroundColor: "#222",
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#333",
    justifyContent: "space-between",
    alignItems: "center"
  },
  sacolaItemNome: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "bold"
  },
  sacolaItemObs: {
    color: "#FF8C00",
    fontSize: 11,
    marginTop: 2
  },
  sacolaItemPreco: {
    color: "#888",
    fontSize: 12,
    marginTop: 4
  },
  sacolaItemSubtotal: {
    color: "#FF8C00",
    fontSize: 15,
    fontWeight: "bold"
  },
  sacolaFooter: {
    borderTopWidth: 1,
    borderTopColor: "#2A2A2A",
    padding: 16
  },
  resumoLinha: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8
  },
  resumoLabel: {
    color: "#888",
    fontSize: 13
  },
  resumoValor: {
    color: "#FFF",
    fontSize: 13,
    fontWeight: "bold"
  },
  resumoTotalLabel: {
    color: "#FFF",
    fontSize: 15,
    fontWeight: "bold"
  },
  resumoTotalValor: {
    color: "#FF8C00",
    fontSize: 18,
    fontWeight: "bold"
  },
  enviarPedidoBtn: {
    backgroundColor: "#32CD32",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 14,
    borderRadius: 25,
    marginTop: 16
  },
  enviarPedidoBtnText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "bold"
  },
  sucessoContainer: {
    backgroundColor: "#1A1A1A",
    marginHorizontal: 20,
    padding: 24,
    borderRadius: 20,
    alignItems: "center",
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4
  },
  sucessoIconContainer: {
    marginBottom: 16
  },
  sucessoTitle: {
    color: "#FFF",
    fontSize: 20,
    fontWeight: "bold",
    textAlign: "center"
  },
  sucessoDesc: {
    color: "#AAA",
    fontSize: 14,
    textAlign: "center",
    marginTop: 10,
    lineHeight: 20
  },
  sucessoMesaText: {
    color: "#FF8C00",
    fontSize: 16,
    fontWeight: "bold",
    marginTop: 12,
    backgroundColor: "rgba(255, 140, 0, 0.1)",
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 12
  },
  sucessoBtn: {
    backgroundColor: "#FF8C00",
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 20,
    marginTop: 20
  },
  sucessoBtnText: {
    color: "#FFF",
    fontWeight: "bold",
    fontSize: 14
  }
});
