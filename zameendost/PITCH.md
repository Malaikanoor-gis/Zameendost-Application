# ZameenDost · زمین دوست — NASA Space Apps 2026

**One line:** a farmer anywhere in Pakistan opens a web page on a phone and is told, in Urdu, whether to irrigate today, how many hours to run the tubewell, and whether rain is about to do the job for free — computed from NASA satellites and weather, checked against other NASA satellites, with no account and no server.

## The problem

Pakistan irrigates on the calendar and on habit. A fixed turn over-waters in December, when water drains past the roots and takes fertiliser with it, and can under-water in March when wheat fills its grain. Electricity and diesel for pumping are among a farmer's largest cash costs. And the water underneath is running down: NASA's GRACE satellites measured about **25 cm less water stored under the Khushab region, and 44 cm less around Lahore, in July 2020–22 than in July 2003–05**. Nobody can tell a farmer with five acres what their soil holds today.

## The solution in 30 seconds

1. **Find the field.** Type the village or chak, press GPS, or tap a satellite map that shows village names. Pick the crop; sowing date and usual schedule start at what is typical for that crop in that part of the country.
2. **NASA weather.** NASA POWER supplies every day since the last irrigation; FAO-56 Penman-Monteith is computed in the browser.
3. **The crop from orbit.** MODIS NDVI at the field adjusts the crop coefficient within ±20 % of the FAO value — and is set aside, with an explanation, when the pixel is clearly not the crop.
4. **A water budget for the root zone**, day by day. When the easily available water is gone: *irrigate now*, in inches, cubic metres, pump hours, kWh or litres, and rupees.
5. **Rain-aware.** If useful rain is forecast within two days, the soil would have no room for it after irrigating, and the crop can wait — the advice is *hold*, with the saving stated.
6. **Checked from orbit.** MODIS land surface temperature (a thirsty crop runs hot), SMAP root-zone soil moisture and GRACE water storage are decoded for the same spot and shown beside the model.
7. **A 14-day calendar** a farmer can read without reading: 💧 irrigate, ☔ rain, ⏳ waiting for rain. One tap sends it on WhatsApp in Urdu and English.

## NASA data: used, not decorated

| Dataset | Role | Access |
|---|---|---|
| **POWER** (MERRA-2 + CERES) | Daily weather → ET₀ by FAO-56 Penman-Monteith; also last season's replay | daily API, no key |
| **MODIS Terra NDVI 8-day** (250 m) | Field pixel → bounded adjustment of Kc → crop water use | GIBS tile + NASA colormap |
| **VIIRS NOAA-20 NDVI 8-day** | Successor layer as Terra retires | same |
| **MODIS Terra LST, day** (1 km) | Field cell against its 5 km neighbourhood → thermal stress flag | same |
| **SMAP L4 root-zone soil moisture** (9 km) | Compared with the model's root-zone state | same |
| **GRACE / GRACE-FO** (≈300 km) | Long-term change in stored water where the farmer is | same |
| **SMAP L3, GPM IMERG** | Map layers | same |

What makes this possible without a backend or an Earthdata login: GIBS tiles are palette images and NASA publishes each layer's colormap, so a pixel's colour can be decoded back into NDVI, kelvin, m³/m³ or centimetres of water in the browser. The decoder is in `engine.js` with unit tests.

Open-Meteo supplies only what NASA cannot — the forecast, and the last few days POWER has not processed. The app displays the ET₀ agreement between the two on shared days.

## Validity

- The engine reproduces FAO-56 worked Example 17 (3.85 against 3.9 mm/day).
- Wheat on typical Punjab weather: 348 mm of crop water use and 6 irrigations, in line with extension figures. Paddy: 781 mm.
- **42 automated checks** (`node test.js`): crop curves for 10 crops, zone calendars, water balance, rain-hold logic (including the cases where it must *not* hold), bounded NDVI, pump arithmetic, tile maths, colormap decoding.
- Testing found and fixed real errors: pins on village centres made the satellite see rooftops and under-estimate water need; a "wait for rain" rule that claimed savings it did not deliver; a comparison that judged sugarcane against a wheat calendar.
- A field validation protocol is in the README: pilot fields, soil sampling, logged irrigations, paired-plot yield over one season.

## What it finds — reported as it comes out

Replayed on last season's NASA POWER weather, flood irrigation, electric tubewell, five acres:

| Field | Usual schedule | Result |
|---|---|---|
| Potato near Okara | every 8 days | **saves about 6,750 m³ and Rs 21,800**; 9 irrigations instead of 15 |
| Wheat near Peshawar | every 25 days | **saves about 2,530 m³ and Rs 8,170**; 3 irrigations instead of 5 in a wet winter |
| Wheat at the Khushab pilot | every 25 days | **about the same water**, 19 fewer stress days, 38 mm less drained away |
| Gram near Botala, sugarcane near Rahim Yar Khan | 45 and 14 days | the model wants **more** water than the habit gives — shown as a reason to watch the crop, with the caveat that a shallow water table may be supplying the rest |

Scaled to 1,000 acres, the potato case is about 1.35 million m³, 125 MWh and 56 t CO₂ in one season. The app does this arithmetic for any area and labels it a planning estimate.

The point is not that the model always says "less". It says what the soil needs, and is plain about where it may be wrong.

## Built for the field

- Any village: search finds chak numbers and small settlements; checked from Khushab to Sanghar, Larkana, Sahiwal, Multan and Peshawar.
- Farmer view on phones: the advice and the calendar, nothing else.
- Urdu and English, a listen button, WhatsApp sharing.
- "I irrigated today" — the start of the irrigation log that will calibrate each field.
- Installable; the last advice stays readable with no signal.
- Slow or failed data services time out and fall back.

## Three-minute demo

1. Open the page. Tap an example chip — say **Potato · Okara**: "Wait — irrigate in 6 days", and the 💧 on the calendar.
2. Tap **Sugarcane · Rahim Yar Khan**: "Irrigate now — 3.3 inches, 16.5 hours". Press **listen**, then **Send on WhatsApp**.
3. Open full details. Satellite check: NDVI and how it was used, surface temperature against the neighbours, SMAP against the model, GRACE's −25 cm. Switch the map to land surface temperature, then GRACE.
4. Season comparison and the impact card; change the acres.
5. Search your own village, or tap its name on the map.

## Next

- Field polygons and Sentinel-2 at 10 m, so the pixel is the field.
- A daily re-run per registered field, with an Urdu message when action is needed.
- A shallow-water-table term for canal areas.
- Calibration of crop and soil parameters from logged irrigations.
