import * as cheerio from "cheerio";

const BASE="https://www.fussball.de";
export const CLUB_ID="00ES8GN9B8000051VV0AG08LVUPGND5I";

const clean=v=>String(v??"")
  .replace(/[\u200b\u200c\u200d\u2060]/g,"")
  .replace(/\u00a0/g," ")
  .replace(/\s+/g," ")
  .trim();

const absolute=href=>{
  try{return new URL(href,BASE).href.split("?")[0]}catch{return ""}
};

const externalId=url=>(
  String(url||"").match(/\/-\/spiel\/([A-Z0-9]{12,})(?:\/|$)/i) ||
  String(url||"").match(/\/spiel\/([A-Z0-9]{12,})(?:\/|$)/i) ||
  []
)[1]||"";

function iso(dd,mm,yyyy){
  return `${yyyy.length===2?`20${yyyy}`:yyyy}-${mm}-${dd}`;
}

function parseMeta(text){
  const t=clean(text);
  let date="",kickoff="",category="",competition="",matchType="",gameNumber="";

  let m=t.match(/(\d{2})\.(\d{2})\.(\d{4})\s*[-–]\s*([0-2]?\d:[0-5]\d)\s*Uhr/i);
  if(m){
    date=iso(m[1],m[2],m[3]);
    kickoff=m[4].padStart(5,"0");
  }

  if(!date){
    m=t.match(/(?:Mo|Di|Mi|Do|Fr|Sa|So),?\s*(\d{2})\.(\d{2})\.(\d{2})\s*(?:\||·)?\s*([0-2]?\d:[0-5]\d)/i);
    if(m){
      date=iso(m[1],m[2],m[3]);
      kickoff=m[4].padStart(5,"0");
    }
  }

  m=t.match(/\b(Herren(?:-Reserve)?|Frauen|A-Junioren|B-Junioren|C-Junioren|D-Junioren|E-Junioren|F-Junioren)\b/i);
  if(m)category=clean(m[1]);

  m=t.match(/\b(FS|ME|PO|TU)\b\s*(?:\||·)?\s*(\d{6,12})\b/i);
  if(m){
    matchType=m[1].toUpperCase();
    gameNumber=m[2];
  }

  if(category){
    const idx=t.toLowerCase().indexOf(category.toLowerCase());
    let tail=clean(t.slice(idx+category.length));
    tail=tail.replace(/\s+\b(?:FS|ME|PO|TU)\b\s*(?:\|?\s*\d{6,12})?.*$/i,"");
    competition=clean(tail.replace(/^[|·,:;\-–]+/,""));
  }

  return {date,kickoff,category,competition,matchType,gameNumber};
}

function statusFrom(text){
  const t=clean(text);
  if(/\bABSE\.?\b|\bAbsetzung\b|\bSpielabsetzung\b/i.test(t))return "abgesetzt";
  if(/\bAUSF\.?\b|\bAusfall\b|\bSpielausfall\b/i.test(t))return "ausfall";
  if(/\bABBR\.?\b|\bAbbruch\b|\bSpielabbruch\b/i.test(t))return "abbruch";
  if(/\bVERL\.?\b|\bVerlegung\b|\bverlegt\b/i.test(t))return "verlegt";
  return "geplant";
}

function usefulTeam(t){
  t=clean(t);
  return Boolean(t) &&
    t.length<130 &&
    !/Zum Spiel|Absetzung|Ausfall|Abbruch|Spielbericht/i.test(t) &&
    !/^[\d:–\-]+$/.test(t);
}

