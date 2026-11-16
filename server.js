// SOPA DE 2 - Servidor multijugador (v1.6.0)
// Render: Start Command = node server.js  |  usa el puerto que Render le da (process.env.PORT)
// Este servidor SI hace lo que el juego necesita:
//  1) Junta a los 2 jugadores que entran a la MISMA sala (codigo o RND-ALE)
//  2) Les asigna Jugador 1 y Jugador 2 (el primero que entro es el 1)
//  3) Les reparte las MISMAS 10 palabras a los 2
//  4) Les pasa las palabras que encuentra el otro, solo dentro de su sala
//  5) Guarda el ranking (POST/GET /ranking)
const http = require("http");
const WebSocket = require("ws");

const PALABRAS_POOL = ["PERRO","GATO","ARENA","TORRE","ROSA","GALAXIA","DONUT","CAPIBARA","LUNA","SOL","MAR","RIO","FLOR","PATO","OSO","LEON","TIGRE","MONO","PANDA","KOALA","ZORRO","LOBO","AGUILA","TORTUGA","DELFIN","BALLENA","TIBURON","PULPO","ESTRELLA","COMETA","NUBE","LLUVIA","NIEVE","FUEGO","VIENTO","MONTAÑA","BOSQUE","DESIERTO","ISLA","PLAYA","BARCO","AVION","TREN","MOTO","BICI","CASA","MESA","SILLA","LIBRO","LAPIZ","MANGO","FRESA","MELON","SANDIA","UVA","LIMON","COCO","PIÑA","QUESO","TACO","PIZZA","HELADO"];

function elegir10() {
  const c = [...PALABRAS_POOL];
  for (let i = c.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [c[i], c[j]] = [c[j], c[i]]; }
  return c.slice(0, 10);
}

let ranking = []; // en memoria (Render gratis lo borra si se reinicia, pero el juego tambien guarda local)
const salas = new Map(); // codigo -> { jugadores: [{ws, id, perfil}], palabras }

function salaDe(ws) { for (const [codigo, s] of salas) if (s.jugadores.some(j => j.ws === ws)) return codigo; return null; }
function enviar(ws, obj) { try { if (ws.readyState === 1) ws.send(JSON.stringify(obj)); } catch (e) {} }

const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") { res.writeHead(204); return res.end(); }
  if (req.url === "/ranking" && req.method === "GET") { res.writeHead(200, { "Content-Type": "application/json" }); return res.end(JSON.stringify(ranking.slice(0, 99))); }
  if (req.url === "/ranking" && req.method === "POST") {
    let body = ""; req.on("data", c => body += c); req.on("end", () => {
      try {
        const p = JSON.parse(body || "{}");
        if (p.nombre) {
          const ex = ranking.find(r => r.id && p.id && r.id === p.id) || ranking.find(r => r.nombre === p.nombre && r.pais === p.pais);
          if (ex) Object.assign(ex, p); else ranking.push({ ...p, activo: true });
          ranking.sort((a, b) => (b.victorias || 0) - (a.victorias || 0));
          ranking = ranking.slice(0, 99);
        }
      } catch (e) {}
      res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify({ ok: true }));
    });
    return;
  }
  res.writeHead(200, { "Content-Type": "text/plain" }); res.end("SOPA DE 2 servidor activo");
});

const wss = new WebSocket.Server({ server });
wss.on("connection", (ws) => {
  ws.on("message", (raw) => {
    let d; try { d = JSON.parse(raw.toString()); } catch (e) { return; }
    const tipo = d.type || d.tipo;
    // Unirse: formatos nuevo (sopa_join) y viejos (join / sopa_unirse / hello)
    if (tipo === "sopa_join" || tipo === "join" || tipo === "sopa_unirse" || tipo === "hello") {
      const codigo = (d.room || d.sala || "").toString().trim().toUpperCase();
      const id = d.id || (d.perfil && d.perfil.id) || ("SOPA-" + Math.random().toString(36).slice(2, 8).toUpperCase());
      const perfil = d.perfil || d.profile || { nombre: d.name || "Jugador" };
      if (!codigo) return;
      if (!salas.has(codigo)) salas.set(codigo, { jugadores: [], palabras: elegir10() });
      const s = salas.get(codigo);
      let yo = s.jugadores.find(j => j.id === id);
      if (!yo) {
        if (s.jugadores.length >= 2) { enviar(ws, { type: "error", message: "Sala llena, ya hay 2 jugadores" }); return; }
        yo = { ws, id, perfil }; s.jugadores.push(yo);
      } else { yo.ws = ws; yo.perfil = perfil; }
      // Avisar al otro que entro alguien
      s.jugadores.forEach(j => { if (j.ws !== ws) enviar(j.ws, { type: "peer_joined", room: codigo }); });
      // Ya somos 2 -> MATCHED a los 2, con numero y las mismas 10 palabras
      if (s.jugadores.length === 2) {
        s.jugadores.forEach((j, i) => enviar(j.ws, {
          type: "matched", room: codigo, you: i + 1,
          players: s.jugadores.map(x => ({ id: x.id, perfil: x.perfil })),
          palabras: s.palabras
        }));
      }
      return;
    }
    // Palabra encontrada: pasarla solo al OTRO de la misma sala
    if (tipo === "sopa_word" || tipo === "word" || tipo === "sopa_encontrada") {
      const codigo = (d.room || d.sala || salaDe(ws) || "").toString().trim().toUpperCase();
      const s = salas.get(codigo); if (!s) return;
      s.jugadores.forEach(j => { if (j.ws !== ws) enviar(j.ws, { type: "sopa_word", room: codigo, palabra: d.palabra || d.word, jugador: d.jugador || d.player }); });
      return;
    }
    // Ranking por WebSocket (respaldo)
    if (tipo === "ranking_update" && d.perfil) {
      const p = { id: d.id, ...d.perfil, victorias: d.victorias || 0, derrotas: d.derrotas || 0 };
      const ex = ranking.find(r => r.id && p.id && r.id === p.id);
      if (ex) Object.assign(ex, p); else ranking.push(p);
      return;
    }
  });
  ws.on("close", () => {
    const codigo = salaDe(ws); if (!codigo) return;
    const s = salas.get(codigo); if (!s) return;
    s.jugadores = s.jugadores.filter(j => j.ws !== ws);
    s.jugadores.forEach(j => enviar(j.ws, { type: "peer_left", room: codigo }));
    if (s.jugadores.length === 0) salas.delete(codigo);
  });
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => console.log("SOPA DE 2 servidor en puerto " + PORT));
