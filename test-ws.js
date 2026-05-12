// Тест подключения к Pocket Option WebSocket
const WebSocket = require('ws');

async function testConnection() {
    console.log('🔍 Тестирование серверов Pocket Option...\n');
    
    const servers = [
        'wss://m.pocketoption.com/ws',
        'wss://m.pocketoption.com/websocket',
        'wss://pocketoption.com/ws',
        'wss://pocketoption.com/websocket',
    ];

    for (const server of servers) {
        console.log(`\n📡 Тестирую: ${server}`);
        
        await new Promise((resolve) => {
            const timeout = setTimeout(() => {
                console.log('   ❌ Таймаут');
                ws.close();
                resolve();
            }, 5000);

            try {
                const ws = new WebSocket(server + '/?EIO=4&transport=websocket');

                ws.on('open', () => {
                    console.log('   ✅ WebSocket подключён!');
                    clearTimeout(timeout);
                });

                ws.on('message', (data) => {
                    const msg = data.toString();
                    console.log('   📨 Получено:', msg.substring(0, 150));
                    
                    if (msg === '2') {
                        ws.send('3');
                        console.log('   📤 Отправлен pong');
                    }
                    
                    if (msg === '40') {
                        console.log('   ✅ Socket.io connected!');
                        console.log('   📤 Отправляю auth с session_id...');
                        ws.send('42["auth",{"session_id":"65815f646d4553717dedf2cf3001c2be"}]');
                    }
                    
                    if (msg.includes('auth') || msg.includes('balance') || msg.includes('uid')) {
                        console.log('   ✅✅✅ АВТОРИЗАЦИЯ УСПЕШНА!');
                        console.log('   Данные:', msg);
                    }
                });

                ws.on('close', (code) => {
                    if (code !== 1000) {
                        console.log(`   ❌ Отключено (код: ${code})`);
                    }
                    clearTimeout(timeout);
                    resolve();
                });

                ws.on('error', (error) => {
                    console.log(`   ❌ Ошибка: ${error.message}`);
                    clearTimeout(timeout);
                    resolve();
                });
            } catch (e) {
                console.log(`   ❌ Ошибка: ${e.message}`);
                clearTimeout(timeout);
                resolve();
            }
        });
    }
}

testConnection();
