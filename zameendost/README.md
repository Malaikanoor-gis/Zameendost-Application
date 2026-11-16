# ZameenDost — زمین دوست

Free irrigation advice for any field in Pakistan, from NASA satellites and weather. Piloted in Khushab.
Tells a farmer **when to irrigate, when to wait, how much water to apply and how many tubewell hours that is**,
and what a soil-water-based schedule changes in water, electricity, diesel and rupees — in English and Urdu.

Built for the NASA Space Apps Challenge 2026. No backend, no account, no API key: everything runs in the browser.

## What is in this folder

| File | Purpose |
|---|---|
| `engine.js` | The science, as pure functions with no UI: FAO-56 crop coefficients for 10 crops, Penman-Monteith ET₀, root-zone water balance, rain-aware advice and forward plan, season comparison, pump energy and cost, decoding of NASA GIBS pixels. Agri and RS teams validate this file. |
| `index.html` | The app. Location picker, NASA POWER weather, satellite pixels decoded from NASA GIBS, Open-Meteo forecast; advice, 14-day calendar, soil-water chart, satellite cross-checks, map, season comparison, district impact. |
| `test.js` | 42 checks against published numbers and expected behaviour. `node test.js` |
| `sw.js`, `manifest.json`, `icon*.png`, `icon.svg` | Installable, offline-capable app shell. |
| `PITCH.md` | Judge-facing summary, NASA data table, demo script. |
| `PUBLISH.md`, `publish.bat` | How to put the app online with GitHub Pages, and a one-command script that does the uploading. |

Run locally: `python -m http.server 8787` in this folder, then open http://localhost:8787/.

**When you change `engine.js`,** bump the `?v=` number on its `<script>` tag in `index.html`, so no browser pairs a new page with an old engine from its cache.

## NASA data in the product

| NASA dataset | Used for | How |
|---|---|---|
| **NASA POWER** (MERRA-2 meteorology + CERES SYN1deg solar) | Daily Tmax, Tmin, humidity, wind, solar radiation and rain for every day since the last irrigation, and for the whole of last season | `power.larc.nasa.gov` daily point API, no key. ET₀ is computed **in the browser** with FAO-56 Penman-Monteith (`ZD.et0PM`, checked against FAO-56 Example 17). |
| **MODIS Terra NDVI 8-day** (250 m), with **VIIRS NOAA-20 NDVI 8-day** as the switchable successor since Terra is at end of life | **Satellite-informed crop coefficient.** The field's pixel is decoded to NDVI and converted to Kc (Kamble et al. 2013). It may adjust the FAO value by up to ±20 %; if it is far outside that (a village centre, bare land, another crop in the pixel) the FAO value is kept and the app says so. Also the greenness map. | WMTS tile → canvas → pixel colour matched against NASA's colormap XML. CORS-open, no login. |
| **MODIS Terra land surface temperature, day** (1 km) | Thermal water-stress flag: the field's cell against the mean of the 5 × 5 km around it (+1.5 °C → "may be short of water") | same decoding; walks back up to 7 days past cloud |
| **SMAP L4 root-zone soil moisture** (9 km) | Independent check of the model: m³/m³ → % of available water for the chosen soil, compared with the modelled root zone | same decoding; ~4-day latency |
| **GRACE / GRACE-FO water storage** (≈300 km mascons) | Why it matters here: change in total stored water between July 2003–05 and July 2020–22. About −25 cm around Khushab, −21 cm around Multan and Faisalabad, −44 cm around Lahore, near zero around Peshawar and Quetta. | same decoding at six fixed dates; GIBS holds this layer to July 2022 |
| **SMAP L3 surface soil moisture, GPM IMERG precipitation rate** | Map layers for the regional picture | GIBS WMTS |

Open-Meteo supplies what NASA cannot — the 16-day forecast — and fills the last few days POWER has not yet processed. The app shows the ET₀ agreement between NASA POWER and Open-Meteo on shared days as a live check (within about ±15 % at the points tried); the two come from independent model families.

