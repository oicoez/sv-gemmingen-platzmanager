import * as cheerio from "cheerio";
import { clean, fetchText } from "./fussballde-v41-engine.js";

function normalizeTeam(s){
  return clean(s).replace(/\s*\/\s*/g,"/").replace(/\s+/g," ");
}

export function isOurTeam(name){
  return /SV Gemmingen|SG Stebbach\/?\s*Gemmingen|JSG Gemmingen\s*\/?\s*Stebbach/i.test(normalizeTeam(name));
}

function titleTeams(title){
  const t=clean(title);
  const m=t.match(/^(.*?)\s+-\s+(.*?)\s+Ergebnis:/i);
  return m?{home:clean(m[1]),away:clean(m[2])}:{home:"",away:""};
}

function extractVenue($,body){
  let venueText="";

  $('a[href*="google"],a[href*="maps"]').each((_,a)=>{
    const t=clean($(a).text());
    if(!venueText && /Sportplatz|Rasenplatz|Kunstrasen|Gemmingen|Stebbach/i.test(t))venueText=t;
  });

  if(!venueText){
    const patterns=[
      /((?:Rasenplatz|Kunstrasenplatz|Kunstrasen|Hartplatz|Sportplatz)[^|]{0,220}75050\s+Gemmingen(?:-Stebbach)?)/i,
      /((?:Beim Sportplatz|Jahnweg)[^|]{0,180}75050\s+Gemmingen(?:-Stebbach)?)/i
    ];
    for(const p of patterns){
      const m=body.match(p);
      if(m){venueText=clean(m[1]);break}
    }
  }

  let location="",address="",pitch="";
  if(/Jahnweg|Stebbach/i.test(venueText)){
    location="Stebbach";
    address="Jahnweg 1, 75050 Gemmingen-Stebbach";
  }else if(/Beim Sportplatz|SV Gemmingen/i.test(venueText)){
    location="Gemmingen";
    address="Beim Sportplatz 3, 75050 Gemmingen";
  }

  if(location){
    const base=/Kunstrasen|Trainingsplatz/i.test(venueText)?"Trainingsplatz":"Hauptplatz";
    pitch=`${base} – Gesamt`;
  }
  return {venueText,location,address,pitch};
}

function gameNumberFromBody(body){
  return (body.match(/\bSpiel:\s*(\d{6,12})\b/i)||[])[1]||"";
}

export async function enrichFixture(row,{timeoutMs=10000}={}){
  const html=await fetchText(row.url,timeoutMs);
  const $=cheerio.load(html);
  const body=clean($("body").text());
  const title=titleTeams($("title").first().text());
  const venue=extractVenue($,body);

  return {
    ...row,
    home:title.home||row.home,
    away:title.away||row.away,
    gameNumber:gameNumberFromBody(body)||row.gameNumber,
    ...venue
  };
}

export async function analyseHomeFixtures(rows,{
  concurrency=5,
  onProgress=()=>{}
}={}){
  const home=rows.filter(r=>isOurTeam(r.home));
  const results=[],errors=[];
  let processed=0;

  for(let offset=0;offset<home.length;offset+=concurrency){
    const batch=home.slice(offset,offset+concurrency);
    const settled=await Promise.all(batch.map(async(row)=>{
      try{
        const enriched=await enrichFixture(row);
        return {ok:true,row:enriched};
      }catch(e){
        return {ok:false,row,error:e.name==="AbortError"?"Timeout":e.message};
      }
    }));

    for(const item of settled){
      processed++;
      if(item.ok)results.push(item.row);
      else errors.push({externalId:item.row.externalId,url:item.row.url,error:item.error});
      onProgress({processed,total:home.length,item});
    }
  }
  return {homeCount:home.length,results,errors};
}
