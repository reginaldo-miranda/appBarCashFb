/* import mongoose from 'mongoose';

const mesaSchema = new mongoose.Schema({
  numero: {
    type: String,
    required: true,
    unique: true
  },
  nome: {
    type: String,
    required: true
  },
  capacidade: {
    type: Number,
    required: true,
    min: 1
  },
  status: {
    type: String,
    enum: ['livre', 'ocupada', 'reservada', 'manutencao'],
    default: 'livre'
  },
  vendaAtual: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Sale',
    default: null
  },
  funcionarioResponsavel: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    default: null
  },
  nomeResponsavel: {
    type: String,
    maxlength: 100
  },
  clientesAtuais: {
    type: Number,
    default: 0
  },
  horaAbertura: {
    type: Date
  },
  observacoes: {
    type: String,
    maxlength: 200
  },
  tipo: {
    type: String,
    enum: ['interna', 'externa', 'vip', 'reservada', 'balcao'],
    default: 'interna'
  },
  ativo: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Método para abrir mesa
mesaSchema.methods.abrir = function(numeroClientes = 1) {
  this.status = 'ocupada';
  this.clientesAtuais = numeroClientes;
  this.horaAbertura = new Date();
  return this.save();
};

// Método para fechar mesa
mesaSchema.methods.fechar = function() {
  this.status = 'livre';
  this.vendaAtual = null;
  this.funcionarioResponsavel = null;
  this.nomeResponsavel = '';
  this.clientesAtuais = 0;
  this.horaAbertura = null;
  this.observacoes = '';
  return this.save();
};

// Método para calcular tempo de ocupação
mesaSchema.methods.tempoOcupacao = function() {
  if (!this.horaAbertura) return 0;
  return Math.floor((new Date() - this.horaAbertura) / (1000 * 60)); // em minutos
};

export default mongoose.model('Mesa', mesaSchema);
*/

import { useEffect, useState } from "react";
import api from "../services/api"; // seu axios configurado

export default function Mesas() {
  const [mesas, setMesas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");

  // ==========================
  //  BUSCAR MESAS
  // ==========================
  async function loadMesas() {
    try {
      setLoading(true);
      const token = (typeof window !== 'undefined' ? window.localStorage?.getItem('authToken') : '') || '';
      const res = await api.get("/mesa/list", { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      setMesas(res.data);
    } catch (err) {
      console.log(err);
      setErro("Erro ao carregar mesas");
    } finally {
      setLoading(false);
    }
  }

  // Carrega mesas ao abrir a página
  useEffect(() => {
    loadMesas();
  }, []);

  // ==========================
  //  ABRIR MESA
  // ==========================
  async function abrirMesa(id) {
    try {
      const token = (typeof window !== 'undefined' ? window.localStorage?.getItem('authToken') : '') || '';
      await api.post(`/mesa/${id}/abrir`, {
        funcionarioId: 1, // você ajusta isso
        numeroClientes: 1,
      }, { headers: token ? { Authorization: `Bearer ${token}` } : {} });

      // ATUALIZA AUTOMATICAMENTE
      await loadMesas();
    } catch (err) {
      alert(err.response?.data?.message || "Erro ao abrir mesa");
    }
  }

  // ==========================
  //  FECHAR MESA
  // ==========================
  async function fecharMesa(id) {
    try {
      const token = (typeof window !== 'undefined' ? window.localStorage?.getItem('authToken') : '') || '';
      await api.post(`/mesa/${id}/fechar`, {}, { headers: token ? { Authorization: `Bearer ${token}` } : {} });

      // ATUALIZA AUTOMATICAMENTE
      await loadMesas();
    } catch (err) {
      alert(err.response?.data?.message || "Erro ao fechar mesa");
    }
  }

  useEffect(() => {
    let es;
    let poll;
    const schedule = () => { try { loadMesas(); } catch {} };
    try {
      if (typeof window !== 'undefined' && (window).EventSource) {
        es = new (window).EventSource('/api/sale/stream');
        es.onmessage = async (evt) => {
          try {
            const msg = JSON.parse(String(evt?.data || '{}'));
            if (msg?.type === 'sale:update') await schedule();
          } catch {}
        };
        es.onerror = () => { try { es.close(); } catch {} };
      }
    } catch {}
    poll = setInterval(schedule, 2000);
    return () => { try { es && es.close && es.close(); } catch {}; try { poll && clearInterval(poll); } catch {} };
  }, []);

  // ==========================
  //  RENDER
  // ==========================
  return (
    <div style={{ padding: 20 }}>
      <h2>Mesas</h2>

      {loading && <p>Carregando mesas...</p>}
      {erro && <p style={{ color: "red" }}>{erro}</p>}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 20 }}>
        {mesas.map((mesa) => (
          <div
            key={mesa.id}
            style={{
              width: 180,
              padding: 15,
              borderRadius: 10,
              background: mesa.status === "ocupada" ? "#ffdddd" : "#ddffdd",
              border: "1px solid #aaa",
            }}
          >
            <h3>Mesa {mesa.numero}</h3>
            <p>Status: <b>{mesa.status}</b></p>

            {mesa.status === "ocupada" && (
              <>
                <p>Clientes: {mesa.clientesAtuais}</p>
                <p>Responsável: {mesa.funcionarioResponsavel?.nome}</p>
              </>
            )}

            <div style={{ marginTop: 10 }}>
              {mesa.status === "livre" ? (
                <button onClick={() => abrirMesa(mesa.id)}>Abrir</button>
              ) : (
                <button onClick={() => fecharMesa(mesa.id)}>Fechar</button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
