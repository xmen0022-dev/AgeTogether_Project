-- Stop the script when one step has an error.
\set ON_ERROR_STOP on

-- Remove old rows from the staging table.
TRUNCATE TABLE places_staging;

-- Load the cleaned CSV made by the DS notebook.
\copy places_staging (feature_name, theme, sub_theme, latitude, longitude, relevance_tier, relevance_reason) FROM 'data/processed/agetogether_places_classified.csv' WITH (FORMAT CSV, HEADER TRUE, ENCODING 'UTF8')

BEGIN;

-- Record the source information used for this dataset.
INSERT INTO data_sources (
    dataset_name,
    dataset_identifier,
    provider,
    official_url,
    licence,
    source_created_date,
    source_modified_date,
    last_processing_date,
    local_acquisition_date,
    notes
)
VALUES (
    'Landmarks and places of interest, including schools, theatres, health services, sports facilities, places of worship, galleries and museums',
    'landmarks-and-places-of-interest-including-schools-theatres-health-services-spor',
    'City of Melbourne',
    'https://data.melbourne.vic.gov.au/explore/dataset/landmarks-and-places-of-interest-including-schools-theatres-health-services-spor/information/',
    'CC BY',
    DATE '2014-04-30',
    DATE '2021-03-12',
    DATE '2022-11-13',
    DATE '2026-09-01',
    'This dataset contains places and coordinates. It does not confirm live activities.'
)
ON CONFLICT (dataset_identifier)
DO UPDATE SET
    dataset_name = EXCLUDED.dataset_name,
    provider = EXCLUDED.provider,
    official_url = EXCLUDED.official_url,
    licence = EXCLUDED.licence,
    source_created_date = EXCLUDED.source_created_date,
    source_modified_date = EXCLUDED.source_modified_date,
    last_processing_date = EXCLUDED.last_processing_date,
    local_acquisition_date = EXCLUDED.local_acquisition_date,
    notes = EXCLUDED.notes;

-- Replace the main table with the current processed data.
TRUNCATE TABLE places RESTART IDENTITY;

INSERT INTO places (
    feature_name,
    theme,
    sub_theme,
    latitude,
    longitude,
    relevance_tier,
    relevance_reason,
    source_id
)
SELECT
    s.feature_name,
    s.theme,
    s.sub_theme,
    s.latitude,
    s.longitude,
    s.relevance_tier,
    s.relevance_reason,
    ds.source_id
FROM places_staging AS s
JOIN data_sources AS ds
    ON ds.dataset_identifier =
       'landmarks-and-places-of-interest-including-schools-theatres-health-services-spor';

COMMIT;