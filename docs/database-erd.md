# Database ER Diagram

The database uses three main tables. The processed CSV is loaded into `places_staging` first. The checked data is then moved into `places`.

```mermaid
erDiagram
    DATA_SOURCES ||--o{ PLACES : provides

    DATA_SOURCES {
        BIGINT source_id PK
        TEXT dataset_name
        TEXT dataset_identifier UK
        TEXT provider
        TEXT official_url
        TEXT licence
        DATE local_acquisition_date
    }

    PLACES_STAGING {
        TEXT feature_name
        TEXT theme
        TEXT sub_theme
        DOUBLE latitude
        DOUBLE longitude
        TEXT relevance_tier
        TEXT relevance_reason
    }

    PLACES {
        BIGINT place_id PK
        TEXT feature_name
        TEXT theme
        TEXT sub_theme
        DOUBLE latitude
        DOUBLE longitude
        TEXT relevance_tier
        TEXT relevance_reason
        BIGINT source_id FK
        GEOGRAPHY geom
        TIMESTAMPTZ loaded_at
    }
```

## Table purpose

- `data_sources` records where the data came from.
- `places_staging` temporarily stores the processed CSV rows.
- `places` stores the checked place records and PostGIS points.
- `discovery_places` is a view containing only Tier 1 places.

One data source can provide many place records. Each place record belongs to one data source.