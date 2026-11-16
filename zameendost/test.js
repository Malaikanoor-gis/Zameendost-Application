// Sanity checks for the ZameenDost engine against published Punjab figures.
// Run: node test.js
require('./engine.js');
const ZD = globalThis.ZD;
let fails = 0;
const check = (name, ok, detail) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  (' + detail + ')' : ''}`); if (!ok) fails++; };

// Synthetic Khushab rabi season: monthly mean ET0 (mm/day) typical for central Punjab, no rain.
const et0ByMonth = { 11: 2.3, 12: 1.5, 1: 1.6, 2: 2.6, 3: 4.0, 4: 6.0, 5: 7.5 };
const sow = '2025-11-10', wheat = ZD.CROPS.wheat, len = ZD.seasonLength(wheat);
const days = [];
for (let i = 0; i <= len; i++) { const d = ZD.addDays(sow, i); days.push({ date: d, et0: et0ByMonth[+d.slice(5, 7)], rain: 0 }); }

// 1. Seasonal crop water requirement of wheat in Punjab is reported at roughly 350–450 mm.
const rows = ZD.waterBalance(days, { crop: wheat, tawPerM: 160, sowDate: sow, startDate: sow, eff: 0.6, maxNet: 50, policy: { type: 'smart' } });
const etc = rows.reduce((s, r) => s + r.ETc, 0);
check('wheat seasonal ETc in 300–450 mm', etc > 300 && etc < 450, etc.toFixed(0) + ' mm');

// 2. Smart schedule on loam should land near the 4–6 irrigations extension services recommend.
const irr = rows.filter(r => r.irrGross > 0);
check('wheat smart irrigations 3–7', irr.length >= 3 && irr.length <= 7, irr.length + ' events: ' + irr.map(r => r.date.slice(5) + ' ' + r.irrGross.toFixed(0) + 'mm').join(', '));

// 3. No stress under the smart schedule (irrigation triggers exactly at RAW).
check('no stress days under smart schedule', rows.filter(r => r.stress).length === 0);

// 4. Kc curve shape.
check('Kc initial', ZD.kcAt(wheat, 10) === 0.40);
check('Kc mid', ZD.kcAt(wheat, 100) === 1.15);
check('Kc after harvest is null', ZD.kcAt(wheat, 200) === null);
check('Kc from NDVI 0.8 ≈ 0.99', Math.abs(ZD.kcFromNdvi(0.8) - 0.993) < 0.01);

// 5. Against a fixed 21-day / 75 mm schedule the soil-water trigger should stress the crop less and drain less.
//    (It may apply MORE total water when the fixed schedule under-waters in spring — the app says so honestly.)
const cmp = ZD.seasonCompare(days, { crop: wheat, tawPerM: 160, sowDate: sow, startDate: sow, eff: 0.6, maxNet: 50 }, { interval: 21, depthMm: 75 });
check('smart schedule has fewer stress days than fixed', cmp.smart.stressDays < cmp.fixed.stressDays, `${cmp.smart.stressDays} vs ${cmp.fixed.stressDays} days; water ${cmp.smart.grossMm.toFixed(0)} vs ${cmp.fixed.grossMm.toFixed(0)} mm`);
check('smart schedule drains less past the roots', cmp.smart.lossMm < cmp.fixed.lossMm, `${cmp.smart.lossMm.toFixed(0)} vs ${cmp.fixed.lossMm.toFixed(0)} mm`);

// 6. Pump arithmetic: 75 mm on 1 acre with a 1-cusec pump ≈ 303 m³ ≈ 3 h.
const pc = ZD.pumpCost(75, 1, { src: 'electric', cusec: 1, headM: 15, elecPrice: 35 });
check('75 mm/acre volume ≈ 303 m³', Math.abs(pc.m3 - 303.5) < 1, pc.m3.toFixed(1));
check('pumping time ≈ 3 h', Math.abs(pc.hours - 2.98) < 0.1, pc.hours.toFixed(2));
check('electricity 20–40 kWh', pc.kWh > 20 && pc.kWh < 40, pc.kWh.toFixed(1) + ' kWh, Rs ' + pc.cost.toFixed(0));

// 6b. Diesel, solar and canal: 75 mm on 1 acre lifted 15 m.
const pd = ZD.pumpCost(75, 1, { src: 'diesel', cusec: 1, headM: 15, dieselPrice: 270 });
check('diesel 5–10 litres, priced', pd.litres > 5 && pd.litres < 10 && Math.abs(pd.cost - pd.litres * 270) < 1e-6 && pd.kWh === 0, pd.litres.toFixed(1) + ' L, Rs ' + pd.cost.toFixed(0));
const psol = ZD.pumpCost(75, 1, { src: 'solar', cusec: 1, headM: 15 }), pcan = ZD.pumpCost(75, 1, { src: 'canal', cusec: 1, headM: 15 });
check('solar and canal: water volume counted, no fuel or cost', psol.cost === 0 && pcan.cost === 0 && psol.litres === 0 && Math.abs(pcan.m3 - 303.5) < 1);
check('twice the lift costs twice the diesel', Math.abs(ZD.pumpCost(75, 1, { src: 'diesel', cusec: 1, headM: 30, dieselPrice: 270 }).litres / pd.litres - 2) < 1e-9);