function teamsFromRow($,row){
  const links=$(row).find("a").map((_,a)=>({
    href:$(a).attr("href")||"",
    text:clean($(a).text())
  })).get().filter(x=>usefulTeam(x.text) && !/\/spiel\//i.test(x.href));

  if(links.length>=2)return {home:links[0].text,away:links[1].text};

  const txt=clean($(row).text());
  const parts=txt.split(/\s+:\s+/);
  if(parts.length>=2){
    return {
      home:clean(parts[0]).replace(/^.*?\b(?:FS|ME|PO|TU)\b(?:\s*\|?\s*\d{6,12})?\s*/i,""),
      away:clean(parts.slice(1).join(" : ")).replace(/\b(?:Absetzung|Ausfall|Abbruch|Zum Spiel).*$/i,"")
    };
  }
  return {home:"",away:""};
}

function eventKey(r){
  return r.externalId || r.gameNumber || `${r.date}|${r.kickoff}|${r.home}|${r.away}`;
}

export function parseMatchplanHtml(html,sourceUrl=""){
  const $=cheerio.load(html);
  const results=[];
  let current={date:"",kickoff:"",category:"",competition:"",matchType:"",gameNumber:""};
  let lastStatusText="";

  const rows=$("tr").toArray();

  if(rows.length){
    for(const row of rows){
      const text=clean($(row).text());
      if(!text)continue;

      const meta=parseMeta(text);
      for(const k of ["date","kickoff","category","competition","matchType","gameNumber"]){
        if(meta[k])current[k]=meta[k];
      }

      // Keep status text local to the game block.
      if(/\b(?:Absetzung|Ausfall|Abbruch|ABSE\.?|AUSF\.?|ABBR\.?)\b/i.test(text)){
        lastStatusText=text;
      }

      const gameAnchors=$(row).find('a[href*="/spiel/"]').toArray();
      if(!gameAnchors.length)continue;

      const teams=teamsFromRow($,row);
      for(const a of gameAnchors){
        const url=absolute($(a).attr("href"));
        const id=externalId(url);
        if(!id)continue;

        results.push({
          externalId:id,
          url,
          ...current,
          ...teams,
          status:statusFrom(`${lastStatusText} ${text}`),
          sourceUrl,
          raw:text
        });
      }

      current={date:"",kickoff:"",category:"",competition:"",matchType:"",gameNumber:""};
      lastStatusText="";
    }
  }

  // Fallback for layouts without table rows.
  if(!results.length){
    const all=$('a[href*="/spiel/"]').toArray();
    for(const a of all){
      const url=absolute($(a).attr("href"));
      const id=externalId(url);
      if(!id)continue;

      let node=$(a),ctx="";
      for(let i=0;i<10&&node.length;i++){
        const t=clean(node.text());
        if(t&&t.length<2500)ctx=t;
        const m=parseMeta(t);
        if(m.date&&m.kickoff)break;
        node=node.parent();
      }
      const meta=parseMeta(ctx);
      const teams=teamsFromRow($,node.length?node:$(a).parent());
      results.push({
        externalId:id,url,...meta,...teams,
        status:statusFrom(ctx),sourceUrl,raw:ctx
      });
    }
  }

  const dedup=new Map();
  for(const r of results){
    const k=eventKey(r);
    const old=dedup.get(k);
    if(!old){dedup.set(k,r);continue}
    const merged={...old};
    for(const field of ["date","kickoff","category","competition","matchType","gameNumber","home","away","url","externalId"]){
      if(!merged[field]&&r[field])merged[field]=r[field];
    }
    if(r.status!=="geplant")merged.status=r.status;
    dedup.set(k,merged);
  }
  return [...dedup.values()];
}

async function fetchText(url,timeoutMs=15000){
  const c=new AbortController();
  const timer=setTimeout(()=>c.abort(),timeoutMs);
  try{
    const r=await fetch(url,{
      signal:c.signal,
      redirect:"follow",
      headers:{
        "user-agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36",
        "accept-language":"de-DE,de;q=0.9",
        "x-requested-with":"XMLHttpRequest",
        "referer":`${BASE}/verein/sv-gemmingen-baden/-/id/${CLUB_ID}`,
        "accept":"text/html,application/xhtml+xml,*/*"
      }
    });
    if(!r.ok)throw new Error(`HTTP ${r.status}`);
    return await r.text();
  }finally{clearTimeout(timer)}
}

function seasonBounds(){
  const now=new Date();
  const y=now.getFullYear();
  const startMonth=now.getMonth()+1>=7?y:y-1;
  return {from:`${startMonth}-07-01`,to:`${startMonth+1}-06-30`};
}

export function candidateUrls(){
  const {from,to}=seasonBounds();
  return [
    {
      name:"ajax-default",
      url:`${BASE}/ajax.club.matchplan/-/id/${CLUB_ID}/mode/PAGE/show-filter/true`
    },
    {
      name:"ajax-max-a",
      url:`${BASE}/ajax.club.matchplan/-/id/${CLUB_ID}/max/999/mode/PAGE/show-filter/false`
    },
    {
      name:"ajax-max-b",
      url:`${BASE}/ajax.club.matchplan/-/id/${CLUB_ID}/mode/PAGE/max/999/show-filter/false`
    },
    {
      name:"ajax-season",
      url:`${BASE}/ajax.club.matchplan/-/datum-bis/${to}/datum-von/${from}/id/${CLUB_ID}/match-type/-1/max/999/mode/PAGE/show-filter/false`
    },
    {
      name:"print-season",
      url:`${BASE}/vereinsspielplan.druck/-/datum-bis/${to}/datum-von/${from}/id/${CLUB_ID}/match-type/-1/max/999/mode/PRINT/show-venues/false`
    }
  ];
}

export async function runDirectMatchplanTest({onProgress=()=>{}}={}){
  const reports=[];
  const merged=new Map();

  for(const src of candidateUrls()){
    try{
      onProgress({phase:"source",message:`${src.name} wird geladen …`,source:src.name});
      const html=await fetchText(src.url,18000);
      const rows=parseMatchplanHtml(html,src.url);

      const report={
        name:src.name,
        url:src.url,
        bytes:Buffer.byteLength(html),
        rows:rows.length,
        withDate:rows.filter(r=>r.date).length,
        withKickoff:rows.filter(r=>r.kickoff).length,
        withTeams:rows.filter(r=>r.home&&r.away).length,
        cancelled:rows.filter(r=>["abgesetzt","ausfall","abbruch"].includes(r.status)).length
      };
      reports.push(report);
      onProgress({phase:"source-result",report});

      for(const r of rows){
        const key=eventKey(r);
        const old=merged.get(key);
        if(!old){
          merged.set(key,r);
        }else{
          const m={...old};
          for(const field of ["externalId","url","date","kickoff","category","competition","matchType","gameNumber","home","away"]){
            if(!m[field]&&r[field])m[field]=r[field];
          }
          if(r.status!=="geplant")m.status=r.status;
          merged.set(key,m);
        }
      }
    }catch(e){
      const report={name:src.name,url:src.url,error:e.name==="AbortError"?"Timeout":e.message,rows:0,withKickoff:0};
      reports.push(report);
      onProgress({phase:"source-error",report});
    }
  }

  const rows=[...merged.values()];
  const stats={
    total:rows.length,
    withDate:rows.filter(r=>r.date).length,
    withKickoff:rows.filter(r=>r.kickoff).length,
    withTeams:rows.filter(r=>r.home&&r.away).length,
    withGameNumber:rows.filter(r=>r.gameNumber).length,
    cancelled:rows.filter(r=>["abgesetzt","ausfall","abbruch"].includes(r.status)).length
  };

  return {reports,stats,rows};
}

export {clean,statusFrom,fetchText};
