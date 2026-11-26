export function ellipse(g,x,y,a,b,color,angle=0){
  g.fillStyle=color;g.beginPath();g.ellipse(x,y,a,b,angle,0,Math.PI*2);g.fill();
}
export function line(g,x,y,x2,y2,width,color){
  g.lineWidth=width;g.strokeStyle=color;g.lineCap="round";g.beginPath();g.moveTo(x,y);g.lineTo(x2,y2);g.stroke();
}
export function insect(g,x,y,kind,t,scale=1){
  g.save();g.translate(x,y);g.scale(scale,scale);
  const flutter=.82+.16*Math.sin(t*7),ink="#393a30";
  if(kind==="caterpillar"){
    for(let i=0;i<6;i++){
      const h=Math.sin(t*3+i)*1.2;line(g,i*2.8-8,h,i*2.8-9,h+3.5,1,ink);
      ellipse(g,i*2.8-8,h-1,2.6,3,i%2?"#9eb74c":"#719744");
    }
    ellipse(g,7,-2,1,1,ink);
  }else if(kind==="butterfly"||kind==="dragonfly"){
    for(const sign of [-1,1]){
      const long=kind==="dragonfly";
      ellipse(g,sign*6,-3, (long?9:7)*flutter,long?2:5,long?"#c4e9df":"#e6a35c",sign*-.5);
      ellipse(g,sign*5,2, (long?7:5)*flutter,long?1.7:4,long?"#94c5bf":"#c9765a",sign*.5);
      if(!long){ellipse(g,sign*9,-5,2,1.8,"#563f43");ellipse(g,sign*9,-5,.8,.8,"#fff2ce");}
    }
    ellipse(g,0,0,1.4,7,ink);
  }else{
    for(const s of [-1,1])for(let j=-1;j<=1;j++)line(g,s*3,j*3,s*6,j*3+Math.sin(t*4+j)*1.4,1,ink);
    ellipse(g,0,-4,2.8,2.7,ink);
    ellipse(g,0,0,4.6,5.5,kind==="ladybug"?"#c95139":kind==="bee"?"#e3ae41":"#55563c");
    if(kind==="ladybug"){
      line(g,0,-4,0,4,.7,ink);
      for(const s of [-1,1])for(const j of [-2,1.5])ellipse(g,s*2.5,j,1.1,1.1,ink);
    }else if(kind==="bee"){
      line(g,-3,-1,3,-1,1.8,ink);line(g,-3,2,3,2,1.8,ink);
      for(const s of [-1,1])ellipse(g,s*4,-3,2.1,4*flutter,"#d6ebe4dd",s*.5);
    }else {ellipse(g,0,3.5,3.2,2.1,"#f6e680");ellipse(g,0,4,6,4,"#ffff7d33");}
  }
  g.restore();
}
export function jarScene(g,kinds,time){
  const w=g.canvas.width,h=g.canvas.height;g.clearRect(0,0,w,h);
  g.save();g.scale(w/300,h/230);
  ellipse(g,150,213,83,6,"#52402933");
  const bottle=new Path2D("M95 34 L205 34 Q203 45 217 54 Q229 64 228 84 L226 191 Q226 210 210 213 Q149 221 90 213 Q74 210 74 191 L72 84 Q71 62 84 53 Q97 44 95 34 Z");
  g.save();g.clip(bottle);
  const glass=g.createLinearGradient(72,0,228,0);
  for(const [s,c] of [[0,"#76938a"],[.08,"#c9ddd2"],[.24,"#e5edd7"],[.58,"#d5e1c2"],[.86,"#b3ccb8"],[1,"#789991"]])glass.addColorStop(s,c);
  g.fillStyle=glass;g.fillRect(65,32,170,185);
  ellipse(g,151,211,88,27,"#7a6549");ellipse(g,150,195,80,13,"#80945b");
  for(let i=0;i<39;i++)ellipse(g,76+i*4,192+Math.sin(i*3.22)*5,3,2,i%2?"#9ca76a":"#697849");
  line(g,96,192,197,107,4,"#8a6c4c");line(g,154,144,141,118,2.4,"#8a6c4c");
  for(let i=0;i<9;i++)ellipse(g,101+i*9,184-i*7,7,3.4,i%2?"#728d59":"#98ab71",i%2?-.8:.5);
  kinds.forEach((k,i)=>{const t=time*.32+i*2.4, x=100+(i*37)%100+Math.sin(t)*7,y=74+(i*23)%103+Math.cos(t*.8)*6;
    g.save();g.translate(x,y);g.rotate(Math.sin(t)*1.4);insect(g,0,0,k,time+i,.92);g.restore();});
  line(g,84,76,84,142,4,"#ffffffa0");line(g,89,65,94,60,3,"#ffffffe0");line(g,217,116,217,181,2,"#ffffffe0");
  g.restore();g.strokeStyle="#68887d";g.lineWidth=2.5;g.stroke(bottle);
  g.fillStyle="#80785e";g.fillRect(90,23,120,15);
  for(let i=0;i<29;i++)line(g,92+i*4,25,91+i*4,36,1.6,"#b6ab85");
  ellipse(g,150,23,60,7,"#d1c59d");ellipse(g,150,22,53,4,"#a99f7e");
  for(let i=0;i<6;i++)ellipse(g,127+(i%3)*21,20+Math.floor(i/3)*3,2,1,"#514f44");
  g.restore();
}

