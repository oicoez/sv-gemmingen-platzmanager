import * as cheerio from "cheerio";

const BASE="https://www.fussball.de";
export const DEFAULT_CLUB_ID="00ES8GN9B8000051VV0AG08LVUPGND5I";

export const clean=v=>String(v??"")
  .replace(/[\u200b\u200c\u200d\u2060]/g,"")
  .replace(/\u00a0/g," ")
  .replace(/\s+/g," ")
  .trim();

export function absoluteUrl(href){
  try{return new URL(href,BASE).href.split("?")[0]}catch{return ""}
}

export function externalIdFromUrl(url){
  const s=String(url||"");
  return (
    s.match(/\/-\/spiel\/([A-Z0-9]{12,})(?:\/|$)/i) ||
    s.match(/\/spiel\/([A-Z0-9]{12,})(?:\/|$)/i) ||
    []
  )[1]||"";
}

export async function fetchText(url,timeoutMs=12000){
  const c=new AbortController();
  const timer=setTimeout(()=>c.abort(),timeoutMs);
  try{
    const r=await fetch(url,{
      signal:c.signal,
      redirect:"follow",
      headers:{
        "user-agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36",
        "accept-language":"de-DE,de;q=0.9",
        "accept":"text/html,application/xhtml+xml"
      }
    });
    if(!r.ok)throw new Error(`HTTP ${r.status}`);
    return await r.text();
  }finally{clearTimeout(timer)}
}

export async function collectGameLinks({clubId=DEFAULT_CLUB_ID}={}){
  const urls=[
    `${BASE}/verein/sv-gemmingen-baden/-/id/${clubId}`,
    `${BASE}/ajax.club.matchplan/-/id/${clubId}/mode/PAGE/show-filter/true`
  ];
  const found=new Map();

  for(const source of urls){
    try{
      const html=await fetchText(source,15000);
      const $=cheerio.load(html);
      $('a[href*="/spiel/"]').each((_,a)=>{
        const url=absoluteUrl($(a).attr("href"));
        const id=externalIdFromUrl(url);
        if(id&&!found.has(id))found.set(id,{externalId:id,url});
      });
    }catch(e){
      console.warn(`[FUSSBALL-4.2] Linkquelle fehlgeschlagen ${source}: ${e.message}`);
    }
  }
  return [...found.values()];
}

function iso(dd,mm,yyyy){
  const y=yyyy.length===2?`20${yyyy}`:yyyy;
  return `${y}-${mm}-${dd}`;
}

function dateTimeFromText(text){
  const t=clean(text);
  const patterns=[
    /(\d{2})\.(\d{2})\.(\d{4})\s*[-–|,]?\s*([0-2]?\d:[0-5]\d)\s*Uhr/i,
    /(?:Mo|Di|Mi|Do|Fr|Sa|So|Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonntag),?\s*(\d{2})\.(\d{2})\.(\d{4}).{0,40}?([0-2]?\d:[0-5]\d)/i,
    /(\d{2})\.(\d{2})\.(\d{2}).{0,40}?([0-2]?\d:[0-5]\d)\s*Uhr/i
  ];
  for(const p of patterns){
    const m=t.match(p);
    if(m)return {date:iso(m[1],m[2],m[3]),kickoff:m[4].padStart(5,"0"),source:"visible-text"};
  }
  return {date:"",kickoff:"",source:""};
}

