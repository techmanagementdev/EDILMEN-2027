import { contours } from 'd3-contour';
import { geoPath } from 'd3-geo';
import fs from 'fs';
// rilievo sintetico: alcune "montagne" gaussiane + rumore morbido, deterministico
const W=150,H=75; const vals=new Float64Array(W*H);
let s=7; const rnd=()=>{s=(s*16807)%2147483647;return s/2147483647;};
const peaks=Array.from({length:9},()=>({x:rnd()*W,y:rnd()*H*1.1,h:0.5+rnd(),r:11+rnd()*22}));
for(let y=0;y<H;y++)for(let x=0;x<W;x++){let v=0;for(const p of peaks){const d=((x-p.x)**2+(y-p.y)**2)/(2*p.r*p.r);v+=p.h*Math.exp(-d);}
 v+=0.04*Math.sin(x/4.4+Math.cos(y/5.6))+0.03*Math.cos(y/3.1-x/8);vals[y*W+x]=v;}
const th=Array.from({length:12},(_,i)=>0.08+i*0.11);
const cs=contours().size([W,H]).thresholds(th)(vals);
const path=geoPath(null);
const sc=16; // 2400x1200
let out=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W*sc} ${H*sc}" preserveAspectRatio="xMidYMid slice" fill="none" stroke="currentColor" stroke-width="1.2" vector-effect="non-scaling-stroke">`;
for(const c of cs){const d=path(c);if(!d)continue;
 const dd=d.replace(/-?\d+(\.\d+)?/g,m=>(+m*sc).toFixed(0));
 out+=`<path class="tl" d="${dd}"/>`;}
out+='</svg>';
fs.writeFileSync('/home/claude/topo.svg',out);console.log(out.length);
