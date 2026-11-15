const WebSocket = require('ws');
const PORT = process.env.PORT || 10000;
const wss = new WebSocket.Server({ port: PORT });

console.log('Servidor Sopa en puerto ' + PORT);

let rooms = {};

wss.on('connection', (ws) => {
  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'join') {
        ws.room = msg.room;
        ws.name = msg.name || 'Jugador';
        if (!rooms[msg.room]) rooms[msg.room] = [];
        rooms[msg.room].push(ws);
        console.log(ws.name + ' entro a ' + msg.room);
      }
      if (msg.type === 'word' && ws.room) {
        (rooms[ws.room] || []).forEach((c) => {
          if (c.readyState === 1) c.send(JSON.stringify(msg));
        });
      }
    } catch (e) {}
  });
  ws.on('close', () => {
    if (ws.room && rooms[ws.room]) {
      rooms[ws.room] = rooms[ws.room].filter((c) => c !== ws);
    }
  });
});
