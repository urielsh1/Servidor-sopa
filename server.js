// SOPA DE 2 - Servidor multijugador (v1.7.0)
// Render: Start Command = node server.js | usa el puerto que Render le da (process.env.PORT)
// v1.7.0: el servidor genera EL MISMO MAPA para los 2 jugadores:
//  - 8 palabras aleatorias
//  - colocadas en las 8 direcciones (derecha, izquierda, abajo, arriba y 4 diagonales)
//  - el grid completo se manda a los 2 en el "matched"
//  - cuando alguien encuentra una palabra, se reenvian SUS CELDAS para que el otro la marque igual
const http = require("http");
const WebSocket = require("ws");

const PALABRAS_POOL = ["PERRO","GATO","ARENA","TORRE","ROSA","GALAXIA","DONUT","CAPIBARA","LUNA","SOL","MAR","RIO","FLOR","PATO","OSO","LEON","TIGRE","MONO","PANDA","KOALA","ZORRO","LOBO","AGUILA","TORTUGA","DELFIN","BALLENA","TIBURON","PULPO","ESTRELLA","COMETA","NUBE","LLUVIA","NIEVE","FUEGO","VIENTO","MONTAÑA","BOSQUE","DESIERTO","ISLA","PLAYA","BARCO","AVION","TREN","MOTO","BICI","CASA","MESA","SILLA","LIBRO","LAPIZ","MANGO","FRESA","MELON","SANDIA","UVA","LIMON","COCO","PIÑA","QUESO","TACO","PIZZA","HELADO"];
const LETRAS = "ABCDEFGHIJKLMNÑOPQRSTUVWXYZ";
function letraRandom(){ return LETRAS[Math.floor(Math.random()*LETRAS.length)]; }

function elegir8(){
  const c=[...PALABRAS_POOL];
  for(let i=c.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [c[i],c[j]]=[c[j],c[i]]; }
  return c.slice(0,8);
}

// Genera UNA sopa completa: palabras + grid 10x10 + posiciones de cada palabra
function generarSopa(){
  const palabras = elegir8();
  const grid = Array.from({length:10},()=>Array(10).fill(""));
  const posiciones = {}; // palabra -> ["r-c", ...]
  const dirs = [[0,1],[0,-1],[1,0],[-1,0],[1,1],[1,-1],[-1,1],[-1,-1]];
  for(const palabra of palabras){
    let puesto=false, intentos=0;
    while(!puesto && intentos<300){
      intentos++;
      const d = dirs[Math.floor(Math.random()*dirs.length)];
      const dr=d[0], dc=d[1];
      const r=Math.floor(Math.random()*10), c=Math.floor(Math.random()*10);
      const er=r+dr*(palabra.length-1), ec=c+dc*(palabra.length-1);
      if(er<0||er>=10||ec<0||ec>=10) continue;
      let ok=true;
      for(let k=0;k<palabra.length;k++){ const v=grid[r+dr*k][c+dc*k]; if(v && v!==palabra[k]) ok=false; }
      if(!ok) continue;
      const celdas=[];
      for(let k=0;k<palabra.length;k++){ grid[r+dr*k][c+dc*k]=palabra[k]; celdas.push((r+dr*k)+"-"+(c+dc*k)); }
      posiciones[palabra]=celdas;
      puesto=true;
    }
    if(!puesto){ // por si alguna no cupo, reintentar la sopa completa
      return generarSopa();
    }
  }
  for(let r=0;r<10;r++) for(let c=0;c<10;c++) if(!grid[r][c]) grid[r][c]=letraRandom();
  return { palabras, grid, posiciones };
}

let ranking = [];
const salas = new Map(); // codigo -> { jugadores: [{ws,id,perfil}], sopa }
function salaDe(ws){ for(const [codigo,s] of salas) if(s.jugadores.some(j=>j.ws===ws)) return codigo; return null; }
function enviar(ws,obj){ try{ if(ws.readyState===1) ws.send(JSON.stringify(obj)); }catch(e){} }

