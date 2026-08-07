export function berlinDateString(date=new Date()){
  const parts=new Intl.DateTimeFormat("de-DE",{
    timeZone:"Europe/Berlin",year:"numeric",month:"2-digit",day:"2-digit"
  }).formatToParts(date);
  const obj=Object.fromEntries(parts.map(p=>[p.type,p.value]));
  return `${obj.year}-${obj.month}-${obj.day}`;
}

export function isoFromValue(value){
  if(!value)return "";
  if(value instanceof Date)return value.toISOString().slice(0,10);
  const s=String(value);
  const m=s.match(/^(\d{4}-\d{2}-\d{2})/);
  if(m)return m[1];
  const d=new Date(value);
  return Number.isNaN(d.getTime())?"":d.toISOString().slice(0,10);
}

export function addDays(dateString,n){
  const d=new Date(`${dateString}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate()+n);
  return d.toISOString().slice(0,10);
}

export function mondayOf(dateString){
  const value=dateString||berlinDateString();
  const d=new Date(`${value}T12:00:00Z`);
  const day=d.getUTCDay()||7;
  d.setUTCDate(d.getUTCDate()-day+1);
  return d.toISOString().slice(0,10);
}

export function currentMonthBerlin(){
  return berlinDateString().slice(0,7);
}
