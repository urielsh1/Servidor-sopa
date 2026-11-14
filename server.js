// server.js - V3 - Arena + Sopa 2
// Arena-Puente: TikTok + Multijugador Sopa
const WebSocket = require('ws');
const http = require('http');
const { TikTokLiveConnection } = require('tiktok-live-connector');

const PORT = process.env.PORT || 10000;
const TIKTOK_USERNAME = process.env.TIKTOK_USERNAME || 'perro1insano';

const server = http.createServer((req,res)=>{
  res.writeHead(200, {'Content-Type':'text/plain'});
  res.end('Arena-Puente V3 - TikTok + Sopa OK');
});
const wss = new WebSocket.Server({ server });

// Clientes por sala de sopa: { sala: Set(ws) }
const salasSopa = new Map();
function mandarASala(sala, data, excepto=null){
  const set = salasSopa.get(sala);
  if(!set) return;
  const msg = JSON.stringify(data);
  for(const c of set){
    if(c!==excepto && c.readyState===WebSocket.OPEN) c.send(msg);
  }
}
function mandarATodos(data){
  const msg = JSON.stringify(data);
  wss.clients.forEach(c=>{ if(c.readyState===WebSocket.OPEN) c.send(msg); });
}

wss.on('connection', (ws)=>{
  console.log('Cliente conectado');
  ws.salaSopa = null;
  ws.send(JSON.stringify({tipo:'bienvenido', mensaje:'Conectado a Arena-Puente V3'}));

  ws.on('message', (raw)=>{
    try{
      const d = JSON.parse(raw.toString());
      // --- SOPA ---
      if(d.tipo==='sopa_unirse'){
        ws.salaSopa = d.sala;
        if(!salasSopa.has(d.sala)) salasSopa.set(d.sala, new Set());
        salasSopa.get(d.sala).add(ws);
        console.log(`Sopa: ${d.perfil?.nombre||'?'} se unio a ${d.sala} como J${d.jugador}`);
        // Avisar a los demas de la misma sala que entro alguien
        mandarASala(d.sala, d, ws);
        ws.send(JSON.stringify({tipo:'sopa_unirse_ok', sala:d.sala}));
        return;
      }
      if(d.tipo==='sopa_encontrada'){
        console.log(`Sopa: J${d.jugador} encontro ${d.palabra} en ${d.sala}`);
        mandarASala(d.sala, d, ws);
        return;
      }
      if(d.tipo==='sopa_salir'){
        if(ws.salaSopa && salasSopa.has(ws.salaSopa)) salasSopa.get(ws.salaSopa).delete(ws);
        return;
      }
      // --- ARENA: cualquier otro mensaje del juego se reenvia a todos (para futuro) ---
      // No reenviamos mensajes vacios
    }catch(e){
      console.log('Mensaje no JSON, ignorado');
    }
  });

  ws.on('close', ()=>{
    if(ws.salaSopa && salasSopa.has(ws.salaSopa)){
      salasSopa.get(ws.salaSopa).delete(ws);
      if(salasSopa.get(ws.salaSopa).size===0) salasSopa.delete(ws.salaSopa);
    }
    console.log('Cliente desconectado');
  });
});

// --- TIKTOK ---
let tiktok = null;
async function conectarTikTok(){
  if(tiktok) { try{ tiktok.disconnect(); }catch(e){} }
  tiktok = new TikTokLiveConnection(TIKTOK_USERNAME);
  tiktok.connect().then(state=>{
    console.log('TikTok conectado a @'+TIKTOK_USERNAME);
    mandarATodos({tipo:'tiktok_conectado', usuario:TIKTOK_USERNAME});
  }).catch(err=>{
    console.log('TikTok no live o error, reintentando en 10s:', err.message);
    setTimeout(conectarTikTok, 10000);
  });
  tiktok.on('chat', data=>{
    mandarATodos({tipo:'chat', usuario: data.uniqueId, comentario: data.comment, foto: data.profilePictureUrl});
  });
  tiktok.on('gift', data=>{
    mandarATodos({tipo:'gift', usuario: data.uniqueId, regalo: data.giftName, cantidad: data.repeatCount, foto: data.profilePictureUrl});
  });
  tiktok.on('disconnected', ()=>{ console.log('TikTok desconectado, reintentando'); setTimeout(conectarTikTok, 5000); });
}
conectarTikTok();
server.listen(PORT, ()=> console.log('Servidor V3 en puerto '+PORT));
