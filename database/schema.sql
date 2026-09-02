BEGIN;

-- PostGIS is needed for location and distance queries.
CREATE EXTENSION IF NOT EXISTS postgis;

-- This table records where the dataset came from.
CREATE TABLE IF NOT EXISTS data_sources (
    source_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    dataset_name TEXT NOT NULL,
    dataset_identifier TEXT NOT NULL UNIQUE,
    provider TEXT NOT NULL,
    official_url TEXT NOT NULL,
    licence TEXT NOT NULL,
    source_created_date DATE,
    source_modified_date DATE,
    last_processing_date DATE,
    local_acquisition_date DATE,
    notes TEXT
);

-- The cleaned CSV is loaded into this table first.
CREATE TABLE IF NOT EXISTS places_staging (
    feature_name TEXT,
    theme TEXT,
    sub_theme TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    relevance_tier TEXT,
    relevance_reason TEXT
);

-- This is the main table for the place data.
CREATE TABLE IF NOT EXISTS places (
    place_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    feature_name TEXT NOT NULL,
    theme TEXT NOT NULL,
    sub_theme TEXT NOT NULL,

    -- These checks stop incorrect coordinates.
    latitude DOUBLE PRECISION NOT NULL
        CHECK (latitude BETWEEN -90 AND 90),
    longitude DOUBLE PRECISION NOT NULL
        CHECK (longitude BETWEEN -180 AND 180),

    relevance_tier TEXT NOT NULL
        CHECK (
            relevance_tier IN (
                'Tier 1 - Discovery Place',
                'Tier 2 - Supporting/Access Place',
                'Tier 3 - Not Relevant',
                'Needs Review'
            )
        ),

    relevance_reason TEXT NOT NULL,

    -- This connects each place to its data source.
    source_id BIGINT NOT NULL
        REFERENCES data_sources(source_id),

    -- The point is created from longitude and latitude.
    geom GEOGRAPHY(POINT, 4326)
        GENERATED ALWAYS AS (
            ST_SetSRID(
                ST_MakePoint(longitude, latitude),
                4326
            )::GEOGRAPHY
        ) STORED,

    loaded_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- The same place and coordinate should not be loaded twice.
    UNIQUE (feature_name, latitude, longitude)
);

-- This index makes nearby place searches faster.
CREATE INDEX IF NOT EXISTS idx_places_geom
    ON places USING GIST (geom);

-- These indexes help with filtering.
CREATE INDEX IF NOT EXISTS idx_places_relevance_tier
    ON places (relevance_tier);

CREATE INDEX IF NOT EXISTS idx_places_theme_sub_theme
    ON places (theme, sub_theme);

-- The app only needs Tier 1 places for the discovery page.
CREATE OR REPLACE VIEW discovery_places AS
SELECT
    p.place_id,
    p.feature_name,
    p.theme,
    p.sub_theme,
    p.latitude,
    p.longitude,
    p.geom,
    p.relevance_tier,
    p.relevance_reason,
    ds.dataset_name,
    ds.provider,
    ds.licence,
    ds.official_url
FROM places AS p
JOIN data_sources AS ds
    ON p.source_id = ds.source_id
WHERE p.relevance_tier = 'Tier 1 - Discovery Place';

COMMENT ON TABLE places IS
    'Place data prepared for the AgeTogether discovery page.';

COMMENT ON VIEW discovery_places IS
    'Tier 1 places only. They are not confirmed live activities.';

COMMIT;