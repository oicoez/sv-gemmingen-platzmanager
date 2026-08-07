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

  // Long FUSSBALL.DE form: Sonntag, 23.08.2026 - 13:15 Uhr
  let m=t.match(/(\d{2})\.(\d{2})\.(\d{4})\s*[-–]\s*([0-2]?\d:[0-5]\d)\s*Uhr/i);
  if(m){
    date=isoDate(m[1],m[2],m[3]);
    kickoff=m[4].padStart(5,"0");
  }

  // Compact form: So, 23.08.26 | 13:15
  if(!date){
    m=t.match(/(?:Mo|Di|Mi|Do|Fr|Sa|So),?\s*(\d{2})\.(\d{2})\.(\d{2})\s*(?:\||·|[-–])?\s*([0-2]?\d:[0-5]\d)/i);
    if(m){
      date=isoDate(m[1],m[2],m[3]);
      kickoff=m[4].padStart(5,"0");
    }
  }

  // Very defensive fallback: date + time inside a reasonably short block.
  if(!date){
    m=t.match(/(\d{2})\.(\d{2})\.(\d{2,4}).{0,80}?([0-2]?\d:[0-5]\d)(?:\s*Uhr)?/i);
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

function teamsFromScope($,scope){
  const links=$(scope).find("a").map((_,a)=>clean($(a).text())).get().filter(isUsefulTeamText);
  if(links.length>=2)return {home:links[0],away:links[1]};

  const txt=clean($(scope).text());
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
    timeSource:x.timeSource||"",
    debugContext:clean(x.debugContext||"").slice(0,1000)
  };
}

// Extract every visible date/time occurrence from the document in DOM order.
// We keep the element itself and its document order index.
function collectMetaBlocks($){
  const blocks=[];
  let order=0;
  $("body *").each((_,el)=>{
    order++;
    const own=clean($(el).clone().children().remove().end().text());
    if(!own || own.length>500)return;

    const meta=parseMeta(own);
    if(meta.date&&meta.kickoff){
      blocks.push({order,el,meta,text:own});
    }
  });

  // Remove duplicate nested/text occurrences with identical consecutive date+time.
  const dedup=[];
  for(const b of blocks){
    const last=dedup[dedup.length-1];
    if(last && last.meta.date===b.meta.date && last.meta.kickoff===b.meta.kickoff && Math.abs(last.order-b.order)<8){
      continue;
    }
    dedup.push(b);
  }
  return dedup;
}

function elementOrderMap($){
  const map=new Map();
  let order=0;
  $("body *").each((_,el)=>{order++;map.set(el,order)});
  return map;
}

function bestFixtureScope($,anchor){
  let node=$(anchor),best=null;
  for(let level=0;level<12&&node.length;level++){
    const txt=clean(node.text());
    if(txt && txt.length<2600){
      let score=0;
      if(/\s+:\s+/.test(txt))score+=5;
      if(/Zum Spiel/i.test(txt))score+=2;
      if(/\b(?:Absetzung|Ausfall|Abbruch)\b/i.test(txt))score+=1;
      if(txt.length<900)score+=1;
      if(!best||score>best.score)best={node:node[0],text:txt,score};
    }
    node=node.parent();
  }
  return best || {node:$(anchor).parent()[0],text:clean($(anchor).parent().text()),score:0};
}

function nearestPreviousMeta(metaBlocks, anchorOrder){
  let best=null;
  for(const b of metaBlocks){
    if(b.order>=anchorOrder)break;
    best=b;
  }
  return best;
}

