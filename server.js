// Servidor Sopa - SIN dependencias externas, solo http de Node. No necesita npm install, no puede dar MODULE_NOT_FOUND.
const http = require("http");
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
    let body = "";
    req.on("data", c => body += c);
    req.on("end", () => {
      try {
        const p = JSON.parse(body);
        if (p && p.id && p.nombre) {
          const ant = rankingGlobal[p.id] || {};
          rankingGlobal[p.id] = {
            id: p.id,
            nombre: p.nombre,
            pais: p.pais || ant.pais || "",
            paisEmoji: p.paisEmoji || ant.paisEmoji || "",
            foto: p.foto || ant.foto || "",
            edad: p.edad || ant.edad || "",
            activo: true,
            victorias: typeof p.victorias === "number" ? p.victorias : (ant.victorias || 0),
            derrotas: typeof p.derrotas === "number" ? p.derrotas : (ant.derrotas || 0),
            ultimaVez: Date.now()
          };
        }
      } catch(e){}
      res.writeHead(200, {"Content-Type":"application/json"});
      res.end(JSON.stringify({ok:true}));
    });
    return;
  }
  // Para que el juego no se caiga, si pide WebSocket, le decimos que use HTTP
  res.writeHead(200, {"Content-Type":"text/plain"});
  res.end("Servidor Sopa - OK - Ranking Global Activo - Sin dependencias");
});
const PORT = process.env.PORT || 10000;
server.listen(PORT, () => console.log("Servidor Sopa Ranking Global en puerto " + PORT));
