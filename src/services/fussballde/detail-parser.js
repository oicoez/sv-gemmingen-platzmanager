import * as cheerio from "cheerio";

const clean=v=>String(v??"").replace(/\u00a0/g," ").replace(/\s+/g," ").trim();

function normalizeCommaText(value){
  return clean(value).replace(/\s*,\s*/g,", ").replace(/,\s*,/g,",");
}

function parseExternalVenue(venueText){
  const t=normalizeCommaText(venueText);
  if(!t)return {locationId:null,venueName:"",address:"",pitchBase:"",venueText:""};

  // FUSSBALL.DE generally exposes venue links like:
  // "Rasenplatz, TB Richen, Stebbacher Straße, 75031 Eppingen"
  const parts=t.split(",").map(clean).filter(Boolean);
  const pitchLabel=parts[0]||"";
  const venueNameRaw=parts[1]||"";
  const addressParts=parts.slice(2);

  const postcodeCity=(t.match(/\b\d{5}\s+[A-Za-zÄÖÜäöüß][^,]*$/)||[])[0]||"";
  const city=postcodeCity.replace(/^\d{5}\s+/,"").trim();
  const venueName=venueNameRaw
    ? (city && !new RegExp(city.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"),"i").test(venueNameRaw)
        ? `${venueNameRaw} (${city})`
        : venueNameRaw)
    : (city||"externer Spielort");

  return {
    locationId:null,
    venueName,
    address:addressParts.join(", "),
    pitchBase:"",
    venueText:t,
    pitchLabel
  };
}

export function parseVenue(html){
  const $=cheerio.load(html);
  const body=clean($("body").text());

  // Highest priority: a real map link with a postal address.
  let venueText="";
  $('a[href*="google"],a[href*="maps"]').each((_,el)=>{
    if(venueText)return;
    const t=normalizeCommaText($(el).text());
    if(/\b\d{5}\b/.test(t) && /(Rasenplatz|Kunstrasen|Sportplatz|Stadion|Platz)/i.test(t)){
      venueText=t;
    }
  });

  // Second priority: an explicit venue/location block that itself contains an address.
  if(!venueText){
    $('[class*="venue"],[class*="stadium"],[class*="spielstaette"],[class*="location"]').each((_,el)=>{
      if(venueText)return;
      const t=normalizeCommaText($(el).text());
      if(/\b\d{5}\b/.test(t) && /(Rasenplatz|Kunstrasen|Sportplatz|Stadion|Platz)/i.test(t)){
        venueText=t;
      }
    });
  }

  // Last fallback: find an address-bearing venue phrase in visible text.
  if(!venueText){
    const m=body.match(/((?:Rasenplatz|Kunstrasenplatz|Kunstrasen|Hartplatz|Sportplatz|Stadion)[^|]{0,240}?\b\d{5}\s+[A-Za-zÄÖÜäöüß][^|]{0,100})/i);
    if(m)venueText=normalizeCommaText(m[1]);
  }

  if(!venueText)return {locationId:null,venueName:"",address:"",pitchBase:"",venueText:""};

  // IMPORTANT: Local locations are recognized ONLY by their exact local address.
  // "Stebbacher Straße, 75031 Eppingen" must NEVER become "Stebbach".
  const localText=normalizeCommaText(venueText);

  if(/\bJahnweg\s*1\b/i.test(localText) && /\b75050\s+Gemmingen(?:-Stebbach)?\b/i.test(localText)){
    return {
      locationId:"stebbach",
      venueName:"Stebbach",
      address:"Jahnweg 1, 75050 Gemmingen-Stebbach",
      pitchBase:/Kunstrasen|Trainingsplatz/i.test(localText)?"Trainingsplatz":"Hauptplatz",
      venueText:localText
    };
  }

  if(/\bBeim Sportplatz\s*3\b/i.test(localText) && /\b75050\s+Gemmingen\b/i.test(localText)){
    return {
      locationId:"gemmingen",
      venueName:"Gemmingen",
      address:"Beim Sportplatz 3, 75050 Gemmingen",
      pitchBase:/Kunstrasen|Trainingsplatz/i.test(localText)?"Trainingsplatz":"Hauptplatz",
      venueText:localText
    };
  }

  // Everything else remains an external/neutral venue.
  return parseExternalVenue(localText);
}
