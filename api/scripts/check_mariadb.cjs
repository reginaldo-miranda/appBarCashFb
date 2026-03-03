const mysql = require('mysql2/promise');

async function checkMariaDB() {
  const config = {
    host: '127.0.0.1',
    user: 'root',
    password: 'saguides@123',
    port: 3307 // Porta padrão sugerida no .env anterior para MariaDB
  };

  console.log('--- Verificando MariaDB na porta 3307 ---');
  try {
    const connection = await mysql.createConnection(config);
    
    // 1. Versão
    const [version] = await connection.execute('SELECT VERSION() as v');
    console.log(`Versão: ${version[0].v}`);

    // 2. Bancos de Dados
    const [dbs] = await connection.execute('SHOW DATABASES');
    console.log('Bancos de dados encontrados:');
    dbs.forEach(db => console.log(` - ${db.Database}`));

    // 3. Verificar se appBar existe e tem tabelas
    if (dbs.find(d => d.Database === 'appBar')) {
        console.log('\nBanco "appBar" encontrado. Verificando tabelas...');
        await connection.changeUser({ database: 'appBar' });
        const [tables] = await connection.execute('SHOW TABLES');
        console.log(`Total de tabelas em appBar: ${tables.length}`);
        if (tables.length > 0) {
            const [users] = await connection.execute('SELECT count(*) as c FROM User');
            console.log(`Registros na tabela User: ${users[0].c}`);
        }
    } else {
        console.log('\nBanco "appBar" NÃO encontrado.');
    }

    await connection.end();
    console.log('\nConexão bem sucedida.');
    return true;

  } catch (err) {
    console.error('Erro ao conectar no MariaDB:', err.message);
    if (err.code === 'ECONNREFUSED') {
        console.log('Dica: Verifique se o serviço MariaDB está rodando.');
    }
    return false;
  }
}

checkMariaDB();
