import { MAP_DB as locationDatabase } from "../raw/locations/location_database.js";
import { ZONES as TEST_ZONES } from "../raw/locations/zones/test.js";

// Spec 130: each location's zones are a data-only module (`npm run apply:zones` rewrites it); the catalog joins them
// to the authored locations, keeping the raw database's identity like ITEM_DB.
const LOCATION_ZONES = Object.freeze({ test: TEST_ZONES });

for (const [locationId, zones] of Object.entries(LOCATION_ZONES)) locationDatabase[locationId].zones = zones;

export const MAP_DB = locationDatabase;
