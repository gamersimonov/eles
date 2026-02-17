const mineflayer = require('mineflayer');
const express = require('express');
const app = express();
const PORT = process.env.PORT || 8080;

// --- CONFIGURATION ---
const CONFIG = {
  host: 'play.kampungeles.id',
  port: 25565,
  username: 'Theo_not_bald',
  password: 'atk.exe',
  version: '1.20.1',
  lobbyItem: 'nether_star',
  realmItem: 'lime_dye',
  tpaTarget: 'simonov41',
  confirmItem: 'lime_stained_glass_pane', // Technical name for lime glass pane
  balanceInterval: 1800000 
};

let bot;
let botStatus = "Offline";
let currentBalance = "0 Shards";
let webLogs = [];
let reconnectTimer;

// --- LOGGING ---
function addLog(type, message) {
  const time = new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Jakarta' });
  const cleanMsg = message.replace(/§[0-9a-fk-or]/g, '').trim();
  let color = "#f8fafc"; 
  if (type === 'SYSTEM') color = "#fbbf24";
  if (type === 'CHAT') color = "#4ade80";
  if (type === 'ECONOMY') color = "#2dd4bf";
  if (type === 'ERROR') color = "#f87171";

  webLogs.unshift(`<span style="color: ${color}">[${time}] [${type}] ${cleanMsg}</span>`);
  if (webLogs.length > 200) webLogs.pop();
  console.log(`[${time}] [${type}] ${cleanMsg}`);
}

// --- BOT CORE ---
function createBot() {
  if (reconnectTimer) clearTimeout(reconnectTimer);

  botStatus = "Connecting...";
  bot = mineflayer.createBot({
    host: CONFIG.host,
    port: CONFIG.port,
    username: CONFIG.username,
    version: CONFIG.version,
    auth: 'offline'
  });

  bot.on('message', (json) => {
    const msg = json.toString();
    const cleanMsg = msg.replace(/§[0-9a-fk-or]/g, '');
    const lowerMsg = cleanMsg.toLowerCase();

    if (cleanMsg.includes('❤') || cleanMsg.includes('⌚') || cleanMsg.includes('|')) return;

    // Balance Catcher
    if (lowerMsg.includes('current balance') && lowerMsg.includes('shard')) {
      const match = cleanMsg.match(/[\d,.]+[kmbKMB]?/); 
      if (match) {
        currentBalance = `${match[0]} Shards`;
        addLog('ECONOMY', `Wealth: ${currentBalance}`);
      }
    } 
    // Chat Filter
    else {
      const isPlayerChat = cleanMsg.includes(':') || cleanMsg.includes('»') || cleanMsg.includes('->');
      if (isPlayerChat || lowerMsg.includes('welcome')) addLog('CHAT', cleanMsg);
    }
  });

  bot.once('spawn', () => {
    botStatus = "Authenticating...";
    addLog('SYSTEM', 'Spawned. Logging in...');
    setTimeout(() => {
      bot.chat(`/login ${CONFIG.password}`);
      startGlobalWatchdog();
    }, 5000);
  });

  bot.on('end', (reason) => {
    botStatus = "Offline (Reconnecting)";
    addLog('ERROR', `Disconnected: ${reason}`);
    reconnectTimer = setTimeout(createBot, 15000);
  });

  bot.on('error', (err) => addLog('ERROR', err.message));

  // TPA GUI Confirmation Logic
  bot.on('windowOpen', async (window) => {
    const title = window.title ? JSON.parse(window.title).text : "";
    
    // Check if this is the TPA confirmation menu
    const confirmSlot = window.slots.find(i => i && i.name === CONFIG.confirmItem);
    
    if (confirmSlot) {
      addLog('SYSTEM', 'TPA Confirmation menu detected. Clicking Lime Glass...');
      await new Promise(r => setTimeout(r, 1200)); // Human-like delay
      await bot.clickWindow(confirmSlot.slot, 0, 0);
    }
  });
}

