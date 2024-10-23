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

// Função para verificar se a página ainda está ativa
function isPageOpen(page) {
  return !page.isClosed();
}

// Agendamento usando node-cron
cron.schedule('* * * * *', async () => {
  console.log('Iniciando o bot...');

  const cookieFile = './cookies.json'; // Arquivo para armazenar cookies

  const browser = await puppeteer.launch({
    headless: false, 
    executablePath: chromePath,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
    ],
  });

  let page = await browser.newPage();
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/102.0.0.0 Safari/537.36'
  );

  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
  });

  try {
    if (fs.existsSync(cookieFile)) {
      console.log('Carregando cookies...');
      await loadCookies(page, cookieFile);

      await page.goto('https://prenotami.esteri.it/Services', { 
        waitUntil: 'domcontentloaded', 
        timeout: 60000 
      });
    } else {
      console.log('Navegando para a página de login...');
      await page.goto('https://prenotami.esteri.it/', { 
        waitUntil: 'domcontentloaded', 
        timeout: 60000 
      });

      await page.waitForSelector('input#login-email', { visible: true, timeout: 15000 });
      await page.type('input#login-email', email);
      await page.type('input#login-password', password);
      await page.click('button[type="submit"]');

      const response = await page.waitForNavigation({ 
        waitUntil: 'domcontentloaded', 
        timeout: 60000 
      });

      if (response && (page.url().includes('/UserArea') || page.url().includes('/Services'))) {
        console.log('Login realizado com sucesso. Salvando cookies...');
        await saveCookies(page, cookieFile);

        if (page.url().includes('/UserArea')) {
          console.log('Redirecionando para a página de serviços...');
          await page.goto('https://prenotami.esteri.it/Services', { 
            waitUntil: 'domcontentloaded', 
            timeout: 60000 
          });
        }
      } else {
        console.error('Falha no login.');
        await browser.close();
        return;
      }
    }

    console.log('Navegando para a página de agendamento...');

    let buttonFound = false;
    for (let i = 0; i < 10; i++) {
      try {
        if (!isPageOpen(page)) throw new Error('A página foi fechada inesperadamente.');

        await page.waitForSelector('tr:nth-child(3) .btn-primary', { visible: true, timeout: 3000 });
        buttonFound = true;
        break;
      } catch (error) {
        console.log(`Tentativa ${i + 1}: Botão ainda não disponível. Recarregando a página...`);

        if (isPageOpen(page)) {
          await page.reload({ waitUntil: 'domcontentloaded' });
        } else {
          console.warn('A página foi fechada. Reabrindo...');
          page = await browser.newPage(); // Reabre a aba
          await page.goto('https://prenotami.esteri.it/Services', { 
            waitUntil: 'domcontentloaded', 
            timeout: 60000 
          });
        }
      }
    }

    if (buttonFound) {
      console.log('Elemento encontrado. Clicando no botão...');
      await page.click('tr:nth-child(3) .btn-primary');
    } else {
      console.error('Não foi possível encontrar o botão "Reservar".');
      await page.screenshot({ path: 'erro_screenshot.png' });
      throw new Error('Botão de reserva não encontrado.');
    }
  } catch (error) {
    console.error('Erro durante a execução:', error);
    await page.screenshot({ path: 'erro_critico.png' });
  } finally {
    if (isPageOpen(page)) {
      await browser.close();
    }
  }
}, {
  scheduled: true,
  timezone: 'America/Sao_Paulo',
});
