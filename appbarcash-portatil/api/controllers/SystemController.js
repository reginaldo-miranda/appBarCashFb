import fs from 'fs';
import path from 'path';
import os from 'os';

export const listDirectories = async (req, res) => {
    try {
        console.log('[SystemController] Listando diretórios...');
        const queryPath = req.query.path || os.homedir(); 
        console.log('[SystemController] Path:', queryPath);
        
        if (!fs.existsSync(queryPath)) {
            console.error('[SystemController] Caminho não existe:', queryPath);
            return res.status(404).json({ error: 'Caminho não encontrado' });
        }

        const items = fs.readdirSync(queryPath, { withFileTypes: true });

        const directories = items
            .filter(item => item.isDirectory() && !item.name.startsWith('.'))
            .map(item => ({
                name: item.name,
                path: path.join(queryPath, item.name),
                type: 'directory'
            }));
            
        // Add ".." option
        const parent = path.dirname(queryPath);
        if (parent !== queryPath) {
             directories.unshift({
                name: '.. (Voltar)',
                path: parent,
                type: 'parent'
            });
        }
        
        console.log(`[SystemController] Encontrados ${directories.length} itens.`);

        res.json({
            currentPath: queryPath,
            directories
        });

    } catch (error) {
        console.error('Erro ao listar diretórios:', error);
        res.status(500).json({ error: 'Erro ao listar diretórios: ' + error.message });
    }
};
