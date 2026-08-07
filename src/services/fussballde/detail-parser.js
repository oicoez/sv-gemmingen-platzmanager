import * as cheerio from "cheerio";

const clean=v=>String(v??"").replace(/\u00a0/g," ").replace(/\s+/g," ").trim();

export function parseVenue(html){
  const $=cheerio.load(html);
  const body=clean($("body").text());
  let venueText="";
  $('a[href*="google"],a[href*="maps"],[class*="venue"],[class*="stadium"],[class*="spielstaette"],[class*="location"]').each((_,el)=>{
    if(venueText)return;
    const t=clean($(el).text());
    if(/Gemmingen|Stebbach|Sportplatz|Rasenplatz|Kunstrasen|Jahnweg/i.test(t))venueText=t;
  });
  if(!venueText){
    const m=body.match(/((?:Rasenplatz|Kunstrasenplatz|Kunstrasen|Hartplatz|Sportplatz)[^|]{0,220}(?:75050\s+Gemmingen(?:-Stebbach)?|Beim Sportplatz|Jahnweg)[^|]{0,120})/i)
      ||body.match(/((?:Beim Sportplatz|Jahnweg)[^|]{0,160}75050\s+Gemmingen(?:-Stebbach)?)/i);
    if(m)venueText=clean(m[1]);
  }
  if(/Jahnweg|Stebbach/i.test(venueText))return {locationId:"stebbach",address:"Jahnweg 1, 75050 Gemmingen-Stebbach",pitchBase:/Kunstrasen|Trainingsplatz/i.test(venueText)?"Trainingsplatz":"Hauptplatz",venueText};
  if(/Beim Sportplatz|SV Gemmingen|75050 Gemmingen\b/i.test(venueText))return {locationId:"gemmingen",address:"Beim Sportplatz 3, 75050 Gemmingen",pitchBase:/Kunstrasen|Trainingsplatz/i.test(venueText)?"Trainingsplatz":"Hauptplatz",venueText};
  return {locationId:null,address:"",pitchBase:"",venueText};
}
