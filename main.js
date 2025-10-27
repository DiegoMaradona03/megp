// ----- Configurações do mapa -----
const mapContainer = document.getElementById("map-container");
const mapSize = 50; // 50x50 tiles
const tileSize = 20; // px
const tiles = [];

// Criar tiles do mapa
for(let y=0; y<mapSize; y++){
  for(let x=0; x<mapSize; x++){
    const tile = document.createElement("div");
    tile.classList.add("tile");

    const r = Math.random();
    if(r < 0.1) tile.classList.add("water");
    else if(r < 0.3) tile.classList.add("earth");
    else tile.classList.add("grass");

    mapContainer.appendChild(tile);
    tiles.push({x, y, element: tile, type: tile.classList[1]});
  }
}

// ----- Classes -----
class Species {
  constructor(name, type, color){
    this.name = name;
    this.type = type; // herbivoro ou carnivoro
    this.color = color;
  }
}

class Creature {
  constructor(species, x, y){
    this.species = species;
    this.x = x;
    this.y = y;
    this.life = 100;
    this.hunger = 100;
    this.thirst = 100;
    this.alive = true;

    this.element = document.createElement("div");
    this.element.classList.add("creature");
    this.element.style.backgroundColor = species.color;
    mapContainer.appendChild(this.element);
  }

  update() {
    if(!this.alive) return;

    // diminui fome e sede
    this.hunger -= 0.05;
    this.thirst -= 0.05;
    if(this.hunger <= 0 || this.thirst <=0) this.life -= 0.2;
    if(this.life <=0){
      this.die();
      return;
    }

    // movimentação aleatória simples
    const dx = Math.floor(Math.random()*3) - 1;
    const dy = Math.floor(Math.random()*3) - 1;
    this.x = Math.max(0, Math.min(mapSize-1, this.x + dx));
    this.y = Math.max(0, Math.min(mapSize-1, this.y + dy));

    // atualizar posição visual
    this.element.style.left = (this.x * tileSize + 2) + "px";
    this.element.style.top = (this.y * tileSize + 2) + "px";
  }

  die(){
    this.alive = false;
    this.element.remove();
    spawnCarcass(this.x, this.y);
    creatures = creatures.filter(c => c !== this);
  }
}

class Plant {
  constructor(x, y){
    this.x = x;
    this.y = y;
    this.element = document.createElement("div");
    this.element.classList.add("tile");
    this.element.classList.add("grass");
    this.element.style.position = "absolute";
    this.element.style.left = (x*tileSize) + "px";
    this.element.style.top = (y*tileSize) + "px";
    this.element.style.width = tileSize + "px";
    this.element.style.height = tileSize + "px";
    mapContainer.appendChild(this.element);
  }
}

// ----- Mundo -----
let speciesList = [];
let creatures = [];
let plants = [];
let carcasses = [];

function spawnPlant(){
  const x = Math.floor(Math.random() * mapSize);
  const y = Math.floor(Math.random() * mapSize);
  plants.push(new Plant(x, y));
}

function spawnCreature(species){
  const x = Math.floor(Math.random() * mapSize);
  const y = Math.floor(Math.random() * mapSize);
  creatures.push(new Creature(species, x, y));
}

function spawnCarcass(x, y){
  const carc = document.createElement("div");
  carc.style.width = tileSize + "px";
  carc.style.height = tileSize + "px";
  carc.style.backgroundColor = "#654321";
  carc.style.position = "absolute";
  carc.style.left = (x*tileSize) + "px";
  carc.style.top = (y*tileSize) + "px";
  mapContainer.appendChild(carc);
  carcasses.push(carc);
  setTimeout(()=>{ carc.remove(); carcasses = carcasses.filter(c=>c!==carc)}, 10000); // decomposição em 10s
}

// ----- Menu -----
document.getElementById("create-species-btn").addEventListener("click", ()=>{
  const name = prompt("Nome da espécie:");
  const type = prompt("Tipo: herbivoro ou carnivoro");
  const color = prompt("Cor da espécie (ex: red, blue, #ff0):");
  if(name && type && color){
    speciesList.push(new Species(name, type, color));
    alert("Espécie criada!");
  }
});

document.getElementById("spawn-creature-btn").addEventListener("click", ()=>{
  if(speciesList.length === 0){ alert("Crie pelo menos uma espécie!"); return;}
  const sp = speciesList[Math.floor(Math.random()*speciesList.length)];
  spawnCreature(sp);
});

document.getElementById("clear-map-btn").addEventListener("click", ()=>{
  creatures.forEach(c => c.element.remove());
  creatures = [];
});

// ----- Loop principal -----
function gameLoop(){
  creatures.forEach(c => c.update());

  // spawn de plantas aleatório
  if(Math.random() < 0.05) spawnPlant();

  requestAnimationFrame(gameLoop);
}

gameLoop();
