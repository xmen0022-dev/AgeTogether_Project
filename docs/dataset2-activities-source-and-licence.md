# Dataset 2: City Activities and Planned Works — Source and Licence

## Source and acquisition

- **Dataset name:** City Activities and Planned Works
- **Provider:** City of Melbourne Open Data, published through DataVic
- **Official dataset URL:** https://discover.data.vic.gov.au/dataset/city-activities-and-planned-works
- **Official resource URL:** https://discover.data.vic.gov.au/en_AU/dataset/city-activities-and-planned-works/resource/f3e6a6af-a0b7-4c0e-a7f8-1de0fdb183e2
- **Resource download URL used:** https://discover.data.vic.gov.au/datastore/dump/f3e6a6af-a0b7-4c0e-a7f8-1de0fdb183e2
- **Licence:** Creative Commons Attribution 4.0 International (CC BY 4.0)
- **Local acquisition date:** 3 September 2026
- **Official data last updated:** 8 February 2024 (DataVic resource metadata)
- **Official metadata last updated:** 13 June 2024
- **Update frequency:** Not available from the source; the dataset metadata lists it as Unknown

The unchanged local raw copy is stored at:

`data/raw/city_activities_and_planned_works.csv`

Its SHA-256 checksum is:

`40f5febb3a39356119c1ae3d012185913f8847f1d06f4081a671bb1a82e93c88`

The checksum is a file-integrity value. It allows a future reviewer to check that the repository raw file has not changed since acquisition.

## Purpose in AgeTogether

Dataset 2 is being evaluated as evidence for the AgeTogether Social → Activities feature. It contains permit-based activities across the City of Melbourne, including event bookings as well as operational city activities.

This dataset is not a pure public event catalogue. It must not be assumed that every record represents a public social activity, a currently occurring event, or an activity suitable for older adults.

## Licence and attribution

The source is published under CC BY 4.0. Reuse requires appropriate attribution to the City of Melbourne / City of Melbourne Open Data, consistent with the licence.

## Important limitations

- The records are derived from permits and include city works, traffic management, reserved parking and structures records as well as event-related records.
- `start_date` and `end_date` describe expected permit/activity ranges, not guaranteed actual event duration or live availability.
- Spatial geometry indicates a general activity area, not necessarily a precise venue entrance.
- The documented schema has no dedicated public event-title field or public event information URL.
- The source does not provide verified public access, organiser, price, booking availability, accessibility, suitability for older adults, or real-time availability.
- The DataVic resource metadata records data last updated in February 2024. Freshness is therefore a material limitation for a 2026 prototype.
- Missing source values must not be interpreted as negative values, and unavailable details must not be invented.

Any later relevance filtering must be transparent, preserve the raw source data and distinguish event-related permit evidence from confirmed public activities.

## Iteration 1 processing decision

For Iteration 1, the project uses a simple and auditable product-relevance rule based only on the source `classification` field:

| Source classification | Prototype relevance | Processing reason |
|---|---|---|
| `Event` | Included | Included because source classification is `Event`. |
| `Public Event` | Included | Included because source classification is `Public Event`. |
| `Private Event` | Excluded | Excluded because source classification is `Private Event`. |
| `Structures` | Excluded | Excluded because source classification is `Structures`. |
| `Traffic Management` | Excluded | Excluded because source classification is `Traffic Management`. |
| `Reserved Parking` | Excluded | Excluded because source classification is `Reserved Parking`. |

This rule produces 35 Included records (`Event`: 21; `Public Event`: 14) and 570 Excluded records. It preserves all 605 source records in the classified audit export.

Freshness is not an Iteration 1 exclusion rule. The project priority at this stage is relevant open data, real source records, transparent processing, traceable provenance and a usable prototype contribution. Expected date ranges remain source evidence, while the material freshness limitation is stated clearly.

## Prototype outputs

- `data/processed/agetogether_activity_records_classified.csv` contains all 605 records, source-derived latitude/longitude, source attribution and the transparent relevance fields.
- `data/processed/agetogether_activity_prototype.csv` contains only the 35 Included `Event` and `Public Event` records for the prototype activity data view.

The prototype export uses `classification` as a generic type label and `location` as a location label. It does not create or imply an event title. It is not a live public event catalogue.

## Later-iteration improvement plan

Later iterations should investigate a fresher, dedicated public-event source; automated refresh; reliable event title and description fields; official public-event URLs; booking information; and source-supported accessibility details. These changes are not part of the Iteration 1 Dataset 2 processing.