function dateTimeFromMachineReadable($,html){
  // <time datetime="2026-08-09T10:30:00...">
  for(const el of $("time[datetime]").toArray()){
    const dt=$(el).attr("datetime")||"";
    const m=dt.match(/(20\d{2})-(\d{2})-(\d{2})[T\s]([0-2]\d):([0-5]\d)/);
    if(m)return {date:`${m[1]}-${m[2]}-${m[3]}`,kickoff:`${m[4]}:${m[5]}`,source:"time-datetime"};
  }

  // JSON-LD / embedded JSON / data attributes
  const candidates=[
    ...$('script[type="application/ld+json"]').map((_,x)=>$(x).text()).get(),
    ...$("script").map((_,x)=>$(x).text()).get(),
    html
  ];
  const regexes=[
    /["'](?:startDate|start_date|matchDate|match_date|dateTime|datetime)["']\s*:\s*["'](20\d{2})-(\d{2})-(\d{2})[T\s]([0-2]\d):([0-5]\d)/i,
    /(20\d{2})-(\d{2})-(\d{2})T([0-2]\d):([0-5]\d):\d{2}(?:[.+Z-][^"' ]*)?/i
  ];
  for(const c of candidates){
    for(const p of regexes){
      const m=String(c||"").match(p);
      if(m)return {date:`${m[1]}-${m[2]}-${m[3]}`,kickoff:`${m[4]}:${m[5]}`,source:"embedded-json"};
    }
  }
  return {date:"",kickoff:"",source:""};
}

function teamsFromTitle(title){
  const t=clean(title);
  const m=t.match(/^(.*?)\s+-\s+(.*?)\s+Ergebnis:/i);
  if(m)return {home:clean(m[1]),away:clean(m[2]),source:"title"};
  return {home:"",away:"",source:""};
}

function teamsFromPage($,body){
  const homeSelectors=[
    ".club-name.club-home",".home-team",".team-home",".home .club-name",
    '[class*="home"] [class*="team"]','[data-side="home"]'
  ];
  const awaySelectors=[
    ".club-name.club-guest",".guest-team",".team-away",".away .club-name",
    '[class*="away"] [class*="team"]','[data-side="away"]'
  ];

  const first=(sels)=>{
    for(const s of sels){
      const t=clean($(s).first().text());
      if(t)return t;
    }
    return "";
  };
  let home=first(homeSelectors),away=first(awaySelectors);
  if(home&&away)return {home,away,source:"selectors"};

  const m=body.match(/([A-ZÄÖÜ][^|]{2,100}?)\s+:\s+([A-ZÄÖÜ][^|]{2,100}?)(?=\s+(?:Spielstätte|Schiedsrichter|Wettbewerb|$))/i);
  if(m)return {home:clean(m[1]),away:clean(m[2]),source:"body-regex"};
  return {home:"",away:"",source:""};
}

function statusFromText(text){
  const t=clean(text);
  if(/\bABSE\.?\b|\bAbsetzung\b|\bSpielabsetzung\b/i.test(t))return "abgesetzt";
  if(/\bAUSF\.?\b|\bAusfall\b|\bSpielausfall\b/i.test(t))return "ausfall";
  if(/\bABBR\.?\b|\bAbbruch\b|\bSpielabbruch\b/i.test(t))return "abbruch";
  if(/\bVERL\.?\b|\bVerlegung\b|\bverlegt\b/i.test(t))return "verlegt";
  return "geplant";
}

function competitionFromText(title,body){
  let m=clean(title).match(/Ergebnis:\s*(.*?)\s+-\s+\d{2}\.\d{2}\.\d{4}/i);
  if(m)return clean(m[1]);
  m=body.match(/\b(?:Wettbewerb|Staffel|Liga)\s*:?\s*([^|]{2,100}?)(?=\s+(?:Spielstätte|Schiedsrichter|Spiel|$))/i);
  return m?clean(m[1]):"";
}

function gameNumber(body,html){
  return (
    (body.match(/\bSpiel(?:nummer)?\s*:?\s*(\d{6,12})\b/i)||[])[1] ||
    (html.match(/["'](?:gameNumber|matchNumber|spielnummer)["']\s*:\s*["']?(\d{6,12})/i)||[])[1] ||
    ""
  );
}

function venueFromPage($,body){
  let venueText="";

  const likely=[];
  $('a[href*="google"],a[href*="maps"],[class*="venue"],[class*="stadium"],[class*="spielstaette"],[class*="location"]').each((_,el)=>{
    const t=clean($(el).text());
    if(t&&t.length<300)likely.push(t);
  });
  venueText=likely.find(t=>/Gemmingen|Stebbach|Sportplatz|Rasenplatz|Kunstrasen|Jahnweg/i.test(t))||"";

  if(!venueText){
    const m=body.match(/((?:Rasenplatz|Kunstrasenplatz|Kunstrasen|Hartplatz|Sportplatz)[^|]{0,220}(?:75050\s+Gemmingen(?:-Stebbach)?|Beim Sportplatz|Jahnweg)[^|]{0,120})/i)
      || body.match(/((?:Beim Sportplatz|Jahnweg)[^|]{0,160}75050\s+Gemmingen(?:-Stebbach)?)/i);
    if(m)venueText=clean(m[1]);
  }

  let location="",address="",pitch="";
  if(/Jahnweg|Stebbach/i.test(venueText)){
    location="Stebbach";
    address="Jahnweg 1, 75050 Gemmingen-Stebbach";
  }else if(/Beim Sportplatz|SV Gemmingen|75050 Gemmingen\b/i.test(venueText)){
    location="Gemmingen";
    address="Beim Sportplatz 3, 75050 Gemmingen";
  }
  if(location){
    const base=/Kunstrasen|Trainingsplatz/i.test(venueText)?"Trainingsplatz":"Hauptplatz";
    pitch=`${base} – Gesamt`;
  }
  return {venueText,location,address,pitch};
}

export function parseDetailHtml(html,url=""){
  const $=cheerio.load(html);
  const body=clean($("body").text());
  const title=clean($("title").first().text());

  let dt=dateTimeFromMachineReadable($,html);
  if(!dt.date||!dt.kickoff){
    const visible=dateTimeFromText(body);
    if(visible.date&&visible.kickoff)dt=visible;
  }

  let teams=teamsFromTitle(title);
  if(!teams.home||!teams.away)teams=teamsFromPage($,body);

  const venue=venueFromPage($,body);
  return {
    externalId:externalIdFromUrl(url),
    url,
    date:dt.date,
    kickoff:dt.kickoff,
    timeSource:dt.source,
    home:teams.home,
    away:teams.away,
    teamSource:teams.source,
    competition:competitionFromText(title,body),
    status:statusFromText(body),
    gameNumber:gameNumber(body,html),
    ...venue,
    rawTitle:title
  };
}

export function isOurTeam(name){
  return /SV Gemmingen|SG Stebbach\/?\s*Gemmingen|JSG Gemmingen\s*\/?\s*Stebbach/i.test(clean(name));
}

export async function loadGameDetail(item,{timeoutMs=12000}={}){
  const html=await fetchText(item.url,timeoutMs);
  return parseDetailHtml(html,item.url);
}

export async function analyseAllGames(links,{
  concurrency=5,
  onProgress=()=>{}
}={}){
  const results=[],errors=[];
  let processed=0;

  for(let offset=0;offset<links.length;offset+=concurrency){
    const batch=links.slice(offset,offset+concurrency);
    const settled=await Promise.all(batch.map(async item=>{
      try{
        const detail=await loadGameDetail(item);
        return {ok:true,row:detail};
      }catch(e){
        return {ok:false,item,error:e.name==="AbortError"?"Timeout":e.message};
      }
    }));

    for(const x of settled){
      processed++;
      if(x.ok)results.push(x.row);
      else errors.push({externalId:x.item.externalId,url:x.item.url,error:x.error});
      onProgress({processed,total:links.length,item:x});
    }
  }

  return {results,errors};
}
