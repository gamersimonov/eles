const mineflayer = require('mineflayer');
const readline = require('readline');

const CONFIG = {
  host: 'play.kampungeles.id',
  port: 25565,
  username: 'Theo_not_bald',
  password: 'atk.exe',
  version: '1.20.1',
  lobbyItem: 'nether_star',
  realmItem: 'lime_dye',
  payCommand: '/shard pay simonov41 30',
  payInterval: 3600000 // 1 hour
};

// --- TERMINAL INPUT SETUP ---
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

function log(msg) {
  console.log(`\n[${new Date().toLocaleTimeString('en-GB')}] ${msg}`);
}

let bot;
let reconnectTimer;

function createBot() {
  if (reconnectTimer) clearTimeout(reconnectTimer);

  bot = mineflayer.createBot({
    host: CONFIG.host,
    port: CONFIG.port,
    username: CONFIG.username,
    version: CONFIG.version,
    auth: 'offline',
    colorsEnabled: false
  });

  bot.on('message', (json) => {
    // Pure raw output to terminal
    console.log(json.toString());
  });

  bot.on('end', () => {
    log("Disconnected. Reconnecting in 30s...");
    reconnectTimer = setTimeout(createBot, 30000);
  });

  bot.once('spawn', () => {
    log("Spawned. Logged in...");
    setTimeout(() => {
      bot.chat(`/login ${CONFIG.password}`);
      startNavigation();
      startPayTimer();
    }, 5000);
  });
}

// --- TERMINAL CHAT INPUT ---
rl.on('line', (line) => {
  if (bot && bot.entity) {
    bot.chat(line);
    log(`Sent: ${line}`);
  }
});

function startPayTimer() {
  setInterval(() => {
    if (bot && bot.entity) {
      bot.chat(CONFIG.payCommand);
      log(`Auto-Paid: ${CONFIG.payCommand}`);
    }
  }, CONFIG.payInterval);
}

function startNavigation() {
  const loop = setInterval(() => {
    if (!bot || !bot.entity) return clearInterval(loop);
    const items = bot.inventory.slots.slice(36, 45);
    const selector = items.find(i => i && i.name.includes(CONFIG.lobbyItem));

    if (selector) {
      bot.setQuickBarSlot(bot.inventory.slots.indexOf(selector) - 36);
      bot.activateItem();
      clearInterval(loop);

      bot.once('windowOpen', async (window) => {
        await new Promise(r => setTimeout(r, 2000));
        const realmIcon = window.slots.find(i => i && i.name.includes(CONFIG.realmItem));
        if (realmIcon) {
          await bot.clickWindow(realmIcon.slot, 0, 0);
          setTimeout(() => bot.chat('/afk'), 8000);
        } else {
          bot.closeWindow(window);
          startNavigation();
        }
      });
    }
  }, 5000);
}

createBot();

