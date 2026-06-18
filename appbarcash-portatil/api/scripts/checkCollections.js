import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function checkCollections() {
  try {
    console.log('🔍 Conectando ao MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Conectado ao MongoDB');

    const db = mongoose.connection.db;
    
    // Listar todas as collections
    console.log('\n📋 Collections existentes:');
    const collections = await db.listCollections().toArray();
    
    if (collections.length === 0) {
      console.log('❌ Nenhuma collection encontrada no banco de dados');
    } else {
      collections.forEach((collection, index) => {
        console.log(`${index + 1}. ${collection.name}`);
      });
    }

    // Verificar collections específicas
    const requiredCollections = ['categorias', 'tipos', 'unidademedidas', 'products'];
    console.log('\n🔍 Verificando collections necessárias:');
    
    for (const collectionName of requiredCollections) {
      const exists = collections.some(col => col.name === collectionName);
      console.log(`${exists ? '✅' : '❌'} ${collectionName}: ${exists ? 'Existe' : 'Não existe'}`);
      
      if (exists) {
        const count = await db.collection(collectionName).countDocuments();
        console.log(`   📊 Documentos: ${count}`);
      }
    }

    // Testar permissões de escrita
    console.log('\n🔐 Testando permissões de escrita...');
    
    try {
      const testCollection = db.collection('test_permissions');
      const testDoc = { test: true, timestamp: new Date() };
      
      const result = await testCollection.insertOne(testDoc);
      console.log('✅ Permissão de escrita: OK');
      
      // Limpar o documento de teste
      await testCollection.deleteOne({ _id: result.insertedId });
      console.log('✅ Permissão de exclusão: OK');
      
    } catch (writeError) {
      console.log('❌ Erro de permissão de escrita:', writeError.message);
    }

  } catch (error) {
    console.error('❌ Erro ao verificar collections:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Desconectado do MongoDB');
  }
}

checkCollections();