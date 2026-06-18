import nodemailer from 'nodemailer';

async function testConnection() {
  console.log('Iniciando teste de conexão com o Gmail SMTP...');
  
  // Limpando os espaços da senha de aplicativo (o formato correto é sem espaços)
  const appPassword = 'xdvk nuts gnfv uodf'.replace(/\s/g, '');
  const userEmail = 'reginaldobrain@gmail.com';
  
  // A porta padrão segura do Gmail geralmente é 465, mas o usuário enviou 485/smt.gmail
  // Vamos configurar do jeito certo: smtp.gmail.com porta 465
  const config = {
    host: 'smtp.gmail.com',
    port: 465,
    secure: true, // true para 465, false para outras portas
    auth: {
      user: userEmail,
      pass: appPassword,
    },
  };
  
  console.log('Configuração utilizada:', { ...config, auth: { user: config.auth.user, pass: '***oculta***' } });

  try {
    const transporter = nodemailer.createTransport(config);
    
    // Testa a conexão (login) sem enviar email
    console.log('Tentando verificar (verify) a conexão SMTP...');
    await transporter.verify();
    console.log('✅ SUCESSO! A conexão com o servidor SMTP do Gmail foi estabelecida e a credencial é válida.');
    
    // Tenta enviar um email de teste para ele mesmo
    console.log('Tentando enviar um e-mail de teste para ' + userEmail + '...');
    const info = await transporter.sendMail({
      from: `"Teste AppBarCash" <${userEmail}>`,
      to: userEmail,
      subject: "Sucesso - Teste SMTP AppBarCash",
      text: "Seu Gmail foi configurado corretamente para enviar e-mails pelo sistema!",
    });
    
    console.log('✅ SUCESSO! E-mail de teste enviado com ID: ' + info.messageId);
    
  } catch (error) {
    console.error('❌ ERRO na conexão ou envio:');
    console.error(error);
  }
}

testConnection();
