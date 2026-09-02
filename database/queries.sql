\pset pager off

-- Use a point in Melbourne CBD as the example location.
-- ST_MakePoint uses longitude first, then latitude.
WITH user_location AS (
    SELECT ST_SetSRID(
        ST_MakePoint(144.9631, -37.8136),
        4326
    )::GEOGRAPHY AS geom
)
SELECT
    p.feature_name,
    p.theme,
    p.sub_theme,
    ROUND(
        (ST_Distance(p.geom, u.geom) / 1000)::NUMERIC,
        2
    ) AS distance_km
FROM discovery_places AS p
CROSS JOIN user_location AS u
ORDER BY ST_Distance(p.geom, u.geom)
LIMIT 10;


-- Find discovery places within two kilometres.
WITH user_location AS (
    SELECT ST_SetSRID(
        ST_MakePoint(144.9631, -37.8136),
        4326
    )::GEOGRAPHY AS geom
)
SELECT
    p.feature_name,
    p.theme,
    p.sub_theme
FROM discovery_places AS p
CROSS JOIN user_location AS u
WHERE ST_DWithin(p.geom, u.geom, 2000)
ORDER BY p.feature_name;


-- Count the discovery places in each theme.
SELECT
    theme,
    COUNT(*) AS place_count
FROM discovery_places
GROUP BY theme
ORDER BY place_count DESC, theme;