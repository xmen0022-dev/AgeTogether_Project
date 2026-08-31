# AgeTogether Australia App

First-iteration static prototype for the AgeTogether Australia app.

## Local preview

```powershell
python -m http.server 8000 --bind 127.0.0.1
```

Then open http://127.0.0.1:8000/

## Iteration 1 Data Science

The Iteration 1 data pipeline uses City of Melbourne open data for local place discovery:

City of Melbourne open data → data validation and coordinate preparation → product-relevance classification → descriptive analysis → 115 Tier 1 discovery places → processed data prepared for frontend integration.

DS evidence and outputs:

- `notebooks/Iteration1_ds.ipynb`
- `data/processed/agetogether_places_classified.csv`
- `data/processed/agetogether_discovery_places.csv`
- `docs/data-source-and-licence.md`
