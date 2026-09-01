function iso(d){return d.toISOString().slice(0,10)}
function parse(s){return new Date(`${s}T12:00:00Z`)}
function addDays(s,n){const d=parse(s);d.setUTCDate(d.getUTCDate()+n);return iso(d)}
function dow(s){const x=parse(s).getUTCDay();return x===0?7:x}
function firstDow(startDate,weekday){let d=startDate;while(dow(d)!==weekday)d=addDays(d,1);return d}
function monthlyDate(year,month,weekday,ordinal){
  if(ordinal==="last"){
    const next=month===12?`${year+1}-01-01`:`${year}-${String(month+1).padStart(2,"0")}-01`;
    let d=addDays(next,-1);while(dow(d)!==weekday)d=addDays(d,-1);return d;
  }
  const first=`${year}-${String(month).padStart(2,"0")}-01`;
  const offset=(weekday-dow(first)+7)%7;
  const day=1+offset+(Number(ordinal||1)-1)*7;
  const d=`${year}-${String(month).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
  return d.slice(0,7)===`${year}-${String(month).padStart(2,"0")}`?d:null;
}
export function generateOccurrences({recurrenceType,weekday,monthOrdinal,startDate,endDate}){
  const until=endDate||addDays(startDate,366),out=[];
  if(recurrenceType==="weekly"||recurrenceType==="biweekly"){
    let d=firstDow(startDate,weekday),step=recurrenceType==="weekly"?7:14;
    while(d<=until){out.push(d);d=addDays(d,step)}
    return out;
  }
  if(recurrenceType==="monthly"){
    const start=parse(startDate),end=parse(until);let y=start.getUTCFullYear(),m=start.getUTCMonth()+1;
    while(new Date(Date.UTC(y,m-1,1))<=end){
      const d=monthlyDate(y,m,weekday,monthOrdinal||"1");
      if(d&&d>=startDate&&d<=until)out.push(d);
      m++;if(m===13){m=1;y++}
    }
    return out;
  }
  throw new Error("Ungültiger Wiederholungsrhythmus");
}
