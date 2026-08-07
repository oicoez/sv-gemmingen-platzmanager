import { chromium } from "playwright";

const CLUB_URL="https://www.fussball.de/verein/sv-gemmingen-baden/-/id/00ES8GN9B8000051VV0AG08LVUPGND5I";

const clean=v=>String(v??"")
  .replace(/[\u200b\u200c\u200d\u2060]/g,"")
  .replace(/\u00a0/g," ")
  .replace(/\s+/g," ")
  .trim();

function externalIdFromUrl(url){
  const s=String(url||"");
  return (
    s.match(/\/-\/spiel\/([A-Z0-9]{12,})(?:\/|$)/i) ||
    s.match(/\/spiel\/([A-Z0-9]{12,})(?:\/|$)/i) ||
    []
  )[1]||"";
}

function statusFromText(t){
  t=clean(t);
  if(/\bABSE\.?\b|\bAbsetzung\b|\bSpielabsetzung\b/i.test(t))return "abgesetzt";
  if(/\bAUSF\.?\b|\bAusfall\b|\bSpielausfall\b/i.test(t))return "ausfall";
  if(/\bABBR\.?\b|\bAbbruch\b|\bSpielabbruch\b/i.test(t))return "abbruch";
  if(/\bVERL\.?\b|\bVerlegung\b|\bverlegt\b/i.test(t))return "verlegt";
  return "geplant";
}

function iso(dd,mm,yyyy){
  const y=yyyy.length===2?`20${yyyy}`:yyyy;
  return `${y}-${mm}-${dd}`;
}

function findDateTimeInString(s){
  s=clean(s);
  const ps=[
    /(\d{2})\.(\d{2})\.(\d{4})\s*[-–|,]?\s*([0-2]?\d:[0-5]\d)\s*Uhr/i,
    /(?:Mo|Di|Mi|Do|Fr|Sa|So|Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonntag),?\s*(\d{2})\.(\d{2})\.(\d{4}).{0,50}?([0-2]?\d:[0-5]\d)/i,
    /(20\d{2})-(\d{2})-(\d{2})[T\s]([0-2]\d):([0-5]\d)/
  ];
  for(const p of ps){
    const m=s.match(p);
    if(!m)continue;
    if(p===ps[2])return {date:`${m[1]}-${m[2]}-${m[3]}`,kickoff:`${m[4]}:${m[5]}`};
    return {date:iso(m[1],m[2],m[3]),kickoff:m[4].padStart(5,"0")};
  }
  return {date:"",kickoff:""};
}

function deepWalk(value,path="",out=[]){
  if(value===null||value===undefined)return out;
  if(typeof value==="string"||typeof value==="number"||typeof value==="boolean"){
    out.push({path,value:String(value)});
    return out;
  }
  if(Array.isArray(value)){
    value.forEach((v,i)=>deepWalk(v,`${path}[${i}]`,out));
    return out;
  }
  if(typeof value==="object"){
    for(const [k,v] of Object.entries(value)){
      deepWalk(v,path?`${path}.${k}`:k,out);
    }
  }
  return out;
}

function pickByKeys(flat,keyRegexes){
  for(const r of keyRegexes){
    const hit=flat.find(x=>r.test(x.path));
    if(hit&&hit.value)return hit.value;
  }
  return "";
}

function parseJsonCandidate(obj,url){
  const flat=deepWalk(obj);
  const blob=flat.map(x=>`${x.path}=${x.value}`).join(" | ");
  const dt=findDateTimeInString(blob);

  const home=pickByKeys(flat,[
    /(?:^|\.)(?:homeTeam|home_team|teamHome|hometeam|homeName|home_name|homeClubName)$/i,
    /(?:^|\.)(?:home)\.(?:name|clubName|teamName)$/i
  ]);
  const away=pickByKeys(flat,[
    /(?:^|\.)(?:awayTeam|guestTeam|away_team|teamAway|awayName|guestName|away_name)$/i,
    /(?:^|\.)(?:away|guest)\.(?:name|clubName|teamName)$/i
  ]);
  const venue=pickByKeys(flat,[
    /(?:venue|stadium|spielstaette|spielstätte|location).*(?:name|title)$/i,
    /(?:venue|stadium|spielstaette|spielstätte)$/i
  ]);
  const address=pickByKeys(flat,[
    /(?:address|street|strasse|straße|postal|zip|city)$/i
  ]);
  const competition=pickByKeys(flat,[
    /(?:competition|league|staffel|wettbewerb).*(?:name|title)?$/i
  ]);
  const gameNumber=pickByKeys(flat,[
    /(?:gameNumber|matchNumber|spielnummer|match_id|game_id)$/i
  ]);

  return {
    url,
    date:dt.date,
    kickoff:dt.kickoff,
    home:clean(home),
    away:clean(away),
    competition:clean(competition),
    venueText:clean(venue),
    address:clean(address),
    gameNumber:clean(gameNumber),
    status:statusFromText(blob),
    blob
  };
}

