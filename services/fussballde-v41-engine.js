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

const gameId = url =>
  (String(url).match(/\/spiel\/(?:[^/]+\/-\/spiel\/)?([A-Z0-9]{12,})/i) ||
   String(url).match(/\/spiel\/([A-Z0-9]{12,})(?:\/|$)/i) || [])[1] || "";

function isoDate(dd, mm, yyyy) {
  const y = yyyy.length === 2 ? `20${yyyy}` : yyyy;
  return `${y}-${mm}-${dd}`;
}

function status(text) {
  const t = clean(text);
  if (/\bABSE\.?\b|\bAbsetzung\b|\bSpielabsetzung\b/i.test(t)) return "abgesetzt";
  if (/\bAUSF\.?\b|\bAusfall\b|\bSpielausfall\b/i.test(t)) return "ausfall";
  if (/\bABBR\.?\b|\bAbbruch\b|\bSpielabbruch\b/i.test(t)) return "abbruch";
  if (/\bVERL\.?\b|\bVerlegung\b|\bverlegt\b/i.test(t)) return "verlegt";
  return "geplant";
}

function parseMeta(text) {
  const t = clean(text);
  let date="", kickoff="", category="", competition="", matchType="", gameNumber="";

  let m=t.match(/(\d{2})\.(\d{2})\.(\d{4})\s*-\s*([0-2]?\d:[0-5]\d)\s*Uhr/i);
  if (m) { date=isoDate(m[1],m[2],m[3]); kickoff=m[4].padStart(5,"0"); }

  if (!date) {
    m=t.match(/(?:Mo|Di|Mi|Do|Fr|Sa|So),?\s*(\d{2})\.(\d{2})\.(\d{2})\s*[|·]\s*([0-2]?\d:[0-5]\d)/i);
    if (m) { date=isoDate(m[1],m[2],m[3]); kickoff=m[4].padStart(5,"0"); }
  }

  m=t.match(/\b(Herren(?:-Reserve)?|Frauen|A-Junioren|B-Junioren|C-Junioren|D-Junioren|E-Junioren|F-Junioren)\b/i);
  if (m) category=clean(m[1]);

  m=t.match(/\b(FS|ME|PO|TU)\b\s*(?:[|·]\s*)?(\d{6,12})\b/i);
  if (m) { matchType=m[1].toUpperCase(); gameNumber=m[2]; }

  if (category) {
    const i=t.toLowerCase().indexOf(category.toLowerCase());
    let tail=clean(t.slice(i+category.length));
    tail=tail.replace(/\s+\b(?:FS|ME|PO|TU)\b\s*(?:[|·]?\s*\d{6,12})?.*$/i,"");
    competition=clean(tail.replace(/^[|·,:;\-–]+/,""));
  }
  return {date,kickoff,category,competition,matchType,gameNumber};
}

function likelyTeamText(text) {
  const t=clean(text);
  return t.length>1 && t.length<100 &&
    !/Zum Spiel|Spielbericht|Absetzung|Ausfall|Abbruch|^\d+$|^\d{1,2}:\d{2}$/i.test(t);
}

function extractTeams($, scope) {
  const texts=$(scope).find("a").map((_,a)=>clean($(a).text())).get().filter(likelyTeamText);
  // Drop the game-link label if present and obvious navigation.
  const candidates=texts.filter(t=>!/^(Details|Mehr|Info)$/i.test(t));
  if (candidates.length>=2) return {home:candidates[0],away:candidates[1]};

  const t=clean($(scope).text());
  const m=t.match(/(.{2,90}?)\s+:\s+(.{2,90}?)(?=\s+(?:Absetzung|Ausfall|Abbruch|Zum Spiel|$))/i);
  return m ? {home:clean(m[1]),away:clean(m[2])} : {home:"",away:""};
}

