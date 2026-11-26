import { pondAt, POND_SPACING, fishingSpot, FISH_ACTION, nearestPond, inWater } from "./meadow.js";


function noise(x,y,seed) {
  let n=Math.imul(x^seed,374761393)+Math.imul(y,668265263);
  n=Math.imul(n^(n>>>13),1274126177);
  return (n^(n>>>16))>>>0;
}
const regions = ["Fern Hollow","Amberwood","Bluebell Reach"];
export function regionAt(x,y){return (Math.floor((x+160)/320)+Math.floor((y+160)/320)*2)%3+3;}
const palettes=[
  ["#426b55","#193f3b","#336353","#547e59","#87ad6a"],
  ["#737342","#453f34","#635736","#99834b","#caab60"],
  ["#416866","#253c46","#354f56","#547571","#85a09a"]
];
function oval(g,x,y,a,b,color,angle=0){
  g.fillStyle=color;g.beginPath();g.ellipse(x,y,a,b,angle,0,Math.PI*2);g.fill();
}
function shape(g,points,color){
  g.fillStyle=color;g.beginPath();g.moveTo(...points[0]);
  for(const p of points.slice(1))g.lineTo(...p);
  g.closePath();g.fill();
}
const sprites=new Map();
function tree(n,zone){
  const key=zone*16+n%16;
  if(sprites.has(key))return sprites.get(key);
  const pic=document.createElement("canvas");pic.width=128;pic.height=168;
  const g=pic.getContext("2d"), pal=palettes[zone],pine=n%3===0;
  g.translate(64,158);
  shape(g,[[-14,2],[-5,-12],[-4,-83],[4,-87],[6,-15],[16,2],[3,-2]],"#4d4536");
  shape(g,[[0,-6],[1,-80],[4,-85],[4,-9]],"#968465");
  for(let j=0;j<26;j++){
    const h=noise(j,key,70),t=j/26;
    const width=pine?40*(1-t)+8:37*Math.sin(Math.PI*(t*.8+.1));
    const x=(h%101/50-1)*width, y=-49-t*78;
    if(pine)shape(g,[[x-width*.62,y+12],[x+3,y-22],[x+width*.65,y+9]],pal[1+j%3]);
    else {oval(g,x,y,17+h%12,12+h%8,pal[1+j%3]);oval(g,x-4,y-5,11,5,pal[3]);}
  }
  sprites.set(key,pic);return pic;
}
export function cover(g,type,t=0){
  g.save();g.rotate(t);
  if(type==="stone"){
    shape(g,[[-17,0],[-14,-9],[-4,-16],[9,-13],[17,-5],[13,2],[-6,4]],"#526763");
    shape(g,[[-14,-9],[-4,-16],[9,-13],[5,-8],[-8,-6]],"#9aab94");
    oval(g,-6,-11,8,3,"#7c9b58",-0.25);
  }else{
    for(let i=0;i<9;i++){
      const a=(i-4)*.32,x=Math.sin(a)*13,y=-Math.cos(a)*9;
      oval(g,x,y,4,10,i%2?"#5c8d54":"#396e52",a);
      oval(g,x-1,y-3,1.1,6,"#99b96e",a);
    }
  }
  g.restore();
}
export function paint(g,world,id,camera,time,walking){
  const w=g.canvas.width,h=g.canvas.height,unit=Math.min(w/310,h/280)*1.22;
  const horizon=h*.25,center=h*.64, focal=(center-horizon)/(.72*unit);
  const cos=Math.cos(camera.angle),sin=Math.sin(camera.angle);
  function project(wx,wy){
    const dx=wx-camera.x,dy=wy-camera.y,depth=dx*sin-dy*cos;
    const k=focal/(focal+depth);
    if(depth < -focal*.58 || depth>510)return null;
    return {x:w/2+(dx*cos+dy*sin)*k*unit,y:horizon+(center-horizon)*k,k:k*unit,depth};
  }
  const zone=regionAt(camera.x,camera.y)%3,pal=palettes[zone];
  const sky=g.createLinearGradient(0,0,0,horizon*1.7);
  sky.addColorStop(0,"#89b3ae");sky.addColorStop(.64,"#e7dcaa");sky.addColorStop(1,pal[0]);
  g.fillStyle=sky;g.fillRect(0,0,w,h);
  const ground=g.createLinearGradient(0,horizon,0,h);
  ground.addColorStop(0,"#94ac88");ground.addColorStop(.42,pal[0]);ground.addColorStop(1,pal[1]);
  g.fillStyle=ground;g.fillRect(0,horizon,w,h-horizon);
  for(let layer=0;layer<3;layer++){
    const stride=(9+layer*4)*unit, offset=camera.angle*stride*34;
    const start=Math.floor(offset/stride);
    for(let i=start-1;i<start+w/stride+2;i++){
      const n=noise(((i%214)+214)%214,layer,world.seed),x=i*stride-offset;
      const base=horizon+(layer*6+1)*unit, ht=(12+layer*3+n%22)*unit;
      shape(g,[[x-stride,base],[x,base-ht],[x+stride,base]],["#acc4ae","#91af96","#779b82"][layer]);
    }
  }
  const things=[],targets=[];
  function sprite(p,fn){if(p&&p.x>-130*p.k&&p.x<w+130*p.k&&p.y<h+150*p.k)things.push([p,fn]);}
  // A winding trail ties the glades together. Build short ribbons in world space.
  const trail=y=>Math.sin(y/95+world.seed%5)*24;
  const trailBand=Math.round(camera.x/280);
  for(let band=trailBand-2;band<=trailBand+2;band++)for(let y=Math.floor((camera.y-510)/12)*12;y<camera.y+510;y+=12){
    const points=[[y,-11],[y,11],[y+12,11],[y+12,-11]].map(([v,d])=>project(band*280+trail(v)+d,v));
    if(points.every(Boolean))shape(g,points.map(p=>[p.x,p.y]),"#9e9871");
  }
  const cx=Math.floor(camera.x/36),cy=Math.floor(camera.y/36);
  for(let iy=cy-14;iy<=cy+14;iy++)for(let ix=cx-14;ix<=cx+14;ix++){
    const n=noise(ix,iy,world.seed),x=ix*36+n%30,y=iy*36+(n>>>9)%30,p=project(x,y);
    if(!p||p.x < -60*p.k||p.x>w+60*p.k||p.y>h+130*p.k)continue;
    if(inWater({x,y},nearestPond({x,y},world.seed)))continue;
    const z=regionAt(x,y)%3,colors=palettes[z];
    oval(g,p.x,p.y,8*p.k,2*p.k,colors[2]);
    if(Math.abs(x-280*Math.round((x-trail(y))/280)-trail(y))<21)continue;
    if(n%5<2){
      const pic=tree(n,z),s=.39+(n>>>12)%31/100;
      sprite(p,()=>{if(p.depth<5&&Math.abs(p.x-w/2)<48*p.k)g.globalAlpha=.28;
        g.drawImage(pic,-64*s,-158*s,128*s,168*s);});
    }else if(n%13===0){
      const type=n%2?"fern":"stone";
      sprite(p,()=>{g.scale(.78,.78);cover(g,type);});
      targets.push({id:0,x:p.x,y:p.y-6*p.k,size:p.k,point:{x,y,cover:type}});
    }else if(n%5===2)sprite(p,()=>{for(let j=0;j<4;j++){const v=j*3-5;oval(g,v,-3,1.1,4,colors[4],v*.15);}});
    else if(n%11===0)sprite(p,()=>{for(let j=0;j<3;j++){const v=j*4;g.fillStyle="#dfcfab";g.fillRect(v,-4-j,2,5);oval(g,v+1,-5-j,3,2,z===2?"#bda0cc":"#ce845a");}});
  }
  for(let iy=Math.round(camera.y/POND_SPACING)-1;iy<=Math.round(camera.y/POND_SPACING)+1;iy++)
    for(let ix=Math.round(camera.x/POND_SPACING)-1;ix<=Math.round(camera.x/POND_SPACING)+1;ix++){
      const pond=pondAt(ix,iy,world.seed),p=project(pond.x,pond.y);
      if(!p||p.y>h+20*p.k)continue;
      for(const [a,b,c] of [[40,14,"#8a9873"],[36,12,"#3b7c7a"],[28,8,"#599898"]])oval(g,p.x,p.y,a*p.k,b*p.k,c);
      for(let j=0;j<5;j++)oval(g,p.x+(j*8-17)*p.k,p.y+Math.sin(j*9+time*.7)*4*p.k,3*p.k,p.k,"#a2c398");
      const spot=fishingSpot(pond),dock=project(spot.x,spot.y);
      if(dock){sprite(dock,()=>{for(let j=0;j<4;j++){g.fillStyle=j%2?"#ad9065":"#c6a577";g.fillRect(-8,-4+j*2,16,2);}
      g.fillStyle="#5b4f39";g.fillRect(7,-15,2,20);shape(g,[[9,-15],[19,-13],[9,-9]],"#e5ad66");});
      targets.push({id:FISH_ACTION,x:dock.x,y:dock.y,size:dock.k,point:spot});}
    }
  for(const bug of world.bugs){
    const p=project(bug.x,bug.y);if(!p)continue;
    sprite(p,()=>{const pulse=(time+bug.id*.9)%3.5;cover(g,bug.cover,pulse<.85?Math.sin(pulse*20)*.095:0);
      if(pulse<.85){g.fillStyle="#fff1ac";g.fillRect(12,-22,2,4);g.fillRect(11,-21,4,2);}});targets.push({id:bug.id,point:bug,x:p.x,y:p.y-3*p.k,size:p.k});
  }
  for(const [key,player] of Object.entries(world.players)){
    const p=project(player.x,player.y);sprite(p,()=>{
      oval(g,0,1,9,3,"#334e43");const bounce=key===id&&walking?Math.sin(time*10)*1.6:0;
      g.translate(0,bounce);const shirt=player.coat||"#dd7956";
      for(const dx of [-4,3])oval(g,dx,0,2.6,3,"#493f36");
      oval(g,0,-8,7,8,shirt);oval(g,-7,-7,2,4,"#d8a377");oval(g,7,-7,2,4,"#d8a377");
      oval(g,0,-17,6,6,"#d4a178");oval(g,0,-20,10,3,"#ac8150");oval(g,0,-23,7,5,"#e2bd7e");
      g.fillStyle=shirt;g.fillRect(-6,-22,12,2);
      if(Math.cos(player.angle-camera.angle)>.1){oval(g,0,-9,4,4,"#9e7247");g.fillStyle="#e3b577";g.fillRect(-3,-12,6,2);}
      else {g.fillStyle="#463b30";g.fillRect(-3,-18,1,1);g.fillRect(2,-18,1,1);}
    });
  }
  things.sort((a,b)=>b[0].depth-a[0].depth);
  for(const [p,draw] of things){g.save();g.translate(p.x,p.y);g.scale(p.k,p.k);draw();g.restore();}
  for(let i=0;i<10;i++){const x=((i*73+Math.sin(time*.34+i)*9)%100+100)%100/100*w;
    const y=(.32+((i*19+time*1.1)%50)/100)*h;oval(g,x,y,unit,unit,"#ffedaa77");}
  return targets;
}
export function placeName(p){return regions[regionAt(p.x,p.y)%3];}

