# Dataset 4: ABS 2021 Census demographic context — source and licence

## Source, product and geography

- **Provider:** Australian Bureau of Statistics (ABS)
- **Product:** 2021 Census General Community Profile
- **Geography type:** Local Government Area (LGA)
- **Geography:** Melbourne (LGA24600), City of Melbourne LGA
- **Census observation year:** 2021
- **Official profile URL:** https://www.abs.gov.au/census/find-census-data/community-profiles/2021/LGA24600
- **Official download URL:** https://www.abs.gov.au/census/find-census-data/community-profiles/2021/LGA24600/download/GCP_LGA24600.xlsx
- **ABS licence/copyright notice:** https://www.abs.gov.au/website-privacy-copyright-and-disclaimer
- **Local acquisition date:** 3 September 2026

The selected General Community Profile reports characteristics of persons, families and dwellings for the selected geography. It is based on **place of usual residence**, not the place where a person was counted on Census night.

The 2021 Census observation year and the 2026 local acquisition date are different. The local download date must not be interpreted as a 2026 Census update.

## Licence and attribution

ABS states that material on its website is provided under the **Creative Commons Attribution 4.0 International (CC BY 4.0)** licence unless an exclusion applies. The stated exclusions include the Commonwealth Coat of Arms, ABS logo, trade marks, microdata and third-party material; this Dataset 4 uses ABS aggregate Census Community Profile data, not unit-record microdata.

The required attribution for derived/transformed material is:

> Based on Australian Bureau of Statistics data

The ABS and source URL should be retained with any reuse. No ABS logo, Census branding or third-party material is reused as part of this project output.

## Raw source preservation

The unchanged local source workbook is stored at:

`data/raw/abs_2021_melbourne_lga24600_general_community_profile.xlsx`

SHA-256 checksum:

`c3ecc64c2675a7d10c25ea9f43d1fae2143e3231d26dd748db8d7f68ccb64b34`

The checksum is a file-integrity value: it allows a reviewer to verify that the stored raw workbook has not changed since local acquisition.

## Tables and variables used

The notebook deliberately selects four relevant tables only:

| Table | ABS table title | Variables used for AgeTogether context |
|---|---|---|
| G04 | Age by sex | Persons aged 65–74, 75–84 and 85 years and over; total persons |
| G18 | Core activity need for assistance by age by sex | Persons aged 65+ with a need for assistance and matching age-band totals |
| G23 | Voluntary work for an organisation or group by age by sex | Persons aged 65+ who volunteered and matching age-band totals |
| G27 | Relationship in household by age by sex | Persons aged 65+ in the Census `Lone person` category and matching occupied-private-dwelling totals |

## Processing and AgeTogether purpose

Processing is deliberately minimal and reproducible:

1. Load the unmodified ABS workbook using a repository-relative path.
2. Validate the raw checksum, selected table geography and Census year.
3. Select only aggregate older-population indicators used in the Iteration 1 analysis.
4. Check numeric parsing, missing values, duplicate logical records and negative/impossible values.
5. Produce `data/processed/agetogether_abs_2021_demographic_insights.csv`, a 10-record evidence output containing only the indicators used in the notebook.

Dataset 4 supports **target-audience understanding, problem-domain evidence and design insight**. It is not integrated into the frontend for Iteration 1, is not used for individual profiling, and is not used to generate personalised recommendations.

## Key limitations

- Census data describes aggregate population characteristics in 2021, not conditions in 2026.
- Melbourne LGA aggregate data does not describe individual AgeTogether users.
- Census statistics do not establish causal relationships.
- ABS makes small random adjustments to Census cells to protect confidentiality; related row/column sums can differ slightly from published totals.
- The `Lone person` category must not be interpreted as proof of loneliness or social isolation.
- Core activity need for assistance must not be interpreted as digital incapability.
- No demographic indicator can prove trust, product preference, accessibility needs or suitability for any individual.
- Later user research and usability/accessibility testing remain necessary.

## FIT5120 open-data contribution

The project has three clearly open/open-licensed datasets:

1. City of Melbourne Places / POI
2. City of Melbourne / DataVic Activities and Planned Works
3. ABS 2021 Census demographic data

Dataset 4 contributes demographic and design-context evidence rather than direct frontend records. SBS News RSS remains an additional structured external metadata source and is not counted here as open data.
