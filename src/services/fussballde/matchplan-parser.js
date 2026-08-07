import * as cheerio from "cheerio";

const BASE="https://www.fussball.de";
const clean=v=>String(v??"").replace(/[\u200b\u200c\u200d\u2060]/g,"").replace(/\u00a0/g," ").replace(/\s+/g," ").trim();

function absolute(href){try{return new URL(href,BASE).href.split("?")[0]}catch{return ""}}
function externalId(url){return (String(url).match(/\/-\/spiel\/([A-Z0-9]{12,})(?:\/|$)/i)||String(url).match(/\/spiel\/([A-Z0-9]{12,})(?:\/|$)/i)||[])[1]||""}
function iso(dd,mm,yyyy){return `${yyyy.length===2?`20${yyyy}`:yyyy}-${mm}-${dd}`}

function statusFrom(text){
  const t=clean(text);
  if(/\bABSE\.?\b|\bAbsetzung\b|\bSpielabsetzung\b/i.test(t))return "cancelled";
  if(/\bAUSF\.?\b|\bAusfall\b|\bSpielausfall\b/i.test(t))return "cancelled";
  if(/\bABBR\.?\b|\bAbbruch\b|\bSpielabbruch\b/i.test(t))return "cancelled";
  if(/\bVERL\.?\b|\bVerlegung\b|\bverlegt\b/i.test(t))return "rescheduled";
  return "planned";
}

function parseMeta(text){
  const t=clean(text);
  let date="",kickoff="",category="",competition="",matchType="",gameNumber="";
  let m=t.match(/(\d{2})\.(\d{2})\.(\d{4})\s*[-–]\s*([0-2]?\d:[0-5]\d)\s*Uhr/i);
  if(m){date=iso(m[1],m[2],m[3]);kickoff=m[4].padStart(5,"0")}
  if(!date){
    m=t.match(/(?:Mo|Di|Mi|Do|Fr|Sa|So),?\s*(\d{2})\.(\d{2})\.(\d{2})\s*(?:\||·)?\s*([0-2]?\d:[0-5]\d)/i);
    if(m){date=iso(m[1],m[2],m[3]);kickoff=m[4].padStart(5,"0")}
  }
  m=t.match(/\b(Herren(?:-Reserve)?|Frauen|A-Junioren|B-Junioren|C-Junioren|D-Junioren|E-Junioren|F-Junioren)\b/i);
  if(m)category=clean(m[1]);
  m=t.match(/\b(FS|ME|PO|TU)\b\s*(?:\||·)?\s*(\d{6,12})\b/i);
  if(m){matchType=m[1].toUpperCase();gameNumber=m[2]}
  if(category){
    const idx=t.toLowerCase().indexOf(category.toLowerCase());
    let tail=clean(t.slice(idx+category.length));
    tail=tail.replace(/\s+\b(?:FS|ME|PO|TU)\b\s*(?:\|?\s*\d{6,12})?.*$/i,"");
    competition=clean(tail.replace(/^[|·,:;\-–]+/,""));
  }
  return {date,kickoff,category,competition,matchType,gameNumber};
}

function usefulTeam(t){
  t=clean(t);
  return Boolean(t)&&t.length<130&&!/Zum Spiel|Absetzung|Ausfall|Abbruch|Spielbericht/i.test(t)&&!/^[\d:–\-]+$/.test(t);
}

function teamsFromRow($,row){
  const links=$(row).find("a").map((_,a)=>({href:$(a).attr("href")||"",text:clean($(a).text())})).get()
    .filter(x=>usefulTeam(x.text)&&!/\/spiel\//i.test(x.href));
  if(links.length>=2)return {home:links[0].text,away:links[1].text};
  const txt=clean($(row).text());
  const parts=txt.split(/\s+:\s+/);
  if(parts.length>=2)return {home:clean(parts[0]).replace(/^.*?\b(?:FS|ME|PO|TU)\b(?:\s*\|?\s*\d{6,12})?\s*/i,""),away:clean(parts.slice(1).join(" : ")).replace(/\b(?:Absetzung|Ausfall|Abbruch|Zum Spiel).*$/i,"")};
  return {home:"",away:""};
}

export function parseSeasonMatchplan(html,sourceUrl=""){
  const $=cheerio.load(html);
  const results=[];
  let current={date:"",kickoff:"",category:"",competition:"",matchType:"",gameNumber:""};
  let localStatus="";
  for(const row of $("tr").toArray()){
    const text=clean($(row).text());
    if(!text)continue;
    const meta=parseMeta(text);
    for(const k of Object.keys(current))if(meta[k])current[k]=meta[k];
    if(/\b(?:Absetzung|Ausfall|Abbruch|ABSE\.?|AUSF\.?|ABBR\.?)\b/i.test(text))localStatus=text;
    const anchors=$(row).find('a[href*="/spiel/"]').toArray();
    if(!anchors.length)continue;
    const teams=teamsFromRow($,row);
    for(const a of anchors){
      const url=absolute($(a).attr("href"));
      const id=externalId(url);
      if(!id)continue;
      results.push({externalId:id,url,...current,...teams,status:statusFrom(`${localStatus} ${text}`),sourceUrl});
    }
    current={date:"",kickoff:"",category:"",competition:"",matchType:"",gameNumber:""};
    localStatus="";
  }
  const map=new Map();
  for(const r of results){if(!map.has(r.externalId))map.set(r.externalId,r)}
  return [...map.values()];
}

export function isClubHomeTeam(name){
  const n=clean(name).replace(/\s*\/\s*/g,"/");
  return /^(?:SV Gemmingen(?:\b|\s)|SG Stebbach\/Gemmingen(?:\b|\s)|JSG Gemmingen\/Stebbach(?:\b|\s))/i.test(n);
}
