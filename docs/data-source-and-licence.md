# Data Source and Licence

## Source and provenance

- **Dataset:** City of Melbourne — *Landmarks and places of interest, including schools, theatres, health services, sports facilities, places of worship, galleries and museums*
- **Provider:** City of Melbourne Open Data
- **Dataset identifier:** `landmarks-and-places-of-interest-including-schools-theatres-health-services-spor`
- **Official dataset source:** [City of Melbourne Open Data dataset page](https://data.melbourne.vic.gov.au/explore/dataset/landmarks-and-places-of-interest-including-schools-theatres-health-services-spor/information/)
- **Licence:** CC BY
- **Source creation date:** 30 April 2014
- **Source modified date:** 12 March 2021
- **Last data processing date:** 13 November 2022
- **Local acquisition date:** 1 September 2026

Attribution: City of Melbourne Open Data, *Landmarks and places of interest, including schools, theatres, health services, sports facilities, places of worship, galleries and museums*.

## Repository reproducibility

`data/raw/` contains an unchanged local copy of the CC BY City of Melbourne source dataset. It is included so that the Iteration 1 notebook can reproduce the original data understanding, cleaning, and validation steps after a teammate clones the repository. Attribution remains required under the CC BY licence. The datasets in `data/processed/` are derived from this raw source.

## AgeTogether Iteration 1 use

The original local dataset contains 242 records. The Iteration 1 data pipeline validates the data, prepares coordinates, applies a transparent product-relevance classification, and produces 115 Tier 1 Discovery Places for local discovery. The processed files are prepared for frontend integration.

## Important limitations

The dataset represents places of interest, not confirmed live activities. It does not confirm:

- event dates or times;
- prices;
- bookings;
- opening hours;
- accessibility;
- live availability; or
- suitability for older adults.

AgeTogether must not present any of these attributes as confirmed facts unless they are supported by another validated source. The original coordinates were supplied in one text field and were prepared as numeric latitude and longitude fields for analysis. Repeated Feature Names were reviewed and must not automatically be treated as duplicate places because they can have different coordinates.
