import crypto from "crypto";
import { db } from "./client.js";
import { logger } from "../utils/logger.js";

export const OFFICIAL_TEAM_NAMES = [
  "Herren - SG Stebbach/Gemmingen",
  "Herren - SG Stebbach/Gemmingen 2",
  "A-Junioren - JSG Gemmingen / Stebbach",
  "B-Junioren - JSG Gemmingen/Stebbach",
  "C-Junioren - JSG Gemmingen/Stebbach",
  "C-Junioren - JSG Gemmingen/Stebbach 2",
  "D-Junioren - JSG Gemmingen/Stebbach",
  "Frauen - SV Gemmingen"
];

const LOCATIONS = [
  { id: "gemmingen", name: "Gemmingen", address: "Beim Sportplatz 3, 75050 Gemmingen" },
  { id: "stebbach", name: "Stebbach", address: "Jahnweg 1, 75050 Gemmingen-Stebbach" }
];

export async function initSchema() {
  await db(`create table if not exists cp5_clubs(
    id uuid primary key,
    name text not null,
    fussballde_club_id text,
    active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  )`);

  await db(`create table if not exists cp5_teams(
    id uuid primary key,
    club_id uuid references cp5_clubs(id) on delete cascade,
    name text not null,
    external_name text default '',
    coach text default '',
    contact text default '',
    note text default '',
    active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique(club_id,name)
  )`);

  await db(`create table if not exists cp5_locations(
    id text primary key,
    name text not null unique,
    address text default '',
    active boolean not null default true
  )`);

  await db(`create table if not exists cp5_resources(
    id uuid primary key,
    location_id text not null references cp5_locations(id) on delete cascade,
    resource_type text not null check(resource_type in ('pitch','cabin')),
    base_name text not null,
    section text not null default 'whole',
    display_name text not null,
    active boolean not null default true,
    created_at timestamptz not null default now(),
    unique(location_id,resource_type,display_name)
  )`);

  await db(`create table if not exists cp5_events(
    id uuid primary key,
    club_id uuid references cp5_clubs(id) on delete cascade,
    team_id uuid references cp5_teams(id) on delete set null,
    event_type text not null,
    event_date date not null,
    kickoff_time time,
    start_time time,
    end_time time,
    title text default '',
    opponent text default '',
    competition text default '',
    status text not null default 'planned',
    location_id text references cp5_locations(id) on delete set null,
    venue_name text default '',
    resource_id uuid references cp5_resources(id) on delete set null,
    allocation_mode text not null default 'flexible',
    requested_section text not null default 'whole',
    home_cabin_id uuid references cp5_resources(id) on delete set null,
    guest_cabin_id uuid references cp5_resources(id) on delete set null,
    address text default '',
    note text default '',
    source text not null default 'manual',
    external_id text,
    external_url text,
    game_number text,
    source_hash text default '',
    last_synced_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  )`);

  await db(`alter table cp5_events add column if not exists venue_name text default ''`);
  await db(`alter table cp5_events add column if not exists allocation_mode text not null default 'flexible'`);
  await db(`alter table cp5_events add column if not exists requested_section text not null default 'whole'`);

  await db(`create unique index if not exists uq_cp5_event_external
    on cp5_events(source,external_id) where external_id is not null`);
  await db(`create index if not exists idx_cp5_events_date on cp5_events(event_date)`);
  await db(`create index if not exists idx_cp5_events_team on cp5_events(team_id)`);
  await db(`create index if not exists idx_cp5_events_resource on cp5_events(resource_id)`);

  await db(`create table if not exists cp5_sync_runs(
    id uuid primary key,
    source text not null,
    status text not null,
    started_at timestamptz not null default now(),
    finished_at timestamptz,
    found_count integer not null default 0,
    inserted_count integer not null default 0,
    updated_count integer not null default 0,
    unchanged_count integer not null default 0,
    skipped_count integer not null default 0,
    error_count integer not null default 0,
    details jsonb not null default '{}'::jsonb
  )`);

  await db(`create table if not exists cp5_settings(
    setting_key text primary key,
    setting_value jsonb not null,
    updated_at timestamptz not null default now()
  )`);

  let club = await db(`select id from cp5_clubs where name=$1 limit 1`,["SV Gemmingen"]);
  let clubId;
  if(!club.rowCount){
    clubId=crypto.randomUUID();
    await db(`insert into cp5_clubs(id,name,fussballde_club_id) values($1,$2,$3)`,[
      clubId,"SV Gemmingen","00ES8GN9B8000051VV0AG08LVUPGND5I"
    ]);
  }else clubId=club.rows[0].id;

  for(const loc of LOCATIONS){
    await db(`insert into cp5_locations(id,name,address) values($1,$2,$3)
      on conflict(id) do update set name=excluded.name,address=excluded.address,active=true`,
      [loc.id,loc.name,loc.address]);
  }

  for(const loc of LOCATIONS){
    for(const base of ["Hauptplatz","Trainingsplatz"]){
      for(const [section,label] of [["whole","Gesamt"],["half_a","Hälfte A"],["half_b","Hälfte B"]]){
        const display=`${base} – ${label}`;
        await db(`insert into cp5_resources(id,location_id,resource_type,base_name,section,display_name)
          values($1,$2,'pitch',$3,$4,$5)
          on conflict(location_id,resource_type,display_name) do update set active=true`,
          [crypto.randomUUID(),loc.id,base,section,display]);
      }
    }
    for(const cabin of ["Heimkabine","Gastkabine"]){
      await db(`insert into cp5_resources(id,location_id,resource_type,base_name,section,display_name)
        values($1,$2,'cabin',$3,'whole',$3)
        on conflict(location_id,resource_type,display_name) do update set active=true`,
        [crypto.randomUUID(),loc.id,cabin]);
    }
  }

  for(const name of OFFICIAL_TEAM_NAMES){
    await db(`insert into cp5_teams(id,club_id,name,external_name)
      values($1,$2,$3,$3)
      on conflict(club_id,name) do update set active=true`,
      [crypto.randomUUID(),clubId,name]);
  }

  logger.info("ClubPlanner 5.0 Sprint 3.2 Datenbankschema bereit", { clubId });
  return { clubId };
}
