import prisma from './lib/prisma.js';
import fs from 'fs';
import path from 'path';

async function debugXmlConfig() {
  try {
    const company = await prisma.company.findFirst();
    if (!company) {
      console.log('No company found in database.');
      return;
    }

    console.log('Company Config Found:');
    console.log(`- ID: ${company.id}`);
    console.log(`- xmlFolder: "${company.xmlFolder}"`);

    const xmlFolder = company.xmlFolder;

    if (!xmlFolder || xmlFolder.trim() === '') {
      console.log('xmlFolder is empty. System should be using default path.');
      return;
    }

    // Logic from Controller to test path resolution
    const now = new Date();
    const months = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
    const subfolder = `${months[now.getMonth()]}${now.getFullYear()}`;
    const targetDir = path.join(xmlFolder, subfolder);

    console.log(`Target Directory would be: "${targetDir}"`);

    // Test access to base folder
    try {
      if (fs.existsSync(xmlFolder)) {
        console.log(`Base folder "${xmlFolder}" exists.`);
        try {
          fs.accessSync(xmlFolder, fs.constants.W_OK);
          console.log(`Base folder "${xmlFolder}" is writable.`);
        } catch (e) {
            console.error(`Base folder "${xmlFolder}" is NOT writable:`, e.message);
        }
      } else {
        console.log(`Base folder "${xmlFolder}" does NOT exist.`);
        console.log('Attempting to create base folder...');
        try {
            fs.mkdirSync(xmlFolder, { recursive: true });
            console.log(`Base folder "${xmlFolder}" created successfully.`);
        } catch (e) {
            console.error(`Failed to create base folder "${xmlFolder}":`, e.message);
            return;
        }
      }

      // Test creating subfolder
      if (!fs.existsSync(targetDir)) {
          console.log(`Subfolder "${targetDir}" does not exist. Creating...`);
          try {
            fs.mkdirSync(targetDir, { recursive: true });
            console.log(`Subfolder created.`);
          } catch(e) {
             console.error(`Failed to create subfolder:`, e.message);
             return;
          }
      }

      // Test writing file
      const testFile = path.join(targetDir, 'test_write.txt');
      fs.writeFileSync(testFile, 'test content');
      console.log(`Successfully wrote test file to: "${testFile}"`);
      fs.unlinkSync(testFile); // Cleanup
      console.log('Test file deleted.');

    } catch (err) {
      console.error('Unexpected error during file operations:', err);
    }

  } catch (error) {
    console.error('Database error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugXmlConfig();
