const http = require("http");
let ranking = {};
const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") { res.writeHead(200); res.end(); return; }
  if (req.url === "/ranking" && req.method === "GET") {
    const lista = Object.values(ranking).sort((a,b)=> b.victorias - a.victorias || a.derrotas - b.derrotas).slice(0,99);
    res.writeHead(200, {"Content-Type":"application/json"});
    res.end(JSON.stringify(lista));
    return;
  }
  if (req.url === "/ranking" && req.method === "POST") {
    let body = "";
    req.on("data", c => { body += c; });
    req.on("end", () => {
      try {
        const p = JSON.parse(body);
        if (p && p.id && p.nombre) {
          const ant = ranking[p.id] || {};
          ranking[p.id] = {
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
          const ordenados = Object.values(ranking).sort((a,b)=> b.victorias - a.victorias || a.derrotas - b.derrotas);
          if (ordenados.length > 99) {
            ranking = {};
            ordenados.slice(0,99).forEach(r => { ranking[r.id] = r; });
          }
        }
      } catch(e) {}
      res.writeHead(200, {"Content-Type":"application/json"});
      res.end(JSON.stringify({ok:true}));
    });
    return;
  }
  res.writeHead(200, {"Content-Type":"text/plain"});
  res.end("Servidor Sopa - OK - Ranking 99");
});
const PORT = process.env.PORT || 10000;
server.listen(PORT, () => console.log("Servidor Sopa en puerto " + PORT));