Decoding a pixel is exact to one colormap bin (NDVI ±0.005, LST ±0.3 K, SMAP ±0.0015 m³/m³, GRACE ±0.125 cm). The real uncertainty is pixel size: all of these pixels are larger than a field. That is why NDVI is only allowed to nudge Kc, and temperature, SMAP and GRACE are shown as cross-checks rather than fed into the water balance. The next step for precision is Sentinel-2 at 10 m, which needs a backend.

## How the advice is calculated

1. **Reference evapotranspiration ET₀** (mm/day) for the field: past days from NASA POWER through FAO-56 Penman-Monteith (fallback: Open-Meteo's ERA5 archive), the next 16 days from the Open-Meteo forecast.
2. **Crop coefficient Kc** by growth stage from the FAO-56 tables, adjusted within ±20 % by satellite NDVI after the initial stage (see above). A field-level NDVI typed in by the RS team is used as it is.
3. **Crop water use ETc = Kc × ET₀.**
4. **Root-zone water balance**, every day since the last irrigation:
   `depletion today = depletion yesterday + ETc − effective rain − irrigation`
   Roots deepen through the season, so the store (TAW = soil water-holding × root depth) grows.
5. **Trigger.** Irrigate when depletion reaches the smaller of RAW (readily available water, p × TAW, p from FAO-56) and what one application can usefully store (flood ≈ 50 mm net ≈ 3 inches applied). Gross = net ÷ field efficiency (flood 60 %, furrow 70 %, sprinkler 75 %, drip 90 %).
6. **Rain-aware hold.** If an irrigation is due but rain is forecast within two days, the app advises waiting **only when** irrigating first would leave no room in the soil for that rain (so it would drain away) **and** the crop can reach the rain without stress. The saving it reports is the rain kept in the root zone, not a whole irrigation. A badly overdue field has room for both, so it is told to irrigate now.
7. **Forward plan.** From today's soil state, the same rules are run to the end of the forecast; the result is the 14-day calendar (💧 irrigate, ☔ rain, ⏳ waiting for rain).
8. **No irrigation in the last 10 days before harvest.**
9. **Season comparison.** The balance is run over *last season's actual weather* twice — the farmer's usual calendar and the soil-water trigger — and converted to m³, pumping hours, kWh or litres and rupees from the farmer's pump discharge, lift and tariff. "Your usual schedule" starts at a typical figure for the crop (wheat every 25 days, cotton and cane every 14, potato every 8, gram every 45…) and the farmer can change it.

**The result is reported as it comes out.** Against an over-watering habit the app says "saves X m³". Within ±15 % it says "about the same water, but applied when the crop needs it", with the stress days and drainage avoided. When the model wants more water than the farmer gives, it says so and adds that the crop may be drawing on a shallow water table or tolerating shortage — a reason to look at the crop, not an instruction to pump more.

Every number is in `engine.js` with its FAO-56 reference, so it can be argued with.

## Coverage: any field in Pakistan

Weather, satellite pixels and elevation are fetched for whatever point the farmer chooses.

| How the field is chosen | Service | Notes |
|---|---|---|
| Type a village, chak or town | GeoNames via Open-Meteo geocoding **plus** OpenStreetMap places via Photon | Merged and de-duplicated. Finds villages one source lacks (Botala) and chak numbers ("Chak 106 NB, Sargodha District"). Roman spelling; Urdu-script queries are not reliable yet. |
| 📍 GPS | Browser geolocation | For a farmer standing in the field. Needs HTTPS (or `localhost`). |
| Tap the map or drag the pin | Leaflet | The point is named from the nearest OSM village (Photon) and the district and province (BigDataCloud), e.g. "near Sinjhoro, Sanghar District, Sindh". Coordinates are rounded to ~100 m before being sent. |
| Tap a village name on the map | Photon "places near this point" | Names are drawn over the satellite image and are tappable. |
| Tap an example | — | Four fields whose crops are in season today, on farmland near Okara, Botala, Rahim Yar Khan, Peshawar and others. |

**Basemap:** Esri World Imagery with village names drawn by the app from OpenStreetMap data, switchable to OpenStreetMap France's humanitarian street map. Rejected after testing: the public OpenStreetMap tile server (blocks apps), CARTO (watermarks unregistered use), Esri's label layer (no small Pakistani villages), Overpass (overloaded). For a public launch with real traffic, move the basemap to a keyed provider.

**Crops:** wheat, rice (paddy), cotton, sugarcane, maize, gram, mustard/canola, sunflower, potato, groundnut. Default sowing dates follow the zone — south (lat < 28.5°), central, north (lat ≥ 33.3°) — e.g. cotton 15 April in Sindh, 10 May in Punjab, and are never changed once the farmer has set a date.

**Soil:** chosen by the farmer with an Urdu "feel test" guide. Automatic lookup from SoilGrids was tried and dropped: the service did not answer.

**Slow connections:** every request times out (NASA POWER after 15 s, falling back to Open-Meteo), what is on screen is dimmed while a new answer loads, and a newer request cancels an older one.

## Farmer-facing features

- **Farmer view** (the default on phones): the advice and the 14-day calendar, nothing else. One button opens the full satellite evidence.
- Advice in **Urdu and English**, with inches of water and hours of tubewell, and a **listen** button.
- **Send on WhatsApp**: the advice written out in both languages with a link back to the field.
- **"I irrigated today"** resets the balance — the start of an irrigation log.
- **Share link** carries the whole field setup, so an extension officer can set it up once and send it.
- **Installable**, and the last advice stays readable with no signal.

## Known limits

- All satellite pixels are larger than a field; see above for how each is used.
- No allowance for water drawn from a shallow water table. For deep-rooted crops in canal areas (sugarcane especially) the model's need is likely too high; the app says so.
- NASA POWER's reanalysis does not see the cooling effect of irrigation, so ET₀ in irrigated desert margins may run high.
- Crop parameters, the per-zone sowing dates and the per-crop "usual schedule" defaults are from FAO-56 and general extension guidance, not yet calibrated to Pakistani trials.
- Not verified in this build environment: the GPS button and offline mode (the test browser allowed neither).

## What must be validated before farmers rely on it

| Check | Who | How |
|---|---|---|
| Crop stages, Kc, sowing windows, usual schedules | Agri research | Compare with PARC, AARI Faisalabad and provincial recommendations; adjust `CROPS` and `USUAL` in `engine.js`. |
| Soil water-holding for Thal sands vs canal-irrigated loams | GIS + agri | Soil samples for the pilot fields; map field → soil class. |
| ET₀ against a station | RS / dev | Compare NASA POWER and Open-Meteo with a PMD station for the same days. |
| Does the trigger match real soil moisture? | Field team | 3–5 pilot fields, gravimetric sampling or a tensiometer at 30 cm, logged irrigation dates. Does the app say "now" within ±2 days of the soil reaching the limit? |
| Does following the advice change yield? | Field team | Paired plots, farmer's schedule against the app's, same variety, one rabi season. |
| Pump arithmetic | Dev | Check pump hours against a real electricity bill or diesel receipts for one irrigation. |

Until then, present the app as *a second opinion — look at your crop too*, which is what its footer says.

## Roadmap

- **Field polygons and Sentinel-2 at 10 m**, so the pixel is the field (needs a small backend).
- **Daily re-run per registered field**, with an Urdu SMS or WhatsApp message when action is needed.
- **Irrigation log per field**, then calibrate Kc and soil from the log and NDVI history.
- **Shallow water table** term for canal-command areas.
- **Canal warabandi**: whether to take or skip the next turn.

## Team split

- **Agri research:** `CROPS`, `SOILS`, `METHODS`, `USUAL`, the depletion fraction, the validation protocol.
- **Remote sensing:** NDVI→Kc at field scale, cloud masking, MOD16 / ECOSTRESS comparison.
- **GIS:** field polygons, soil map, tubewell depth map (pumping head drives the electricity estimate).
- **Development:** this app, then the messaging service and the field database.

## Sources

- FAO Irrigation & Drainage Paper 56: https://www.fao.org/3/x0490e/x0490e00.htm
- NASA POWER: https://power.larc.nasa.gov/ · NASA GIBS: https://www.earthdata.nasa.gov/engage/open-data-services-software/earthdata-developer-portal/gibs-api
- Open-Meteo: https://open-meteo.com/ · Photon: https://photon.komoot.io/ · BigDataCloud reverse geocoding
- Kamble, Kilic & Hubbard (2013), *Estimating crop coefficients using remote sensing-based vegetation index*, Remote Sensing 5(4).
