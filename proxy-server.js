// Pocket Option Proxy Server
const http = require('http');
const WebSocket = require('ws');

const PORT = 3000;

// WebSocket подключение к Pocket Option
let poWebSocket = null;
let connectedClients = [];

const httpServer = http.createServer((req, res) => {
    // CORS заголовки
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', message: 'Pocket Option Proxy Running' }));
});

// WebSocket сервер для фронтенда
const wss = new WebSocket.Server({ server: httpServer });

wss.on('connection', (ws) => {
    console.log('Frontend подключён');
    connectedClients.push(ws);

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            
            // Подключение к Pocket Option
            if (data.action === 'connect') {
                connectToPocketOption(data.ssid, data.type, ws);
            }
            
            // Отправка команд в Pocket Option
            if (data.action === 'send' && poWebSocket) {
                poWebSocket.send(data.message);
            }
            
            // Отключение
            if (data.action === 'disconnect') {
                disconnectFromPocketOption();
            }
        } catch (e) {
            console.error('Ошибка:', e.message);
        }
    });

    ws.on('close', () => {
        console.log('Frontend отключён');
        connectedClients = connectedClients.filter(c => c !== ws);
    });
});

function connectToPocketOption(ssid, type, clientWs) {
    // Пробуем разные серверы
    const servers = [
        'wss://demo-po.pocketoption.com/websocket',
        'wss://api-po.pocketoption.com/websocket',
        'wss://demo.pocketoption.com/ws',
        'wss://api.pocketoption.com/ws'
    ];
    
    // Выбираем сервер по типу счёта
    const wsUrl = (type === 'demo' ? servers[0] : servers[1]) + '/?EIO=4&transport=websocket';

    console.log(`Подключение к Pocket Option (${type}): ${wsUrl}`);

    poWebSocket = new WebSocket(wsUrl);

    poWebSocket.on('open', () => {
        console.log('✅ Pocket Option подключён');
        broadcast({ event: 'connected', type });
    });

    poWebSocket.on('message', (data) => {
        const message = data.toString();
        console.log('Получено:', message.substring(0, 100));
        
        // Отвечаем на ping
        if (message === '2') {
            poWebSocket.send('3');
            return;
        }

        // Socket.io connected - отправляем auth
        if (message === '40' && ssid) {
            console.log('Socket.io connected, отправляю auth...');
            poWebSocket.send(`42["auth",{"ssid":"${ssid}"}]`);
            return;
        }

        // Пересылаем все сообщения фронтенду
        broadcast({ event: 'message', data: message });
    });

    poWebSocket.on('close', (code, reason) => {
        console.log(`❌ Pocket Option отключён (код: ${code}, причина: ${reason})`);
        broadcast({ event: 'disconnected' });
        poWebSocket = null;
    });

    poWebSocket.on('error', (error) => {
        console.error('Ошибка WebSocket:', error.message);
        broadcast({ event: 'error', message: error.message });
    });
}

function disconnectFromPocketOption() {
    if (poWebSocket) {
        poWebSocket.close();
        poWebSocket = null;
    }
}

function broadcast(data) {
    const message = JSON.stringify(data);
    connectedClients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
}

httpServer.listen(PORT, () => {
    console.log(`🚀 Proxy сервер запущен на http://localhost:${PORT}`);
    console.log('Ожидание подключений...');
});