function contextForAnchor($, anchor) {
  let node=$(anchor);
  const blocks=[];
  // Gather small ancestors; the match component usually contains metadata + teams.
  for(let i=0;i<10 && node.length;i++) {
    const txt=clean(node.text());
    if (txt && txt.length<2600) blocks.push({node:node[0],text:txt});
    node=node.parent();
  }

  // Score contexts: date/time + category + team separator + match number.
  const scored=blocks.map(b=>{
    let score=0;
    if(/\d{2}\.\d{2}\.(?:\d{2}|\d{4})/.test(b.text)) score+=4;
    if(/\b[0-2]?\d:[0-5]\d\b/.test(b.text)) score+=4;
    if(/\b(?:Herren|Frauen|[A-F]-Junioren)\b/i.test(b.text)) score+=2;
    if(/\b(?:FS|ME|PO|TU)\b/.test(b.text)) score+=2;
    if(/\s:\s/.test(b.text)) score+=2;
    if(b.text.length>1600) score-=2;
    return {...b,score};
  }).sort((a,b)=>b.score-a.score || a.text.length-b.text.length);

  const best=scored[0] || {node:$(anchor).parent()[0],text:clean($(anchor).parent().text())};

  // Metadata is sometimes in preceding sibling/header rather than same block.
  let combined=best.text;
  let n=$(best.node);
  for(let i=0;i<5;i++) {
    const prev=n.prev();
    if(!prev.length) break;
    const pt=clean(prev.text());
    if(pt && pt.length<1200) combined=clean(`${pt} ${combined}`);
    if(/\d{2}\.\d{2}\.(?:\d{2}|\d{4}).{0,50}\d{1,2}:\d{2}/.test(combined)) break;
    n=prev;
  }
  return {scope:best.node,text:combined,rowText:best.text};
}

export function parseClubPage(html) {
  const $=cheerio.load(html);
  const out=[], seen=new Set();

  $('a[href*="/spiel/"]').each((_,a)=>{
    const url=abs($(a).attr("href"));
    const id=gameId(url);
    if(!url || !id || seen.has(id)) return;
    seen.add(id);

    const ctx=contextForAnchor($,a);
    const meta=parseMeta(ctx.text);
    const teams=extractTeams($,ctx.scope);

    out.push({
      externalId:id,
      url,
      date:meta.date,
      kickoff:meta.kickoff,
      category:meta.category,
      competition:meta.competition,
      matchType:meta.matchType,
      gameNumber:meta.gameNumber,
      home:teams.home,
      away:teams.away,
      status:status(ctx.rowText),
      debugContext:ctx.text.slice(0,700)
    });
  });

  return out;
}

export function validateRows(rows) {
  const issues=[];
  rows.forEach((r,i)=>{
    const missing=[];
    for(const k of ["externalId","date","kickoff","category","home","away"]) if(!r[k]) missing.push(k);
    if(missing.length) issues.push({index:i+1,externalId:r.externalId,missing,context:r.debugContext});
  });
  return {
    total:rows.length,
    withDate:rows.filter(r=>r.date).length,
    withKickoff:rows.filter(r=>r.kickoff).length,
    withTeams:rows.filter(r=>r.home&&r.away).length,
    withGameNumber:rows.filter(r=>r.gameNumber).length,
    issues
  };
}

export async function fetchClubPage({clubId=DEFAULT_CLUB_ID, timeoutMs=15000}={}) {
  const url=`${BASE}/verein/sv-gemmingen-baden/-/id/${clubId}`;
  const ctrl=new AbortController();
  const timer=setTimeout(()=>ctrl.abort(),timeoutMs);
  try {
    const res=await fetch(url,{
      signal:ctrl.signal,
      redirect:"follow",
      headers:{
        "user-agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36",
        "accept-language":"de-DE,de;q=0.9",
        "accept":"text/html,application/xhtml+xml"
      }
    });
    if(!res.ok) throw new Error(`FUSSBALL.DE HTTP ${res.status}`);
    return {url,html:await res.text()};
  } finally { clearTimeout(timer); }
}

export async function previewClubSchedule(options={}) {
  const {url,html}=await fetchClubPage(options);
  const rows=parseClubPage(html);
  const validation=validateRows(rows);
  return {source:url,generatedAt:new Date().toISOString(),validation,rows};
}