function scoreCandidate(c){
  let s=0;
  if(c.date)s+=5;
  if(c.kickoff)s+=5;
  if(c.home)s+=4;
  if(c.away)s+=4;
  if(c.venueText)s+=2;
  if(c.address)s+=2;
  if(c.competition)s+=2;
  if(c.gameNumber)s+=1;
  return s;
}

function mergeCandidates(list){
  const sorted=[...list].sort((a,b)=>scoreCandidate(b)-scoreCandidate(a));
  const out={date:"",kickoff:"",home:"",away:"",competition:"",venueText:"",address:"",gameNumber:"",status:"geplant",sources:[]};
  for(const c of sorted){
    for(const k of ["date","kickoff","home","away","competition","venueText","address","gameNumber"]){
      if(!out[k]&&c[k])out[k]=c[k];
    }
    if(c.status&&c.status!=="geplant")out.status=c.status;
    out.sources.push({url:c.url,score:scoreCandidate(c)});
  }
  return out;
}

function normalizeVenue(record){
  let location="",address=record.address||"",pitch="";
  const all=clean(`${record.venueText} ${record.address}`);

  if(/Jahnweg|Stebbach/i.test(all)){
    location="Stebbach";
    address="Jahnweg 1, 75050 Gemmingen-Stebbach";
  }else if(/Beim Sportplatz|SV Gemmingen|75050 Gemmingen\b/i.test(all)){
    location="Gemmingen";
    address="Beim Sportplatz 3, 75050 Gemmingen";
  }
  if(location){
    const base=/Kunstrasen|Trainingsplatz/i.test(all)?"Trainingsplatz":"Hauptplatz";
    pitch=`${base} – Gesamt`;
  }
  return {...record,location,address,pitch};
}

function isOurTeam(name){
  return /SV Gemmingen|SG Stebbach\/?\s*Gemmingen|JSG Gemmingen\s*\/?\s*Stebbach/i.test(clean(name));
}

