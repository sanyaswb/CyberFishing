import { MAP_DB as locationDatabase } from "../raw/locations/location_database.js";
import { WEATHER as TEST_WEATHER } from "../raw/locations/weather/test.js";
import { ZONES as TEST_ZONES } from "../raw/locations/zones/test.js";

// Spec 130 / spec 175: each location's zones (`npm run apply:zones`) and weather (`npm run apply:weather`) live in
// data-only modules; the catalog joins them to the authored locations, keeping the raw database's identity like ITEM_DB.
const LOCATION_ZONES = Object.freeze({ test: TEST_ZONES });
const LOCATION_WEATHER = Object.freeze({ test: TEST_WEATHER });

for (const [locationId, zones] of Object.entries(LOCATION_ZONES)) locationDatabase[locationId].zones = zones;
for (const [locationId, weather] of Object.entries(LOCATION_WEATHER)) locationDatabase[locationId].weather = weather;

export const MAP_DB = locationDatabase;
