const FIBER = {
  getProjects(){ try{return JSON.parse(localStorage.getItem('fiberosProjects')||'[]')}catch{return[]} },
  setProjects(v){localStorage.setItem('fiberosProjects',JSON.stringify(v))},
  getActive(){ try{return JSON.parse(localStorage.getItem('fiberosActiveProject')||'null')}catch{return null} },
  setActive(v){localStorage.setItem('fiberosActiveProject',JSON.stringify(v))},
  colors(grid){const m=new Map();(grid||[]).flat().forEach(c=>m.set(c,(m.get(c)||0)+1));return [...m.entries()].map(([hex,count],i)=>({hex,count,name:`Color ${i+1}`,brand:'Unassigned'})).sort((a,b)=>b.count-a.count)},
  symbols:['●','▲','■','◆','✚','✦','○','△','□','◇','✕','✱','⬟','⬢','▰','▱','☰','≋','⌁','⊙'],
  escape(s=''){return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))},
  demo(){const colors=['#f7efe4','#4a1f4f','#c13f8a','#2a7d58'];const grid=Array.from({length:28},(_,y)=>Array.from({length:36},(_,x)=>{const cx=x-18,cy=y-14;if(cx*cx+cy*cy<55)return colors[2];if(Math.abs(cx)<2&&y>14)return colors[3];if((x+y)%17===0)return colors[1];return colors[0]}));return{id:'demo',name:'Flower Sampler',visibility:'private',createdAt:new Date().toLocaleString(),stitches:36,rows:28,grid,note:'Check color placement before beginning.',palette:FIBER.colors(grid)}}
};


(function(){
  const saved=localStorage.getItem('fiberos_theme')||'light';
  document.documentElement.dataset.theme=saved;
  window.FIBER_THEME={
    toggle(){const next=document.documentElement.dataset.theme==='dark'?'light':'dark';document.documentElement.dataset.theme=next;localStorage.setItem('fiberos_theme',next);return next},
    addButton(container){if(!container||container.querySelector('.theme-toggle'))return;const b=document.createElement('button');b.className='btn ghost small theme-toggle';b.type='button';b.textContent=document.documentElement.dataset.theme==='dark'?'Light mode':'Dark mode';b.onclick=()=>{const n=this.toggle();b.textContent=n==='dark'?'Light mode':'Dark mode'};container.appendChild(b)}
  };
  document.addEventListener('DOMContentLoaded',()=>FIBER_THEME.addButton(document.querySelector('.topin')));
})();
