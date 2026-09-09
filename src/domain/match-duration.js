const norm=v=>String(v??"")
 .replace(/[\u200b\u200c\u200d\u2060]/g,"").replace(/\u00a0/g," ")
 .replace(/\s*\/\s*/g,"/").replace(/\s+/g," ").trim().toLocaleLowerCase("de-DE");
export function matchBlockingMinutes({category="",teamName=""}={}){
 return /\bd-junioren\b/.test(norm(`${category} ${teamName}`))?90:120;
}
