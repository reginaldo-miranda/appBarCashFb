import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Employee from '../models/Employee.js';
import Caixa from '../models/Caixa.js';

dotenv.config();
const MONGODB_URI = process.env.MONGO_URI;

async function checkAndOpenCaixa() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Conectado ao MongoDB');

    // Verificar se existe caixa aberto
    const caixaAberto = await Caixa.findOne({ status: 'aberto' });
    if (caixaAberto) {
      console.log('✅ Já existe um caixa aberto:', caixaAberto._id);
      return;
    }

    // Verificar funcionários
    const employees = await Employee.find();
    console.log(`📊 Funcionários encontrados: ${employees.length}`);

    if (employees.length === 0) {
      // Criar funcionário padrão
      const funcionarioPadrao = new Employee({
        nome: 'Administrador',
        email: 'admin@bar.com',
        telefone: '(00) 00000-0000',
        cargo: 'Gerente',
        salario: 0,
        dataAdmissao: new Date(),
        status: 'ativo'
      });
      
      await funcionarioPadrao.save();
      console.log('✅ Funcionário padrão criado:', funcionarioPadrao._id);
      
      // Usar o funcionário recém-criado
      const funcionarioId = funcionarioPadrao._id;
      
      // Criar caixa
      const novoCaixa = new Caixa({
        funcionarioAbertura: funcionarioId,
        valorAbertura: 0,
        observacoes: 'Caixa aberto automaticamente pelo sistema'
      });

      await novoCaixa.save();
      console.log('✅ Caixa aberto automaticamente:', novoCaixa._id);
    } else {
      // Usar primeiro funcionário existente
      const funcionarioId = employees[0]._id;
      console.log('👤 Usando funcionário:', employees[0].nome);
      
      // Criar caixa
      const novoCaixa = new Caixa({
        funcionarioAbertura: funcionarioId,
        valorAbertura: 0,
        observacoes: 'Caixa aberto automaticamente pelo sistema'
      });

      await novoCaixa.save();
      console.log('✅ Caixa aberto automaticamente:', novoCaixa._id);
    }

  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Desconectado do MongoDB');
  }
}

checkAndOpenCaixa();