// --- AUTOMATION WATCHDOG ---
// This runs every 10 seconds to check if the bot is in the lobby or realm
function startGlobalWatchdog() {
  setInterval(() => {
    if (!bot || !bot.entity) return;

    const hotbar = bot.inventory.slots.slice(36, 45);
    const star = hotbar.find(i => i && i.name.includes(CONFIG.lobbyItem));

    // If we see the Nether Star, we are definitely in the lobby
    if (star) {
      if (botStatus !== "In Lobby") {
        addLog('SYSTEM', 'Lobby detected! Starting rejoin sequence...');
        botStatus = "In Lobby";
        handleLobbyJoin(star);
      }
    } else {
      if (botStatus === "In Lobby") botStatus = "In-Game";
    }
  }, 10000);

  // Periodic Balance Check
  setInterval(() => {
    if (bot && bot.entity && botStatus !== "In Lobby") {
      bot.chat('/shard balance');
    }
  }, CONFIG.balanceInterval);
}

async function handleLobbyJoin(starItem) {
  try {
    const slot = bot.inventory.slots.indexOf(starItem) - 36;
    bot.setQuickBarSlot(slot);
    bot.activateItem();
    
    // Wait for the Realm Selector GUI
    bot.once('windowOpen', async (window) => {
      await new Promise(r => setTimeout(r, 2000));
      const realm = window.slots.find(i => i && i.name.includes(CONFIG.realmItem));
      if (realm) {
        await bot.clickWindow(realm.slot, 0, 0);
        addLog('SYSTEM', 'Re-joining Realm...');
        setTimeout(() => bot.chat('/afk'), 8000);
      }
    });
  } catch (e) { addLog('ERROR', 'Nav Error: ' + e.message); }
}

// --- API ACTIONS ---
function sendTPA() {
  if (bot && bot.entity) {
    bot.chat(`/tpa ${CONFIG.tpaTarget}`);
    addLog('SYSTEM', `Sent TPA request to ${CONFIG.tpaTarget}`);
  }
}

createBot();

// --- WEB DASHBOARD ---
app.get('/', (req, res) => {
  res.send(`
    <html>
      <head>
        <title>Theo Cloud Control</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body { background: #020617; color: #f8fafc; font-family: sans-serif; padding: 20px; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 20px; }
          .card { background: #1e293b; padding: 15px; border-radius: 12px; border: 1px solid #334155; }
          .val { font-size: 1.1rem; font-weight: bold; margin-top: 5px; color: #3b82f6; }
          #logs { background: #000; height: 55vh; overflow-y: auto; padding: 15px; border-radius: 12px; font-family: monospace; font-size: 12px; border: 1px solid #334155; }
          .controls { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 20px; }
          input { grid-column: span 2; padding: 12px; border-radius: 8px; border: 1px solid #334155; background: #0f172a; color: white; }
          button { padding: 12px; border-radius: 8px; border: none; font-weight: bold; cursor: pointer; color: white; }
          .btn-blue { background: #3b82f6; }
          .btn-green { background: #10b981; }
          .btn-purple { background: #8b5cf6; }
        </style>
      </head>
      <body>
        <div class="grid">
          <div class="card"><div>Status</div><div class="val" id="st">${botStatus}</div></div>
          <div class="card"><div>Wealth</div><div class="val" id="bl" style="color:#10b981">${currentBalance}</div></div>
        </div>
        <div id="logs">${webLogs.join('<br>')}</div>
        <div class="controls">
          <input type="text" id="m" placeholder="Chat/Command..." onkeypress="if(event.key==='Enter')send()">
          <button class="btn-blue" onclick="send()">Send Chat</button>
          <button class="btn-purple" onclick="fetch('/tpa')">TPA to Simon</button>
          <button class="btn-green" onclick="fetch('/force-bal')">Check Wealth</button>
        </div>
        <script>
          function send(){
            const i = document.getElementById('m');
            if(!i.value) return;
            fetch('/chat?msg='+encodeURIComponent(i.value));
            i.value='';
          }
          setInterval(()=> {
            fetch('/data').then(r=>r.json()).then(d=>{
              document.getElementById('st').innerText = d.status;
              document.getElementById('bl').innerText = d.balance;
              document.getElementById('logs').innerHTML = d.logs.join('<br>');
            });
          }, 2000);
        </script>
      </body>
    </html>
  `);
});

app.get('/data', (req, res) => res.json({ status: botStatus, balance: currentBalance, logs: webLogs }));
app.get('/chat', (req, res) => { if(bot) bot.chat(req.query.msg); res.sendStatus(200); });
app.get('/tpa', (req, res) => { sendTPA(); res.sendStatus(200); });
app.get('/force-bal', (req, res) => { if(bot) bot.chat('/shard balance'); res.sendStatus(200); });

app.listen(PORT);

