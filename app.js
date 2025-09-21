
//SECCION PRINCIPAL.

// COMENZAMOS CON LA PARTE DEL ANALISIS LEXICO Y SINTACTICO, PARA LUEGO PASAR A LA GENERACION DE REPORTES
function descargar(filename, text) {
  const blob = new Blob([text], {type: "text/plain;charset=utf-8"});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 0);
}


//renderizando....
function esc(s) {
  const str = String(s);
  let out = "";
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (ch === "&") out += "&amp;";
    else if (ch === "<") out += "&lt;";
    else if (ch === ">") out += "&gt;";
    else out += ch;
  }
  return out;
}

//parte principal del analisis lexico y sintactico....
//se puede mejorar mucho
class Lexer {
  constructor() {
    this.source = "";
    this.i = 0;
    this.line = 1;
    this.col = 1;
    this.tokens = [];
    this.errors = [];



    // Palabras que son especificas al buscar y leer el archivo.
    this.reserved = [
      "TORNEO", "EQUIPOS", "ELIMINACION",
      "equipo", "jugador", "jugadores",
      "posicion", "numero", "edad", "nombre", "sede",
      "fase", "cuartos", "semifinal", "final",
      "partido", "resultado", "goleador", "goleadores",
      "vs", "minuto", "equipos" //
    ];
  }

  setSource(text) {
    this.source = text || "";
    this.i = 0;
    this.line = 1;
    this.col = 1;
    this.tokens = [];
    this.errors = [];
  }

  // Verifica si hemos llegado al final del archivo de texto
  eof() { return this.i >= this.source.length; }
  
  // lee el caracter.
  peek() { return this.source[this.i] || ""; }
  
  // lee y avanza...
  next() {
    // Obtiene el carácter actual y aumenta el índice en 1
    const ch = this.source[this.i++] || "";
    
    // Si encontramos un salto de línea, aumentamos el número de línea y reiniciamos la columna
    if (ch === "\n") {
      this.line++; this.col = 1;
    } else {
      // Si no es salto de línea, solo aumentamos la columna
      this.col++;
    }
    
    // Retorna el carácter que acabamos de consumir
    return ch;
  }

  isAlpha(ch) {
    const code = ch.charCodeAt(0);
    return (code>=65 && code<=90) || (code>=97 && code<=122) || ch === '_' || ch === 'ñ' || ch === 'Ñ';
  }
  isDigit(ch) { const c=ch.charCodeAt(0); return c>=48 && c<=57; }
  isWhitespace(ch) { return ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n'; }

  addToken(type, lexeme, line, col) {
    this.tokens.push({type, lexeme, line, col});
  }
  addError(desc, line, col) {
    this.errors.push({desc, line, col});
  }

  scan() {
    while(!this.eof()) {
      let ch = this.peek();

      // Saltar espacios
      if (this.isWhitespace(ch)) { this.next(); continue; }

      const startLine = this.line, startCol = this.col;

      // Símbolos simples
      if (ch === '{') { this.next(); this.addToken('LLAVE_IZQ', '{', startLine, startCol); continue; }
      if (ch === '}') { this.next(); this.addToken('LLAVE_DER', '}', startLine, startCol); continue; }
      if (ch === '[') { this.next(); this.addToken('CORCHETE_IZQ', '[', startLine, startCol); continue; }
      if (ch === ']') { this.next(); this.addToken('CORCHETE_DER', ']', startLine, startCol); continue; }
      if (ch === ':') { this.next(); this.addToken('DOS_PUNTOS', ':', startLine, startCol); continue; }
      if (ch === ',') { this.next(); this.addToken('COMA', ',', startLine, startCol); continue; }

      // Cadenas entre comillas
      if (ch === '"') {
        this.next(); // consume opening "
        let value = "";
        let l = startLine, c = startCol; // pos del token
        let closed = false;
        while (!this.eof()) {
          let k = this.peek();
          if (k === '"') { this.next(); closed = true; break; }
          if (k === '\\') { // escape básico
            this.next();
            let nxt = this.peek();
            if (nxt === '"' || nxt === '\\') { value += nxt; this.next(); }
            else { value += '\\' + nxt; this.next(); }
          } else {
            value += this.next();
          }
        }
        if (!closed) {
          this.addError('Cadena sin cerrar', l, c);
        } else {
          this.addToken('CADENA', value, l, c);
        }
        continue;
      }

      // Números
      if (this.isDigit(ch)) {
        let num = "";
        while(!this.eof() && this.isDigit(this.peek())) { num += this.next(); }
        this.addToken('NUMERO', num, startLine, startCol);
        continue;
      }

      // Identificadores / Palabras reservadas
      if (this.isAlpha(ch)) {
        let word = "";
        while(!this.eof()) {
          let p = this.peek();
          if (this.isAlpha(p) || this.isDigit(p)) { word += this.next(); }
          else break;
        }

        // Determinar si es reservada (case sensitive como se muestra en el enunciado)
        // Para atributos en minúscula y secciones en mayúscula incluimos ambas variantes en this.reserved
        let isReserved = false;
        for (let i=0;i<this.reserved.length;i++) {
          if (this.reserved[i] === word) { isReserved = true; break; }
        }
        if (isReserved) this.addToken('RESERVADA', word, startLine, startCol);
        else this.addToken('IDENT', word, startLine, startCol);
        continue;
      }

      // Cualquier otro caracter no reconocido
      this.addError(`Caracter no reconocido «${ch}»`, startLine, startCol);
      this.next();
    }

    return { tokens: this.tokens, errors: this.errors };
  }
}








// ---------------- Parser muy simple (sobre los tokens reconocidos) ----------------
class Parser {
  constructor(tokens) {
    this.tokens = tokens || [];
    this.i = 0;
  }
  peek() { return this.tokens[this.i] || null; }
  next() { return this.tokens[this.i++] || null; }
  match(type, lexeme) {
    const tk = this.peek();
    if (!tk) return false;
    if (tk.type !== type) return false;
    if (typeof lexeme !== "undefined" && tk.lexeme !== lexeme) return false;
    this.next();
    return true;
  }

