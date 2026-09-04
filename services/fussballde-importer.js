import crypto from "crypto";
import * as cheerio from "cheerio";
import { db } from "../database/db.js";
import { syncState, resetSyncState, syncLog, syncProblem } from "./sync-state.js";

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

const DEFAULT_CLUB_ID = "00ES8GN9B8000051VV0AG08LVUPGND5I";
const BASE = "https://www.fussball.de";
const DETAIL_CONCURRENCY = 6;
const DETAIL_TIMEOUT_MS = 12000;
const OVERVIEW_TIMEOUT_MS = 15000;
const TOTAL_TIMEOUT_MS = 120000;

function clean(value) {
  return String(value || "")
    .replace(/[\u200b\u200c\u200d\u2060]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeTeam(value) {
  return clean(value)
    .replace(/\s*\/\s*/g, "/")
    .replace(/\s+/g, " ")
    .trim();
}

function absoluteUrl(href) {
  try {
    return new URL(href, BASE).href.split("?")[0];
  } catch {
    return "";
  }
}

function externalIdFromUrl(url) {
  return (String(url || "").match(/\/spiel\/([A-Z0-9]+)(?:\/|$)/i) || [])[1] || "";
}

function parseIsoFromGermanDate(value) {
  const m = String(value || "").match(/(\d{2})\.(\d{2})\.(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : "";
}

function addMinutes(time, minutes) {
  const m = String(time || "").match(/^([0-2]\d):([0-5]\d)$/);
  if (!m) return "00:01";
  const total = Number(m[1]) * 60 + Number(m[2]) + minutes;
  return `${String(Math.floor((total % 1440) / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

async function fetchText(url, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36",
        "accept-language": "de-DE,de;q=0.9,en;q=0.6",
        accept: "text/html,application/xhtml+xml"
      }
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

function statusFromText(text) {
  const t = clean(text);
  if (/\bABSE\.?\b|\bAbsetzung\b|\bSpielabsetzung\b/i.test(t)) return "abgesetzt";
  if (/\bAUSF\.?\b|\bAusfall\b|\bSpielausfall\b/i.test(t)) return "ausfall";
  if (/\bABBR\.?\b|\bAbbruch\b|\bSpielabbruch\b/i.test(t)) return "abbruch";
  if (/\bVERL\.?\b|\bVerlegung\b|\bverlegt\b/i.test(t)) return "verlegt";
  return "geplant";
}

function extractKickoff(...texts) {
  for (const text of texts) {
    const t = String(text || "");
    const patterns = [
      /(?:^|\s|[-|,])([0-2]?\d:[0-5]\d)\s*Uhr\b/i,
      /(?:startDate|kickoff|kick-off|datetime)[^0-9]{0,100}(?:\d{4}-\d{2}-\d{2}[T\s])?([0-2]\d:[0-5]\d)/i,
      /"(?:time|kickoffTime|startTime)"\s*:\s*"([0-2]\d:[0-5]\d)/i
    ];
    for (const p of patterns) {
      const m = t.match(p);
      if (m) return m[1].padStart(5, "0");
    }
  }
  return "";
}

function parseHeaderMeta(text) {
  const t = clean(text);
  let date = "";
  let kickoff = "";

  // Full FUSSBALL.DE heading:
  // Sonntag, 09.08.2026 - 10:30 Uhr | Frauen | Landesfreundschaftsspiele
  let m = t.match(/(\d{2})\.(\d{2})\.(\d{4})\s*-\s*([0-2]?\d:[0-5]\d)\s*Uhr/i);
  if (m) {
    date = `${m[3]}-${m[2]}-${m[1]}`;
    kickoff = m[4].padStart(5, "0");
  } else {
    // Compact line: So, 09.08.26 | 10:30 | Frauen | ...
    m = t.match(/(\d{2})\.(\d{2})\.(\d{2}).{0,35}?([0-2]?\d:[0-5]\d)/i);
    if (m) {
      date = `20${m[3]}-${m[2]}-${m[1]}`;
      kickoff = m[4].padStart(5, "0");
    }
  }

  const category = (t.match(/\b(Herren|Frauen|A-Junioren|B-Junioren|C-Junioren|D-Junioren)\b/i) || [])[1] || "";

  // Competition sits after category on FUSSBALL.DE.
  let competition = "";
  if (category) {
    const idx = t.toLowerCase().indexOf(category.toLowerCase());
    if (idx >= 0) {
      let tail = clean(t.slice(idx + category.length));
      // Remove technical suffix: FS | 520007093 etc.
      tail = tail.replace(/\s+\b(?:FS|ME|PO|TU)\b\s*(?:\|?\s*\d{6,12})?.*$/i, "");
      competition = clean(tail.replace(/^[|,\-–]\s*/, ""));
    }
  }

  const gameNumber =
    (t.match(/\b(?:FS|ME|PO|TU)\s*(?:\|\s*)?(\d{6,12})\b/i) || [])[1] ||
    "";

  return { date, kickoff, category, competition, gameNumber };
}

function extractTeamsFromFixtureRow($, row) {
  const links = $(row)
    .find("a")
    .map((_, el) => clean($(el).text()))
    .get()
    .filter(t =>
      t &&
      !/Zum Spiel|Absetzung|Ausfall|Abbruch|Spielbericht/i.test(t) &&
      !/^[\d:\-–]+$/.test(t)
    );

  // In a fixture row the two team links occur before the "Zum Spiel" link.
  if (links.length >= 2) {
    return { home: links[0], away: links[1] };
  }

  const text = clean($(row).text());
  const parts = text.split(/\s+:\s+/);
  if (parts.length >= 2) {
    return {
      home: clean(parts[0]).replace(/^.*?\b(?:FS|ME|PO|TU)\b(?:\s*\|?\s*\d{6,12})?\s*/i, ""),
      away: clean(parts.slice(1).join(" : "))
        .replace(/\b(?:Absetzung|Ausfall|Abbruch|Zum Spiel).*$/i, "")
    };
  }
  return { home: "", away: "" };
}

export function parseOverviewHtml(html) {
  const $ = cheerio.load(html);
  const fixtures = [];
  const seen = new Set();

  // Stateful parsing is important: FUSSBALL.DE renders the date/time/meta
  // in the row directly before the home/away fixture row.
  let current = {
    date: "",
    kickoff: "",
    category: "",
    competition: "",
    gameNumber: ""
  };

  const rows = $("tr").toArray();

  if (rows.length) {
    for (const row of rows) {
      const text = clean($(row).text());

      // Update current fixture metadata whenever the row contains a date/time
      // or compact metadata.
      const meta = parseHeaderMeta(text);
      if (meta.date) current.date = meta.date;
      if (meta.kickoff) current.kickoff = meta.kickoff;
      if (meta.category) current.category = meta.category;
      if (meta.competition) current.competition = meta.competition;
      if (meta.gameNumber) current.gameNumber = meta.gameNumber;

      const anchors = $(row).find('a[href*="/spiel/"]').toArray();
      if (!anchors.length) continue;

      const teams = extractTeamsFromFixtureRow($, row);
      const rowStatus = statusFromText(text);

      for (const anchor of anchors) {
        const url = absoluteUrl($(anchor).attr("href"));
        const externalId = externalIdFromUrl(url);
        if (!url || !externalId || seen.has(externalId)) continue;
        seen.add(externalId);

        fixtures.push({
          externalId,
          url,
          overviewDate: current.date,
          overviewKickoff: current.kickoff,
          overviewStatus: rowStatus,
          overviewHome: teams.home,
          overviewAway: teams.away,
          overviewCategory: current.category,
          overviewCompetition: current.competition,
          gameNumber: current.gameNumber,
          rowText: text,
          contextText: clean(`${current.date} ${current.kickoff} ${current.category} ${current.competition} ${current.gameNumber} ${text}`)
        });
      }

      // Prevent metadata bleed if the next block is malformed.
      // Date/category persist only until the next fixture has consumed them.
      if (anchors.length) {
        current = { date:"", kickoff:"", category:"", competition:"", gameNumber:"" };
      }
    }

    if (fixtures.length) return fixtures;
  }

  // Fallback for non-table layouts: find every game link and use the smallest
  // ancestor only. This path is secondary; the print view should hit the table parser.
  $('a[href*="/spiel/"]').each((_, anchor) => {
    const url = absoluteUrl($(anchor).attr("href"));
    const externalId = externalIdFromUrl(url);
    if (!url || !externalId || seen.has(externalId)) return;
    seen.add(externalId);

    let node = $(anchor);
    let text = "";
    for (let i=0;i<10;i++) {
      node = node.parent();
      if (!node.length) break;
      const candidate = clean(node.text());
      if (candidate && candidate.length < 2200) {
        text = candidate;
        if (/\d{1,2}:\d{2}|ABSE\.?|Absetzung/i.test(candidate)) break;
      }
    }

    const meta = parseHeaderMeta(text);
    const teams = extractTeamsFromFixtureRow($, node);

    fixtures.push({
      externalId,
      url,
      overviewDate: meta.date,
      overviewKickoff: meta.kickoff,
      overviewStatus: statusFromText(text),
      overviewHome: teams.home,
      overviewAway: teams.away,
      overviewCategory: meta.category,
      overviewCompetition: meta.competition,
      gameNumber: meta.gameNumber,
      rowText: text,
      contextText: text
    });
  });

  return fixtures;
}

function parseTitle(title) {
  const t = clean(title);
  const m = t.match(/^(.*?)\s+-\s+(.*?)\s+Ergebnis:\s+(.*?)\s+-\s+(.*?)\s+-\s+(\d{2}\.\d{2}\.\d{4})/);
  if (!m) return null;
  return {
    home: clean(m[1]),
    away: clean(m[2]),
    competition: clean(m[3]),
    category: clean(m[4]),
    date: parseIsoFromGermanDate(m[5])
  };
}

function extractVenue($, bodyText) {
  let venueText = "";

  // Prefer the exact Google Maps / map link on the individual match page.
  $('a[href*="google"],a[href*="maps"],a[href*="geo:"]').each((_, el) => {
    const text = clean($(el).text());
    if (!venueText && text.length >= 8) venueText = text;
  });

  if (!venueText) {
    // Local venue fallback from visible detail text.
    const m = bodyText.match(
      /((?:Rasenplatz|Kunstrasenplatz|Kunstrasen|Hartplatz|Sportplatz)[^|]{0,180}(?:Beim Sportplatz|Jahnweg)[^|]{0,180}75050\s+Gemmingen(?:-Stebbach)?)/i
    );
    if (m) venueText = clean(m[1]);
  }

  let location = "";
  let address = "";
  let pitch = "";

  if (/Jahnweg|Stebbach/i.test(venueText)) {
    location = "Stebbach";
    address = "Jahnweg 1, 75050 Gemmingen-Stebbach";
  } else if (/Beim Sportplatz|75050\s+Gemmingen(?!-Stebbach)/i.test(venueText)) {
    location = "Gemmingen";
    address = "Beim Sportplatz 3, 75050 Gemmingen";
  }

  if (location) {
    const base = /Kunstrasen|Trainingsplatz/i.test(venueText) ? "Trainingsplatz" : "Hauptplatz";
    pitch = `${base} – Gesamt`;
  }

  return { venueText, location, address, pitch };
}

function officialTeamName(category, rawTeam) {
  const cat = clean(category);
  const team = normalizeTeam(rawTeam);

  if (/^Herren$/i.test(cat) && /SG Stebbach\/Gemmingen 2$/i.test(team)) return "Herren - SG Stebbach/Gemmingen 2";
  if (/^Herren$/i.test(cat) && /SG Stebbach\/Gemmingen$/i.test(team)) return "Herren - SG Stebbach/Gemmingen";
  if (/^Frauen$/i.test(cat) && /SV Gemmingen/i.test(team)) return "Frauen - SV Gemmingen";
  if (/^A-Junioren$/i.test(cat)) return "A-Junioren - JSG Gemmingen / Stebbach";
  if (/^B-Junioren$/i.test(cat)) return "B-Junioren - JSG Gemmingen/Stebbach";
  if (/^C-Junioren$/i.test(cat) && /(?:Stebbach|Gemmingen).*\b2\b/i.test(team)) return "C-Junioren - JSG Gemmingen/Stebbach 2";
  if (/^C-Junioren$/i.test(cat)) return "C-Junioren - JSG Gemmingen/Stebbach";
  if (/^D-Junioren$/i.test(cat)) return "D-Junioren - JSG Gemmingen/Stebbach";
  return `${cat} - ${clean(rawTeam)}`.replace(/^\s*-\s*/, "");
}

function isClubTeam(team) {
  return /SV Gemmingen|SG Stebbach\/?\s*Gemmingen|JSG Gemmingen\s*\/?\s*Stebbach/i.test(normalizeTeam(team));
}

export function parseDetailHtml(html, overview) {
  const $ = cheerio.load(html);
  const rawHtml = String(html || "");
  const bodyText = clean($("body").text());
  const titleData = parseTitle($("title").first().text());

  const home = titleData?.home || overview.overviewHome || "";
  const away = titleData?.away || overview.overviewAway || "";
  const category = titleData?.category || overview.overviewCategory || "";
  const date = titleData?.date || overview.overviewDate || "";
  const competition = titleData?.competition || overview.overviewCompetition || "";

  // Detail page first: only explicit machine-readable / "Uhr" values.
  // Never scan arbitrary page times because menus/news can contain unrelated clocks.
  const detailKickoff = extractKickoff(
    rawHtml.match(/<(?:time|meta)[^>]+(?:datetime|content)=["'][^"']+["'][^>]*>/gi)?.join(" ") || "",
    bodyText.match(/(?:Anstoß|Anstoss|Spielbeginn|Beginn).{0,80}[0-2]?\d:[0-5]\d(?:\s*Uhr)?/gi)?.join(" ") || ""
  );

  // The overview table is authoritative and always contains the scheduled kickoff.
  const kickoff = detailKickoff || overview.overviewKickoff || "";

  // The fixture row is authoritative. Do NOT scan the complete detail body for status:
  // FUSSBALL.DE pages contain a global legend with words such as "Absetzung",
  // which would otherwise mark every game as cancelled.
  const status = overview.overviewStatus || "geplant";

  const venue = extractVenue($, bodyText);
  const gameNumber = (bodyText.match(/\bSpiel:\s*(\d{6,12})\b/i) || [])[1] || overview.gameNumber || "";

  return {
    externalId: overview.externalId,
    externalUrl: overview.url,
    gameNumber,
    home,
    away,
    category,
    competition,
    date,
    kickoff,
    status,
    ...venue
  };
}

function eventHash(event) {
  return crypto.createHash("sha256").update(JSON.stringify({
    date: event.date,
    kickoff: event.kickoff,
    team: event.team,
    opponent: event.opponent,
    competition: event.competition,
    location: event.location,
    address: event.address,
    pitch: event.pitch,
    status: event.status,
    gameNumber: event.gameNumber
  })).digest("hex");
}

function toCalendarEvent(detail) {
  const cancelled = ["abgesetzt", "ausfall", "abbruch"].includes(detail.status);
  return {
    externalId: detail.externalId,
    externalUrl: detail.externalUrl,
    gameNumber: detail.gameNumber,
    date: detail.date,
    kickoff: detail.kickoff,
    end: detail.kickoff ? addMinutes(detail.kickoff, 120) : "00:01",
    kickoffKnown: Boolean(detail.kickoff),
    type: "Heimspiel",
    team: officialTeamName(detail.category, detail.home),
    opponent: clean(detail.away),
    competition: clean(detail.competition || detail.category),
    location: detail.location || (cancelled ? "—" : "PRÜFEN"),
    address: detail.address || "",
    pitch: detail.pitch || "",
    status: detail.status,
    note: cancelled ? "ABGESETZT" : (!detail.location ? "SPIELORT PRÜFEN" : ""),
    source: "fussball.de"
  };
}

async function removePreviouslyImportedGame(detail, reason="extern") {
  // First choice: stable FUSSBALL.DE id. Older imports can however contain a
  // different external_id for the same fixture. Therefore we also match the
  // fixture identity (date + the external opponent) as a migration fallback.
  const externalOpponent = isClubTeam(detail.home) ? detail.away : detail.home;
  const found = await db(
    `select id, external_id, event_date, team, opponent
       from clubplanner_events
      where source='fussball.de'
        and (
          external_id=$1
          or (
            event_date=$2::date
            and lower(trim(opponent))=lower(trim($3))
            and (lower(team) like '%gemmingen%' or lower(team) like '%stebbach%')
          )
        )`,
    [detail.externalId, detail.date, externalOpponent]
  );
  if (!found.rowCount) {
    console.log(`[FUSSBALL-4.3.4] Kein Alt-Datensatz gefunden: ${detail.externalId} | ${detail.date} | Gegner=${externalOpponent}`);
    return false;
  }

  const ids = found.rows.map(row => row.id);
  await db(`delete from clubplanner_events where id = any($1::uuid[])`, [ids]);
  syncState.updated += ids.length;
  console.log(`[FUSSBALL-4.3.4] ${ids.length} Alt-Datensatz/-sätze entfernt: ${reason} | ${detail.date} | Gegner=${externalOpponent}`);
  return true;
}

async function upsertHomeGame(event) {
  const hash = eventHash(event);
  const found = await db(
    `select id, import_hash from clubplanner_events where source='fussball.de' and external_id=$1`,
    [event.externalId]
  );

  if (found.rowCount && found.rows[0].import_hash === hash) {
    await db(`update clubplanner_events set last_synced_at=now() where id=$1`, [found.rows[0].id]);
    syncState.unchanged++;
    return;
  }

  const values = [
    event.date,
    event.kickoff || "00:00",
    event.end,
    event.kickoffKnown,
    event.type,
    event.team,
    event.opponent,
    event.competition,
    event.location,
    event.address,
    event.pitch,
    "",
    "",
    event.status,
    event.note,
    event.externalId,
    event.externalUrl,
    event.gameNumber,
    hash
  ];

  if (found.rowCount) {
    await db(`update clubplanner_events set
      event_date=$2,start_time=$3,end_time=$4,kickoff_known=$5,event_type=$6,team=$7,opponent=$8,
      competition=$9,location=$10,address=$11,pitch=$12,home_cabin=$13,guest_cabin=$14,status=$15,note=$16,
      external_url=$18,game_number=$19,import_hash=$20,last_synced_at=now(),updated_at=now()
      where id=$1`, [found.rows[0].id, ...values]);
    syncState.updated++;
  } else {
    await db(`insert into clubplanner_events(
      id,event_date,start_time,end_time,kickoff_known,event_type,team,opponent,competition,location,address,pitch,
      home_cabin,guest_cabin,status,note,source,external_id,external_url,game_number,import_hash,last_synced_at
    ) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,'fussball.de',$17,$18,$19,$20,now())`,
    [crypto.randomUUID(), ...values]);
    syncState.imported++;
  }

  await db(`insert into clubplanner_teams(id,name,active) values($1,$2,true)
    on conflict(name) do update set active=true`, [crypto.randomUUID(), event.team]);
}

async function fetchOverview(clubId) {
  const from = new Date().toISOString().slice(0, 10);
  const seasonYear = new Date().getMonth() >= 6 ? new Date().getFullYear() + 1 : new Date().getFullYear();
  const to = `${seasonYear}-06-30`;
  const urls = [
    `${BASE}/vereinsspielplan.druck/-/datum-bis/${to}/datum-von/${from}/id/${clubId}/match-type/-1/max/999/mode/PRINT/show-venues/true`,
    `${BASE}/verein/sv-gemmingen-baden/-/id/${clubId}`
  ];

  let best = [];
  let lastError = null;
  for (const url of urls) {
    try {
      const html = await fetchText(url, OVERVIEW_TIMEOUT_MS);
      const parsed = parseOverviewHtml(html);
      if (parsed.length > best.length) best = parsed;
      if (best.length >= 20) break;
    } catch (e) {
      lastError = e;
      syncProblem("overview", url, e.name === "AbortError" ? "Timeout" : e.message);
    }
  }
  if (!best.length) throw lastError || new Error("Vereinsspielplan enthält keine Spiel-Links.");
  return best;
}

async function processFixture(overview, index, total) {
  syncLog(`Spiel ${index}/${total} wird geöffnet …`, "details");
  try {
    const html = await fetchText(overview.url, DETAIL_TIMEOUT_MS);
    const detail = parseDetailHtml(html, overview);
    console.log(`[FUSSBALL-4.3.4] ${overview.externalId} | ${detail.date || "kein Datum"} | ${detail.kickoff || "keine Zeit"} | ${detail.home || "kein Heim"} : ${detail.away || "kein Gast"} | Ort=${detail.location || "extern/kein lokaler Ort"} | Venue=${detail.venueText || "kein Venue-Text"}`);

    if (!detail.home || !detail.away || !detail.date) {
      throw new Error("Pflichtdaten auf Detailseite fehlen");
    }

    const cancelled = ["abgesetzt","ausfall","abbruch"].includes(detail.status);

    if (!isClubTeam(detail.home)) {
      await removePreviouslyImportedGame(detail, `kein Heimspiel: ${detail.home} : ${detail.away}`);
      syncState.skipped++;
      return;
    }

    // ClubPlanner reserves only our own pitches. A scheduled match must
    // have its ACTUAL venue in Gemmingen or Stebbach. External venues
    // are away games for the local resource planner. Remove any stale
    // record created by an older importer during the next sync.
    if (!cancelled && !["Gemmingen","Stebbach"].includes(detail.location)) {
      await removePreviouslyImportedGame(
        detail,
        `externer Spielort: ${detail.venueText || "unbekannt"}`
      );
      syncState.skipped++;
      return;
    }

    const event = toCalendarEvent(detail);
    await upsertHomeGame(event);
  } catch (e) {
    syncState.skipped++;
    syncProblem(overview.externalId, overview.url, e.name === "AbortError" ? "Detailseite Timeout" : e.message);
  } finally {
    syncState.processed++;
  }
}

export async function runFussballSync({ clubId = process.env.FUSSBALL_CLUB_ID || DEFAULT_CLUB_ID } = {}) {
  if (syncState.running) return syncState;
  resetSyncState();

  const safety = setTimeout(() => {
    if (syncState.running) {
      syncState.error = "Gesamt-Timeout nach 120 Sekunden";
      syncLog("Gesamt-Timeout erreicht.", "error");
    }
  }, TOTAL_TIMEOUT_MS);

  try {
    syncLog("Vereinsspielplan wird geladen …", "discovery");
    const fixtures = await fetchOverview(clubId);
    syncState.total = fixtures.length;
    syncLog(`${fixtures.length} Spiele gefunden. Detailseiten werden geprüft …`, "details");

    for (let offset = 0; offset < fixtures.length; offset += DETAIL_CONCURRENCY) {
      if (syncState.error) break;
      const batch = fixtures.slice(offset, offset + DETAIL_CONCURRENCY);
      await Promise.all(batch.map((fixture, idx) => processFixture(fixture, offset + idx + 1, fixtures.length)));
    }

    if (!syncState.error) {
      syncLog(
        `Fertig: ${syncState.imported} neu · ${syncState.updated} aktualisiert · ${syncState.unchanged} unverändert · ${syncState.skipped} übersprungen`,
        "done"
      );
    }
  } catch (e) {
    syncState.error = e.name === "AbortError" ? "FUSSBALL.DE Timeout" : e.message;
    syncLog(`Synchronisierung fehlgeschlagen: ${syncState.error}`, "error");
  } finally {
    clearTimeout(safety);
    syncState.running = false;
    syncState.finishedAt = new Date().toISOString();
  }

  return syncState;
}
