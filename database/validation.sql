-- Check the main database results.
SELECT
    'Total places' AS check_name,
    COUNT(*)::TEXT AS actual_result,
    '242' AS expected_result
FROM places

UNION ALL

SELECT
    'Tier 1 discovery places',
    COUNT(*)::TEXT,
    '115'
FROM discovery_places

UNION ALL

SELECT
    'Missing geometry',
    COUNT(*)::TEXT,
    '0'
FROM places
WHERE geom IS NULL

UNION ALL

SELECT
    'Invalid coordinates',
    COUNT(*)::TEXT,
    '0'
FROM places
WHERE latitude NOT BETWEEN -90 AND 90
   OR longitude NOT BETWEEN -180 AND 180

UNION ALL

SELECT
    'Incorrect SRID',
    COUNT(*)::TEXT,
    '0'
FROM places
WHERE ST_SRID(geom::GEOMETRY) <> 4326

UNION ALL

SELECT
    'Duplicate place and coordinate groups',
    COUNT(*)::TEXT,
    '0'
FROM (
    SELECT
        feature_name,
        latitude,
        longitude
    FROM places
    GROUP BY
        feature_name,
        latitude,
        longitude
    HAVING COUNT(*) > 1
) AS duplicate_groups

UNION ALL

SELECT
    'Data sources',
    COUNT(*)::TEXT,
    '1'
FROM data_sources;

-- Show the number of records in each relevance tier.
SELECT
    relevance_tier,
    COUNT(*) AS place_count
FROM places
GROUP BY relevance_tier
ORDER BY relevance_tier;