const server = http.createServer((req,res)=>{
  res.setHeader("Access-Control-Allow-Origin","*");
  res.setHeader("Access-Control-Allow-Methods","GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers","Content-Type");
  if(req.method==="OPTIONS"){ res.writeHead(204); return res.end(); }
  if(req.url==="/ranking" && req.method==="GET"){ res.writeHead(200,{"Content-Type":"application/json"}); return res.end(JSON.stringify(ranking.slice(0,99))); }
  if(req.url==="/ranking" && req.method==="POST"){
    let body=""; req.on("data",c=>body+=c); req.on("end",()=>{
      try{
        const p=JSON.parse(body||"{}");
        if(p.nombre){
          const ex = ranking.find(r=>r.id && p.id && r.id===p.id) || ranking.find(r=>r.nombre===p.nombre && r.pais===p.pais);
          if(ex) Object.assign(ex,p); else ranking.push({...p, activo:true, victorias:p.victorias||0, derrotas:p.derrotas||0});
          ranking.sort((a,b)=>(b.victorias||0)-(a.victorias||0));
          ranking=ranking.slice(0,99);
        }
      }catch(e){}
      res.writeHead(200,{"Content-Type":"application/json"}); res.end(JSON.stringify({ok:true}));
    });
    return;
  }
  res.writeHead(200,{"Content-Type":"text/plain"}); res.end("SOPA DE 2 servidor activo");
});

const wss = new WebSocket.Server({ server });
wss.on("connection",(ws)=>{
  ws.on("message",(raw)=>{
    let d; try{ d=JSON.parse(raw.toString()); }catch(e){ return; }
    const tipo=d.type || d.tipo;
    if(tipo==="sopa_join" || tipo==="join" || tipo==="sopa_unirse" || tipo==="hello"){
      const codigo=(d.room||d.sala||"").toString().trim().toUpperCase();
      const id=d.id || (d.perfil&&d.perfil.id) || ("SOPA-"+Math.random().toString(36).slice(2,8).toUpperCase());
      const perfil=d.perfil || d.profile || {nombre:"Jugador"};
      if(!codigo) return;
      if(!salas.has(codigo)) salas.set(codigo,{jugadores:[], sopa:generarSopa()});
      const s=salas.get(codigo);
      let yo=s.jugadores.find(j=>j.id===id);
      if(!yo){
        if(s.jugadores.length>=2){ enviar(ws,{type:"error", message:"Sala llena, ya hay 2 jugadores"}); return; }
        yo={ws,id,perfil}; s.jugadores.push(yo);
      } else { yo.ws=ws; yo.perfil=perfil; }
      s.jugadores.forEach(j=>{ if(j.ws!==ws) enviar(j.ws,{type:"peer_joined", room:codigo}); });
      if(s.jugadores.length===2){
        s.jugadores.forEach((j,i)=>enviar(j.ws,{
          type:"matched", room:codigo, you:i+1,
          players:s.jugadores.map(x=>({id:x.id, perfil:x.perfil})),
          palabras:s.sopa.palabras,
          grid:s.sopa.grid // MISMO mapa para los 2
        }));
      }
      return;
    }
    if(tipo==="sopa_word" || tipo==="word" || tipo==="sopa_encontrada"){
      const codigo=(d.room||d.sala||salaDe(ws)||"").toString().trim().toUpperCase();
      const s=salas.get(codigo); if(!s) return;
      const palabra=d.palabra||d.word;
      const celdas=d.celdas || s.sopa.posiciones[palabra] || null; // celdas del servidor, para que el otro marque igual
      s.jugadores.forEach(j=>{ if(j.ws!==ws) enviar(j.ws,{type:"sopa_word", room:codigo, palabra, jugador:d.jugador||d.player, celdas}); });
      return;
    }
    if(tipo==="ranking_update" && d.perfil){
      const p={id:d.id, ...d.perfil, victorias:d.victorias||0, derrotas:d.derrotas||0};
      const ex=ranking.find(r=>r.id && p.id && r.id===p.id);
      if(ex) Object.assign(ex,p); else ranking.push(p);
      return;
    }
  });
  ws.on("close",()=>{
    const codigo=salaDe(ws); if(!codigo) return;
    const s=salas.get(codigo); if(!s) return;
    s.jugadores=s.jugadores.filter(j=>j.ws!==ws);
    s.jugadores.forEach(j=>enviar(j.ws,{type:"peer_left", room:codigo}));
    if(s.jugadores.length===0) salas.delete(codigo);
  });
});

const PORT=process.env.PORT||10000;
server.listen(PORT,()=>console.log("SOPA DE 2 servidor v1.7.0 en puerto "+PORT));
