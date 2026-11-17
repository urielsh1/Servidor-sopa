// v1.12.0
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

const fs = require("fs");
const RANKING_FILE = __dirname + "/ranking.json";
function limpiarRanking(lista){
  var unicos=[];
  (lista||[]).forEach(function(r){
    if(!r || !r.nombre) return;
    r.victorias=r.victorias||0; r.derrotas=r.derrotas||0;
    var ex=unicos.find(function(u){ if(u.id && r.id && u.id===r.id) return true; if(nombreClave(u.nombre)===nombreClave(r.nombre) && (u.pais||"")===(r.pais||"")) return true; return false; }); // v1.12.32: Uriel y uriel son la MISMA casilla
    if(!ex) unicos.push(r);
    else { ex.victorias=Math.max(ex.victorias||0, r.victorias||0); ex.derrotas=Math.max(ex.derrotas||0, r.derrotas||0); if(!ex.id && r.id) ex.id=r.id; if(!ex.foto && r.foto) ex.foto=r.foto; if(!ex.edad && r.edad) ex.edad=r.edad; if(!ex.paisEmoji && r.paisEmoji) ex.paisEmoji=r.paisEmoji; if(!ex.sexo && r.sexo) ex.sexo=r.sexo; if(r.activo) ex.activo=true; if(r.ultimo) ex.ultimo=Math.max(ex.ultimo||0, r.ultimo); }
  });
  return unicos;
}
let ranking = [];
try{ ranking = limpiarRanking(JSON.parse(fs.readFileSync(RANKING_FILE, "utf8")||"[]")); }catch(e){ ranking = []; }
function guardarRankingArchivo(){ try{ fs.writeFileSync(RANKING_FILE, JSON.stringify(ranking)); }catch(e){} }
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
const CLAVE_9X = "uriel";
const BANEADOS_FILE = __dirname + "/baneados.json";
const OBJETOS_FILE = __dirname + "/objetos.json";
let baneados = [];
try{ baneados = JSON.parse(fs.readFileSync(BANEADOS_FILE, "utf8")||"[]"); }catch(e){ baneados = []; }
let objetos = [];
try{ objetos = JSON.parse(fs.readFileSync(OBJETOS_FILE, "utf8")||"[]"); }catch(e){ objetos = []; }
function guardarBaneadosArchivo(){ try{ fs.writeFileSync(BANEADOS_FILE, JSON.stringify(baneados)); }catch(e){} }
function guardarObjetosArchivo(){ try{ fs.writeFileSync(OBJETOS_FILE, JSON.stringify(objetos)); }catch(e){} }
const CHAT_FILE = __dirname + "/chat.json"; // v1.12.7: historial del chat, se guarda para que no se borre al salir
let chatGlobal=[];
try{ chatGlobal = JSON.parse(fs.readFileSync(CHAT_FILE, "utf8")||"[]"); }catch(e){ chatGlobal = []; }
function guardarChatArchivo(){ try{ fs.writeFileSync(CHAT_FILE, JSON.stringify(chatGlobal)); }catch(e){} }
const REPORTES_FILE = __dirname + "/reportes.json"; // v1.12.9: reportes del chat, solo el admin los ve
let reportes=[];
try{ reportes = JSON.parse(fs.readFileSync(REPORTES_FILE, "utf8")||"[]"); }catch(e){ reportes = []; }
// v1.12.10: migracion - reportes viejos (un mensaje, una categoria) pasan al formato agrupado por persona
reportes = reportes.map(function(r){
  if(r.categorias) return r;
  return {id: r.id, persona: (r.mensaje&&r.mensaje.nombre)||"", categorias: [r.categoria||"Otro"], reportadoPor: [r.reportadoPor||""].filter(function(x){ return !!x; }), mensajes: [Object.assign({}, r.mensaje||{}, {id: r.mensajeId||"", categoria: r.categoria||"Otro", ts: r.ts||Date.now()})], ts: r.ts||Date.now(), actualizado: r.ts||Date.now()};
});
const BUZON_FILE = __dirname + "/buzon.json"; // v1.12.10: correos de gracias, se borran despues de 1 dia
let buzon=[];
try{ buzon = JSON.parse(fs.readFileSync(BUZON_FILE, "utf8")||"[]"); }catch(e){ buzon = []; }
function guardarBuzonArchivo(){ try{ fs.writeFileSync(BUZON_FILE, JSON.stringify(buzon)); }catch(e){} }
function limpiarBuzon(){ const _antes = buzon.length; buzon = buzon.filter(function(c){ if(c.tipo==="compra") return true; return Date.now() - (c.ts||0) < 24*60*60*1000; }); if(buzon.length!==_antes) guardarBuzonArchivo(); }
// v1.12.10: REPORTES AGRUPADOS - si varios reportan a la misma persona, llega UN solo reporte con todos los motivos
function agregarReporte(persona, categoria, reportadoPor, snap){
  var _rep = reportes.find(function(r){ return nombreClave(r.persona||"")===nombreClave(persona||""); });
  if(!_rep){ _rep = {id:"r"+Date.now().toString(36)+Math.floor(Math.random()*1000), persona: persona, categorias: [], reportadoPor: [], mensajes: [], ts: Date.now(), actualizado: Date.now()}; reportes.push(_rep); }
  if(_rep.categorias.indexOf(categoria)<0) _rep.categorias.push(categoria);
  if(reportadoPor && _rep.reportadoPor.indexOf(reportadoPor)<0) _rep.reportadoPor.push(reportadoPor);
  if(snap){ var _ex = _rep.mensajes.find(function(m){ return m.id===snap.id; }); if(!_ex) _rep.mensajes.push(snap); }
  _rep.actualizado = Date.now();
  guardarReportesArchivo();
  return _rep;
}
function guardarReportesArchivo(){ try{ fs.writeFileSync(REPORTES_FILE, JSON.stringify(reportes)); }catch(e){} }
const MALAS_PALABRAS = ["pito","verga","pendejo","pendeja","puta","puto","mierda","cabron","cabrón","chinga","chingar","chingado","chingada","mamada","coño","joder","carajo","pinche"];
function contieneMalasPalabras(t){ const _t=String(t||"").toLowerCase(); return MALAS_PALABRAS.some(function(w){ return new RegExp("(^|[^a-záéíóúñ])"+w+"([^a-záéíóúñ]|$)","i").test(_t); }); }
let retosActivos=new Map(); // v1.12.6: retos del chat, id del retador -> {ws, perfil, victorias, derrotas, ts}
function generarCodigoReto(){ const L="ABCDEFGHIJKLMNOPQRSTUVWXYZ", A="ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"; let c=""; for(let i=0;i<3;i++) c+=L[Math.floor(Math.random()*L.length)]; c+="-"; for(let i=0;i<3;i++) c+=A[Math.floor(Math.random()*A.length)]; return c; }
function estaBaneado(nombre){ var _b = baneados.find(function(b){ return nombreClave(b.nombre)===nombreClave(nombre); }); if(!_b) return null; if(_b.hasta && _b.hasta <= Date.now()){ baneados = baneados.filter(function(b){ return nombreClave(b.nombre)!==nombreClave(nombre); }); guardarBaneadosArchivo(); return null; } return _b; }
function objetosDeJugador(nombre){ return objetos.filter(function(o){ return nombreClave(o.jugador)===nombreClave(nombre); }); }
function leerBody(req, cb){ let b=""; req.on("data",function(c){ b+=c; }); req.on("end",function(){ try{ cb(JSON.parse(b||"{}")); }catch(e){ cb({}); } }); }
function esClave(p){ return p && String(p.admin||"").toLowerCase()===CLAVE_9X; } // v1.12.26: la clave no distingue mayúsculas (Uriel = uriel)
const salas = new Map(); // codigo -> { jugadores: [{ws,id,perfil}], sopa }
function salaDe(ws){ for(const [codigo,s] of salas) if(s.jugadores.some(j=>j.ws===ws)) return codigo; return null; }
function enviar(ws,obj){ try{ if(ws.readyState===1) ws.send(JSON.stringify(obj)); }catch(e){} }