  // Helper: expect token; throws if not found (para robustez)
  expect(type, lexeme) {
    const tk = this.peek();
    if (!this.match(type, lexeme)) {
      throw new Error(`Se esperaba ${lexeme || type} cerca de línea ${tk ? tk.line : "?"}`);
    }
    return tk;
  }

  parseAll() {
    // Modelo de salida
    const model = {
      torneo: { nombre: null, equiposCant: null, sede: null },
      equipos: [],
      eliminacion: {
        cuartos: [], semifinal: [], final: []
      }
    };

    // Permitir que las secciones estén en cualquier orden
    while (this.peek()) {
      const tk = this.peek();
      if (tk.type === 'RESERVADA' && tk.lexeme === 'TORNEO') {
        Object.assign(model.torneo, this.parseTorneo());
      } else if (tk.type === 'RESERVADA' && tk.lexeme === 'EQUIPOS') {
        model.equipos = this.parseEquipos();
      } else if (tk.type === 'RESERVADA' && tk.lexeme === 'ELIMINACION') {
        const fases = this.parseEliminacion();
        Object.assign(model.eliminacion, fases);
      } else {
        // Consumir token no esperado para evitar loop infinito
        this.next();
      }
    }
    return model;
  }

  parseTorneo() {
    // TORNEO { nombre: "X", equipos: N, sede: "Y" }
    const out = { nombre: null, equiposCant: null, sede: null };
    this.expect('RESERVADA', 'TORNEO');
    this.expect('LLAVE_IZQ');
    while (this.peek() && this.peek().type !== 'LLAVE_DER') {
      const attr = this.expect('RESERVADA').lexeme; // nombre | equipos | sede
      this.expect('DOS_PUNTOS');
      if (attr === 'nombre' || attr === 'sede') {
        const cad = this.expect('CADENA').lexeme;
        out[attr === 'nombre' ? 'nombre' : 'sede'] = cad;
      } else if (attr === 'equipos') {
        const n = this.expect('NUMERO').lexeme;
        out.equiposCant = parseInt(n,10);
      } else {
        // ignorar atributos desconocidos
        this.next();
      }
      if (this.peek() && this.peek().type === 'COMA') this.next();
    }
    this.expect('LLAVE_DER');
    return out;
  }

