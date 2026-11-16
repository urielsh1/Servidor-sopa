// SOPA DE 2 - Servidor multijugador (v1.9.0)
// Render: Start Command = node server.js | usa el puerto que Render le da (process.env.PORT)
// v1.7.4: el servidor genera EL MISMO MAPA para los 2 jugadores:
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

// v1.7.5: el ranking se guarda en ARCHIVO para que NO se borre cuando Render se reinicia o se hace deploy
const fs = require("fs");
const RANKING_FILE = __dirname + "/ranking.json";
function limpiarRanking(lista){
  var unicos=[];
  (lista||[]).forEach(function(r){
    if(!r || !r.nombre) return;
    r.victorias=r.victorias||0; r.derrotas=r.derrotas||0;
    var ex=unicos.find(function(u){ if(u.id && r.id && u.id===r.id) return true; if(u.nombre===r.nombre && (u.pais||"")===(r.pais||"")) return true; return false; });
    if(!ex) unicos.push(r);
    else { ex.victorias=Math.max(ex.victorias||0, r.victorias||0); ex.derrotas=Math.max(ex.derrotas||0, r.derrotas||0); if(!ex.id && r.id) ex.id=r.id; if(!ex.foto && r.foto) ex.foto=r.foto; if(!ex.edad && r.edad) ex.edad=r.edad; if(!ex.paisEmoji && r.paisEmoji) ex.paisEmoji=r.paisEmoji; if(r.activo) ex.activo=true; if(r.ultimo) ex.ultimo=Math.max(ex.ultimo||0, r.ultimo); }
  });
  return unicos;
}
let ranking = [];
try{ ranking = limpiarRanking(JSON.parse(fs.readFileSync(RANKING_FILE, "utf8")||"[]")); }catch(e){ ranking = []; }
function guardarRankingArchivo(){ try{ fs.writeFileSync(RANKING_FILE, JSON.stringify(ranking)); }catch(e){} }
// v1.9.0: CUENTAS EN LA NUBE - el nombre queda amarrado a su dueno con contrasena.
// Solo se guarda el HASH de la contrasena, nunca la contrasena. El token es la llave de sesion.
const crypto = require("crypto");
const CUENTAS_FILE = __dirname + "/cuentas.json";
let cuentas = [];
try{ cuentas = JSON.parse(fs.readFileSync(CUENTAS_FILE, "utf8")||"[]"); }catch(e){ cuentas = []; }
function guardarCuentasArchivo(){ try{ fs.writeFileSync(CUENTAS_FILE, JSON.stringify(cuentas)); }catch(e){} }
function nombreClave(n){ return String(n||"").trim().toLowerCase(); }
function hashPass(pw){ return crypto.createHash("sha256").update(String(pw||"")).digest("hex"); }
function nuevoToken(){ return crypto.randomBytes(24).toString("hex"); }
function cuentaDeNombre(n){ return cuentas.find(function(c){ return nombreClave(c.nombre)===nombreClave(n); }); }
function tokenValido(nombre, token){ var c=cuentaDeNombre(nombre); return !!(c && token && c.token===token); }
const salas = new Map(); // codigo -> { jugadores: [{ws,id,perfil}], sopa }
function salaDe(ws){ for(const [codigo,s] of salas) if(s.jugadores.some(j=>j.ws===ws)) return codigo; return null; }
function enviar(ws,obj){ try{ if(ws.readyState===1) ws.send(JSON.stringify(obj)); }catch(e){} }

