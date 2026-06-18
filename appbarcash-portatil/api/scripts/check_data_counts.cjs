const mysql = require('mysql2/promise');

async function checkDataCounts() {
  const config = {
    host: 'localhost',
    user: 'root',
    password: 'saguides@123',
    database: 'appbar',
    port: 3307
  };

  console.log('--- Verificando contagem de registros (MariaDB 3307) ---');
  
  try {
    const connection = await mysql.createConnection(config);
    
    // Listar todas as tabelas
    const [tables] = await connection.execute('SHOW TABLES');
    
    if (tables.length === 0) {
        console.log('Nenhuma tabela encontrada no banco "appbar".');
        await connection.end();
        return;
    }

    console.log(`Encontradas ${tables.length} tabelas. Contando registros...`);
    
    const tableKey = Object.keys(tables[0])[0]; // "Tables_in_appbar"
    
    for (const row of tables) {
        const tableName = row[tableKey];
        try {
            const [rows] = await connection.execute(`SELECT COUNT(*) as c FROM \`${tableName}\``);
            const count = rows[0].c;
            
            // Destacar tabelas importantes
            let marker = '';
            if (['user', 'employee', 'product', 'customer', 'sale'].includes(tableName.toLowerCase())) {
                marker = ' <--- IMPORTANTE';
            }
            
            console.log(`- ${tableName}: ${count}${marker}`);
        } catch (err) {
            console.log(`- ${tableName}: Erro ao ler (${err.message})`);
        }
    }

    await connection.end();

  } catch (err) {
    console.error('Erro geral:', err.message);
  }
}

checkDataCounts();