(() => {
  const MAP = document.getElementById('map-container');
  const zoomRangeEl = document.getElementById('zoom-range');

  const MAP_W = MAP.offsetWidth || 4000;
  const MAP_H = MAP.offsetHeight || 3200;

  let zoom = Number(zoomRangeEl.min || 0.4);
  zoomRangeEl.value = zoom;

  const viewportW = Math.max(window.innerWidth - 320, 800);
  const viewportH = Math.max(window.innerHeight - 200, 600);
  let panX = Math.round((viewportW / 2) - (MAP_W * zoom / 2));
  let panY = Math.round((viewportH / 2) - (MAP_H * zoom / 2));

  function applyTransform(){
    MAP.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
  }
  applyTransform();

  // -------- PAN --------
  let dragging=false, sx=0, sy=0, spx=0, spy=0;
  MAP.addEventListener('mousedown',(e)=>{dragging=true;sx=e.clientX;sy=e.clientY;spx=panX;spy=panY; e.preventDefault();});
  window.addEventListener('mousemove',(e)=>{if(!dragging) return;panX=spx+(e.clientX-sx);panY=spy+(e.clientY-sy);applyTransform();});
  window.addEventListener('mouseup',()=> dragging=false);

  // touch pan
  MAP.addEventListener('touchstart',(e)=>{if(e.touches.length===1){dragging=true;sx=e.touches[0].clientX;sy=e.touches[0].clientY;spx=panX;spy=panY;}});
  MAP.addEventListener('touchmove',(e)=>{if(!dragging||e.touches.length!==1)return;panX=spx+(e.touches[0].clientX-sx);panY=spy+(e.touches[0].clientY-sy);applyTransform();});
  MAP.addEventListener('touchend',()=>dragging=false);

  // -------- ZOOM --------
  zoomRangeEl.addEventListener('input',(e)=>{
    const oldZoom=zoom;
    const newZoom=Number(e.target.value);
    const cx=window.innerWidth/2, cy=window.innerHeight/2;
    const localX=(cx-panX)/oldZoom, localY=(cy-panY)/oldZoom;
    zoom=newZoom;
    panX=Math.round(cx-localX*zoom);
    panY=Math.round(cy-localY*zoom);
    applyTransform();
  });

  // -------- LAKES (mantém igual ao seu código) --------
  const rand=(a,b)=>Math.random()*(b-a)+a;
  const randInt=(a,b)=>Math.floor(rand(a,b+1));

  const TARGET_LAKES=7, MIN_RADIUS=80, MAX_RADIUS=220, MIN_GAP=140;

  function createLakes(){
    let tries=0;
    while(WORLD.lakes.length<TARGET_LAKES && tries<1200){
      tries++;
      const rDeepBase=randInt(MIN_RADIUS,MAX_RADIUS);
      let rxDeep=rDeepBase, ryDeep=rDeepBase;
      const choice=Math.random();
      if(choice<0.35){rxDeep*=rand(1.1,1.9); ryDeep*=rand(0.7,1.0);}
      else if(choice<0.7){ryDeep*=rand(1.1,1.9); rxDeep*=rand(0.7,1.0);}
      else {rxDeep*=rand(0.85,1.15); ryDeep*=rand(0.85,1.15);}
      rxDeep=Math.round(rxDeep); ryDeep=Math.round(ryDeep);

      const sF=rand(0.28,0.45);
      const rShX=Math.round(rxDeep+rxDeep*sF), rShY=Math.round(ryDeep+ryDeep*sF);

      const cx=rand(rShX+40,MAP_W-rShX-40);
      const cy=rand(rShY+40,MAP_H-rShY-40);

      let ok=true;
      for(const L of WORLD.lakes){
        const minDist=Math.hypot(rShX+L.rShallowX,rShY+L.rShallowY)*0.6+MIN_GAP;
        if(Math.hypot(cx-L.cx,cy-L.cy)<minDist){ok=false;break;}
      }
      if(!ok) continue;

      const deep=document.createElement('div');
      deep.className='lake-deep';
      deep.style.cssText=`position:absolute;left:${cx-rxDeep}px;top:${cy-ryDeep}px;width:${rxDeep*2}px;height:${ryDeep*2}px;border-radius:50%;background:radial-gradient(circle at 35% 30%,rgba(150,210,255,0.95),rgba(10,60,140,0.86));z-index:2;`;

      const shallow=document.createElement('div');
      shallow.className='lake-shallow';
      shallow.style.cssText=`position:absolute;left:${cx-rShX}px;top:${cy-rShY}px;width:${rShX*2}px;height:${rShY*2}px;border-radius:50%;background:radial-gradient(circle at 35% 30%,rgba(200,235,255,0.85),rgba(50,150,235,0.35));z-index:1;`;

      MAP.appendChild(shallow); MAP.appendChild(deep);

      WORLD.lakes.push({cx,cy,rxDeep,ryDeep,rShallowX:rShX,rShallowY:rShY,deepEl:deep,shallowEl:shallow});
    }
  }
  createLakes();

  // -------- PLANTS --------
  const PLANT_MAX=500, PLANT_SPAWN_CHANCE=0.018;

  function spawnPlantAt(x,y){
    if(WORLD.plants.length>=PLANT_MAX) return;
    for(const lake of WORLD.lakes){
      const dx=x-lake.cx, dy=y-lake.cy;
      if((dx*dx)/(lake.rxDeep*lake.rxDeep)+(dy*dy)/(lake.ryDeep*lake.ryDeep)<1) return;
    }
    const el=document.createElement('div');
    el.className='plant';
    el.style.left=x+'px'; el.style.top=y+'px';
    MAP.appendChild(el);
    WORLD.plants.push({x,y,element:el});
  }

  function spawnPlantRandom(){
    for(let i=0;i<12;i++){
      const x=rand(40,MAP_W-40), y=rand(40,MAP_H-40);
      let ok=true;
      for(const lake of WORLD.lakes){
        const dx=x-lake.cx, dy=y-lake.cy;
        if((dx*dx)/(lake.rxDeep*lake.rxDeep)+(dy*dy)/(lake.ryDeep*lake.ryDeep)<1){ok=false;break;}
      }
      if(ok){spawnPlantAt(x,y);break;}
    }
  }

  for(let i=0;i<120;i++) spawnPlantRandom();

  // -------- CARCASS DECOMPOSE - handled by loop --------

  const sideInfo=document.getElementById('side-info');

  let last=performance.now();
  function loop(now){
    const dt=Math.max(1,now-last); last=now;

    if(Math.random()<PLANT_SPAWN_CHANCE) spawnPlantRandom();

    // update carcasses
    for(let i=WORLD.carcasses.length-1;i>=0;i--){
      const c=WORLD.carcasses[i];
      c.decompose-=dt/1000;
      if(c.decompose<=0 || c.foodLeft<=0){
        c.element.remove();
        WORLD.carcasses.splice(i,1);
      } else {
        c.element.style.transform=`scale(${Math.max(0.35,c.foodLeft/80)})`;
      }
    }

    sideInfo.innerHTML=`Criaturas: ${WORLD.creatures.length} • Plantas: ${WORLD.plants.length} • Carcaças: ${WORLD.carcasses.length}<br>Lagoas: ${WORLD.lakes.length}`;

    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();