function rawHtmlMetaBefore(html,url,externalId){
  // Method 3: locate the game URL/id in raw source and search only backwards.
  const needles=[
    externalId,
    String(url||"").replace("https://www.fussball.de","")
  ].filter(Boolean);

  let pos=-1;
  for(const n of needles){
    const p=html.indexOf(n);
    if(p>=0 && (pos<0||p<pos))pos=p;
  }
  if(pos<0)return null;

  // The metadata block normally sits shortly before the fixture row.
  const snippet=html.slice(Math.max(0,pos-14000),pos)
    .replace(/<script[\s\S]*?<\/script>/gi," ")
    .replace(/<style[\s\S]*?<\/style>/gi," ")
    .replace(/<[^>]+>/g," ")
    .replace(/&nbsp;|&#160;/gi," ")
    .replace(/&amp;/gi,"&")
    .replace(/&ndash;|&#8211;/gi,"–")
    .replace(/&mdash;|&#8212;/gi,"—");

  // Take the LAST matching date/time in the backwards snippet, not the first.
  const patterns=[
    /(\d{2})\.(\d{2})\.(\d{4})\s*[-–]\s*([0-2]?\d:[0-5]\d)\s*Uhr/gi,
    /(?:Mo|Di|Mi|Do|Fr|Sa|So),?\s*(\d{2})\.(\d{2})\.(\d{2})\s*(?:\||·|[-–])?\s*([0-2]?\d:[0-5]\d)/gi
  ];

  let found=null;
  for(const p of patterns){
    for(const m of snippet.matchAll(p)){
      found={
        date:isoDate(m[1],m[2],m[3]),
        kickoff:m[4].padStart(5,"0")
      };
    }
    if(found)break;
  }
  return found;
}

export function parseScheduleHtml(html){
  const $=cheerio.load(html);
  const orderMap=elementOrderMap($);
  const metaBlocks=collectMetaBlocks($);
  const out=[],seen=new Set();

  const gameAnchors=$('a[href*="/spiel/"]').toArray();

  // Strong fallback if DOM metadata blocks count matches/approaches game count:
  // map in document order. We do not rely solely on this, but it repairs
  // layouts where metadata and fixture rows are siblings in separate wrappers.
  const chronologicalMeta=metaBlocks.map(b=>b.meta);

  gameAnchors.forEach((a,index)=>{
    const url=abs($(a).attr("href"));
    const id=externalIdFromUrl(url);
    if(!id||seen.has(id))return;
    seen.add(id);

    const scope=bestFixtureScope($,a);
    const teams=teamsFromScope($,scope.node);
    const anchorOrder=orderMap.get(a)||0;

    let meta=parseMeta(scope.text);
    let timeSource=meta.date&&meta.kickoff?"fixture-scope":"";

    // Method 1: nearest preceding date/time block in actual DOM order.
    if(!meta.date||!meta.kickoff){
      const prev=nearestPreviousMeta(metaBlocks,anchorOrder);
      if(prev){
        meta={...prev.meta,...Object.fromEntries(Object.entries(meta).filter(([,v])=>v))};
        if(meta.date&&meta.kickoff)timeSource="nearest-previous-dom";
      }
    }

    // Method 2: by document sequence. Useful on FUSSBALL.DE where each visible
    // fixture has one heading immediately before it.
    if((!meta.date||!meta.kickoff) && chronologicalMeta[index]){
      const seq=chronologicalMeta[index];
      meta={
        date:meta.date||seq.date,
        kickoff:meta.kickoff||seq.kickoff,
        category:meta.category||seq.category,
        competition:meta.competition||seq.competition,
        matchType:meta.matchType||seq.matchType,
        gameNumber:meta.gameNumber||seq.gameNumber
      };
      if(meta.date&&meta.kickoff)timeSource="document-sequence";
    }

    // Method 3: raw HTML search immediately before this exact game id.
    if(!meta.date||!meta.kickoff){
      const raw=rawHtmlMetaBefore(html,url,id);
      if(raw){
        meta.date=meta.date||raw.date;
        meta.kickoff=meta.kickoff||raw.kickoff;
        if(meta.date&&meta.kickoff)timeSource="raw-html-backscan";
      }
    }

    // Read category/competition/game number from a larger nearby text block if missing.
    if(!meta.category||!meta.gameNumber){
      let node=$(scope.node),around=scope.text;
      for(let i=0;i<5;i++){
        const prev=node.prev();
        if(!prev.length)break;
        around=clean(`${prev.text()} ${around}`);
        const pm=parseMeta(around);
        meta.category=meta.category||pm.category;
        meta.competition=meta.competition||pm.competition;
        meta.matchType=meta.matchType||pm.matchType;
        meta.gameNumber=meta.gameNumber||pm.gameNumber;
        node=prev;
      }
    }

    out.push(normalizeRecord({
      externalId:id,
      url,
      ...meta,
      ...teams,
      status:statusFromText(scope.text),
      timeSource,
      debugContext:`${timeSource} | ${meta.date} ${meta.kickoff} | ${scope.text}`
    }));
  });

  return out;
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