export async function runBrowserNetworkTest({
  onProgress=()=>{},
  overallTimeoutMs=150000
}={}){
  const browser=await chromium.launch({
    headless:true,
    args:["--no-sandbox","--disable-dev-shm-usage"]
  });

  const context=await browser.newContext({
    locale:"de-DE",
    userAgent:"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36"
  });

  const page=await context.newPage();
  const network=[];
  const gameLinks=new Map();

  const timer=setTimeout(()=>{},overallTimeoutMs);

  page.on("response",async response=>{
    try{
      const req=response.request();
      const type=req.resourceType();
      const ct=(response.headers()["content-type"]||"").toLowerCase();
      if(!["xhr","fetch"].includes(type) && !ct.includes("json"))return;

      const url=response.url();
      if(response.status()<200||response.status()>=400)return;

      let data=null;
      try{
        if(ct.includes("json"))data=await response.json();
        else{
          const txt=await response.text();
          if(/^\s*[\[{]/.test(txt))data=JSON.parse(txt);
        }
      }catch{}
      if(data!==null)network.push({url,data});
    }catch{}
  });

  try{
    onProgress({phase:"club",message:"Vereinsseite wird im Browser geöffnet …"});
    await page.goto(CLUB_URL,{waitUntil:"domcontentloaded",timeout:45000});
    await page.waitForTimeout(2500);

    // Keep clicking "Mehr laden" while available
    for(let i=0;i<40;i++){
      const before=gameLinks.size;
      const hrefs=await page.locator('a[href*="/spiel/"]').evaluateAll(as=>as.map(a=>a.href));
      for(const href of hrefs){
        const id=externalIdFromUrl(href);
        if(id)gameLinks.set(id,href.split("?")[0]);
      }

      const clicked=await page.evaluate(()=>{
        const els=[...document.querySelectorAll("button,a,div,span")];
        const e=els.find(x=>{
          const t=(x.innerText||x.textContent||"").trim();
          return x.offsetParent!==null && /^(Mehr laden|mehr anzeigen|weitere Spiele)$/i.test(t);
        });
        if(!e)return false;
        e.click();return true;
      });
      if(!clicked)break;
      await page.waitForTimeout(900);
      if(gameLinks.size===before)continue;
    }

    const hrefs=await page.locator('a[href*="/spiel/"]').evaluateAll(as=>as.map(a=>a.href));
    for(const href of hrefs){
      const id=externalIdFromUrl(href);
      if(id)gameLinks.set(id,href.split("?")[0]);
    }

    const links=[...gameLinks.entries()].map(([externalId,url])=>({externalId,url}));
    onProgress({phase:"links",message:`${links.length} Spiel-Links gefunden`,total:links.length});

    const results=[],errors=[];
    let processed=0;

    // Sequential per browser page would be slow; use 4 pages concurrently.
    const concurrency=4;
    for(let offset=0;offset<links.length;offset+=concurrency){
      const batch=links.slice(offset,offset+concurrency);
      const batchResults=await Promise.all(batch.map(async item=>{
        const p=await context.newPage();
        const localNetwork=[];
        const responseHandler=async response=>{
          try{
            const req=response.request();
            const type=req.resourceType();
            const ct=(response.headers()["content-type"]||"").toLowerCase();
            if(!["xhr","fetch"].includes(type) && !ct.includes("json"))return;
            if(response.status()<200||response.status()>=400)return;
            let data=null;
            try{
              if(ct.includes("json"))data=await response.json();
              else{
                const txt=await response.text();
                if(/^\s*[\[{]/.test(txt))data=JSON.parse(txt);
              }
            }catch{}
            if(data!==null)localNetwork.push({url:response.url(),data});
          }catch{}
        };
        p.on("response",responseHandler);

        try{
          await p.goto(item.url,{waitUntil:"domcontentloaded",timeout:30000});
          await p.waitForTimeout(1500);

          const renderedText=clean(await p.locator("body").innerText().catch(()=>""));
          const title=clean(await p.title().catch(()=>""));
          const html=await p.content();

          const candidates=localNetwork.map(x=>parseJsonCandidate(x.data,x.url));

          // rendered DOM fallback as another candidate
          const dt=findDateTimeInString(renderedText);
          const titleMatch=title.match(/^(.*?)\s+-\s+(.*?)\s+Ergebnis:/i);
          const domCandidate={
            url:"rendered-dom",
            date:dt.date,kickoff:dt.kickoff,
            home:titleMatch?clean(titleMatch[1]):"",
            away:titleMatch?clean(titleMatch[2]):"",
            competition:"",
            venueText:(renderedText.match(/(?:Rasenplatz|Kunstrasenplatz|Sportplatz)[^\n|]{0,220}/i)||[])[0]||"",
            address:(renderedText.match(/(?:Beim Sportplatz|Jahnweg)[^\n|]{0,180}75050\s+Gemmingen(?:-Stebbach)?/i)||[])[0]||"",
            gameNumber:(renderedText.match(/\bSpiel(?:nummer)?\s*:?\s*(\d{6,12})\b/i)||[])[1]||"",
            status:statusFromText(renderedText)
          };
          candidates.push(domCandidate);

          const merged=normalizeVenue(mergeCandidates(candidates));
          return {ok:true,row:{externalId:item.externalId,url:item.url,...merged,networkResponses:localNetwork.length}};
        }catch(e){
          return {ok:false,item,error:e.name==="TimeoutError"?"Timeout":e.message};
        }finally{
          await p.close().catch(()=>{});
        }
      }));

      for(const r of batchResults){
        processed++;
        if(r.ok)results.push(r.row);
        else errors.push({externalId:r.item.externalId,url:r.item.url,error:r.error});
        onProgress({phase:"details",processed,total:links.length,item:r});
      }
    }

    const home=results.filter(r=>isOurTeam(r.home));
    const stats={
      totalLinks:links.length,
      parsed:results.length,
      withDate:results.filter(r=>r.date).length,
      withKickoff:results.filter(r=>r.kickoff).length,
      withTeams:results.filter(r=>r.home&&r.away).length,
      withVenue:results.filter(r=>r.location&&r.address).length,
      withNetworkData:results.filter(r=>r.networkResponses>0).length,
      homeGames:home.length,
      homeWithDate:home.filter(r=>r.date).length,
      homeWithKickoff:home.filter(r=>r.kickoff).length,
      homeWithVenue:home.filter(r=>r.location&&r.address).length,
      cancelled:results.filter(r=>["abgesetzt","ausfall","abbruch"].includes(r.status)).length,
      errors:errors.length
    };

    return {stats,homeGames:home,allGames:results,errors};
  } finally {
    clearTimeout(timer);
    await browser.close().catch(()=>{});
  }
}
