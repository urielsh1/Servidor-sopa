const http = require("http");
let WebSocket = null;
try{ WebSocket = require("ws"); }catch(e){ console.log("ws no instalado, sigo solo con HTTP para ranking"); }

let rankingGlobal = {};

const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") { res.writeHead(200); res.end(); return; }
  if (req.url === "/ranking" && req.method === "GET") {
    const lista = Object.values(rankingGlobal).sort((a,b)=> b.victorias - a.victorias || a.derrotas - b.derrotas);
    res.writeHead(200, {"Content-Type":"application/json"});
    res.end(JSON.stringify(lista));
    return;
  }
  if (req.url === "/ranking" && req.method === "POST") {
    let body="";
    req.on("data", c=> body+=c);
    req.on("end", ()=>{
      try{
        const p = JSON.parse(body);
        if(p && p.id && p.nombre){
          const ant = rankingGlobal[p.id] || {};
          rankingGlobal[p.id] = {
            id: p.id,
            nombre: p.nombre,
            pais: p.pais || ant.pais || "",
            paisEmoji: p.paisEmoji || ant.paisEmoji || "",
            foto: p.foto || ant.foto || "",
            edad: p.edad || ant.edad || "",
            activo: true,
            victorias: typeof p.victorias==="number" ? p.victorias : (ant.victorias||0),
            derrotas: typeof p.derrotas==="number" ? p.derrotas : (ant.derrotas||0),
            ultimaVez: Date.now()
          };
        }
      }catch(e){}
      res.writeHead(200, {"Content-Type":"application/json"});
      res.end(JSON.stringify({ok:true}));
    });
    return;
  }
  res.writeHead(200, {"Content-Type":"text/plain"});
  res.end("Servidor Sopa - OK - Ranking Global Activo");
});

if(WebSocket){
  const wss = new WebSocket.Server({ server });
  let salas = {};
  function enviarRankingA(ws){ try{ ws.send(JSON.stringify({tipo:"ranking_global", lista: Object.values(rankingGlobal)})); }catch(e){} }
  wss.on("connection", (ws)=>{
    ws.id = Math.random().toString(36).slice(2,9);
    enviarRankingA(ws);
    ws.on("message", (msg)=>{
      let data;
      try{ data = JSON.parse(msg); }catch(e){ return; }
      if(data.tipo === "ranking_update" && data.perfil){
        const p = data.perfil;
        const id = data.id || p.id || ws.id;
        const ant = rankingGlobal[id] || {};
        rankingGlobal[id] = {
          id: id, nombre: p.nombre || ant.nombre || "",
          pais: p.pais || ant.pais || "", paisEmoji: p.paisEmoji || ant.paisEmoji || "",
          foto: p.foto || ant.foto || "", edad: p.edad || ant.edad || "",
          activo: true,
          victorias: typeof data.victorias==="number" ? data.victorias : (ant.victorias||0),
          derrotas: typeof data.derrotas==="number" ? data.derrotas : (ant.derrotas||0),
          ultimaVez: Date.now()
        };
        wss.clients.forEach(c=>{ if(c.readyState===1) enviarRankingA(c); });
        return;
      }
      if(data.tipo === "pedir_ranking"){ enviarRankingA(ws); return; }
      if(data.tipo === "crear_sala" || data.tipo === "unirse_sala" || data.tipo === "sala_aleatoria"){
        const codigo = data.codigo || Math.random().toString(36).slice(2,7).toUpperCase();
        if(!salas[codigo]) salas[codigo]=[];
        if(!salas[codigo].includes(ws)){ salas[codigo].push(ws); ws.sala = codigo; ws.jugador = salas[codigo].length; }
        ws.send(JSON.stringify({tipo:"sala_creada", codigo, jugador: ws.jugador}));
        if(salas[codigo].length===2){ salas[codigo].forEach((c,i)=>{ try{ c.send(JSON.stringify({tipo:"empezar", jugador: i+1})); }catch(e){} }); }
        return;
      }
      if(ws.sala && salas[ws.sala]){ salas[ws.sala].forEach(c=>{ if(c!==ws && c.readyState===1){ try{ c.send(msg.toString()); }catch(e){} } }); }
    });
    ws.on("close", ()=>{
      if(ws.sala && salas[ws.sala]){ salas[ws.sala] = salas[ws.sala].filter(c=>c!==ws); if(salas[ws.sala].length===0) delete salas[ws.sala]; }
    });
  });
}

const PORT = process.env.PORT || 10000;
server.listen(PORT, ()=> console.log("Servidor Sopa con Ranking Global en puerto", PORT));