// 7. FAO-56 Example 17 (Brussels, 6 July): Tmax 21.5, Tmin 12.3, RHmean ~73.5 %, u2 2.78 m/s, Rs 22.07 MJ/m²/d, 50.8°N, 100 m → ET0 = 3.9 mm/d.
const et0 = ZD.et0PM({ tmax: 21.5, tmin: 12.3, rh: 73.5, u2: 2.78, rs: 22.07 }, 50.8, 187, 100);
check('Penman-Monteith reproduces FAO-56 Example 17 (3.9 ± 0.3)', Math.abs(et0 - 3.9) < 0.3, et0.toFixed(2) + ' mm/day');

// 8. Advice: 3 days after a full irrigation in December should say "wait".
const adv = ZD.advise(days, { crop: wheat, tawPerM: 160, sowDate: sow, startDate: '2025-12-20', eff: 0.6, maxNet: 50 }, '2025-12-23');
check('advice shortly after irrigation is wait/soon', adv.status === 'wait' || (adv.status === 'soon' && adv.inDays > 7), adv.status + (adv.inDays ? ' in ' + adv.inDays + ' d' : ''));

// 9. Satellite helpers: Web Mercator tile maths and GIBS colormap parsing.
const tc = ZD.tileCoords(0, 0, 1);
check('tile of (0,0) at z=1 is tile 1,1 pixel 0,0', tc.tx === 1 && tc.ty === 1 && tc.px === 0 && tc.py === 0, JSON.stringify(tc));
const tk = ZD.tileCoords(32.2955, 72.3519, 9);
check('Khushab at z=9 lands on tile 358,207 (the tile GIBS served)', tk.tx === 358 && tk.ty === 207, JSON.stringify(tk));
const cm = ZD.parseColormap(`<ColorMaps><ColorMap><Entries>
  <ColorMapEntry rgb="0,26,105" transparent="true" sourceValue="[-3000,-2000)" value="[-0.3,-0.2)" nodata="true" ref="0"/>
  <ColorMapEntry rgb="10,105,0" transparent="false" sourceValue="[7601,7701)" value="[0.7601,0.7701)" ref="119"/>
  <ColorMapEntry rgb="80,80,80" transparent="false" sourceValue="[0.700,+INF)" value="[0.700,+INF)" ref="255"/>
</Entries></ColorMap></ColorMaps>`);
check('colormap skips no-data and keeps bin midpoints', cm.length === 2 && Math.abs(cm[0].value - 0.7651) < 1e-6 && cm[1].value === 0.7, JSON.stringify(cm));
check('colour lookup exact and tolerant', ZD.lookupColor(cm, 10, 105, 0) === cm[0].value && ZD.lookupColor(cm, 12, 104, 2) === cm[0].value && ZD.lookupColor(cm, 200, 0, 0) === null);
check('SMAP 0.16 m³/m³ on sandy loam = 50 % of available water', Math.abs(ZD.availableFraction(0.16, ZD.SOILS.sandyloam) - 0.5) < 1e-9);

// 10. Pakistan-wide: zones, per-zone sowing defaults, every crop well-formed, paddy water use plausible.
check('zones: Sukkur south, Khushab central, Peshawar north', ZD.zoneOf(27.7) === 'south' && ZD.zoneOf(32.3) === 'central' && ZD.zoneOf(34.0) === 'north');
check('cotton sown earlier in Sindh than Punjab', ZD.sowFor(ZD.CROPS.cotton, 26.0) === '04-15' && ZD.sowFor(ZD.CROPS.cotton, 30.2) === '05-10');
check('crop without a zone override falls back to the central date', ZD.sowFor(ZD.CROPS.wheat, 25.5) === '11-10');
const bad = Object.entries(ZD.CROPS).filter(([k, c]) => c.stages.length !== 4 || c.kc.length !== 3 || c.zr.length !== 2 || !(c.p > 0 && c.p < 1) || !/^\d\d-\d\d$/.test(c.sow) || !c.ur
  || !Array.isArray(c.usual) || !(c.usual[0] >= 3 && c.usual[0] <= 60) || !(c.usual[1] >= 40 && c.usual[1] <= 100));
