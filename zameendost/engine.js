// ZameenDost — irrigation science core.
// FAO-56 (Allen et al., 1998) single-crop-coefficient root-zone water balance.
// Pure functions, no UI, so the agri/research team can validate it independently.
(function (root) {
  'use strict';

  // ---- Crop parameters (FAO-56 Tables 11, 12, 22) for Pakistan's main irrigated crops.
  // stages = [initial, development, mid-season, late] in days; kc = [Kc_ini, Kc_mid, Kc_end]
  // zr = [root depth at sowing, max root depth] in metres; p = depletion fraction before stress.
  // sow = default sowing day (MM-DD) for the central zone (Punjab plains); sowBy overrides it for the
  // south (Sindh, southern Balochistan) and north (KP, Potohar, hills). The farmer can always change the date.
  // TODO(agri team): replace with values calibrated from PARC / AARI / provincial research-station trials.
  const CROPS = {
    wheat:     { name: 'Wheat',           ur: 'گندم',  stages: [25, 50, 50, 30],     kc: [0.40, 1.15, 0.30], zr: [0.30, 1.00], p: 0.55, sow: '11-10', sowBy: { north: '11-01' } },
    rice:      { name: 'Rice (paddy)',    ur: 'دھان',  stages: [30, 30, 60, 30],     kc: [1.05, 1.20, 0.75], zr: [0.30, 0.60], p: 0.20, sow: '07-01', sowBy: { south: '06-10', north: '06-15' },
                 note: 'Paddy: dates are from transplanting, and the advice assumes alternate wetting and drying (soil kept near saturation, not permanently flooded).' },
    cotton:    { name: 'Cotton',          ur: 'کپاس',  stages: [30, 50, 60, 55],     kc: [0.35, 1.15, 0.60], zr: [0.30, 1.40], p: 0.65, sow: '05-10', sowBy: { south: '04-15' } },
    sugarcane: { name: 'Sugarcane',       ur: 'گنا',   stages: [35, 60, 190, 120],   kc: [0.40, 1.25, 0.75], zr: [0.30, 1.60], p: 0.65, sow: '02-20', sowBy: { south: '02-01', north: '03-01' } },
    maize:     { name: 'Maize',           ur: 'مکئی',  stages: [25, 40, 45, 30],     kc: [0.30, 1.20, 0.35], zr: [0.30, 1.20], p: 0.55, sow: '02-15', sowBy: { south: '02-01', north: '06-10' } },
    chickpea:  { name: 'Gram / Chickpea', ur: 'چنا',   stages: [25, 35, 50, 25],     kc: [0.40, 1.00, 0.35], zr: [0.30, 1.00], p: 0.50, sow: '10-25', sowBy: { south: '10-20', north: '10-15' } },
    canola:    { name: 'Mustard / Canola', ur: 'سرسوں', stages: [25, 35, 45, 30],    kc: [0.35, 1.10, 0.35], zr: [0.30, 1.00], p: 0.60, sow: '10-15', sowBy: { north: '10-01' } },
    sunflower: { name: 'Sunflower',       ur: 'سورج مکھی', stages: [25, 35, 45, 25], kc: [0.35, 1.10, 0.35], zr: [0.30, 1.20], p: 0.45, sow: '02-10', sowBy: { south: '01-15', north: '03-01' } },
    potato:    { name: 'Potato',          ur: 'آلو',   stages: [25, 30, 45, 30],     kc: [0.50, 1.15, 0.75], zr: [0.25, 0.50], p: 0.35, sow: '10-10', sowBy: { south: '10-20', north: '03-15' } },
    groundnut: { name: 'Groundnut',       ur: 'مونگ پھلی', stages: [35, 45, 35, 25], kc: [0.40, 1.15, 0.60], zr: [0.30, 0.90], p: 0.50, sow: '04-01', sowBy: { north: '04-10' } },
  };
  // Typical farmer practice per crop — [days between irrigations, mm applied each time]. Used only as the default
  // "your usual schedule" that the season comparison is run against; the farmer can change both numbers.
  // Rough figures from general extension guidance (wheat 4–5 irrigations, cotton fortnightly, cane 25–30 a year,
  // gram and canola 2–3, potato light and frequent). TODO(agri team): confirm per district.
  const USUAL = { wheat: [25, 75], rice: [5, 60], cotton: [14, 75], sugarcane: [14, 75], maize: [10, 75],
                  chickpea: [45, 60], canola: [35, 75], sunflower: [18, 75], potato: [8, 50], groundnut: [18, 60] };
  for (const k in CROPS) CROPS[k].usual = USUAL[k];
  CROPS.sugarcane.note = 'Sugarcane: the model assumes all water comes from irrigation and rain. Where the water table is within about 2 m, the roots draw on it and the real need is lower.';

  const zoneOf = (lat) => (lat < 28.5 ? 'south' : lat >= 33.3 ? 'north' : 'central');
  const sowFor = (crop, lat) => (crop.sowBy && crop.sowBy[zoneOf(lat)]) || crop.sow;

  // Total available water per metre of root zone (mm/m), field capacity and wilting point (m³/m³),
  // FAO-56 Table 19 mid-range values. fc/wp convert SMAP volumetric soil moisture to "% of available water".
  const SOILS = {
    sand:      { name: 'Sand (dunes: Thal, Thar, Cholistan)', ur: 'ریتلی',      taw: 70,  fc: 0.12, wp: 0.04 },
    loamysand: { name: 'Loamy sand',                          ur: 'میرا ریتلی', taw: 100, fc: 0.16, wp: 0.07 },
    sandyloam: { name: 'Sandy loam',                          ur: 'ریتلی میرا', taw: 130, fc: 0.22, wp: 0.10 },
    loam:      { name: 'Loam',                                ur: 'میرا',       taw: 160, fc: 0.26, wp: 0.11 },
    clayloam:  { name: 'Clay loam',                           ur: 'بھاری میرا', taw: 180, fc: 0.33, wp: 0.15 },
  };
  const availableFraction = (theta, soil) => Math.max(0, Math.min(1, (theta - soil.wp) / (soil.fc - soil.wp)));

  // ---- Satellite helpers for NASA GIBS WMTS tiles (Web Mercator, 256-px tiles).
  function tileCoords(lat, lon, z) {
    const n = Math.pow(2, z), latR = lat * Math.PI / 180;
    const x = (lon + 180) / 360 * n, y = (1 - Math.log(Math.tan(latR) + 1 / Math.cos(latR)) / Math.PI) / 2 * n;
    const tx = Math.floor(x), ty = Math.floor(y);
    return { z, tx, ty, px: Math.floor((x - tx) * 256), py: Math.floor((y - ty) * 256) };
  }
  // GIBS colormap XML -> [{r,g,b,value}] using each bin's midpoint; no-data / transparent entries skipped.
  function parseColormap(xml) {
    const out = [], re = /<ColorMapEntry\s+([^>]*)\/>/g; let m;
    while ((m = re.exec(xml))) {
      const a = m[1]; if (/nodata="true"|transparent="true"/.test(a)) continue;
      const rgb = /rgb="(\d+),(\d+),(\d+)"/.exec(a), v = /\svalue="\[([^,\]]+)(?:,([^\)\]]+))?[\)\]]"/.exec(a);
      if (!rgb || !v) continue;
      const num = s => parseFloat(s.replace('INF', 'Infinity'));
      const lo = num(v[1]), hi = v[2] == null ? lo : num(v[2]);
      if (!isFinite(lo)) continue;
      out.push({ r: +rgb[1], g: +rgb[2], b: +rgb[3], value: isFinite(hi) ? (lo + hi) / 2 : lo });
    }
    return out;
  }
  function lookupColor(cmap, r, g, b) {      // palette PNGs match exactly; small tolerance guards against resampling
    let best = null, bd = Infinity;
    for (const e of cmap) { const d = (e.r - r) ** 2 + (e.g - g) ** 2 + (e.b - b) ** 2; if (d < bd) { bd = d; best = e; } }
    return best && bd <= 48 ? best.value : null;
  }

  // Field application efficiency (share of applied water that ends up in the root zone) and the
  // practical maximum NET depth one event can store (flood: ~3 inch gross = 50 mm net; larger
  // events mostly drain past the roots). Irrigation triggers at min(RAW, maxNet).
  const METHODS = {
    flood:     { name: 'Flood / basin', ur: 'کھلا پانی', eff: 0.60, maxNet: 50 },
    furrow:    { name: 'Furrow / bed',  ur: 'کھیلیاں',   eff: 0.70, maxNet: 50 },
    sprinkler: { name: 'Sprinkler',     ur: 'فوارہ',     eff: 0.75, maxNet: 40 },
    drip:      { name: 'Drip',          ur: 'ڈرپ',       eff: 0.90, maxNet: 25 },
  };

  const STAGES = ['Initial', 'Development', 'Mid-season', 'Late season'];
  const NO_IRRIGATION_BEFORE_HARVEST_DAYS = 10;

  // ---- Date helpers (all dates are 'YYYY-MM-DD' strings in local Pakistan time)
  const toUTC = (s) => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d); };
  const daysBetween = (a, b) => Math.round((toUTC(b) - toUTC(a)) / 86400000);
  const addDays = (s, n) => new Date(toUTC(s) + n * 86400000).toISOString().slice(0, 10);
  const seasonLength = (crop) => crop.stages.reduce((a, b) => a + b, 0);

  function kcAt(crop, das) {
    const [L1, L2, L3, L4] = crop.stages, [ini, mid, end] = crop.kc;
    if (das < 0) return null;                                    // not sown yet
    if (das <= L1) return ini;
    if (das <= L1 + L2) return ini + (mid - ini) * (das - L1) / L2;
    if (das <= L1 + L2 + L3) return mid;
    if (das <= L1 + L2 + L3 + L4) return mid + (end - mid) * (das - L1 - L2 - L3) / L4;
    return null;                                                 // harvested
  }

  function stageAt(crop, das) {
    let acc = 0;
    for (let i = 0; i < 4; i++) { acc += crop.stages[i]; if (das <= acc) return STAGES[i]; }
    return 'Harvested';
  }

  // Roots grow linearly until the end of the development stage.
  function rootDepthAt(crop, das) {
    const [z0, zmax] = crop.zr, grow = crop.stages[0] + crop.stages[1];
    return z0 + (zmax - z0) * Math.min(1, Math.max(0, das) / grow);
  }

  // Satellite hook: NDVI -> Kc (Kamble et al., 2013, Kc = 1.457·NDVI − 0.1725).
  function kcFromNdvi(ndvi) { return Math.min(1.30, Math.max(0.15, 1.457 * ndvi - 0.1725)); }

  /**
   * Satellite-informed crop coefficient from a coarse (250 m) NDVI pixel, bounded by the FAO table.
   * Such a pixel mixes the field with neighbours, tracks and buildings, so it may only nudge the table value by
   * ±20 %. If the implied Kc is below 60 % or above 150 % of the table, the pixel does not look like this crop at
   * this stage at all (a village centre, bare land, another crop) and the table is used unchanged.
   * Under-estimating water need is the costly error, so the satellite is never allowed to cut Kc deeply.
   */
  function kcAdjust(ndvi, tableKc) {
    const kcNdvi = kcFromNdvi(ndvi), ratio = kcNdvi / tableKc;
    if (ratio < 0.6 || ratio > 1.5) return { factor: 1, used: false, kcNdvi, ratio };
    return { factor: Math.min(1.2, Math.max(0.8, ratio)), used: true, kcNdvi, ratio };
  }

  function dayOfYear(s) { return Math.round((toUTC(s) - Date.UTC(+s.slice(0, 4), 0, 1)) / 86400000) + 1; }

  /**
   * FAO-56 Penman-Monteith reference ET (eq. 6) from daily weather — used with NASA POWER inputs.
   * w: { tmax, tmin (°C), rh (mean %), u2 (m/s at 2 m), rs (MJ/m²/day) }, lat in degrees, doy 1..366, z elevation (m).
   */
  function et0PM(w, lat, doy, z) {
    z = z == null ? 200 : z;
    const T = (w.tmax + w.tmin) / 2;
    const e0 = t => 0.6108 * Math.exp(17.27 * t / (t + 237.3));
    const delta = 4098 * e0(T) / Math.pow(T + 237.3, 2);                          // slope of vapour pressure curve
    const P = 101.3 * Math.pow((293 - 0.0065 * z) / 293, 5.26), gamma = 0.000665 * P;
    const es = (e0(w.tmax) + e0(w.tmin)) / 2, ea = Math.min(es, es * w.rh / 100);
    const phi = lat * Math.PI / 180;
    const dr = 1 + 0.033 * Math.cos(2 * Math.PI * doy / 365), dec = 0.409 * Math.sin(2 * Math.PI * doy / 365 - 1.39);
    const ws = Math.acos(Math.max(-1, Math.min(1, -Math.tan(phi) * Math.tan(dec))));
    const Ra = 24 * 60 / Math.PI * 0.0820 * dr * (ws * Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.sin(ws));
    const Rso = (0.75 + 2e-5 * z) * Ra;                                            // clear-sky radiation
    const Rns = 0.77 * w.rs;                                                       // net shortwave (albedo 0.23)
    const Rnl = 4.903e-9 * ((Math.pow(w.tmax + 273.16, 4) + Math.pow(w.tmin + 273.16, 4)) / 2)
              * (0.34 - 0.14 * Math.sqrt(ea)) * (1.35 * Math.min(1, w.rs / Rso) - 0.35);
    const Rn = Rns - Rnl;                                                          // soil heat flux G ≈ 0 daily
    const et0 = (0.408 * delta * Rn + gamma * 900 / (T + 273) * w.u2 * (es - ea)) / (delta + gamma * (1 + 0.34 * w.u2));
    return Math.max(0, et0);
  }

  // Simple effective-rainfall rule: light showers (<5 mm) mostly evaporate; 80% of larger rain counts.
  function effectiveRain(p) { return p < 5 ? 0 : 0.8 * p; }

  // Should an irrigation that is due today be held for forecast rain?
  // Waiting saves water only when irrigating first would fill the root zone and leave no room for the rain, which
  // would then drain past the roots. If the soil is so dry that it can hold both, irrigate now. The crop must also be
  // able to reach the rain without stress, and forecast skill drops fast, so we never look more than two days ahead.
  // savedNet = the rain (mm) that holding keeps in the root zone instead of losing.
  const RAIN_LOOKAHEAD_DAYS = 2;
  function rainWorthWaitingFor(list, i, Dr, RAW, need, o) {
    let proj = Dr;                                             // depletion if no water is applied
    for (let k = 1; k <= RAIN_LOOKAHEAD_DAYS && i + k < list.length; k++) {
      const d = list[i + k], kc = kcAt(o.crop, daysBetween(o.sowDate, d.date));
      if (kc == null) return null;
      const roomIfIrrigatedNow = (Dr - need) + (proj - Dr);    // what is left unfilled, plus crop use until the rain
      const wasted = effectiveRain(d.rain || 0) - roomIfIrrigatedNow;
      if (wasted >= Math.max(10, 0.25 * need) && proj < RAW) return { date: d.date, rainMm: d.rain, inDays: k, savedNet: Math.min(wasted, need) };
      proj += kc * (o.kcFactor || 1) * d.et0;                  // one more dry day of crop water use
      if (proj >= RAW) return null;                            // waiting longer would stress the crop
    }
    return null;
  }

  /**
   * Daily root-zone water balance.
   * days: [{date, et0, rain}] sorted ascending.
   * o: { crop, tawPerM, sowDate, startDate, eff, maxNet?, kcFactor?, initialDr?, rainAware?,
   *      policy: {type:'none'|'smart'|'fixed', interval?, depthMm?} }
   * Dr = root-zone depletion (mm below field capacity). At startDate Dr = initialDr (default 0: a full irrigation).
   * rainAware (smart policy only): when irrigation is due but useful rain is forecast within two days and the
   * crop can safely wait for it, the irrigation is held and the row is marked heldForRain.
   */
  function waterBalance(days, o) {
    const crop = o.crop, eff = o.eff, pol = o.policy || { type: 'none' }, maxNet = o.maxNet || Infinity;
    const total = seasonLength(crop), list = days.filter(d => d.date >= o.startDate && d.et0 != null);
    let Dr = o.initialDr || 0, sinceIrr = 0;
    const rows = [];
    for (let i = 0; i < list.length; i++) {
      const d = list[i];
      const das = daysBetween(o.sowDate, d.date);
      let kc = kcAt(crop, das);
      if (kc == null) { rows.push({ date: d.date, das, outOfSeason: true, et0: d.et0, rain: d.rain || 0, Dr }); continue; }
      kc *= (o.kcFactor || 1);
      const Zr = rootDepthAt(crop, das);
      const TAW = o.tawPerM * Zr;
      const ETc = kc * d.et0;
      const p = Math.min(0.8, Math.max(0.1, crop.p + 0.04 * (5 - ETc)));   // FAO-56 eq. p adjustment
      const RAW = p * TAW;
      const trigger = Math.min(RAW, maxNet);
      const Pe = effectiveRain(d.rain || 0);
      const lateCutoff = das > total - NO_IRRIGATION_BEFORE_HARVEST_DAYS;

      let irrNet = 0, irrGross = 0;
      sinceIrr++;
      if (pol.type === 'fixed' && sinceIrr >= pol.interval && !lateCutoff) {
        irrGross = pol.depthMm; irrNet = pol.depthMm * eff; sinceIrr = 0;
      }
      const Ks = Dr > RAW ? Math.max(0, (TAW - Dr) / ((1 - p) * TAW)) : 1;
      const ETa = Ks * ETc;
      Dr = Dr - Pe - irrNet + ETa;
      let DP = 0;
      if (Dr < 0) { DP = -Dr; Dr = 0; }
      if (Dr > TAW) Dr = TAW;

      let heldForRain = null;
      if (pol.type === 'smart' && Dr >= trigger && !lateCutoff) {
        if (o.rainAware) heldForRain = rainWorthWaitingFor(list, i, Dr, RAW, Math.min(Dr, maxNet), o);
        if (!heldForRain) { irrNet = Math.min(Dr, maxNet); irrGross = irrNet / eff; Dr -= irrNet; sinceIrr = 0; }
      }
      rows.push({ date: d.date, das, stage: stageAt(crop, das), kc, Zr, TAW, RAW, trigger, p, ETc, ETa, Ks, Pe,
                  et0: d.et0, rain: d.rain || 0, Dr, irrNet, irrGross, DP, stress: Ks < 1, lateCutoff, heldForRain });
    }
    return rows;
  }

  /**
   * Irrigation advice from the last irrigation date through the forecast.
   * rows = soil water if nothing more is applied (drawn in the chart);
   * plan = the rain-aware schedule from today's soil state to the end of the forecast (drawn in the calendar).
   * status: 'now' | 'soon' | 'rain' (due, but hold for forecast rain) | 'wait' | 'stop' | 'notsown' | 'harvested'
   */
  function advise(days, o, today) {
    const rows = waterBalance(days, { ...o, policy: { type: 'none' } });
    const todayRow = rows.find(r => r.date === today);
    const das = daysBetween(o.sowDate, today);
    const total = seasonLength(o.crop);
    if (das < 0) return { status: 'notsown', rows, plan: [], todayRow, das };
    if (das > total) return { status: 'harvested', rows, plan: [], todayRow, das };

    const before = rows.filter(r => r.date < today && !r.outOfSeason).pop();      // soil state at the end of yesterday
    const plan = waterBalance(days, { ...o, startDate: today, initialDr: before ? before.Dr : 0, rainAware: true, policy: { type: 'smart' } })
      .filter(r => !r.outOfSeason);
    const first = plan.find(r => r.irrGross > 0), hold = plan.find(r => r.heldForRain);
    const rainSoon = plan.slice(0, 3).filter(r => r.rain >= 10);
    let res;
    if (todayRow && todayRow.lateCutoff) res = { status: 'stop' };
    else if (hold && hold.date === today) {
      const need = Math.min(hold.Dr, o.maxNet || Infinity);
      res = { status: 'rain', rainDate: hold.heldForRain.date, rainMm: hold.heldForRain.rainMm, inDays: hold.heldForRain.inDays,
              netMm: need, grossMm: need / o.eff, savedNetMm: hold.heldForRain.savedNet, savedGrossMm: hold.heldForRain.savedNet / o.eff,
              nextDate: first ? first.date : null };
    } else if (!first) res = { status: 'wait', inDays: null };
    else {
      const inDays = daysBetween(today, first.date);
      res = { status: inDays <= 0 ? 'now' : 'soon', inDays, date: first.date, netMm: first.irrNet, grossMm: first.irrGross };
    }
    return { ...res, rows, plan, hold, todayRow, das, rainSoon, stage: stageAt(o.crop, das) };
  }

  /** Compare a smart (soil-water-triggered) schedule against the farmer's fixed schedule over a whole season. */
  function seasonCompare(days, o, fixed) {
    const run = (policy) => {
      const rows = waterBalance(days, { ...o, policy });
      const irr = rows.filter(r => r.irrGross > 0);
      return { rows, count: irr.length, grossMm: irr.reduce((s, r) => s + r.irrGross, 0),
               stressDays: rows.filter(r => r.stress && !r.lateCutoff).length,   // drying down before harvest is intended, not stress
               lossMm: rows.reduce((s, r) => s + (r.DP || 0), 0) };
    };
    return { smart: run({ type: 'smart' }), fixed: run({ type: 'fixed', ...fixed }), days: days.length };
  }

  /**
   * Pumping energy & cost for a gross application.
   * src: 'electric' | 'diesel' | 'solar' | 'canal'
   */
  function pumpCost(grossMm, acres, pump) {
    const m3 = grossMm * 4.0469 * acres;                       // 1 mm over 1 acre = 4.047 m³
    const flowM3h = pump.cusec * 0.0283168 * 3600;            // 1 cusec = 28.3 L/s
    const hours = flowM3h > 0 ? m3 / flowM3h : 0;
    const hydKWh = 1000 * 9.81 * pump.headM * m3 / 3.6e6;     // energy to lift the water
    let kWh = 0, litres = 0, cost = 0;
    if (pump.src === 'electric') { kWh = hydKWh / 0.45; cost = kWh * pump.elecPrice; }       // wire-to-water eff.
    else if (pump.src === 'diesel') { litres = hydKWh / (0.55 * 0.30 * 9.9); cost = litres * pump.dieselPrice; } // pump × engine × kWh/L
    return { m3, hours, kWh, litres, cost };
  }

  root.ZD = { CROPS, SOILS, METHODS, kcAt, stageAt, rootDepthAt, kcFromNdvi, effectiveRain, et0PM, dayOfYear,
              waterBalance, advise, seasonCompare, pumpCost, daysBetween, addDays, seasonLength,
              availableFraction, tileCoords, parseColormap, lookupColor, zoneOf, sowFor, kcAdjust };
})(typeof window !== 'undefined' ? window : globalThis);