  parseEquipos() {
    // EQUIPOS { equipo: "Nombre" [ jugador: "Nom" [posicion:"", numero:N, edad:N], ... ], ... }
    const list = [];
    this.expect('RESERVADA', 'EQUIPOS');
    this.expect('LLAVE_IZQ');
    while (this.peek() && this.peek().type !== 'LLAVE_DER') {
      this.expect('RESERVADA', 'equipo');
      this.expect('DOS_PUNTOS');
      const teamName = this.expect('CADENA').lexeme;
      const team = { nombre: teamName, jugadores: [] };

      // jugadores opcionales
      if (this.match('CORCHETE_IZQ')) {
        while (this.peek() && this.peek().type !== 'CORCHETE_DER') {
          this.expect('RESERVADA', 'jugador');
          this.expect('DOS_PUNTOS');
          const nombre = this.expect('CADENA').lexeme;
          const jugador = { nombre, posicion:null, numero:null, edad:null };
          if (this.match('CORCHETE_IZQ')) {
            while (this.peek() && this.peek().type !== 'CORCHETE_DER') {
              const attr = this.expect('RESERVADA').lexeme; // posicion | numero | edad
              this.expect('DOS_PUNTOS');
              if (attr === 'posicion') {
                jugador.posicion = this.expect('CADENA').lexeme;
              } else if (attr === 'numero' || attr === 'edad') {
                jugador[attr] = parseInt(this.expect('NUMERO').lexeme,10);
              } else {
                // skip unknown
                this.next();
              }
              if (this.peek() && this.peek().type === 'COMA') this.next();
            }
            this.expect('CORCHETE_DER');
          }
          team.jugadores.push(jugador);
          if (this.peek() && this.peek().type === 'COMA') this.next();
        }
        this.expect('CORCHETE_DER');
      }
      list.push(team);
      if (this.peek() && this.peek().type === 'COMA') this.next();
    }
    this.expect('LLAVE_DER');
    return list;
  }

  parseEliminacion() {
    // ELIMINACION { cuartos:[...], semifinal:[...], final:[...] }
    const out = { cuartos:[], semifinal:[], final:[] };
    this.expect('RESERVADA', 'ELIMINACION');
    this.expect('LLAVE_IZQ');
    while (this.peek() && this.peek().type !== 'LLAVE_DER') {
      const fase = this.expect('RESERVADA').lexeme; // cuartos|semifinal|final|fase
      this.expect('DOS_PUNTOS');
      // Puede venir un bloque { ... } o una lista [ ... ] según el enunciado (usaremos lista)
      this.expect('CORCHETE_IZQ');
      while (this.peek() && this.peek().type !== 'CORCHETE_DER') {
        const match = this.parsePartido();
        // Guardar
        if (out[fase]) out[fase].push(match);
        if (this.peek() && this.peek().type === 'COMA') this.next();
      }
      this.expect('CORCHETE_DER');
      if (this.peek() && this.peek().type === 'COMA') this.next();
    }
    this.expect('LLAVE_DER');
    return out;
  }