const server = http.createServer((req,res)=>{
  res.setHeader("Access-Control-Allow-Origin","*");
  res.setHeader("Access-Control-Allow-Methods","GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers","Content-Type");
  if(req.method==="OPTIONS"){ res.writeHead(204); return res.end(); }
  if(req.url==="/ranking" && req.method==="GET"){ ranking=limpiarRanking(ranking);
    // v1.8.1: quien no ha avisado "sigo aqui" en los ultimos 2 minutos -> bolita gris (desconectado)
    var _ahora=Date.now();
    ranking.forEach(function(r){ r.activo = !!(r.ultimo && (_ahora - r.ultimo < 120000)); });
    ranking.sort((a,b)=>(b.victorias||0)-(a.victorias||0)); res.writeHead(200,{"Content-Type":"application/json"}); return res.end(JSON.stringify(ranking.slice(0,99))); }
  if(req.url==="/ranking" && req.method==="POST"){
    let body=""; req.on("data",c=>body+=c); req.on("end",()=>{
      try{
        const p=JSON.parse(body||"{}");
        if(p.nombre){
          // v1.7.4: juntar por ID o por nombre+pais, y NUNCA bajar las estadisticas a 0 por un dato viejo
          // v1.9.0: si el nombre tiene cuenta, solo quien tenga su token puede subirlo
          var _cuentaNombre = nombreClave(p.nombre);
          var _cuenta = cuentaDeNombre(p.nombre);
          if(_cuenta && !tokenValido(p.nombre, p.token)){
            res.writeHead(403,{"Content-Type":"application/json"}); return res.end(JSON.stringify({ok:false, error:"nombre_vinculado"}));
          }
          const ex = ranking.find(r=>r.id && p.id && r.id===p.id) || ranking.find(r=>r.nombre===p.nombre && (r.pais||"")===(p.pais||""));
          if(ex){
            const v=Math.max(ex.victorias||0, p.victorias||0), d=Math.max(ex.derrotas||0, p.derrotas||0);
            if(p.nombre) ex.nombre=p.nombre; if(p.pais) ex.pais=p.pais; if(p.paisEmoji) ex.paisEmoji=p.paisEmoji;
            if(p.foto) ex.foto=p.foto; if(p.edad) ex.edad=p.edad; if(p.sexo) ex.sexo=p.sexo; if(p.id) ex.id=p.id;
            ex.victorias=v; ex.derrotas=d; if(tokenValido(p.nombre, p.token)) ex.cuenta=_cuentaNombre;
            // v1.8.1: presencia. Si avisa que se fue -> gris ya. Si avisa que sigue -> verde y guardo cuando lo vi.
            if(p.activo===false){ ex.activo=false; ex.ultimo=0; }
            else { ex.activo=true; ex.ultimo=Date.now(); }
          } else ranking.push({...p, cuenta: (tokenValido(p.nombre, p.token)?_cuentaNombre:""), activo: p.activo!==false, ultimo: p.activo===false?0:Date.now(), victorias:p.victorias||0, derrotas:p.derrotas||0});
          ranking.sort((a,b)=>(b.victorias||0)-(a.victorias||0));
          ranking=ranking.slice(0,99);
          guardarRankingArchivo(); // v1.7.5: guardar en archivo para que no se borre
        }
      }catch(e){}
      res.writeHead(200,{"Content-Type":"application/json"}); res.end(JSON.stringify({ok:true}));
    });
    return;
  }
  if(req.url==="/cuenta/crear" && req.method==="POST"){
    let body=""; req.on("data",c=>body+=c); req.on("end",()=>{
      try{
        const p=JSON.parse(body||"{}");
        const nombre=String(p.nombre||"").trim();
        const pass=String(p.pass||"");
        if(!nombre || pass.length<4){ res.writeHead(400,{"Content-Type":"application/json"}); return res.end(JSON.stringify({ok:false, error:"datos"})); }
        if(cuentaDeNombre(nombre)){ res.writeHead(200,{"Content-Type":"application/json"}); return res.end(JSON.stringify({ok:false, error:"existe"})); }
        const token=nuevoToken();
        cuentas.push({nombre: nombre, passHash: hashPass(pass), token: token, creado: Date.now()});
        guardarCuentasArchivo();
        // Amarrar las entradas del Top que ya tengan ese nombre a esta cuenta
        ranking.forEach(function(r){ if(nombreClave(r.nombre)===nombreClave(nombre) && !r.cuenta) r.cuenta=nombreClave(nombre); });
        guardarRankingArchivo();
        res.writeHead(200,{"Content-Type":"application/json"}); return res.end(JSON.stringify({ok:true, nombre: nombre, token: token}));
      }catch(e){ res.writeHead(500,{"Content-Type":"application/json"}); return res.end(JSON.stringify({ok:false, error:"server"})); }
    });
    return;
  }
  if(req.url==="/cuenta/login" && req.method==="POST"){
    let body=""; req.on("data",c=>body+=c); req.on("end",()=>{
      try{
        const p=JSON.parse(body||"{}");
        const nombre=String(p.nombre||"").trim();
        const c=cuentaDeNombre(nombre);
        if(!c){ res.writeHead(200,{"Content-Type":"application/json"}); return res.end(JSON.stringify({ok:false, error:"no_existe"})); }
        if(c.passHash!==hashPass(p.pass||"")){ res.writeHead(200,{"Content-Type":"application/json"}); return res.end(JSON.stringify({ok:false, error:"pass"})); }
        c.token=nuevoToken(); guardarCuentasArchivo();
        res.writeHead(200,{"Content-Type":"application/json"}); return res.end(JSON.stringify({ok:true, nombre: c.nombre, token: c.token}));
      }catch(e){ res.writeHead(500,{"Content-Type":"application/json"}); return res.end(JSON.stringify({ok:false, error:"server"})); }
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
    // v1.7.4: fin de partida -> avisar al otro que la partida TERMINO (no que se salio)
    if(tipo==="sopa_fin" || tipo==="match_end"){
      const codigo=(d.room||d.sala||salaDe(ws)||"").toString().trim().toUpperCase();
      const s=salas.get(codigo); if(!s) return;
      s.jugadores.forEach(j=>{ if(j.ws!==ws) enviar(j.ws,{type:"sopa_fin", room:codigo, ganador:d.ganador, scores:d.scores}); });
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
        // v1.9.0: si el nombre tiene cuenta, sin su token no se puede actualizar por WebSocket
        if(cuentaDeNombre(p.nombre) && !tokenValido(p.nombre, d.token)){ return; }
      // v1.7.4: juntar por ID o por nombre+pais, y NUNCA bajar las estadisticas
      const ex=ranking.find(r=>r.id && p.id && r.id===p.id) || ranking.find(r=>r.nombre===p.nombre && (r.pais||"")===(p.pais||""));
      if(ex){
        const v=Math.max(ex.victorias||0, p.victorias||0), dd=Math.max(ex.derrotas||0, p.derrotas||0);
        if(p.nombre) ex.nombre=p.nombre; if(p.pais) ex.pais=p.pais; if(p.paisEmoji) ex.paisEmoji=p.paisEmoji;
        if(p.foto) ex.foto=p.foto; if(p.edad) ex.edad=p.edad; if(p.sexo) ex.sexo=p.sexo; if(p.id) ex.id=p.id;
        ex.victorias=v; ex.derrotas=dd; ex.activo=true; if(tokenValido(p.nombre, d.token)) ex.cuenta=nombreClave(p.nombre);
      } else { if(tokenValido(p.nombre, d.token)) p.cuenta=nombreClave(p.nombre); ranking.push(p); }
      guardarRankingArchivo(); // v1.7.5: guardar en archivo
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
server.listen(PORT,()=>console.log("SOPA DE 2 servidor v1.8.1 en puerto "+PORT));