const server = http.createServer((req,res)=>{
  res.setHeader("Access-Control-Allow-Origin","*");
  res.setHeader("Access-Control-Allow-Methods","GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers","Content-Type");
  if(req.method==="OPTIONS"){ res.writeHead(204); return res.end(); }
  if(req.url==="/ranking" && req.method==="GET"){ ranking=limpiarRanking(ranking);
    // v1.8.1: quien no ha avisado "sigo aqui" en los ultimos 45 segundos -> bolita gris (desconectado)
    var _ahora=Date.now();
    ranking.forEach(function(r){ r.activo = !!(r.ultimo && (_ahora - r.ultimo < 45000)); }); // v1.12.3: 45s, no 2 min. El latido es cada 30s, asi que si falta 1 latido ya se marca desconectado y el Ranking lo refleja rapido.
    ranking.sort((a,b)=>(b.victorias||0)-(a.victorias||0)); res.writeHead(200,{"Content-Type":"application/json"}); return res.end(JSON.stringify(ranking.slice(0,99))); }
  if(req.url==="/ranking" && req.method==="POST"){
    let body=""; req.on("data",c=>body+=c); req.on("end",()=>{
      try{
        const p=JSON.parse(body||"{}");
        if(p.nombre){
          // v1.7.4: juntar por ID o por nombre+pais, y NUNCA bajar las estadisticas a 0 por un dato viejo
          var _cuentaNombre = nombreClave(p.nombre);
          var _cuenta = cuentaDeNombre(p.nombre);
          if(_cuenta && !tokenValido(p.nombre, p.token)){
            res.writeHead(403,{"Content-Type":"application/json"}); return res.end(JSON.stringify({ok:false, error:"nombre_vinculado"}));
          }
          // v1.12.34: el nombre de la casilla es el de la CUENTA (Uriel, no "uriel" escrito). Y si el token es valido, la casilla se busca por nombre solo (sin pais): un mismo nombre no se duplica por cambiar de pais.
        var _tokenOK = tokenValido(p.nombre, p.token);
        var _nombreFinal = _cuenta ? _cuenta.nombre : p.nombre;
        var _exId = ranking.find(r=>r.id && p.id && r.id===p.id);
        var _exNombre = ranking.find(r=>nombreClave(r.nombre)===nombreClave(p.nombre) && (r.pais||"")===(p.pais||"")) || (_tokenOK ? ranking.find(r=>nombreClave(r.nombre)===nombreClave(p.nombre)) : null);
        const ex = _exId || _exNombre;
          if(ex){
            const v=Math.max(ex.victorias||0, p.victorias||0), d=Math.max(ex.derrotas||0, p.derrotas||0);
          if(_exNombre && ex===_exNombre) ex.nombre=_nombreFinal; /* v1.12.34: si coincidio por nombre, la casilla queda con el nombre de la cuenta (Uriel, no uriel) */ if(p.pais) ex.pais=p.pais; if(p.paisEmoji) ex.paisEmoji=p.paisEmoji;
            if(p.foto) ex.foto=p.foto; if(p.edad) ex.edad=p.edad; if(p.sexo) ex.sexo=p.sexo; if(p.id) ex.id=p.id;
            ex.victorias=v; ex.derrotas=d; if(tokenValido(p.nombre, p.token)) ex.cuenta=_cuentaNombre;
            // v1.8.1: presencia. Si avisa que se fue -> gris ya. Si avisa que sigue -> verde y guardo cuando lo vi.
            if(p.activo===false){ ex.activo=false; ex.ultimo=0; }
            else { ex.activo=true; ex.ultimo=Date.now(); }
          } else ranking.push({...p, nombre:_nombreFinal, cuenta: (tokenValido(p.nombre, p.token)?_cuentaNombre:""), activo: p.activo!==false, ultimo: p.activo===false?0:Date.now(), victorias:p.victorias||0, derrotas:p.derrotas||0});
          ranking.sort((a,b)=>(b.victorias||0)-(a.victorias||0));
          ranking=ranking.slice(0,99);
          guardarRankingArchivo(); // v1.7.5: guardar en archivo para que no se borre
        }
      }catch(e){}
      res.writeHead(200,{"Content-Type":"application/json"}); res.end(JSON.stringify({ok:true}));
    });
    return;
  }
  if(req.url.indexOf("/cuenta/existe")===0 && req.method==="GET"){
    // v1.12.32: ¿este nombre ya tiene cuenta? Uriel = uriel (sin mayusculas). Lo usa MI PERFIL para decir "Ya esta registrado, intente con otro".
    var _nb = new URL(req.url, "http://x").searchParams.get("nombre") || "";
    var _c = cuentaDeNombre(_nb);
    res.writeHead(200,{"Content-Type":"application/json"});
    return res.end(JSON.stringify({ok:true, existe: !!_c}));
  }
  if(req.url==="/cuenta/fusionar" && req.method==="POST"){
    leerBody(req, function(p){
      // v1.12.34: FUSIÓN - todo lo de los nombres viejos pasa a UNA sola casilla (la de la cuenta). Nada se pierde.
      // Candidatos: el nombre viejo del perfil (Uriel2, mateo), la cuenta vieja, y TODAS las casillas con el mismo ID del telefono (un telefono = una casilla).
      var _nombre = String(p.nombre||"").trim();
      if(!_nombre || !tokenValido(_nombre, p.token)){
        res.writeHead(403,{"Content-Type":"application/json"});
        return res.end(JSON.stringify({ok:false, error:"no_autorizado"}));
      }
      var _cuenta = cuentaDeNombre(_nombre);
      var _canon = _cuenta ? _cuenta.nombre : _nombre;
      var _cands = [];
      function _agregarCandidato(nv){
        var _nv = String(nv||"").trim();
        if(_nv && nombreClave(_nv)!==nombreClave(_canon) && _cands.indexOf(nombreClave(_nv))<0) _cands.push(nombreClave(_nv));
      }
      _agregarCandidato(p.nombreViejo);
      _agregarCandidato(p.nombreViejoCuenta);
      if(p.id){
        ranking.forEach(function(r){ if(r.id && r.id===p.id) _agregarCandidato(r.nombre); });
      }
      _cands.forEach(function(_kV){
        // 1) RANKING: la casilla vieja se junta en la de la cuenta
        var _eCuenta = ranking.find(function(r){ return nombreClave(r.nombre)===nombreClave(_canon); });
        var _eViejo = ranking.find(function(r){ return r!==_eCuenta && nombreClave(r.nombre)===_kV; });
        if(_eViejo){
          if(_eCuenta){
            _eCuenta.victorias = Math.max(_eCuenta.victorias||0, _eViejo.victorias||0);
            _eCuenta.derrotas = Math.max(_eCuenta.derrotas||0, _eViejo.derrotas||0);
            if((_eViejo.ultimo||0) > (_eCuenta.ultimo||0)){ _eCuenta.ultimo = _eViejo.ultimo; _eCuenta.activo = !!_eViejo.activo; }
            if(!_eCuenta.paisEmoji && _eViejo.paisEmoji) _eCuenta.paisEmoji = _eViejo.paisEmoji;
            if(!_eCuenta.edad && _eViejo.edad) _eCuenta.edad = _eViejo.edad;
            if(!_eCuenta.sexo && _eViejo.sexo) _eCuenta.sexo = _eViejo.sexo;
            ranking = ranking.filter(function(r){ return r!==_eViejo; });
          } else {
            _eViejo.nombre = _canon; // la vieja pasa a ser la casilla de la cuenta
          }
        }
        // 2) NUBE: se junta todo en la cuenta - se queda lo mejor de cada cosa (oro, pistas, animaciones, niveles)
        var _nC = nube[nombreClave(_canon)], _nV = nube[_kV];
        if(_nV){
          if(!_nC){
            nube[nombreClave(_canon)] = {nombre: _canon, datos: _nV.datos, ts: _nV.ts};
          } else {
            var _dC = _nC.datos||{}, _dV = _nV.datos||{};
            var _masNuevoV = (_nV.ts||0) > (_nC.ts||0);
            var _anim = {};
            ["explosion","estrella","gato"].forEach(function(k){ _anim[k] = !!(_dC.animaciones && _dC.animaciones[k]) || !!(_dV.animaciones && _dV.animaciones[k]); });
            var _perfil = {};
            ["pais","paisEmoji","edad","sexo"].forEach(function(k){ _perfil[k] = (_dC.perfil && _dC.perfil[k]) || (_dV.perfil && _dV.perfil[k]) || ""; });
            nube[nombreClave(_canon)] = {nombre: _canon, datos: {
              monedas: Math.max(_dC.monedas||0, _dV.monedas||0),
              pistas: Math.max(_dC.pistas||0, _dV.pistas||0),
              animaciones: _anim,
              animacionEquipada: _masNuevoV ? (_dV.animacionEquipada||0) : (_dC.animacionEquipada||0),
              progreso: _masNuevoV ? (_dV.progreso||{}) : (_dC.progreso||{}),
              perfil: _perfil
            }, ts: Math.max(_nC.ts||0, _nV.ts||0)};
          }
          delete nube[_kV];
        }
        // 3) OBJETOS: los que le mandaron al nombre viejo pasan a la cuenta (sin duplicar)
        objetos.forEach(function(o){
          if(nombreClave(o.jugador)===_kV){
            var _ya = objetos.some(function(o2){ return o2!==o && nombreClave(o2.jugador)===nombreClave(_canon) && nombreClave(o2.objeto)===nombreClave(o.objeto); });
            if(!_ya){ o.jugador = _canon; }
          }
        });
      });
      // La casilla de la cuenta queda con el nombre de la cuenta (Uriel, no uriel) y el ID de este telefono
      var _eCuenta2 = ranking.find(function(r){ return nombreClave(r.nombre)===nombreClave(_canon); });
      if(_eCuenta2){ _eCuenta2.nombre = _canon; if(p.id) _eCuenta2.id = p.id; }
      ranking.sort(function(a,b){ return (b.victorias||0)-(a.victorias||0); });
      guardarRankingArchivo(); guardarNubeArchivo(); guardarObjetosArchivo();
      res.writeHead(200,{"Content-Type":"application/json"});
      return res.end(JSON.stringify({ok:true, fusionado:true}));
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
  if(req.url==="/cuenta/eliminar" && req.method==="POST"){
    let body=""; req.on("data",c=>body+=c); req.on("end",()=>{
      try{
        const p=JSON.parse(body||"{}");
        const nombre=String(p.nombre||"").trim();
        const c=cuentaDeNombre(nombre);
        var _autorizado = tokenValido(nombre, p.token) || (p.pass && c && c.passHash===hashPass(p.pass));
        if(!c || !_autorizado){ res.writeHead(403,{"Content-Type":"application/json"}); return res.end(JSON.stringify({ok:false, error:"no_autorizado"})); }
        cuentas=cuentas.filter(function(x){ return x!==c; });
        guardarCuentasArchivo();
        // v1.12.34: borrar la cuenta YA NO borra su casilla del ranking (ahi se perdian las victorias). La casilla se queda y se fusiona cuando entres a otra cuenta.
        res.writeHead(200,{"Content-Type":"application/json"}); return res.end(JSON.stringify({ok:true, nombre: c.nombre}));
      }catch(e){ res.writeHead(500,{"Content-Type":"application/json"}); return res.end(JSON.stringify({ok:false, error:"server"})); }
    });
    return;
  }
  if(req.url.indexOf("/admin/jugadores")===0 && req.method==="GET"){
    var _adm = new URL(req.url, "http://x").searchParams.get("admin");
    if(String(_adm||"").toLowerCase()!==CLAVE_9X){ res.writeHead(403,{"Content-Type":"application/json"}); return res.end(JSON.stringify({ok:false, error:"no_admin"})); }
    var mapa = {};
    ranking.forEach(function(r){ if(!r || !r.nombre) return; var k=nombreClave(r.nombre); mapa[k]={nombre:r.nombre, pais:r.pais||"", paisEmoji:r.paisEmoji||"", foto:r.foto||"", edad:r.edad||"", victorias:r.victorias||0, derrotas:r.derrotas||0, activo:!!r.activo, tieneCuenta:!!r.cuenta, creadoCuenta:0}; });
    cuentas.forEach(function(c){ if(!c || !c.nombre) return; var k=nombreClave(c.nombre); if(!mapa[k]) mapa[k]={nombre:c.nombre, pais:"", paisEmoji:"", foto:"", edad:"", victorias:0, derrotas:0, activo:false, tieneCuenta:true, creadoCuenta:c.creado||0}; else { mapa[k].tieneCuenta=true; mapa[k].creadoCuenta=c.creado||0; } });
    var jugadores = Object.keys(mapa).map(function(k){ return mapa[k]; });
    jugadores.sort(function(a,b){ return (b.victorias||0)-(a.victorias||0); });
    res.writeHead(200,{"Content-Type":"application/json"});
    return res.end(JSON.stringify({ok:true, jugadores: jugadores, baneados: baneados, objetos: objetos}));
  }
    if(req.url.indexOf("/admin/reportes")===0 && req.method==="GET"){
    var _adm = new URL(req.url, "http://x").searchParams.get("admin");
    if(String(_adm||"").toLowerCase()!==CLAVE_9X){ res.writeHead(403,{"Content-Type":"application/json"}); return res.end(JSON.stringify({ok:false, error:"no_admin"})); }
    res.writeHead(200,{"Content-Type":"application/json"}); return res.end(JSON.stringify({ok:true, reportes: reportes}));
  }
  if(req.url==="/admin/reportes/borrar" && req.method==="POST"){
    leerBody(req, function(p){
      if(!esClave(p)){ res.writeHead(403,{"Content-Type":"application/json"}); return res.end(JSON.stringify({ok:false, error:"no_admin"})); }
      reportes = reportes.filter(function(r){ return r.id!==String(p.id||""); });
      guardarReportesArchivo();
      res.writeHead(200,{"Content-Type":"application/json"}); res.end(JSON.stringify({ok:true, reportes: reportes}));
    });
    return;
  }
  if(req.url==="/admin/ban" && req.method==="POST"){
    leerBody(req, function(p){
      if(!esClave(p)){ res.writeHead(403,{"Content-Type":"application/json"}); return res.end(JSON.stringify({ok:false, error:"no_admin"})); }
      var nombre=String(p.nombre||"").trim();
      if(!nombre){ res.writeHead(400,{"Content-Type":"application/json"}); return res.end(JSON.stringify({ok:false, error:"sin_nombre"})); }
      var _motivo = String(p.motivo||"Baneado por el admin");
      var _tipo = String(p.tipo||"permanente");
      var _cant = parseInt(p.cantidad||0, 10);
      var _hasta = null;
      if(_tipo==="minutos" && _cant>0) _hasta = Date.now() + _cant*60*1000;
      else if(_tipo==="horas" && _cant>0) _hasta = Date.now() + _cant*60*60*1000;
      else if(_tipo==="dias" && _cant>0) _hasta = Date.now() + _cant*24*60*60*1000;
      else _tipo = "permanente";
      var _ex = baneados.find(function(b){ return nombreClave(b.nombre)===nombreClave(nombre); });
      if(_ex){ _ex.motivo=_motivo; _ex.tipo=_tipo; _ex.hasta=_hasta; _ex.fecha=Date.now(); }
      else baneados.push({nombre: nombre, motivo: _motivo, fecha: Date.now(), tipo: _tipo, hasta: _hasta});
      // v1.12.10: CORREO DE GRACIAS - al que reporto le llega un correo cuando el admin banea
      if(p.reporteId){
        var _rp = reportes.find(function(r){ return r.id===String(p.reporteId); });
        if(_rp){
          var _tiempoTxt = _tipo==="permanente" ? "Permanente" : _cant + " " + (_tipo==="horas" ? (_cant===1 ? "hora" : "horas") : (_cant===1 ? "minuto" : "minutos"));
          (_rp.reportadoPor||[]).forEach(function(_dest){
            if(!_dest || _dest==="Auto") return;
            limpiarBuzon();
            buzon.push({id:"c"+Date.now().toString(36)+Math.floor(Math.random()*1000)+Math.floor(Math.random()*1000), para:_dest, titulo:"Resultados de tu reporte", texto:"Hola querido "+_dest+", has reportado a "+nombre+" por "+_motivo+" y quiero agradecerte por mantener un juego limpio y justo para todos.\n\nDetalles:\nPersona: "+nombre+"\nTiempo de su baneo: "+_tiempoTxt+"\nBaneo de tiempo: "+_tiempoTxt+"\nMotivo: "+_motivo, ts:Date.now(), leido:false});
          });
          guardarBuzonArchivo();
        }
      }
      guardarBaneadosArchivo();
      res.writeHead(200,{"Content-Type":"application/json"}); res.end(JSON.stringify({ok:true, baneados: baneados}));
    });
    return;
  }
  if(req.url==="/admin/desbanear" && req.method==="POST"){
    leerBody(req, function(p){
      if(!esClave(p)){ res.writeHead(403,{"Content-Type":"application/json"}); return res.end(JSON.stringify({ok:false, error:"no_admin"})); }
      var nombre=String(p.nombre||"").trim();
      baneados = baneados.filter(function(b){ return nombreClave(b.nombre)!==nombreClave(nombre); });
      guardarBaneadosArchivo();
      res.writeHead(200,{"Content-Type":"application/json"}); res.end(JSON.stringify({ok:true, baneados: baneados}));
    });
    return;
  }
  if(req.url==="/admin/objeto" && req.method==="POST"){
    leerBody(req, function(p){
      if(!esClave(p)){ res.writeHead(403,{"Content-Type":"application/json"}); return res.end(JSON.stringify({ok:false, error:"no_admin"})); }
      var jugador=String(p.jugador||"").trim();
      var objeto=String(p.objeto||"").trim();
      var cant=parseInt(p.cantidad||1, 10); if(!cant || cant<1) cant=1;
      if(!jugador || !objeto){ res.writeHead(400,{"Content-Type":"application/json"}); return res.end(JSON.stringify({ok:false, error:"sin_datos"})); }
      var ex = objetos.find(function(o){ return nombreClave(o.jugador)===nombreClave(jugador) && nombreClave(o.objeto)===nombreClave(objeto); });
      if(ex){ ex.cantidad=(ex.cantidad||0)+cant; ex.fecha=Date.now(); }
      else objetos.push({jugador: jugador, objeto: objeto, cantidad: cant, fecha: Date.now()});
      guardarObjetosArchivo();
      res.writeHead(200,{"Content-Type":"application/json"}); res.end(JSON.stringify({ok:true, objetos: objetosDeJugador(jugador)}));
    });
    return;
  }
  if(req.url==="/admin/quitar-objeto" && req.method==="POST"){
    leerBody(req, function(p){
      if(!esClave(p)){ res.writeHead(403,{"Content-Type":"application/json"}); return res.end(JSON.stringify({ok:false, error:"no_admin"})); }
      var jugador=String(p.jugador||"").trim();
      var objeto=String(p.objeto||"").trim();
      objetos = objetos.filter(function(o){ return !(nombreClave(o.jugador)===nombreClave(jugador) && nombreClave(o.objeto)===nombreClave(objeto)); });
      guardarObjetosArchivo();
      res.writeHead(200,{"Content-Type":"application/json"}); res.end(JSON.stringify({ok:true, objetos: objetosDeJugador(jugador)}));
    });
    return;
  }
  if(req.url==="/admin/victorias" && req.method==="POST"){
    leerBody(req, function(p){
      if(!esClave(p)){ res.writeHead(403,{"Content-Type":"application/json"}); return res.end(JSON.stringify({ok:false, error:"no_admin"})); }
      var jugador=String(p.jugador||p.nombre||"").trim();
      var cant=parseInt(p.victorias||p.cantidad||0, 10); if(!cant || cant<1) cant=1;
      var derr=parseInt(p.derrotas||0, 10); if(!derr || derr<0) derr=0;
      if(!jugador){ res.writeHead(400,{"Content-Type":"application/json"}); return res.end(JSON.stringify({ok:false, error:"sin_datos"})); }
      // v1.12.3: el admin puede DAR victorias (suman, no reemplazan). Asi el Ranking las refleja de verdad.
      var ex = ranking.find(function(r){ return nombreClave(r.nombre)===nombreClave(jugador); });
      if(ex){ ex.victorias=(ex.victorias||0)+cant; ex.derrotas=(ex.derrotas||0)+derr; }
      else ranking.push({nombre: jugador, pais:"", paisEmoji:"", foto:"", edad:"", sexo:"", victorias: cant, derrotas: derr, activo:false, ultimo:0});
      ranking.sort(function(a,b){ return (b.victorias||0)-(a.victorias||0); });
      ranking=ranking.slice(0,99);
      guardarRankingArchivo();
      res.writeHead(200,{"Content-Type":"application/json"}); res.end(JSON.stringify({ok:true, jugador: jugador, victorias: ex?ex.victorias:cant, derrotas: ex?ex.derrotas:derr}));
    });
    return;
  }
  if(req.url==="/admin/enviar-compra" && req.method==="POST"){
    leerBody(req, function(p){
      if(!esClave(p)){ res.writeHead(403,{"Content-Type":"application/json"}); return res.end(JSON.stringify({ok:false, error:"no_admin"})); }
      var _jug = String(p.jugador||"").trim();
      var _obj = String(p.objeto||"").trim();
      if(!_jug || !_obj){ res.writeHead(400,{"Content-Type":"application/json"}); return res.end(JSON.stringify({ok:false, error:"falta jugador u objeto"})); }
      var _cant = parseInt(p.cantidad||"0", 10) || 0;
      var _tit = (_obj==="monedas") ? ("🪙 " + _cant + " monedas") : (_obj==="animacion_explosion") ? "💥 Animación Explosión" : (_obj==="animacion_estrella") ? "⭐ Animación Estrella" : (_obj==="animacion_gato") ? "🐱 Animación Gato" : "🎁 Regalo";
      var _mail = {id: "c" + Date.now().toString(36) + Math.floor(Math.random()*1000), para: _jug, tipo: "compra", objeto: _obj, cantidad: _cant, titulo: _tit, texto: "Te mandaron un regalo 🎁", leido: false, ts: Date.now()};
      buzon.push(_mail);
      guardarBuzonArchivo();
      res.writeHead(200,{"Content-Type":"application/json"}); res.end(JSON.stringify({ok:true}));
    });
    return;
  }
  if(req.url==="/buzon/reclamar" && req.method==="POST"){
    leerBody(req, function(p){
      var _nb = String(p.nombre||"");
      var _id = String(p.id||"");
      var _ix = buzon.findIndex(function(c){ return String(c.id||"")===_id && nombreClave(c.para)===nombreClave(_nb) && c.tipo==="compra"; });
      if(_ix<0){ res.writeHead(404,{"Content-Type":"application/json"}); return res.end(JSON.stringify({ok:false, error:"no encontrado"})); }
      var _c = buzon[_ix];
      buzon.splice(_ix, 1);
      guardarBuzonArchivo();
      res.writeHead(200,{"Content-Type":"application/json"}); res.end(JSON.stringify({ok:true, objeto: _c.objeto, cantidad: _c.cantidad||0}));
    });
    return;
  }
  if(req.url.indexOf("/buzon")===0 && req.method==="GET"){
    limpiarBuzon();
    var _nb2 = new URL(req.url, "http://x").searchParams.get("nombre") || "";
    var _correos = buzon.filter(function(c){ return nombreClave(c.para)===nombreClave(_nb2); }).slice().reverse();
    res.writeHead(200,{"Content-Type":"application/json"});
    return res.end(JSON.stringify({ok:true, correos: _correos}));
  }
  if(req.url==="/buzon/leer" && req.method==="POST"){
    leerBody(req, function(p){
      var _nb3 = String(p.nombre||"");
      limpiarBuzon();
      buzon.forEach(function(c){ if(nombreClave(c.para)===nombreClave(_nb3)) c.leido = true; });
      guardarBuzonArchivo();
      res.writeHead(200,{"Content-Type":"application/json"}); res.end(JSON.stringify({ok:true}));
    });
    return;
  }
  if(req.url.indexOf("/baneado")===0 && req.method==="GET"){
    var _nb = new URL(req.url, "http://x").searchParams.get("nombre") || "";
    var _b = estaBaneado(_nb);
    res.writeHead(200,{"Content-Type":"application/json"});
    return res.end(JSON.stringify({ok:true, baneado: !!_b, motivo: _b ? (_b.motivo||"") : "", tipo: _b ? (_b.tipo||"permanente") : "", hasta: _b ? (_b.hasta||null) : null}));
  }
  if(req.url.indexOf("/objetos")===0 && req.method==="GET"){
    var _oj = new URL(req.url, "http://x").searchParams.get("jugador") || "";
    res.writeHead(200,{"Content-Type":"application/json"});
    return res.end(JSON.stringify({ok:true, objetos: objetosDeJugador(_oj)}));
  }
  if(req.url==="/nube/guardar" && req.method==="POST"){
    leerBody(req, function(p){
      var _nb = String(p.nombre||"").trim();
      var _datos = p.datos;
      if(!_nb || !_datos || typeof _datos!=="object"){ res.writeHead(400,{"Content-Type":"application/json"}); return res.end(JSON.stringify({ok:false, error:"falta nombre o datos"})); }
      // v1.12.36: NUNCA pisar un guardado con cosas con un guardado vacio (reinstalacion que sube 0 monedas / 0 niveles). Si viene vacio y lo guardado tiene cosas, se ignora y se queda lo bueno.
      var _viejo = nube[nombreClave(_nb)];
      var _tieneAnim = function(dd){ return !!(dd && dd.animaciones && (dd.animaciones.explosion || dd.animaciones.estrella || dd.animaciones.gato)); };
      var _nuevoVacio = !(_datos.monedas||0) && !(_datos.progreso && Object.keys(_datos.progreso).length) && !_tieneAnim(_datos) && !((_datos.pistas||0) > 2);
      var _viejoConCosas = !!(_viejo && _viejo.datos && ((_viejo.datos.monedas||0) > 0 || (_viejo.datos.progreso && Object.keys(_viejo.datos.progreso).length) || _tieneAnim(_viejo.datos) || ((_viejo.datos.pistas||0) > 2)));
      if(_viejo && _nuevoVacio && _viejoConCosas){ res.writeHead(200,{"Content-Type":"application/json"}); return res.end(JSON.stringify({ok:true, ignorado:true, motivo:"guardado vacio", version:"v1.12.40"})); }
      nube[nombreClave(_nb)] = {nombre: _nb, datos: _datos, ts: Date.now()};
      guardarNubeArchivo();
      res.writeHead(200,{"Content-Type":"application/json"}); res.end(JSON.stringify({ok:true, version:"v1.12.40"}));
    });
    return;
  }
  if(req.url.indexOf("/nube/cargar")===0 && req.method==="GET"){
    var _nb2 = new URL(req.url, "http://x").searchParams.get("nombre") || "";
    var _reg = nube[nombreClave(_nb2)];
    if(!_reg){ res.writeHead(200,{"Content-Type":"application/json"}); return res.end(JSON.stringify({ok:false, error:"sin datos"})); }
    res.writeHead(200,{"Content-Type":"application/json"}); return res.end(JSON.stringify({ok:true, datos: _reg.datos, ts: _reg.ts, version:"v1.12.40"}));
  }
  res.writeHead(200,{"Content-Type":"text/plain"}); res.end("ok");
});

// v1.12.29: NUBE - guardado del progreso (monedas, pistas, animaciones, niveles, perfil). Clave = nombre del jugador.
const NUBE_FILE = __dirname + "/nube.json";
let nube = {};
try{ nube = JSON.parse(fs.readFileSync(NUBE_FILE, "utf8")||"{}"); }catch(e){ nube = {}; }
function guardarNubeArchivo(){ try{ fs.writeFileSync(NUBE_FILE, JSON.stringify(nube)); }catch(e){} }

const wss = new WebSocket.Server({ server });
wss.on("connection",(ws)=>{
  ws.on("message",(raw)=>{
    try{ _manejarMensaje(ws, raw); }catch(e){ try{ console.log("mensaje fallo:", e && e.message); }catch(_){} }
  });
  ws.on("close",()=>{
    retosActivos.forEach(function(v,k){ if(v.ws===ws) retosActivos.delete(k); }); // v1.12.6: si se va, su reto muere
    const codigo=salaDe(ws); if(!codigo) return;
    const s=salas.get(codigo); if(!s) return;
    s.jugadores=s.jugadores.filter(j=>j.ws!==ws);
    s.jugadores.forEach(j=>enviar(j.ws,{type:"peer_left", room:codigo}));
    if(s.jugadores.length===0) salas.delete(codigo);
  });
});
function _manejarMensaje(ws, raw){
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
      s.jugadores.forEach(j=>{ if(j.ws!==ws) enviar(j.ws,{type:"sopa_word", room:codigo, palabra, jugador:d.jugador||d.player, celdas, animacion: d.animacion||0}); });
      return;
    }
        // v1.12.5: CHAT DE TODOS - solo texto (max 200), se manda a TODOS los conectados, baneados no escriben
    if(tipo==="chat"){
      const _texto = String(d.texto||"").trim().slice(0,200);
      const _nombre = (d.perfil&&d.perfil.nombre)||"";
      if(!_texto || !_nombre) return;
      if(estaBaneado(_nombre)){ enviar(ws,{type:"chat_error", error:"baneado"}); return; }
      const _msg = {type:"chat", id:"m"+Date.now().toString(36)+Math.floor(Math.random()*1000), nombre:_nombre, paisEmoji:(d.perfil&&d.perfil.paisEmoji)||"", victorias:d.victorias||0, derrotas:d.derrotas||0, texto:_texto, reacciones:{}};
      chatGlobal.push(_msg);
      while(chatGlobal.length>50) chatGlobal.shift();
      // v1.12.31: REPARTIR PRIMERO, guardar despues. Antes si guardar o el auto-reporte fallaba, el mensaje nunca llegaba a nadie y se veia como si el chat estuviera roto.
      wss.clients.forEach(function(c){ try{ enviar(c,_msg); }catch(e){} });
      try{ guardarChatArchivo(); }catch(e){} // v1.12.7: guardar historial
      // v1.12.9: AUTO-REPORTE - si el mensaje trae malas palabras, solo ese mensaje sale en Malas palabras del admin
      try{
        if(contieneMalasPalabras(_texto)){
          agregarReporte(_msg.nombre, "Malas palabras", "Auto", {id:_msg.id, nombre:_msg.nombre, paisEmoji:_msg.paisEmoji, texto:_msg.texto, victorias:_msg.victorias, derrotas:_msg.derrotas, ts:Date.now(), categoria:"Malas palabras"});
        }
      }catch(e){}
      return;
    }
        // v1.12.8: REACCIONES estilo WhatsApp - mantener presionado un mensaje y elegir emoji, todos las ven
    if(tipo==="reaccion"){
      const _n=(d.perfil&&d.perfil.nombre)||d.nombre||"";
      if(!_n) return;
      if(estaBaneado(_n)){ enviar(ws,{type:"chat_error", error:"baneado"}); return; }
      const _m = chatGlobal.find(function(x){ return x.id===d.id; });
      if(!_m) return;
      if(!_m.reacciones) _m.reacciones={};
      const _emoji=String(d.emoji||"");
      const _ya = _emoji && (_m.reacciones[_emoji]||[]).indexOf(_n)>=0;
      Object.keys(_m.reacciones).forEach(function(e){ _m.reacciones[e]=(_m.reacciones[e]||[]).filter(function(n){ return n!==_n; }); if(_m.reacciones[e].length===0) delete _m.reacciones[e]; });
      if(_emoji && !_ya){ if(!_m.reacciones[_emoji]) _m.reacciones[_emoji]=[]; _m.reacciones[_emoji].push(_n); }
      guardarChatArchivo();
      const _r={type:"reaccion", id:_m.id, reacciones:_m.reacciones};
      wss.clients.forEach(function(c){ try{ enviar(c,_r); }catch(e){} });
      return;
    }
    // v1.12.9: REPORTES - un jugador reporta un mensaje, el admin lo ve dividido por categoria
    if(tipo==="reporte"){
      const _n=(d.perfil&&d.perfil.nombre)||d.nombre||"";
      if(!_n) return;
      const _cat=String(d.categoria||"");
      if(["Comportamiento tóxico","Acoso sexual","Malas palabras","Otro"].indexOf(_cat)<0) return;
      const _m = chatGlobal.find(function(x){ return x.id===d.id; });
      if(!_m) return;
      agregarReporte(_m.nombre, _cat, _n, {id:_m.id, nombre:_m.nombre, paisEmoji:_m.paisEmoji, texto:_m.texto, victorias:_m.victorias, derrotas:_m.derrotas, ts:Date.now(), categoria:_cat});
      enviar(ws,{type:"reporte_ok"});
      return;
    }
// v1.12.6: RETO desde el chat - un jugador reta a todos, si alguien acepta, los 2 entran a una sala con codigo secreto
    if(tipo==="reto"){
      const _nombre=(d.perfil&&d.perfil.nombre)||"";
      if(!_nombre) return;
      if(estaBaneado(_nombre)){ enviar(ws,{type:"chat_error", error:"baneado"}); return; }
      const _id=d.id||("R"+Date.now());
      const _ahora=Date.now();
      retosActivos.forEach(function(v,k){ if(_ahora-v.ts>60000) retosActivos.delete(k); });
      retosActivos.set(_id, {ws:ws, perfil:d.perfil, victorias:d.victorias||0, derrotas:d.derrotas||0, ts:_ahora});
      const _msg={type:"reto", de:{nombre:_nombre, paisEmoji:(d.perfil&&d.perfil.paisEmoji)||"", victorias:d.victorias||0, derrotas:d.derrotas||0, id:_id}};
      wss.clients.forEach(function(c){ try{ if(c!==ws) enviar(c,_msg); }catch(e){} });
      return;
    }
    if(tipo==="reto_cancelar"){
      retosActivos.delete(d.id||"");
      return;
    }
    if(tipo==="reto_aceptado"){
      const _rid=d.retadorId||"";
      const _reto=retosActivos.get(_rid);
      if(!_reto || Date.now()-_reto.ts>60000){ enviar(ws,{type:"reto_error", error:"reto_no_disponible"}); return; }
      if(!_reto.ws || _reto.ws.readyState!==1){ retosActivos.delete(_rid); enviar(ws,{type:"reto_error", error:"reto_no_disponible"}); return; }
      const _codigo=generarCodigoReto();
      const _aceptador={nombre:(d.perfil&&d.perfil.nombre)||"Jugador", paisEmoji:(d.perfil&&d.perfil.paisEmoji)||"", victorias:d.victorias||0, derrotas:d.derrotas||0, id:d.id||""};
      const _retador={nombre:(_reto.perfil&&_reto.perfil.nombre)||"Jugador", paisEmoji:(_reto.perfil&&_reto.perfil.paisEmoji)||"", victorias:_reto.victorias||0, derrotas:_reto.derrotas||0, id:_rid};
      retosActivos.delete(_rid);
      enviar(_reto.ws, {type:"reto_listo", room:_codigo, rival:_aceptador});
      enviar(ws, {type:"reto_listo", room:_codigo, rival:_retador});
      return;
    }
    // v1.12.7: HISTORIAL - al entrar al chat, mandar los ultimos 50 mensajes guardados
    if(tipo==="chat_historial"){
      enviar(ws, {type:"chat_historial", mensajes: chatGlobal});
      return;
    }
if(tipo==="ranking_update" && d.perfil){
      const p={id:d.id, ...d.perfil, victorias:d.victorias||0, derrotas:d.derrotas||0};
        if(cuentaDeNombre(p.nombre) && !tokenValido(p.nombre, d.token)){ return; }
      // v1.7.4: juntar por ID o por nombre+pais, y NUNCA bajar las estadisticas
      var _tokenOK2 = tokenValido(p.nombre, d.token);
        var _cuenta2 = cuentaDeNombre(p.nombre);
        var _nombreFinal2 = _cuenta2 ? _cuenta2.nombre : p.nombre;
        var _exId2 = ranking.find(r=>r.id && p.id && r.id===p.id);
        var _exNombre2 = ranking.find(r=>nombreClave(r.nombre)===nombreClave(p.nombre) && (r.pais||"")===(p.pais||"")) || (_tokenOK2 ? ranking.find(r=>nombreClave(r.nombre)===nombreClave(p.nombre)) : null);
        const ex=_exId2 || _exNombre2;
      if(ex){
        const v=Math.max(ex.victorias||0, p.victorias||0), dd=Math.max(ex.derrotas||0, p.derrotas||0);
        if(_exNombre2 && ex===_exNombre2) ex.nombre=_nombreFinal2; /* v1.12.34: si coincidio por nombre, la casilla queda con el nombre de la cuenta */ if(p.pais) ex.pais=p.pais; if(p.paisEmoji) ex.paisEmoji=p.paisEmoji;
        if(p.foto) ex.foto=p.foto; if(p.edad) ex.edad=p.edad; if(p.sexo) ex.sexo=p.sexo; if(p.id) ex.id=p.id;
        ex.victorias=v; ex.derrotas=dd; ex.activo=true; if(tokenValido(p.nombre, d.token)) ex.cuenta=nombreClave(p.nombre);
      } else { p.nombre=_nombreFinal2; if(tokenValido(p.nombre, d.token)) p.cuenta=nombreClave(p.nombre); ranking.push(p); }
      guardarRankingArchivo(); // v1.7.5: guardar en archivo
      return;
    }
}

const PORT=process.env.PORT||10000;
server.listen(PORT,()=>console.log("SOPA DE 2 servidor v1.12.40 en puerto "+PORT));