  parsePartido() {
    // partido: "A" vs "B" [resultado:"X-Y", goleadores:[ ... ]]
    const m = { equipo1:null, equipo2:null, resultado:null, goles:[], fase:null };
    this.expect('RESERVADA','partido');
    this.expect('DOS_PUNTOS');
    m.equipo1 = this.expect('CADENA').lexeme;
    this.expect('RESERVADA','vs');
    m.equipo2 = this.expect('CADENA').lexeme;

    if (this.match('CORCHETE_IZQ')) {
      while (this.peek() && this.peek().type !== 'CORCHETE_DER') {
        const attr = this.expect('RESERVADA').lexeme; // resultado | goleadores
        this.expect('DOS_PUNTOS');
        if (attr === 'resultado') {
          const resStr = this.expect('CADENA').lexeme; // "X-Y"
          // Parse manual de X-Y sin split/regex
          let a = "", b = "", seenDash = false;
          for (let k=0;k<resStr.length;k++) {
            const ch = resStr[k];
            if (ch === '-') { seenDash = true; continue; }
            if (!seenDash) a += ch; else b += ch;
          }
          const A = parseInt(a,10); const B = parseInt(b,10);
          if(!isNaN(A) && !isNaN(B)) m.resultado = { a:A, b:B };
        } else if (attr === 'goleadores') {
          // Puede ser lista de cadenas o de objetos 'goleador: "X" [minuto:N]'
          this.expect('CORCHETE_IZQ');
          while (this.peek() && this.peek().type !== 'CORCHETE_DER') {
            const look = this.peek();
            if (look.type === 'RESERVADA' && look.lexeme === 'goleador') {
              this.next(); // goleador
              this.expect('DOS_PUNTOS');
              const jname = this.expect('CADENA').lexeme;
              let minuto = null;
              if (this.match('CORCHETE_IZQ')) {
                while (this.peek() && this.peek().type !== 'CORCHETE_DER') {
                  const a2 = this.expect('RESERVADA').lexeme; // minuto
                  this.expect('DOS_PUNTOS');
                  if (a2 === 'minuto') minuto = parseInt(this.expect('NUMERO').lexeme,10);
                  if (this.peek() && this.peek().type === 'COMA') this.next();
                }
                this.expect('CORCHETE_DER');
              }
              m.goles.push({ jugador:jname, minuto });
            } else if (look.type === 'CADENA') {
              const nm = this.next().lexeme;
              m.goles.push({ jugador:nm, minuto:null });
            } else {
              // consumir algo para evitar loop
              this.next();
            }
            if (this.peek() && this.peek().type === 'COMA') this.next();
          }
          this.expect('CORCHETE_DER');
        } else {
          // atributo desconocido
          this.next();
        }
        if (this.peek() && this.peek().type === 'COMA') this.next();
      }
      this.expect('CORCHETE_DER');
    }
    return m;
  }
}

// ---------------- Reportes ----------------
function computeReports(model) {
  // Mapas de equipos
  const teamMap = {};
  for (const t of model.equipos) teamMap[t.nombre] = { ...t };

  const fasesOrden = ['cuartos','semifinal','final'];
  // Stats iniciales
  const stats = {};
  for (const name in teamMap) {
    stats[name] = { J:0, G:0, P:0, GF:0, GC:0, GD:0, fase:'-' };
  }

  const allMatches = [];
  const scorers = {}; // nombre -> {goles, equipo}
  const phaseWinners = { cuartos: [], semifinal: [], final: [] };

  for (const fase of fasesOrden) {
    const juegos = model.eliminacion[fase] || [];
    for (const m of juegos) {
      allMatches.push({ fase, ...m });
      // actualizar stats si hay resultado
      if (m.resultado) {
        const A = m.resultado.a, B = m.resultado.b;
        const t1 = m.equipo1, t2 = m.equipo2;
        if (stats[t1]) { stats[t1].J++; stats[t1].GF+=A; stats[t1].GC+=B; }
        if (stats[t2]) { stats[t2].J++; stats[t2].GF+=B; stats[t2].GC+=A; }
        if (A>B) { if (stats[t1]) stats[t1].G++; if (stats[t2]) stats[t2].P++; phaseWinners[fase].push(t1); }
        else if (B>A) { if (stats[t2]) stats[t2].G++; if (stats[t1]) stats[t1].P++; phaseWinners[fase].push(t2); }
        // goles
        for (const g of m.goles) {
          if (!scorers[g.jugador]) {
            // intentar detectar equipo del goleador: si está en plantilla de algún equipo
            let teamOf = null;
            for (const T in teamMap) {
              const plist = teamMap[T].jugadores || [];
              for (let j=0;j<plist.length;j++) {
                if (plist[j].nombre === g.jugador) { teamOf = T; break; }
              }
              if (teamOf) break;
            }
            scorers[g.jugador] = { jugador:g.jugador, equipo:teamOf || '-', goles:0, minutos:[] };
          }
          scorers[g.jugador].goles += 1;
          if (g.minuto !== null && g.minuto !== undefined) scorers[g.jugador].minutos.push(g.minuto);
        }
      }
    }
  }

  // Calcular GD y fase alcanzada (simple: última fase en la que apareció en algún partido)
  const phaseRank = { cuartos:1, semifinal:2, final:3 };
  for (const m of allMatches) {
    const r = phaseRank[m.fase] || 0;
    const involved = [m.equipo1, m.equipo2];
    for (const nm of involved) {
      if (stats[nm]) {
        // fase más alta alcanzada (solo etiqueta)
        const current = stats[nm].fase;
        const curRank = current==='-' ? 0 : (phaseRank[current] || 0);
        if (r > curRank) stats[nm].fase = m.fase[0].toUpperCase()+m.fase.slice(1);
      }
    }
  }
  for (const k in stats) stats[k].GD = stats[k].GF - stats[k].GC;

  // Goleadores ordenados
  const scorersArr = Object.values(scorers).sort((a,b)=> b.goles - a.goles || a.jugador.localeCompare(b.jugador));

  // Info general
  const totalPartidos = allMatches.length;
  const partidosCompletados = allMatches.filter(m=>m.resultado).length;
  let totalGoles = 0;
  for (const m of allMatches) if (m.resultado) totalGoles += (m.resultado.a + m.resultado.b);
  // Edad promedio
  let sumaEdades=0, contEdades=0;
  for (const t of model.equipos) {
    for (const j of (t.jugadores||[])) {
      if (typeof j.edad === 'number' && !Number.isNaN(j.edad)) { sumaEdades+=j.edad; contEdades++; }
    }
  }
  const edadProm = contEdades>0 ? (sumaEdades/contEdades) : 0;

  const general = [
    ['Nombre del Torneo', model.torneo.nombre || '-'],
    ['Sede', model.torneo.sede || '-'],
    ['Equipos Participantes', String(model.equipos.length)],
    ['Total de Partidos Programados', String(totalPartidos)],
    ['Partidos Completados', String(partidosCompletados)],
    ['Total de Goles', String(totalGoles)],
    ['Promedio de Goles por Partido', (totalPartidos? (totalGoles/totalPartidos):0).toFixed(2)],
    ['Edad Promedio de Jugadores', contEdades? (edadProm.toFixed(2)+' años'):'-'],
    ['Fase Actual', partidosCompletados===totalPartidos ? 'Finalizado' : inferFaseActual(model)]
  ];

  // Bracket table (simple tabular)
  const bracketRows = [];
  for (const m of allMatches) {
    let res='Pendiente', win='-';
    if (m.resultado) {
      res = m.resultado.a + '-' + m.resultado.b;
      if (m.resultado.a>m.resultado.b) win = m.equipo1;
      else if (m.resultado.b>m.resultado.a) win = m.equipo2;
      else win = 'Empate';
    }
    bracketRows.push([capitalize(m.fase), `${m.equipo1} vs ${m.equipo2}`, res, win]);
  }

  // DOT (Graphviz) del bracket — conectando ganadores por orden
  const dot = buildBracketDOT(model);

  return { stats, scorersArr, general, bracketRows, dot };
}

function inferFaseActual(model) {
  const fases = ['cuartos','semifinal','final'];
  for (let i=0;i<fases.length;i++) {
    const list = model.eliminacion[fases[i]] || [];
    const hasPend = list.some(m=>!m.resultado);
    const hasAny = list.length>0;
    if (hasPend && hasAny) return capitalize(fases[i]);
  }
  // si todo completo
  return 'Final';
}

function capitalize(s){ return s ? s[0].toUpperCase()+s.slice(1) : s; }

function buildTable(container, head, rows) {
  const tbl = document.createElement('table');
  const thead = document.createElement('thead');
  const trh = document.createElement('tr');
  for(const h of head){ const th=document.createElement('th'); th.textContent=h; trh.appendChild(th); }
  thead.appendChild(trh); tbl.appendChild(thead);
  const tbody=document.createElement('tbody');
  for(const r of rows){ const tr=document.createElement('tr'); for(const c of r){ const td=document.createElement('td'); td.textContent=c; tr.appendChild(td);} tbody.appendChild(tr);}
  tbl.appendChild(tbody);
  container.innerHTML = ""; container.appendChild(tbl);
}

function buildStatsTable(container, stats) {
  const head = ['Equipo','J','G','P','GF','GC','GD','Fase Alcanzada'];
  const rows = Object.keys(stats).sort().map(k=>[k, stats[k].J, stats[k].G, stats[k].P, stats[k].GF, stats[k].GC, stats[k].GD >=0 ? ('+'+stats[k].GD):String(stats[k].GD), stats[k].fase ]);
  buildTable(container, head, rows);
}

function buildScorersTable(container, scorersArr) {
  const head = ['Posición','Jugador','Equipo','Goles','Minutos de Gol'];
  const rows = [];
  let pos = 1;
  for (const s of scorersArr) {
    rows.push([pos++, s.jugador, s.equipo || '-', s.goles, s.minutos.length? s.minutos.sort((a,b)=>a-b).map(x=>String(x)+'\'').join(', '):'-']);
  }
  buildTable(container, head, rows);
}

function buildGeneralTable(container, general) {
  const head = ['Estadística','Valor'];
  buildTable(container, head, general);
}

function buildBracketDOT(model) {
  // Construir un diagrama simple por fases. Conectamos los ganadores de cuartos a semifinales, etc.
  const fases = ['cuartos','semifinal','final'];
  let dot = 'digraph Bracket {\n  rankdir=LR;\n  node [shape=box, style=filled, fillcolor="#e8f5e9"];\n';
  let matchId = 1;
  const phaseMatchIds = {};
  for (const f of fases) {
    const list = model.eliminacion[f] || [];
    phaseMatchIds[f] = [];
    for (let i=0;i<list.length;i++) {
      const m = list[i];
      const id = `M${matchId++}`;
      phaseMatchIds[f].push(id);
      let label = `${capitalize(f)}\\n${m.equipo1} vs ${m.equipo2}`;
      if (m.resultado) {
        label += `\\n${m.resultado.a}-${m.resultado.b}`;
      }
      dot += `  ${id} [label="${label}"];\n`;
    }
  }
  // conectar ganadores por orden (1->1,2->1; 3->2,4->2; etc.)
  function winnerOf(id) { return `winner_${id}`; } // etiqueta virtual
  // Edges ganadores (solo como guía; sin cálculo de nombre del ganador en DOT)
  for (let i=0;i<phaseMatchIds['cuartos'].length; i+=2) {
    const sIndex = Math.floor(i/2);
    const m1 = phaseMatchIds['cuartos'][i];
    const m2 = phaseMatchIds['cuartos'][i+1];
    const semi = phaseMatchIds['semifinal'][sIndex];
    if (m1 && semi) dot += `  ${m1} -> ${semi};\n`;
    if (m2 && semi) dot += `  ${m2} -> ${semi};\n`;
  }
  for (let i=0;i<phaseMatchIds['semifinal'].length; i+=2) {
    const fIndex = Math.floor(i/2);
    const s1 = phaseMatchIds['semifinal'][i];
    const s2 = phaseMatchIds['semifinal'][i+1];
    const fin = phaseMatchIds['final'][fIndex];
    if (s1 && fin) dot += `  ${s1} -> ${fin};\n`;
    if (s2 && fin) dot += `  ${s2} -> ${fin};\n`;
  }
  dot += '}\n';
  return dot;
}

// ---------------- UI glue ----------------
const src = document.getElementById('source');
const fileInput = document.getElementById('fileInput');
const analyzeBtn = document.getElementById('analyzeBtn');
const exportTokensBtn = document.getElementById('exportTokensBtn');
const exportErrorsBtn = document.getElementById('exportErrorsBtn');
const exportReportsBtn = document.getElementById('exportReportsBtn');
const downloadDotBtn = document.getElementById('downloadDotBtn');

const tokensTable = document.getElementById('tokensTable');
const errorsTable = document.getElementById('errorsTable');
const bracketTable = document.getElementById('bracketTable');
const teamStatsDiv = document.getElementById('teamStats');
const scorersDiv = document.getElementById('scorers');
const generalInfoDiv = document.getElementById('generalInfo');
const dotPreview = document.getElementById('dotPreview');

let TokensPas = [];
let ErroresPas = [];
let modeloPas = null;
let ReportesPas = null;

fileInput.addEventListener('change', (ev)=>{
  const f = ev.target.files[0];
  if (!f) return;
  const reader = new FileReader();
  reader.onload = (e)=>{ src.value = e.target.result; };
  reader.readAsText(f, 'utf-8');
});

analyzeBtn.addEventListener('click', ()=>{
  const lexer = new Lexer();
  lexer.setSource(src.value);
  const { tokens, errors } = lexer.scan();
  TokensPas = tokens; ErroresPas = errors;

  // Render tokens
  tokensTable.innerHTML = "";
  const tHead = document.createElement('tr');
  ['No.','Lexema','Tipo','Línea','Columna'].forEach(h=>{
    const th=document.createElement('th'); th.textContent=h; tHead.appendChild(th);
  });
  const thead = document.createElement('thead'); thead.appendChild(tHead); tokensTable.appendChild(thead);
  const tbody = document.createElement('tbody');
  for (let i=0;i<tokens.length;i++) {
    const tr=document.createElement('tr');
    const tk = tokens[i];
    [i+1, tk.lexeme, tk.type, tk.line, tk.col].forEach(v=>{ const td=document.createElement('td'); td.textContent=String(v); tr.appendChild(td); });
    tbody.appendChild(tr);
  }
  tokensTable.appendChild(tbody);

  // Render errors
  errorsTable.innerHTML="";
  const eHead=document.createElement('tr');
  ['No.','Descripción','Línea','Columna'].forEach(h=>{ const th=document.createElement('th'); th.textContent=h; eHead.appendChild(th); });
  const eThead=document.createElement('thead'); eThead.appendChild(eHead); errorsTable.appendChild(eThead);
  const eBody=document.createElement('tbody');
  for (let i=0;i<errors.length;i++) {
    const er=errors[i]; const tr=document.createElement('tr');
    [i+1, er.desc, er.line, er.col].forEach(v=>{ const td=document.createElement('td'); td.textContent=String(v); tr.appendChild(td); });
    eBody.appendChild(tr);
  }
  errorsTable.appendChild(eBody);






  // Si no hay errores léxicos, proceder a parsear y generar reportes
  bracketTable.innerHTML = ""; teamStatsDiv.innerHTML=""; scorersDiv.innerHTML=""; generalInfoDiv.innerHTML=""; dotPreview.textContent="";
  modeloPas = null; lastReports = null;
  if (errors.length === 0) {
    try {
      const parser = new Parser(tokens);
      modeloPas = parser.parseAll();
      lastReports = computeReports(modeloPas);
      buildTable(bracketTable, ['Fase','Partido','Resultado','Ganador'], lastReports.bracketRows);
      buildStatsTable(teamStatsDiv, lastReports.stats);
      buildScorersTable(scorersDiv, lastReports.scorersArr);
      buildGeneralTable(generalInfoDiv, lastReports.general);
      dotPreview.textContent = lastReports.dot;
    } catch (ex) {
      const p = document.createElement('p'); p.textContent = "Error de interpretación: " + ex.message;
      bracketTable.appendChild(p);
    }
  } else {
    const p = document.createElement('p'); p.textContent = "Corrige los errores léxicos para generar los reportes.";
    bracketTable.appendChild(p);
  }
});




exportTokensBtn.addEventListener('click', ()=>{
  let html = "<html><head><meta charset='utf-8'><title>Tokens</title></head><body><h1>Tokens</h1><table border='1' cellspacing='0' cellpadding='6'><tr><th>No.</th><th>Lexema</th><th>Tipo</th><th>Línea</th><th>Columna</th></tr>";
  for (let i=0;i<lastTokens.length;i++) {
    const t=lastTokens[i];
    html += `<tr><td>${i+1}</td><td>${esc(t.lexeme)}</td><td>${t.type}</td><td>${t.line}</td><td>${t.col}</td></tr>`;
  }
  html += "</table></body></html>";
  descargar("tokens.html", html);
});






exportErrorsBtn.addEventListener('click', ()=>{
  let html = "<html><head><meta charset='utf-8'><title>Errores Lexicos</title></head><body><h1>Errores Léxicos</h1><table border='1' cellspacing='0' cellpadding='6'><tr><th>No.</th><th>Descripción</th><th>Línea</th><th>Columna</th></tr>";
  for (let i=0;i<lastErrors.length;i++) {
    const e=lastErrors[i];
    html += `<tr><td>${i+1}</td><td>${esc(e.desc)}</td><td>${e.line}</td><td>${e.col}</td></tr>`;
  }
  html += "</table></body></html>";
  descargar("errores.html", html);
});





exportReportsBtn.addEventListener('click', ()=>{
  if (!lastReports) { alert("Primero ejecuta el análisis sin errores."); return; }
  let html = "<html><head><meta charset='utf-8'><title>Reportes del Torneo</title></head><body>";
  html += "<h1>Bracket de Eliminación</h1>";
  html += "<table border='1' cellspacing='0' cellpadding='6'><tr><th>Fase</th><th>Partido</th><th>Resultado</th><th>Ganador</th></tr>";
  for (const r of lastReports.bracketRows) {
    html += `<tr><td>${esc(r[0])}</td><td>${esc(r[1])}</td><td>${esc(r[2])}</td><td>${esc(r[3])}</td></tr>`;
  }
  html += "</table>";

  html += "<h1>Estadísticas por Equipo</h1>";
  html += "<table border='1' cellspacing='0' cellpadding='6'><tr><th>Equipo</th><th>J</th><th>G</th><th>P</th><th>GF</th><th>GC</th><th>GD</th><th>Fase Alcanzada</th></tr>";
  const stats = lastReports.stats;
  const keys = Object.keys(stats).sort();
  for (const k of keys) {
    const s = stats[k];
    html += `<tr><td>${esc(k)}</td><td>${s.J}</td><td>${s.G}</td><td>${s.P}</td><td>${s.GF}</td><td>${s.GC}</td><td>${s.GD>=0?('+'+s.GD):s.GD}</td><td>${esc(s.fase)}</td></tr>`;
  }
  html += "</table>";

  html += "<h1>Goleadores</h1>";
  html += "<table border='1' cellspacing='0' cellpadding='6'><tr><th>Posición</th><th>Jugador</th><th>Equipo</th><th>Goles</th><th>Minutos de Gol</th></tr>";
  let pos=1;
  for (const sc of lastReports.scorersArr) {
    html += `<tr><td>${pos++}</td><td>${esc(sc.jugador)}</td><td>${esc(sc.equipo || '-')}</td><td>${sc.goles}</td><td>${esc(sc.minutos.length? sc.minutos.sort((a,b)=>a-b).map(x=>String(x)+"'").join(", "):'-')}</td></tr>`;
  }
  html += "</table>";

  html += "<h1>Información General del Torneo</h1>";
  html += "<table border='1' cellspacing='0' cellpadding='6'><tr><th>Estadística</th><th>Valor</th></tr>";
  for (const row of lastReports.general) {
    html += `<tr><td>${esc(row[0])}</td><td>${esc(row[1])}</td></tr>`;
  }
  html += "</table>";

  html += "<h1>DOT (Graphviz)</h1><pre>"+esc(lastReports.dot)+"</pre>";
  html += "</body></html>";
  descargar("reportes.html", html);
});

downloadDotBtn.addEventListener('click', ()=>{
  if (!lastReports) { alert("Primero ejecuta el análisis sin errores."); return; }
  descargar("bracket.dot", lastReports.dot);
});

// ---------------- PROBANDO EJEMPLO PARA INGRESO INICIAL----------------
const ejemplo = `TORNEO {
  nombre: "Copa Mundial Universitaria",
  equipos: 4,
  sede: "Guatemala"
}

EQUIPOS {
  equipo: "Leones FC" [ 
    jugador: "Pedro Martínez" [posicion: "DELANTERO", numero: 9, edad: 22],
    jugador: "Mario López" [posicion: "MEDIOCAMPO", numero: 7, edad: 21],
    jugador: "Luis García" [posicion: "DEFENSA", numero: 4, edad: 23]
  ],
  equipo: "Águilas United" [
    jugador: "Diego Ramírez" [posicion: "DELANTERO", numero: 10, edad: 23],
    jugador: "Sofía Hernández" [posicion: "MEDIOCAMPO", numero: 8, edad: 21]
  ],
  equipo: "Cóndores FC" [
    jugador: "Valeria Cruz" [posicion: "DELANTERO", numero: 11, edad: 22]
  ],
  equipo: "Tigres Academy" [
    jugador: "Ana Gómez" [posicion: "DEFENSA", numero: 3, edad: 20]
  ]
}

ELIMINACION {
  cuartos: [
    partido: "Leones FC" vs "Cóndores FC" [resultado: "3-1", goleadores: [
      goleador: "Pedro Martínez" [minuto: 15],
      goleador: "Pedro Martínez" [minuto: 45],
      goleador: "Valeria Cruz" [minuto: 67],
      goleador: "Mario López" [minuto: 34]
    ]],
    partido: "Águilas United" vs "Tigres Academy" [resultado: "2-0", goleadores: [
      "Diego Ramírez", "Sofía Hernández"
    ]]
  ],
  semifinal: [
    partido: "Leones FC" vs "Águilas United" [resultado: "1-0", goleadores: ["Luis García"]]
  ],
  final: [
    partido: "Leones FC" vs "TBD" [goleadores: []]
  ]
}`;

src.value = ejemplo;
