const puppeteer = require('puppeteer');
const fs = require('fs');
const cron = require('node-cron');

// Credenciais de login
const email = 'phromao@outlook.com';
const password = 'Calculadora386_';

// Caminho para o executável do Google Chrome
const chromePath = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

// Função para salvar cookies em um arquivo
async function saveCookies(page, filePath) {
  const cookies = await page.cookies();
  fs.writeFileSync(filePath, JSON.stringify(cookies, null, 2));
}

// Função para carregar cookies de um arquivo
async function loadCookies(page, filePath) {
  const cookiesString = fs.readFileSync(filePath);
  const cookies = JSON.parse(cookiesString);
  await page.setCookie(...cookies);
}

// Agendamento usando node-cron
cron.schedule('* * * * *', async () => {
  console.log('Iniciando o bot...');

  const cookieFile = './cookies.json'; // Arquivo para armazenar cookies

  const browser = await puppeteer.launch({
    headless: false, // Manter false para ver o navegador
    executablePath: chromePath,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled', // Evitar detecção
    ],
  });

  const page = await browser.newPage();

  // Definir User-Agent para evitar bloqueios
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/102.0.0.0 Safari/537.36'
  );

  try {
    // Carregar cookies, se existirem
    if (fs.existsSync(cookieFile)) {
      console.log('Carregando cookies...');
      await loadCookies(page, cookieFile);
      await page.goto('https://prenotami.esteri.it/Services', {
        waitUntil: 'networkidle2',
        timeout: 60000, // Aumentar o timeout para 60 segundos
      });
    } else {
      console.log('Navegando para a página de login...');
      await page.goto('https://prenotami.esteri.it/', {
        waitUntil: 'networkidle2',
        timeout: 60000, // Aumentar o timeout para 60 segundos
      });

      // Fazer login manual
      await page.waitForSelector('input#login-email', { visible: true, timeout: 15000 });
      await page.type('input#login-email', email);
      await page.type('input#login-password', password);
      await page.click('button[type="submit"]');

      // Aguardar redirecionamento após login
      const response = await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 });

      // Verificar se o login foi bem-sucedido
      if (response && page.url().includes('/Services')) {
        console.log('Login realizado com sucesso. Salvando cookies...');
        await saveCookies(page, cookieFile);
      } else {
        console.error('Falha no login.');
        await browser.close();
        return;
      }
    }

    console.log('Navegando para a página de agendamento...');

    // Verificar se o botão de reserva está presente com tentativas repetidas
    let buttonFound = false;
    for (let i = 0; i < 5; i++) {
      try {
        await page.waitForSelector('tr:nth-child(3) .btn-primary', { visible: true, timeout: 5000 });
        buttonFound = true;
        break; // Sair do loop se encontrado
      } catch (error) {
        console.log(`Tentativa ${i + 1}: Botão ainda não disponível.`);
      }
    }

    if (buttonFound) {
      console.log('Elemento encontrado. Clicando no botão...');
      await page.click('tr:nth-child(3) .btn-primary');
    } else {
      console.error('Não foi possível encontrar o botão "Reservar".');
      // Capturar um screenshot para verificar o estado da página
      await page.screenshot({ path: 'erro_screenshot.png' });
      throw new Error('Botão de reserva não encontrado.');
    }

  } catch (error) {
    console.error('Erro durante a execução:', error);
    await page.screenshot({ path: 'erro_critico.png' }); // Captura screenshot em caso de erro crítico
  } finally {
    await browser.close();
  }
}, {
  scheduled: true,
  timezone: 'America/Sao_Paulo',
});
