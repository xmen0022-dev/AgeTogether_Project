# Dataset 3: SBS News RSS Snapshot — Source and Copyright Considerations

## Source and acquisition

- **Dataset purpose:** AgeTogether Social → Recent News prototype
- **Provider:** SBS News, Special Broadcasting Service Corporation
- **Feed type:** Official SBS News Australia RSS feed
- **Official RSS URL:** https://www.sbs.com.au/news/topic/australia/feed
- **SBS RSS feed directory:** https://www.sbs.com.au/news/article/feeds/nbv1rs3kw
- **Original Iteration 1 acquisition date:** 3 September 2026
- **Latest local acquisition date:** 15 October 2026, 14:25 AEDT (03:25 UTC)
- **Latest acquisition HTTP status:** 200 (official feed)
- **Raw snapshot:** `data/raw/sbs_news_feed_snapshot.xml`
- **Latest raw SHA-256:** `ccce3a87933e27d91fa196a3da311daa7d8410222d8c6b5e1bb9cbea77ba7ded`
- **Archived Iteration 1 snapshot:** `data/raw/sbs_news_feed_snapshot_2026-09-03.xml` (SHA-256: `5a4cf94543aca33dcbb38e74e8837672710fbc6626cad30d327aa7cc3dc6218b`)
- **Archived 12 October 2026 snapshot:** `data/raw/sbs_news_feed_snapshot_2026-10-12.xml` (SHA-256: `b97754f191577441d0b7bc50506ef5cd3d2616e1b9b8a265450a223e4c0d02e6`)

The current raw XML file is an unchanged static snapshot of the official RSS feed. The September Iteration 1 snapshot and the 12 October 2026 refresh snapshot are retained separately so that historical evidence remains recoverable. The notebook uses the current snapshot and can reproduce the current metadata processing and output files.

The 15 October 2026 refresh returned HTTP 200 from the official feed URL and contains 25 RSS items. All 25 publication dates parsed successfully; the publication-date range is 10 October 2026 19:44 UTC to 14 October 2026 18:39 UTC. The refresh produced 25 cleaned/classified records and 23 Included prototype records. There were no exact duplicate records, duplicate titles or duplicate article URLs. The same CSV was successfully validated against the local `GET /api/news` endpoint in an isolated test worktree; because the API maintains an in-memory CSV cache, a server restart is required after a CSV replacement.

## Static RSS approach

RSS is a machine-readable feed format. Iteration 1 intentionally uses one static snapshot; it does not implement real-time delivery, automated refresh or article-webpage scraping.

Only feed metadata is processed: title, publication date, original article URL, source, category, GUID and RSS-provided summary. Full article bodies are not retrieved or reproduced. The prototype should direct users to the original SBS `article_url` to read the source article.

## Copyright and reuse considerations

This RSS feed is an official SBS source, but it is not documented here as Creative Commons or open-data licensed material. SBS states that its material is copyright protected and that rights not expressly granted are reserved. See:

- https://www.sbs.com.au/aboutus/terms-and-conditions/
- https://www.sbs.com.au/aboutus/copyright/

For this reason, Dataset 3 is metadata-only, attributed to SBS News and linked back to the original article. It must not be treated as permission to reproduce full articles, images, video or other SBS content. Any broader publication or reuse requires checking SBS terms or obtaining permission.

## Iteration 1 relevance processing

The classified export retains every cleaned RSS item. The prototype export includes records matching either:

1. AgeTogether-relevant terms in the RSS title or summary: older people, older Australians, seniors, ageing/aging, community, social isolation, loneliness, scams, online safety, online, digital, health, wellbeing, transport, Victoria, Melbourne, vaccine or COVID; or
2. An official RSS category of `Australia`, `Health`, `Life` or `COVID-19`.

The second category rule is a documented broadening rule. It was added because the title/summary keyword rule alone produced too few records for a useful Iteration 1 Recent News prototype. Inclusion is not a popularity measure, personalised recommendation, verification of relevance for every older adult or a claim that an article is currently the most important news.

## Outputs

- `data/processed/agetogether_news_records_classified.csv` contains every cleaned RSS metadata record plus the transparent relevance fields.
- `data/processed/agetogether_news_prototype.csv` contains Included metadata records only.

## Iteration 1 limitations and later improvements

- The data is a static snapshot and becomes stale after acquisition.
- The feed has limited metadata and does not provide personal relevance, reader preferences or verified accessibility information.
- RSS categories are publisher-provided topics and not AgeTogether suitability labels.
- Copyright limits how SBS content can be reused.

Later iterations could evaluate authorised automated feed refresh, additional official feeds, more precise topic filtering, user-controlled topic preferences and a review of permitted metadata display under applicable SBS terms.
