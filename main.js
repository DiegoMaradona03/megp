/* main.js — Versão completa (mapa gigante, zoom mínimo inicial, pan, lagoas raso/profundo, plantas, carcaças, etc.)
   ============================================================
   Esse arquivo contém TODO o comportamento que você tinha antes
   + pan/zoom e menu toggle, sem remover nada.
   Cole index.html, style.css e main.js juntos.
*/

(() => {
  // ----------------- MAP / VIEW CONFIG -----------------
  const MAP = document.getElementById('map-container');
  const MAP_W = MAP.offsetWidth || 4000; // large map
  const MAP_H = MAP.offsetHeight || 3200;

  // initial zoom: set to minimum of the zoom range (user asked "minimo")
  const zoomRangeEl = document.getElementById('zoom-range');
  const initialZoom = Number(zoomRangeEl.min || 0.4);
  let zoom = initialZoom;

  // pan initial (center the big map in view)
  // place pan such that center of map is centered in viewport
  const viewportW = Math.max(window.innerWidth - 320, 800);
  const viewportH = Math.max(window.innerHeight - 200, 600);
  let panX = Math.round((viewportW / 2) - (MAP_W * zoom / 2));
  let panY = Math.round((viewportH / 2) - (MAP_H * zoom / 2));

  function applyTransform(){
    MAP.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
  }
  applyTransform();

  // ----------------- PAN (drag to move) -----------------
  let dragging = false;
  let dragStartX = 0, dragStartY = 0, startPanX = 0, startPanY = 0;

  // start drag when mouse down on map
  MAP.addEventListener('mousedown', (e) => {
    dragging = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    startPanX = panX;
    startPanY = panY;
    // prevent selecting text
    e.preventDefault();
  });

  window.addEventListener('mousemove', (e) => {
    if(!dragging) return;
    const dx = e.clientX - dragStartX;
    const dy = e.clientY - dragStartY;
    panX = startPanX + dx;
    panY = startPanY + dy;
    applyTransform();
  });

  window.addEventListener('mouseup', () => {
    dragging = false;
  });

  // touch support for pan
  MAP.addEventListener('touchstart', (e) => {
    if(e.touches.length === 1){
      dragging = true;
      dragStartX = e.touches[0].clientX;
      dragStartY = e.touches[0].clientY;
      startPanX = panX;
      startPanY = panY;
    }
  }, {passive: true});
  MAP.addEventListener('touchmove', (e) => {
    if(!dragging || e.touches.length !== 1) return;
    const dx = e.touches[0].clientX - dragStartX;
    const dy = e.touches[0].clientY - dragStartY;
    panX = startPanX + dx;
    panY = startPanY + dy;
    applyTransform();
  }, {passive: true});
  MAP.addEventListener('touchend', ()=> dragging = false);

  // ----------------- ZOOM control (slider) -----------------
  zoomRangeEl.addEventListener('input', (e) => {
    // keep center stable while zooming (approximate behavior)
    const oldZoom = zoom;
    const newZoom = Number(e.target.value);
    // map center in screen coords before zoom
    const rect = MAP.getBoundingClientRect();
    const screenCenterX = window.innerWidth / 2;
    const screenCenterY = window.innerHeight / 2;

    // compute map-local point under screen center
    const localX = (screenCenterX - panX) / oldZoom;
    const localY = (screenCenterY - panY) / oldZoom;

    zoom = newZoom;
    // recompute pan so the same local point remains under screen center
    panX = Math.round(screenCenterX - localX * zoom);
    panY = Math.round(screenCenterY - localY * zoom);
    applyTransform();
  });

  // ensure slider starts at minimum (user asked min)
  zoomRangeEl.value = String(zoom);

  // ----------------- MENU TOGGLE -----------------
  const menuEl = document.getElementById('menu-lateral');
  const toggleBtn = document.getElementById('toggle-menu');
  toggleBtn.addEventListener('click', ()=> menuEl.classList.toggle('hide'));

  // ----------------- WORLD / SIM CONFIG -----------------
  const speciesListEl = document.getElementById('species-list');
  const sideInfo = document.getElementById('side-info');

  const WORLD = {
    creatures: [],
    plants: [],
    carcasses: [],
    lakes: [],
    speciesCatalog: []
  };

  const MAX_CREATURES = 1500;
  const PLANT_MAX = 500;
  const PLANT_SPAWN_CHANCE = 0.018;

  // lake params
  const TARGET_LAKES = 7;
  const MIN_RADIUS = 80; // px (deep)
  const MAX_RADIUS = 220; // px (deep)
  const MIN_GAP = 140; // min distance between lake centers

  // utils
  const rand = (a,b)=> Math.random()*(b-a)+a;
  const randInt = (a,b)=> Math.floor(rand(a,b+1));
  const clamp = (v,a,b)=> Math.max(a, Math.min(b, v));
  const distance = (ax,ay,bx,by) => Math.hypot(ax-bx, ay-by);

  // ----------------- LAKES (shallow + deep) -----------------
  function createLakes(){
    let tries = 0;
    while(WORLD.lakes.length < TARGET_LAKES && tries < 1200){
      tries++;
      // vary ellipse shapes: use rx and ry to make wide or tall lakes
      const rDeepBase = randInt(MIN_RADIUS, MAX_RADIUS);
      // decide if wide or tall or roughly circular
      const shapeChoice = Math.random();
      let rxDeep = rDeepBase;
      let ryDeep = rDeepBase;
      if(shapeChoice < 0.35){
        rxDeep = Math.round(rDeepBase * rand(1.1, 1.9)); // wider
        ryDeep = Math.round(rDeepBase * rand(0.7, 1.0));
      } else if(shapeChoice < 0.7){
        ryDeep = Math.round(rDeepBase * rand(1.1, 1.9)); // taller
        rxDeep = Math.round(rDeepBase * rand(0.7, 1.0));
      } else {
        rxDeep = Math.round(rDeepBase * rand(0.85, 1.15));
        ryDeep = Math.round(rDeepBase * rand(0.85, 1.15));
      }

      const shallowExtraFactor = rand(0.28, 0.45);
      const rShallowX = Math.round(rxDeep + rxDeep * shallowExtraFactor);
      const rShallowY = Math.round(ryDeep + ryDeep * shallowExtraFactor);

      const cx = rand(rShallowX + 40, MAP_W - rShallowX - 40);
      const cy = rand(rShallowY + 40, MAP_H - rShallowY - 40);

      // ensure distance to others (use bounding circles approximation)
      let ok = true;
      for(const L of WORLD.lakes){
        const minDist = Math.hypot(rShallowX + L.rShallowX, rShallowY + L.rShallowY) * 0.6 + MIN_GAP;
        if(Math.hypot(cx - L.cx, cy - L.cy) < minDist){ ok = false; break; }
      }
      if(!ok) continue;

      // create DOM elements (use elliptical appearance via width/height)
      const deepEl = document.createElement('div');
      deepEl.className = 'lake-deep';
      deepEl.style.position = 'absolute';
      deepEl.style.left = (cx - rxDeep) + 'px';
      deepEl.style.top = (cy - ryDeep) + 'px';
      deepEl.style.width = (rxDeep*2) + 'px';
      deepEl.style.height = (ryDeep*2) + 'px';
      deepEl.style.borderRadius = '50%';
      deepEl.style.background = `radial-gradient(circle at 35% 30%, rgba(150,210,255,0.95) 0%, rgba(50,130,220,0.95) 60%, rgba(10,60,140,0.86) 100%)`;
      deepEl.style.boxShadow = 'inset 0 -20px 60px rgba(0,0,0,0.18)';

      const shallowEl = document.createElement('div');
      shallowEl.className = 'lake-shallow';
      shallowEl.style.position = 'absolute';
      shallowEl.style.left = (cx - rShallowX) + 'px';
      shallowEl.style.top = (cy - rShallowY) + 'px';
      shallowEl.style.width = (rShallowX*2) + 'px';
      shallowEl.style.height = (rShallowY*2) + 'px';
      shallowEl.style.borderRadius = '50%';
      shallowEl.style.background = `radial-gradient(circle at 35% 30%, rgba(200,235,255,0.85) 0%, rgba(120,200,245,0.55) 60%, rgba(50,150,235,0.35) 100%)`;
      shallowEl.style.zIndex = 1;
      deepEl.style.zIndex = 2;

      MAP.appendChild(shallowEl);
      MAP.appendChild(deepEl);

      WORLD.lakes.push({
        cx, cy,
        rxDeep, ryDeep,
        rShallowX, rShallowY,
        deepEl, shallowEl
      });
    }
  }
  createLakes();

  // ----------------- SPECIES / CREATURE / PLANT CLASSES -----------------
  class Species {
    constructor({name='Especie', diet='herbivoro', color='#ff6b00', size='medio', speed=45, vision=80} = {}){
      this.name = name; this.diet = diet; this.color = color; this.size = size;
      this.speed = speed; this.vision = vision; this.id = Math.random().toString(36).slice(2,9);
    }
  }

  class Creature {
    constructor(spec, x, y){
      this.spec = spec;
      this.x = x; this.y = y;
      this.size = spec.size === 'pequeno' ? 8 : (spec.size === 'medio' ? 12 : 18);
      this.vx = 0; this.vy = 0;
      this.life = 100; this.hunger = 100; this.thirst = 100; this.alive = true;
      this.element = document.createElement('div');
      this.element.className = 'creature';
      this.element.style.width = this.size + 'px';
      this.element.style.height = this.size + 'px';
      this.element.style.background = spec.color;
      this.element.style.transform = `translate(${this.x}px, ${this.y}px)`;
      MAP.appendChild(this.element);
      this.target = null;
      this.wanderAngle = Math.random() * Math.PI * 2;
    }

    step(dt){
      if(!this.alive) return;

      // decay hunger and thirst
      this.hunger = clamp(this.hunger - 6 * dt/1000, 0, 100);
      this.thirst = clamp(this.thirst - 6 * dt/1000, 0, 100);
      if(this.hunger <= 0 || this.thirst <= 0){
        this.life -= 8 * dt/1000;
        if(this.life <= 0) this.die();
      }

      // detect deep water: elliptical check
      for(const lake of WORLD.lakes){
        // transform point to lake local coordinates (centered)
        const dx = this.x - lake.cx;
        const dy = this.y - lake.cy;
        // ellipse equation x^2/rx^2 + y^2/ry^2 < 1 => inside deep
        const insideDeep = (dx*dx)/(lake.rxDeep*lake.rxDeep) + (dy*dy)/(lake.ryDeep*lake.ryDeep) < 1;
        if(insideDeep){
          // drowning damage
          const drownPerSec = 18;
          this.life -= drownPerSec * dt/1000;
          this.element.style.opacity = '0.55';
          if(this.life <= 0){ this.die(); return; }
        } else {
          this.element.style.opacity = '1';
        }
      }

      // goal logic: water if thirsty (<50), plants if herbivore & hungry (<50)
      const needWater = this.thirst < 50;
      const needFood = this.hunger < 50 && this.spec.diet === 'herbivoro';

      if(needWater){
        let best = null, bd = Infinity;
        for(const lake of WORLD.lakes){
          // distance to shallow edge approximated
          const dx = lake.cx - this.x, dy = lake.cy - this.y;
          const dCenter = Math.hypot(dx,dy);
          // approximate shallow radius as average
          const approxShallow = (lake.rShallowX + lake.rShallowY) / 2;
          const dEdge = Math.max(0, dCenter - approxShallow);
          if(dEdge < bd && dCenter < this.spec.vision + approxShallow){
            best = lake; bd = dEdge;
          }
        }
        if(best) this.target = {type:'water', ref:best};
      }

      if(!this.target && needFood){
        let best = null, bd = Infinity;
        for(const p of WORLD.plants){
          const d = Math.hypot(this.x - p.x, this.y - p.y);
          if(d < bd && d < this.spec.vision){ best = p; bd = d; }
        }
        if(best) this.target = {type:'plant', ref:best};
      }

      // movement toward target or wander
      let tx = null, ty = null;
      if(this.target){
        if(this.target.type === 'water'){ tx = this.target.ref.cx; ty = this.target.ref.cy; }
        else if(this.target.type === 'plant'){ tx = this.target.ref.x; ty = this.target.ref.y; }
        else if(this.target.type === 'carcass'){ tx = this.target.ref.x; ty = this.target.ref.y; }
        else if(this.target.type === 'creature'){ tx = this.target.ref.x; ty = this.target.ref.y; }
      }

      if(tx !== null){
        const dx = tx - this.x, dy = ty - this.y;
        const d = Math.hypot(dx,dy);
        if(d < 6){
          // interaction
          this.onReachTarget();
        } else {
          const speed = this.spec.speed;
          const move = Math.min(speed * dt/1000, d);
          this.x += (dx/d) * move;
          this.y += (dy/d) * move;
        }
      } else {
        // wander gently
        this.wanderAngle += (Math.random() - 0.5) * 0.6 * dt/1000;
        const vx = Math.cos(this.wanderAngle) * this.spec.speed * 0.4;
        const vy = Math.sin(this.wanderAngle) * this.spec.speed * 0.4;
        this.x = clamp(this.x + vx*dt/1000, 0, MAP_W - this.size);
        this.y = clamp(this.y + vy*dt/1000, 0, MAP_H - this.size);
      }

      this.element.style.transform = `translate(${this.x}px, ${this.y}px)`;
    }

    onReachTarget(){
      if(!this.target) return;
      const t = this.target;
      if(t.type === 'plant'){
        const idx = WORLD.plants.indexOf(t.ref);
        if(idx !== -1){
          WORLD.plants[idx].element.remove();
          WORLD.plants.splice(idx,1);
          this.hunger = clamp(this.hunger + 40, 0, 100);
        }
        this.target = null;
      } else if(t.type === 'water'){
        // drink: only restores thirst; if in deep area, risk remains handled elsewhere
        this.thirst = clamp(this.thirst + 60, 0, 100);
        this.target = null;
      } else if(t.type === 'carcass'){
        if(WORLD.carcasses.includes(t.ref)){
          const carc = t.ref;
          const foodTaken = Math.min(30, carc.foodLeft);
          carc.foodLeft -= foodTaken;
          this.hunger = clamp(this.hunger + (foodTaken/30)*40, 0, 100);
          if(carc.foodLeft <= 0){
            try{ carc.element.remove(); }catch(e){}
            WORLD.carcasses.splice(WORLD.carcasses.indexOf(carc),1);
          }
        }
        this.target = null;
      } else if(t.type === 'creature'){
        const prey = t.ref;
        if(prey && prey.alive){
          const attackPower = 30 + Math.random()*20;
          prey.life -= attackPower;
          if(prey.life <= 0) prey.die();
          this.hunger = clamp(this.hunger + 40, 0, 100);
        }
        this.target = null;
      }
    }

    die(){
      if(!this.alive) return;
      this.alive = false;
      try{ this.element.remove(); }catch(e){}
      const carc = {
        x: this.x, y: this.y,
        foodLeft: Math.max(20, this.size * 3),
        element: null,
        decompose: 20
      };
      const el = document.createElement('div');
      el.className = 'carcass';
      el.style.left = this.x + 'px';
      el.style.top = this.y + 'px';
      el.style.width = (this.size) + 'px';
      el.style.height = (this.size) + 'px';
      MAP.appendChild(el);
      carc.element = el;
      WORLD.carcasses.push(carc);
      const idx = WORLD.creatures.indexOf(this);
      if(idx !== -1) WORLD.creatures.splice(idx,1);
    }
  }

  // ----------------- PLANTS & SPAWNING -----------------
  function spawnPlantAt(x,y){
    if(WORLD.plants.length >= PLANT_MAX) return;
    // avoid deep areas
    for(const lake of WORLD.lakes){
      const dx = x - lake.cx;
      const dy = y - lake.cy;
      if((dx*dx)/(lake.rxDeep*lake.rxDeep) + (dy*dy)/(lake.ryDeep*lake.ryDeep) < 1) return;
    }
    const p = {x,y,element:null};
    const el = document.createElement('div');
    el.className = 'plant';
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    MAP.appendChild(el);
    p.element = el;
    WORLD.plants.push(p);
  }

  function spawnPlantRandom(){
    for(let tries=0; tries<12; tries++){
      const x = rand(40, MAP_W - 40);
      const y = rand(40, MAP_H - 40);
      let ok = true;
      for(const lake of WORLD.lakes){
        const dx = x - lake.cx; const dy = y - lake.cy;
        if((dx*dx)/(lake.rxDeep*lake.rxDeep) + (dy*dy)/(lake.ryDeep*lake.ryDeep) < 1){ ok = false; break; }
      }
      if(ok){ spawnPlantAt(x,y); break; }
    }
  }

  // ----------------- SPAWN CREATURE -----------------
  function spawnCreature(spec, x=null, y=null){
    if(WORLD.creatures.length > MAX_CREATURES) return null;
    const px = x === null ? rand(60, MAP_W - 60) : x;
    const py = y === null ? rand(60, MAP_H - 60) : y;
    const c = new Creature(spec, px, py);
    WORLD.creatures.push(c);
    return c;
  }

  // ----------------- INITIAL SPECIES & UI -----------------
  WORLD.speciesCatalog.push(new Species({name:'Caprino', diet:'herbivoro', color:'#ffd166', size:'pequeno', speed:48, vision:90}));
  WORLD.speciesCatalog.push(new Species({name:'Ruminant', diet:'herbivoro', color:'#7fc97f', size:'medio', speed:36, vision:100}));
  WORLD.speciesCatalog.push(new Species({name:'Predador', diet:'carnivoro', color:'#ff4d4d', size:'medio', speed:70, vision:120}));

  function renderSpecies(){
    speciesListEl.innerHTML = '';
    WORLD.speciesCatalog.forEach(sp => {
      const row = document.createElement('div'); row.className = 'species-item';
      const left = document.createElement('div'); left.className = 'left';
      const dot = document.createElement('div'); dot.className = 'dot'; dot.style.background = sp.color;
      const info = document.createElement('div'); info.innerHTML = `<strong>${sp.name}</strong><br/><small style="color:#ddd">${sp.diet} • ${sp.size}</small>`;
      left.appendChild(dot); left.appendChild(info);
      row.appendChild(left);
      const actions = document.createElement('div');
      const spawnBtn = document.createElement('button'); spawnBtn.textContent = 'Spawn'; spawnBtn.onclick = ()=> spawnCreature(sp);
      const delBtn = document.createElement('button'); delBtn.textContent = 'Apagar'; delBtn.onclick = ()=>{
        if(!confirm('Deletar espécie?')) return;
        const idx = WORLD.speciesCatalog.indexOf(sp); if(idx!==-1) WORLD.speciesCatalog.splice(idx,1); renderSpecies();
      };
      actions.appendChild(spawnBtn); actions.appendChild(delBtn);
      row.appendChild(actions);
      speciesListEl.appendChild(row);
    });
  }
  renderSpecies();

  // ----------------- INITIAL PLANTS -----------------
  for(let i=0;i<120;i++) spawnPlantRandom();

  // ----------------- TICK / LOOP -----------------
  let last = performance.now();
  function loop(now){
    const dt = Math.max(1, now - last);
    last = now;

    // spawn plants occasionally
    if(Math.random() < PLANT_SPAWN_CHANCE) spawnPlantRandom();

    // update creatures
    for(const c of [...WORLD.creatures]) c.step(dt);

    // update carcasses decomposition
    for(let i=WORLD.carcasses.length-1;i>=0;i--){
      const carc = WORLD.carcasses[i];
      carc.decompose -= dt/1000;
      if(carc.decompose <= 0 || carc.foodLeft <= 0){
        try{ carc.element.remove(); }catch(e){}
        WORLD.carcasses.splice(i,1);
      } else {
        const scale = clamp(carc.foodLeft/80, 0.35, 1);
        carc.element.style.transform = `scale(${scale})`;
      }
    }

    // update side info
    sideInfo.innerHTML = `<div style="color:#ddd">Criaturas: ${WORLD.creatures.length} • Plantas: ${WORLD.plants.length} • Carcaças: ${WORLD.carcasses.length}</div>
                          <div style="color:#bfbfbf;margin-top:6px">Lagoas geradas: ${WORLD.lakes.length}</div>`;

    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  // ----------------- UI HOOKS (modal, buttons, dblclick spawn) -----------------
  document.getElementById('create-species-btn').addEventListener('click', () => {
    const modal = document.getElementById('species-modal'); modal.style.display = 'flex'; modal.setAttribute('aria-hidden','false');
  });
  document.getElementById('sp-cancel').addEventListener('click', () => {
    const modal = document.getElementById('species-modal'); modal.style.display = 'none'; modal.setAttribute('aria-hidden','true');
  });
  document.getElementById('sp-create').addEventListener('click', () => {
    const name = document.getElementById('sp-name').value.trim() || `Especie ${WORLD.speciesCatalog.length+1}`;
    const diet = document.getElementById('sp-diet').value;
    const color = document.getElementById('sp-color').value;
    const size = document.getElementById('sp-size').value;
    const speed = Number(document.getElementById('sp-speed').value);
    const vision = Number(document.getElementById('sp-vision').value);
    const sp = new Species({name, diet, color, size, speed, vision});
    WORLD.speciesCatalog.push(sp); renderSpecies();
    document.getElementById('species-modal').style.display = 'none';
  });

  document.getElementById('spawn-random-btn').addEventListener('click', ()=>{
    if(WORLD.speciesCatalog.length===0) return alert('Crie ao menos 1 espécie');
    const sp = WORLD.speciesCatalog[Math.floor(Math.random() * WORLD.speciesCatalog.length)];
    spawnCreature(sp);
  });

  document.getElementById('clear-creatures-btn').addEventListener('click', ()=>{
    if(!confirm('Remover todas as criaturas do mapa?')) return;
    WORLD.creatures.forEach(c=>{ try{ c.element.remove(); }catch(e){} });
    WORLD.creatures.length = 0;
  });

  // dblclick quick spawn menu on MAP (coords relative to map element)
  MAP.addEventListener('dblclick', (ev) => {
    if(WORLD.speciesCatalog.length === 0) return;
    const rect = MAP.getBoundingClientRect();
    // convert client coordinates to map-local coordinates considering transform
    // compute map-local by (client - pan)/zoom
    const clientX = ev.clientX, clientY = ev.clientY;
    // map-local coords:
    const localX = (clientX - panX) / zoom;
    const localY = (clientY - panY) / zoom;

    const quick = document.createElement('div');
    quick.style.position = 'absolute';
    quick.style.left = (localX) + 'px';
    quick.style.top = (localY) + 'px';
    quick.style.background = '#fff'; quick.style.color = '#111'; quick.style.padding = '6px';
    quick.style.borderRadius = '8px'; quick.style.boxShadow = '0 8px 30px rgba(0,0,0,0.15)';
    quick.style.zIndex = 9999;
    quick.innerHTML = `<div style="margin-bottom:6px;font-weight:600">Spawnar:</div>`;
    WORLD.speciesCatalog.forEach(sp=>{
      const b = document.createElement('button'); b.textContent = sp.name; b.style.display='block'; b.style.margin='6px 0';
      b.onclick = ()=>{ spawnCreature(sp, localX, localY); quick.remove(); };
      quick.appendChild(b);
    });
    const cancel = document.createElement('button'); cancel.textContent = 'Cancelar'; cancel.style.display='block'; cancel.style.marginTop='6px';
    cancel.onclick = ()=> quick.remove();
    quick.appendChild(cancel);
    MAP.appendChild(quick);
  });

  // ensure slider zoom changes update transform (already setup above)
  // but also allow wheel zoom (ctrl + wheel or wheel with shift)
  window.addEventListener('wheel', (e) => {
    // if ctrlKey or metaKey pressed or shift pressed -> zoom; otherwise allow scroll page
    if(e.ctrlKey || e.metaKey || e.shiftKey){
      e.preventDefault();
      const delta = -e.deltaY * 0.0015;
      const newZoom = clamp(zoom + delta, Number(zoomRangeEl.min), Number(zoomRangeEl.max));
      zoomRangeEl.value = String(newZoom);
      // trigger input handler programmatically
      const ev = new Event('input'); zoomRangeEl.dispatchEvent(ev);
    }
  }, {passive: false});

  // expose for debugging
  window.ECO = WORLD;

})(); 