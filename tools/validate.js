/* 約瑟的夢 — 不變式驗證器
   用法:在專案根目錄執行  node tools/validate.js
   改動劇情、門檻、路線圖後必跑(規範見 CLAUDE.md「開發與驗證流程」)。 */
const fs = require("fs");
const path = require("path");
const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.error("FAIL: 找不到 <script>"); process.exit(1); }

/* ---- DOM / localStorage stub ---- */
function mkEl(){return{innerHTML:"",textContent:"",className:"",classList:{add(){},remove(){}},style:{},setAttribute(){},append(){},appendChild(){},addEventListener(){},offsetWidth:0,disabled:false,onclick:null,querySelector(){return mkEl()},querySelectorAll(){return[]}};}
const els={};
global.document={getElementById:id=>(els[id]=els[id]||mkEl()),createElement:()=>mkEl(),addEventListener(){},body:mkEl(),querySelector:()=>mkEl(),querySelectorAll:()=>[]};
global.localStorage={getItem:()=>null,setItem(){},removeItem(){}};
global.window={scrollTo(){},addEventListener(){},location:{href:""}};
global.navigator={};
global.SRC=m[1];

const NLJOIN = String.fromCharCode(10);
const PROBE = `
;(function(){
const NL=String.fromCharCode(10);
let errs=[];
/* 1. 圖譜:斷鏈 / eff 整十 / 鎖規範 */
for(const[id,sc]of Object.entries(S)){
  for(const c of(sc.choices||[])){
    if(c.next&&!S[c.next])errs.push("斷鏈 "+id+" -> "+c.next);
    if(c.eff)for(const[k,v]of Object.entries(c.eff))if(v%10!==0)errs.push("eff 非整十 "+id+" "+k+"="+v);
    if(c.req&&!c.lockedNote)errs.push("鎖缺 lockedNote: "+id);
    if(c.req&&c.req.flag&&!c.req.label)errs.push("flag 鎖缺 label: "+id);
  }
  if(sc.ending&&!ENDINGS[sc.ending])errs.push("未知結局 "+id+" -> "+sc.ending);
}
/* 2. 殘留(已移除的機制/場景,別讓它回來) */
for(const bad of ["pickDynamicEnding","overrideText","branch:true","risk:","flee_wild","v_viz_amb",'"hate"',"faith_crown","wise_savior","halfway","homeward","grand_reunion","relent","賭一把"])
  if(SRC.includes(bad)) errs.push("殘留字樣: "+bad);
/* 3. 一結局一入口 */
const entry={};
for(const[id,sc]of Object.entries(S))for(const c of(sc.choices||[])){
  const t=S[c.next]; if(t&&t.ending) entry[t.ending]=(entry[t.ending]||0)+1;
}
for(const[eid,n]of Object.entries(entry)) if(n>1) errs.push("結局 "+eid+" 有 "+n+" 個入口(重疊)");
for(const k of Object.keys(ENDINGS)) if(!entry[k]) errs.push("結局無入口: "+k);
/* 4. 📖 規範:每幕至多一個;金標(canonical 入口)全遊戲恰好一個;支線(虛構場景)禁 📖 */
for(const[id,sc]of Object.entries(S)){
  const n=(sc.choices||[]).filter(c=>c.bible).length;
  if(n>1)errs.push("一幕多 📖: "+id);
  if(n>0 && (sc.fiction || /虛構|What-if/.test(sc.ref||""))) errs.push("虛構場景含 📖: "+id);
}
let canon=0;
for(const[id,sc]of Object.entries(S))for(const c of(sc.choices||[])){
  const t=S[c.next]; if(t&&t.ending&&ENDINGS[t.ending]&&ENDINGS[t.ending].canonical)canon++;
}
if(canon!==1)errs.push("金標入口數="+canon+"(應為 1)");
/* 5. 選項數文法:主場景 3;中繼站與終幕 2;小故事 1;結局 0 */
const TWO=["test_brothers","wild_years","affair_days","crowd_kneel","revenge_cell"];
for(const[id,sc]of Object.entries(S)){
  const n=(sc.choices||[]).length;
  const want = sc.ending?0 : id.startsWith("v_")?1 : TWO.includes(id)?2 : 3;
  if(n!==want)errs.push("選項數 "+id+"="+n+"(應為 "+want+")");
}
/* 6. DFS 全可達(狀態含 stats+flags,事件鑰匙才判得對) */
const reached=new Set(), endingsHit=new Set(), seen=new Set();
function dfs(id,st,fl){
  const key=id+"|"+st.faith+"|"+st.wisdom+"|"+st.ambition+"|"+[...fl].sort().join(".");
  if(seen.has(key))return; seen.add(key); reached.add(id);
  const sc=S[id];
  if(sc.ending){endingsHit.add(sc.ending);return}
  let any=false;
  for(const c of(sc.choices||[])){
    if(c.req){ if(c.req.stat&&st[c.req.stat]<c.req.val)continue; if(c.req.flag&&!fl.has(c.req.flag))continue; }
    any=true;
    const ns={...st};
    if(c.eff)for(const k in c.eff)ns[k]=Math.max(0,Math.min(100,ns[k]+c.eff[k]));
    const nf=c.flag? new Set([...fl,c.flag]) : fl;
    if(c.next)dfs(c.next,ns,nf);
  }
  if((sc.choices||[]).length&&!any)errs.push("全鎖死局: "+id);
}
dfs("start",{faith:20,wisdom:20,ambition:20},new Set());
const unreached=Object.keys(S).filter(k=>!reached.has(k));
if(unreached.length)errs.push("不可達場景: "+unreached.join(","));
const missEnd=Object.keys(ENDINGS).filter(k=>!endingsHit.has(k));
if(missEnd.length)errs.push("不可達結局: "+missEnd.join(","));
/* 7. 條件文:所有旗標組合渲染不丟例外 */
const FLAGS=["fled","grudge","crowd","confessed","outwit"];
for(const id of Object.keys(S)){
  for(let mask=0;mask<32;mask++){
    for(const k of Object.keys(flags))delete flags[k];
    FLAGS.forEach((f,i)=>{ if(mask&(1<<i)) flags[f]=true; });
    try{
      const sc=S[id];
      let t=(typeof sc.text==="function")?sc.text():sc.text;
      const cb=CALLBACKS[id]&&CALLBACKS[id]();
      if(cb){ t=(cb.pre?cb.pre+NL:"")+t+(cb.post?NL+cb.post:""); }
      if(typeof t!=="string"||!t.length)errs.push("空文案: "+id);
    }catch(e){ errs.push("渲染例外 "+id+" mask="+mask+": "+e.message); }
  }
}
for(const k of Object.keys(flags))delete flags[k];
/* 8. 路線圖資料一致性 */
const mapIds=new Set([...MAP_MAIN, ...MAP_NODES.map(n=>n.sc)]);
for(const id of mapIds) if(!S[id]) errs.push("地圖節點無場景: "+id);
for(const [f,t] of MAP_EDGES) if(!mapIds.has(f)||!mapIds.has(t)) errs.push("地圖邊未知節點: "+f+"->"+t);
for(const n of MAP_NODES) if(n.end && !ENDINGS[n.end]) errs.push("地圖結局格未知 id: "+n.sc);
const mapped=new Set(MAP_NODES.filter(n=>n.end).map(n=>n.end));
for(const k of Object.keys(ENDINGS)) if(!mapped.has(k)) errs.push("結局不在地圖上: "+k);
for(const [host,vs] of Object.entries(MAP_VIGNETTES)) for(const v of vs) if(!S[v]) errs.push("地圖小故事點無場景: "+v);
try{ openMap(); }catch(e){ errs.push("openMap 例外: "+e.message); }
/* ---- 報告 ---- */
console.log("場景:",Object.keys(S).length," 結局:",Object.keys(ENDINGS).length," 可達:",reached.size+"/"+Object.keys(S).length);
console.log("結局可達:",[...endingsHit].sort().join(","));
if(errs.length){ console.log("FAIL ("+errs.length+"):"); errs.forEach(e=>console.log("  - "+e)); process.exitCode=1; }
else console.log("ALL CHECKS PASS");
})();`;
eval(m[1] + PROBE);
