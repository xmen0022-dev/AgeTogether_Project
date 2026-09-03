# Database Data Dictionary

## data_sources

This table records the source and licence information.

| Column | Type | Description |
|---|---|---|
| source_id | BIGINT | Unique source ID |
| dataset_name | TEXT | Full dataset name |
| dataset_identifier | TEXT | Short unique dataset identifier |
| provider | TEXT | Organisation providing the data |
| official_url | TEXT | Official dataset page |
| licence | TEXT | Dataset licence |
| source_created_date | DATE | Date the source was created |
| source_modified_date | DATE | Date the source was modified |
| last_processing_date | DATE | Last processing date shown by the source |
| local_acquisition_date | DATE | Date the data was obtained for this project |
| notes | TEXT | Extra information about the dataset |

## places_staging

This table temporarily stores rows loaded from the processed CSV file.

| Column | Type | Description |
|---|---|---|
| feature_name | TEXT | Name of the place |
| theme | TEXT | Main place category |
| sub_theme | TEXT | More detailed category |
| latitude | DOUBLE PRECISION | Latitude from the CSV |
| longitude | DOUBLE PRECISION | Longitude from the CSV |
| relevance_tier | TEXT | Project relevance group |
| relevance_reason | TEXT | Reason for the relevance group |

## places

This is the main table used by the project.

| Column | Type | Description |
|---|---|---|
| place_id | BIGINT | Unique place ID |
| feature_name | TEXT | Name of the place |
| theme | TEXT | Main place category |
| sub_theme | TEXT | More detailed category |
| latitude | DOUBLE PRECISION | Latitude between -90 and 90 |
| longitude | DOUBLE PRECISION | Longitude between -180 and 180 |
| relevance_tier | TEXT | Tier 1, Tier 2, Tier 3 or Needs Review |
| relevance_reason | TEXT | Reason for the assigned tier |
| source_id | BIGINT | Links the place to `data_sources` |
| geom | GEOGRAPHY(POINT, 4326) | PostGIS location point |
| loaded_at | TIMESTAMPTZ | Time the row was loaded |

## discovery_places

`discovery_places` is a database view. It returns only records marked as `Tier 1 - Discovery Place`. The view also includes the data source and licence information.