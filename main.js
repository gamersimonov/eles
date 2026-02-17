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
  balanceInterval: 1800000 // 30 minutes
};

let bot;
let botStatus = "Offline";
let currentBalance = "0 Shards";
let webLogs = [];
let reconnectTimer;
let balanceTimer;

// --- LOGGING & FILTERING ---
function addLog(type, message) {
  const time = new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Jakarta' });
  const cleanMsg = message.replace(/§[0-9a-fk-or]/g, '').trim();
  
  let color = "#e2e8f0"; // Default
  if (type === 'SYSTEM') color = "#ffca28";
  else if (type === 'CHAT') color = "#00ff41";
  else if (type === 'ECONOMY') color = "#34d399";
  else if (type === 'ERROR') color = "#ff5555";

  const entry = `<span style="color: ${color}">[${time}] [${type}] ${cleanMsg}</span>`;
  webLogs.unshift(entry);
  if (webLogs.length > 200) webLogs.pop();
  
  console.log(`[${time}] [${type}] ${cleanMsg}`);
}

// --- BOT CORE ---
function createBot() {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  if (balanceTimer) clearInterval(balanceTimer);

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

    // 1. STAT BAR BLOCKER
    if (cleanMsg.includes('❤') || cleanMsg.includes('⌚') || cleanMsg.includes('|')) return;

    // 2. SMART BALANCE CATCHER (Avoids "Next Shard" spam)
    if (lowerMsg.includes('current balance') && lowerMsg.includes('shard')) {
      const match = cleanMsg.match(/\d+(?:,\d+)*/); // Catches numbers like 588 or 1,000
      if (match) {
        currentBalance = `${match[0]} Shards`;
        addLog('ECONOMY', `Balance Updated: ${currentBalance}`);
      }
    } 

    // 3. CLEAN CHAT FILTER
    else {
      const isPlayerChat = cleanMsg.includes(':') || cleanMsg.includes('»') || cleanMsg.includes('->');
      const isImportant = lowerMsg.includes('welcome') || lowerMsg.includes('joined the');
      
      if (isPlayerChat || isImportant) {
        addLog('CHAT', cleanMsg);
      }
    }
  });

  bot.once('spawn', () => {
    botStatus = "Authenticating...";
    addLog('SYSTEM', 'Spawned in lobby.');
    
    setTimeout(() => {
      bot.chat(`/login ${CONFIG.password}`);
      startNavigation();
      startBalanceLoop();
    }, 5000);
  });

  bot.on('end', (reason) => {
    botStatus = "Offline (Reconnecting)";
    addLog('ERROR', `Disconnected: ${reason}`);
    reconnectTimer = setTimeout(createBot, 30000);
  });

  bot.on('error', (err) => addLog('ERROR', err.message));
}

// --- AUTOMATION ---
function startBalanceLoop() {
  setTimeout(() => requestBalance(), 10000); // Initial check
  balanceTimer = setInterval(requestBalance, CONFIG.balanceInterval);
}

function requestBalance() {
  if (bot && bot.entity) {
    bot.chat('/shard balance');
    addLog('SYSTEM', 'Fetching balance...');
  }
}

function startNavigation() {
  botStatus = "Navigating...";
  const navInterval = setInterval(() => {
    if (!bot || !bot.entity) return clearInterval(navInterval);

    const items = bot.inventory.slots.slice(36, 45);
    const star = items.find(i => i && i.name.includes(CONFIG.lobbyItem));

    if (star) {
      bot.setQuickBarSlot(bot.inventory.slots.indexOf(star) - 36);
      bot.activateItem();
      clearInterval(navInterval);

      bot.once('windowOpen', async (window) => {
        await new Promise(r => setTimeout(r, 2000));
        const dye = window.slots.find(i => i && i.name.includes(CONFIG.realmItem));
        
        if (dye) {
          await bot.clickWindow(dye.slot, 0, 0);
          addLog('SYSTEM', 'Joining DonutSMP...');
          setTimeout(() => {
            bot.chat('/afk');
            botStatus = "In-Game (AFK)";
          }, 8000);
        }
      });
    }
  }, 5000);
}

createBot();

// --- DASHBOARD UI ---
app.get('/', (req, res) => {
  res.send(`
    <html>
      <head>
        <title>Theo Control</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body { background: #020617; color: #f8fafc; font-family: system-ui; padding: 20px; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px; }
          .card { background: #1e293b; padding: 15px; border-radius: 12px; border: 1px solid #334155; }
          .label { color: #94a3b8; font-size: 12px; text-transform: uppercase; font-weight: bold; }
          .val { font-size: 1.2rem; font-weight: bold; margin-top: 5px; }
          #logs { background: #000; height: 60vh; overflow-y: auto; padding: 15px; border-radius: 12px; font-family: monospace; font-size: 13px; line-height: 1.6; border: 1px solid #334155; }
          .input-bar { display: flex; gap: 10px; margin-top: 20px; }
          input { flex: 1; padding: 12px; border-radius: 8px; border: 1px solid #334155; background: #0f172a; color: white; outline: none; }
          button { padding: 12px 20px; border-radius: 8px; border: none; background: #3b82f6; color: white; font-weight: bold; cursor: pointer; }
          .btn-shard { background: #10b981; }
        </style>
      </head>
      <body>
        <div class="grid">
          <div class="card">
            <div class="label">Bot Status</div>
            <div class="val" id="st" style="color:#3b82f6">${botStatus}</div>
          </div>
          <div class="card">
            <div class="label">Wealth</div>
            <div class="val" id="bl" style="color:#10b981">${currentBalance}</div>
          </div>
        </div>
        <div id="logs">${webLogs.join('<br>')}</div>
        <div class="input-bar">
          <input type="text" id="m" placeholder="Message or Command..." onkeypress="if(event.key==='Enter')send()">
          <button onclick="send()">Send</button>
          <button class="btn-shard" onclick="fetch('/force-bal')">Check Shards</button>
        </div>
        <script>
          function send(){
            const i = document.getElementById('m');
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
app.get('/force-bal', (req, res) => { requestBalance(); res.sendStatus(200); });

app.listen(PORT);