check('all ' + Object.keys(ZD.CROPS).length + ' crops have complete parameters', bad.length === 0, bad.map(b => b[0]).join(','));
const kharif = { 6: 7.0, 7: 6.0, 8: 5.5, 9: 5.0, 10: 4.0, 11: 2.4 }, rs = '2025-07-01', rice = ZD.CROPS.rice, rd = [];
for (let i = 0; i <= ZD.seasonLength(rice); i++) { const d = ZD.addDays(rs, i); rd.push({ date: d, et0: kharif[+d.slice(5, 7)], rain: 0 }); }
const rr = ZD.waterBalance(rd, { crop: rice, tawPerM: 180, sowDate: rs, startDate: rs, eff: 0.6, maxNet: 50, policy: { type: 'smart' } });
const rEtc = rr.reduce((s, r) => s + r.ETc, 0), rIrr = rr.filter(r => r.irrGross > 0).length;
check('paddy seasonal ETc in 550–900 mm with frequent light irrigations', rEtc > 550 && rEtc < 900 && rIrr > 15, rEtc.toFixed(0) + ' mm, ' + rIrr + ' irrigations');

// 11. Rain-aware advice and the forward plan.
const loam = { crop: wheat, tawPerM: 160, sowDate: sow, startDate: '2026-02-01', eff: 0.6, maxNet: 50 };
const withRain = (date, mm) => days.map(d => ({ ...d, rain: d.date === date ? mm : 0 }));
const dry = ZD.advise(days, loam, '2026-02-05'), T = dry.date;
check('dry forecast: irrigation scheduled some days ahead', dry.status === 'soon' && dry.inDays > 5, dry.status + ' on ' + T);
check('on that day with no rain coming: irrigate now', ZD.advise(days, loam, T).status === 'now');
const rainTomorrow = ZD.advise(withRain(ZD.addDays(T, 1), 30), loam, T);
check('30 mm forecast tomorrow: hold the irrigation for the rain', rainTomorrow.status === 'rain' && rainTomorrow.rainDate === ZD.addDays(T, 1) && !rainTomorrow.plan[0].irrGross, rainTomorrow.status + ' → ' + rainTomorrow.rainDate);
check('saving claimed is the rain that would have drained away, not a whole irrigation', rainTomorrow.savedNetMm > 15 && rainTomorrow.savedNetMm <= 24 && rainTomorrow.savedGrossMm < rainTomorrow.grossMm, rainTomorrow.savedNetMm.toFixed(0) + ' mm net of ' + rainTomorrow.netMm.toFixed(0));
const overdue = ZD.advise(withRain(ZD.addDays(T, 9), 30), loam, ZD.addDays(T, 8));
check('badly overdue field has room for irrigation and rain: irrigate now', overdue.status === 'now' && overdue.todayRow.Dr > 65, 'depletion ' + overdue.todayRow.Dr.toFixed(0) + ' mm');
check('rain five days away is too far to gamble on: irrigate now', ZD.advise(withRain(ZD.addDays(T, 5), 30), loam, T).status === 'now');
check('a 6 mm shower is not worth waiting for', ZD.advise(withRain(ZD.addDays(T, 1), 6), loam, T).status === 'now');
const sand = { ...loam, tawPerM: 70 }, Ts = ZD.advise(days, sand, '2026-02-05').date;
check('on sand the crop is already at its stress limit, so it does not wait for rain', ZD.advise(withRain(ZD.addDays(Ts, 1), 30), sand, Ts).status === 'now', 'trigger ' + Ts);
const ev = dry.plan.filter(r => r.irrGross > 0);
check('plan starts from today, first event is the advised date, events are spaced', dry.plan[0].date === '2026-02-05' && ev[0].date === T && (ev.length < 2 || ZD.daysBetween(ev[0].date, ev[1].date) > 5), ev.map(e => e.date.slice(5)).join(', '));
check('plan and no-irrigation run agree on today\'s soil water', Math.abs(dry.plan[0].Dr - dry.todayRow.Dr) < 1e-9);

// 12. Coarse-pixel NDVI may nudge the FAO Kc, never override it.
const a1 = ZD.kcAdjust(0.80, 1.15), a2 = ZD.kcAdjust(0.21, 1.25), a3 = ZD.kcAdjust(0.60, 1.15), a4 = ZD.kcAdjust(0.63, 0.43), a5 = ZD.kcAdjust(0.95, 1.00);
check('NDVI close to the table: used, small adjustment', a1.used && Math.abs(a1.factor - 0.993 / 1.15) < 0.01, a1.factor.toFixed(2));
check('village-centre pixel (NDVI 0.21 under mid-season cane): rejected, table kept', !a2.used && a2.factor === 1, 'ratio ' + a2.ratio.toFixed(2));
check('moderately low NDVI: used but cut limited to −20 %', a3.used && a3.factor === 0.8, 'ratio ' + a3.ratio.toFixed(2));
check('pixel far greener than the crop stage: rejected, table kept', !a4.used && a4.factor === 1, 'ratio ' + a4.ratio.toFixed(2));
check('raise limited to +20 %', a5.used && a5.factor <= 1.2 && a5.factor > 1.19, a5.factor.toFixed(2));

console.log(fails ? `\n${fails} check(s) failed` : '\nAll checks passed');
process.exit(fails ? 1 : 0);
