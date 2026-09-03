# AgeTogether Database

This folder contains the PostgreSQL and PostGIS database scripts for the AgeTogether project.

## Requirements

- PostgreSQL 17
- PostGIS 3.6
- The database name is `agetogether_db`

## Files

- `schema.sql` creates the tables, indexes and view.
- `load_data.sql` loads the processed CSV data.
- `validation.sql` checks the loaded data.
- `queries.sql` contains example database queries.

## Run the scripts

Open PowerShell in the project folder and run the scripts in this order.

```powershell
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -d agetogether_db -f database/schema.sql
```

```powershell
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -d agetogether_db -f database/load_data.sql
```

```powershell
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -d agetogether_db -f database/validation.sql
```

```powershell
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -d agetogether_db -f database/queries.sql
```

## Current results

The database contains:

- 242 places in total
- 115 Tier 1 discovery places
- 84 Tier 2 supporting or access places
- 43 Tier 3 places
- 1 recorded data source

The spatial data uses SRID 4326. PostGIS is used for distance and nearby-place queries.

## Data note

The place data comes from the City of Melbourne dataset. These records describe locations, but they do not confirm that a live activity is currently available.