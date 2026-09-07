import { config } from "../../config/index.js";

const BASE="https://www.fussball.de";

async function fetchText(url,{timeoutMs=18000}={}){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{
    const response=await fetch(url,{
      signal:controller.signal,
      redirect:"follow",
      cache:"no-store",
      headers:{
        "user-agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36",
        "accept-language":"de-DE,de;q=0.9",
        "x-requested-with":"XMLHttpRequest",
        "referer":`${BASE}/verein/sv-gemmingen-baden/-/id/${config.fussballdeClubId}`,
        "accept":"text/html,application/xhtml+xml,*/*",
        "cache-control":"no-cache, no-store, must-revalidate",
        "pragma":"no-cache"
      }
    });
    if(!response.ok)throw new Error(`FUSSBALL.DE HTTP ${response.status}`);
    return await response.text();
  }finally{
    clearTimeout(timer);
  }
}

function seasonBounds(){
  const now=new Date();
  const y=now.getFullYear();
  const startYear=(now.getMonth()+1)>=7?y:y-1;
  return {from:`${startYear}-07-01`,to:`${startYear+1}-06-30`};
}

export function buildSeasonMatchplanUrl(clubId=config.fussballdeClubId){
  const {from,to}=seasonBounds();
  return `${BASE}/ajax.club.matchplan/-/datum-bis/${to}/datum-von/${from}/id/${clubId}/match-type/-1/max/999/mode/PAGE/show-filter/false`;
}

export async function loadSeasonMatchplan(clubId=config.fussballdeClubId){
  const url=buildSeasonMatchplanUrl(clubId);
  const html=await fetchText(url);
  return {url,html,clubId};
}

export async function loadClubMatchplans(){
  const clubIds=[
    {id:config.fussballdeClubId,sourceClub:"gemmingen"},
    {id:"00ES8GN9B800005MVV0AG08LVUPGND5I",sourceClub:"stebbach"}
  ];
  const out=[];
  for(const c of clubIds){
    try{
      const x=await loadSeasonMatchplan(c.id);
      out.push({...x,sourceClub:c.sourceClub});
    }catch(e){
      out.push({clubId:c.id,sourceClub:c.sourceClub,error:e.message,url:"",html:""});
    }
  }
  return out;
}

export async function loadGameDetail(url){
  return fetchText(url,{timeoutMs:12000});
}
