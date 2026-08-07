import * as cheerio from "cheerio";

const BASE = "https://www.fussball.de";
export const DEFAULT_CLUB_ID = "00ES8GN9B8000051VV0AG08LVUPGND5I";

const clean = v => String(v ?? "")
  .replace(/[\u200b\u200c\u200d\u2060]/g, "")
  .replace(/\u00a0/g, " ")
  .replace(/\s+/g, " ")
  .trim();

const abs = href => {
  try { return new URL(href, BASE).href.split("?")[0]; }
  catch { return ""; }
};

export function externalIdFromUrl(url) {
  const s=String(url||"");
  return (
    s.match(/\/-\/spiel\/([A-Z0-9]{12,})(?:\/|$)/i) ||
    s.match(/\/spiel\/([A-Z0-9]{12,})(?:\/|$)/i) ||
    []
  )[1] || "";
}

function isoDate(dd, mm, yyyy) {
  return `${yyyy.length===2 ? `20${yyyy}` : yyyy}-${mm}-${dd}`;
}

function parseMeta(text) {
  const t=clean(text);
  let date="",kickoff="",category="",competition="",matchType="",gameNumber="";

  let m=t.match(/(\d{2})\.(\d{2})\.(\d{4})\s*-\s*([0-2]?\d:[0-5]\d)\s*Uhr/i);
  if(m){
    date=isoDate(m[1],m[2],m[3]);
    kickoff=m[4].padStart(5,"0");
  }
  if(!date){
    m=t.match(/(?:Mo|Di|Mi|Do|Fr|Sa|So),?\s*(\d{2})\.(\d{2})\.(\d{2})\s*(?:\||·)?\s*([0-2]?\d:[0-5]\d)/i);
    if(m){
      date=isoDate(m[1],m[2],m[3]);
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
    const i=t.toLowerCase().indexOf(category.toLowerCase());
    let tail=clean(t.slice(i+category.length));
    tail=tail.replace(/\s+\b(?:FS|ME|PO|TU)\b\s*(?:\|?\s*\d{6,12})?.*$/i,"");
    competition=clean(tail.replace(/^[|·,:;\-–]+/,""));
  }

  return {date,kickoff,category,competition,matchType,gameNumber};
}

function statusFromText(text){
  const t=clean(text);
  if(/\bABSE\.?\b|\bAbsetzung\b|\bSpielabsetzung\b/i.test(t))return "abgesetzt";
  if(/\bAUSF\.?\b|\bAusfall\b|\bSpielausfall\b/i.test(t))return "ausfall";
  if(/\bABBR\.?\b|\bAbbruch\b|\bSpielabbruch\b/i.test(t))return "abbruch";
  if(/\bVERL\.?\b|\bVerlegung\b|\bverlegt\b/i.test(t))return "verlegt";
  return "geplant";
}

function isUsefulTeamText(t){
  t=clean(t);
  return Boolean(t) &&
    t.length<130 &&
    !/^(Zum Spiel|Absetzung|Spielabsetzung|Ausfall|Abbruch|Spielbericht|Details|Info)$/i.test(t) &&
    !/^[\d:–\-]+$/.test(t);
}

function teamsFromRow($,row){
  const links=$(row).find("a").map((_,a)=>clean($(a).text())).get().filter(isUsefulTeamText);
  if(links.length>=2)return {home:links[0],away:links[1]};

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

function normalizeRecord(x){
  return {
    externalId:x.externalId||"",
    url:x.url||"",
    date:x.date||"",
    kickoff:x.kickoff||"",
    category:x.category||"",
    competition:x.competition||"",
    matchType:x.matchType||"",
    gameNumber:x.gameNumber||"",
    home:clean(x.home),
    away:clean(x.away),
    status:x.status||"geplant",
    debugContext:clean(x.debugContext||"").slice(0,800)
  };
}

function parseTableLayout($){
  const out=[],seen=new Set();
  let current={date:"",kickoff:"",category:"",competition:"",matchType:"",gameNumber:""};

  for(const row of $("tr").toArray()){
    const text=clean($(row).text());
    if(!text)continue;

    const m=parseMeta(text);
    for(const k of ["date","kickoff","category","competition","matchType","gameNumber"]){
      if(m[k])current[k]=m[k];
    }

    const gameLinks=$(row).find('a[href*="/spiel/"]').toArray();
    if(!gameLinks.length)continue;

    const teams=teamsFromRow($,row);
    const st=statusFromText(text);

    for(const a of gameLinks){
      const url=abs($(a).attr("href"));
      const id=externalIdFromUrl(url);
      if(!id||seen.has(id))continue;
      seen.add(id);

      out.push(normalizeRecord({
        externalId:id,url,
        ...current,
        ...teams,
        status:st,
        debugContext:`${current.date} ${current.kickoff} ${current.category} ${current.competition} ${current.matchType} ${current.gameNumber} | ${text}`
      }));
    }

    // FUSSBALL.DE's next fixture starts with a fresh metadata row.
    current={date:"",kickoff:"",category:"",competition:"",matchType:"",gameNumber:""};
  }
  return out;
}

function parseComponentLayout($){
  const out=[],seen=new Set();

  $('a[href*="/spiel/"]').each((_,a)=>{
    const url=abs($(a).attr("href"));
    const id=externalIdFromUrl(url);
    if(!id||seen.has(id))return;
    seen.add(id);

    let node=$(a),best=null;
    for(let level=0;level<12&&node.length;level++){
      const txt=clean(node.text());
      if(txt && txt.length<3000){
        const meta=parseMeta(txt);
        let score=0;
        if(meta.date)score+=5;
        if(meta.kickoff)score+=5;
        if(meta.category)score+=2;
        if(meta.gameNumber)score+=2;
        if(/\s:\s/.test(txt))score+=2;
        if(!best||score>best.score)best={node:node[0],txt,meta,score};
      }
      node=node.parent();
    }
    if(!best)return;

    let context=best.txt;
    let n=$(best.node);
    for(let i=0;i<5;i++){
      const p=n.prev();
      if(!p.length)break;
      const pt=clean(p.text());
      if(pt&&pt.length<1500)context=clean(`${pt} ${context}`);
      const pm=parseMeta(context);
      if(pm.date&&pm.kickoff)break;
      n=p;
    }

    const meta=parseMeta(context);
    const teams=teamsFromRow($,best.node);
    out.push(normalizeRecord({
      externalId:id,url,...meta,...teams,
      status:statusFromText(best.txt),
      debugContext:context
    }));
  });
  return out;
}

export function parseScheduleHtml(html){
  const $=cheerio.load(html);
  const table=parseTableLayout($);
  const component=parseComponentLayout($);

  // Merge both layouts by ID and keep the more complete value for each field.
  const map=new Map();
  for(const r of [...component,...table]){
    const old=map.get(r.externalId)||{};
    const merged={...old,...r};
    for(const key of ["date","kickoff","category","competition","matchType","gameNumber","home","away"]){
      if(old[key]&&!r[key])merged[key]=old[key];
    }
    merged.status=(old.status&&old.status!=="geplant")?old.status:r.status;
    map.set(r.externalId,normalizeRecord(merged));
  }
  return [...map.values()];
}

export function validation(rows){
  const issues=[];
  rows.forEach((r,i)=>{
    const missing=["date","kickoff","category","home","away"].filter(k=>!r[k]);
    if(missing.length)issues.push({index:i+1,externalId:r.externalId,missing,context:r.debugContext});
  });
  return {
    total:rows.length,
    withDate:rows.filter(r=>r.date).length,
    withKickoff:rows.filter(r=>r.kickoff).length,
    withTeams:rows.filter(r=>r.home&&r.away).length,
    withGameNumber:rows.filter(r=>r.gameNumber).length,
    cancelled:rows.filter(r=>["abgesetzt","ausfall","abbruch"].includes(r.status)).length,
    issues
  };
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
        accept:"text/html,application/xhtml+xml"
      }
    });
    if(!r.ok)throw new Error(`HTTP ${r.status}`);
    return await r.text();
  }finally{clearTimeout(timer)}
}

export async function fetchBestSchedule({clubId=DEFAULT_CLUB_ID}={}){
  const now=new Date();
  const from=`${now.getFullYear()}-07-01`;
  const to=`${now.getFullYear()+1}-06-30`;
  const candidates=[
    `${BASE}/vereinsspielplan.druck/-/datum-bis/${to}/datum-von/${from}/id/${clubId}/match-type/-1/max/999/mode/PRINT/show-venues/true`,
    `${BASE}/verein/sv-gemmingen-baden/-/id/${clubId}`
  ];

  let best=null,lastError=null;
  for(const url of candidates){
    try{
      const html=await fetchText(url,15000);
      const rows=parseScheduleHtml(html);
      const v=validation(rows);
      const quality=v.withKickoff*10+v.withTeams*5+v.withGameNumber+v.total;
      if(!best||quality>best.quality)best={url,html,rows,validation:v,quality};
    }catch(e){lastError=e}
  }
  if(!best)throw lastError||new Error("Vereinsspielplan konnte nicht geladen werden.");
  return best;
}

export {clean,fetchText,statusFromText};
