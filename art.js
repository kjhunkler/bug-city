// Paint the field at its native resolution so every sprite shares one pixel grid.
export function paint(ctx,g,t){
 const home=g.scene==='home', {x:px,y:py}=g.player;
 function rect(x,y,w,h,c){ctx.fillStyle=c;ctx.fillRect(Math.round(x),Math.round(y),w,h)}
 function oval(x,y,a,b,c){for(let j=-b;j<=b;j++){const n=Math.round(a*Math.sqrt(1-(j/b)**2));rect(x-n,y+j,n*2+1,1,c)}}
 function rng(seed){return ()=>((seed=Math.imul(seed,1664525)+1013904223|0)>>>0)/4294967296}
 const r=rng(home?125:953);
 rect(0,0,320,180,home?'#414a33':'#393a37');
 for(let i=0;i<1500;i++){const x=r()*320,y=r()*180;rect(x,y,1+r()*4|0,1,home?(i%2?'#526041':'#343e2e'):(i%2?'#48443c':'#302f2d'))}
 for(let y=0;y<180;y++){const bend=151+Math.sin(y/42)*21;rect(bend-18,y,38,1,'#736444');rect(bend-15,y,30,1,'#88764e')}
 for(let i=0;i<130;i++){let y=r()*180;rect(136+Math.sin(y/42)*21+r()*30,y,2,1,'#665d42')}
 function leaf(x,y,s){oval(x,y,s,Math.ceil(s*.52),'#283b30');oval(x-1,y-2,s-1,Math.ceil(s*.46),'#526246');rect(x-s+1,y-2,s*1.6,1,'#768253')}
 for(let i=0;i<210;i++){let x=r()*320,y=r()*182;if(y<18||x<15||x>305||y>171)leaf(x,y,3+r()*8|0)}
 function shroom(x,y,s){oval(x+2,y+2,s,3,'#333b2c');rect(x-2,y-s,5,s,'#cdb990');oval(x,y-s,s,s>>1,'#914f35');rect(x-s+2,y-s-2,s*2-4,3,'#c2764c');rect(x-3,y-s-3,3,2,'#f3d59b')}
 function hut(x,y,s){oval(x+4,y+1,s+5,6,'#303a2c');rect(x-s+4,y-20,s*2-8,20,'#a28c60');for(let k=-s+5;k<s-4;k+=5)rect(x+k,y-17,1,16,'#756749');rect(x-5,y-12,9,13,'#483f30');rect(x-4,y-10,6,8,'#edb35f');oval(x,y-23,s,11,'#533f30');oval(x-1,y-26,s-1,10,'#a65536');oval(x-3,y-29,s-5,7,'#c57244');rect(x-8,y-33,6,2,'#f2c286');rect(x+4,y-28,4,2,'#edb778');rect(x-7,y,14,2,'#c7ad79')}
 if(home){hut(76,77,22);hut(229,62,20);hut(252,128,24)}else{for(let i=0;i<7;i++){let x=22+r()*270,y=22+r()*123;rect(x,y,12,6,'#58554a');rect(x,y,11,1,'#8a8167')}}
 for(let [x,y] of [[37,104],[43,108],[202,151],[211,154],[272,44],[103,36]])shroom(x,y,5);
 function bug(x,y,c){oval(x+1,y+3,7,2,'#2e3028');for(let k of [-4,0,4]){rect(x-6,y+k,12,1,'#261f20')}oval(x,y,4,5,c);rect(x,y-4,1,8,'#544b38');rect(x-2,y-7,5,3,'#302f2b');rect(x-3,y-8,1,2,'#d1bc88');rect(x+3,y-8,1,2,'#d1bc88')}
 if(!home){oval(g.exit.x,g.exit.y,9,4,'#9bbe93');oval(g.exit.x,g.exit.y,6,2,'#415e51');for(const l of g.loot){rect(l.x-2,l.y-2,4,4,'#efc873');rect(l.x,l.y-3,2,2,'#fff1b5')}for(const e of g.enemies){if(e.windup>0){ctx.strokeStyle='#ffb172';ctx.beginPath();ctx.arc(e.x,e.y,12,0,7);ctx.stroke()}bug(e.x,e.y,'#d57459')}}
 bug(px,py,'#edc76c');rect(px+5,py,2,3,'#fff0a1');
 for(let i=0;i<15;i++){const x=r()*320,y=r()*180;if(Math.sin(t+i)>0.4)rect(x,y,1,1,'#e3ce7e')}
}
