# Dataset 3: SBS News RSS Snapshot — Source and Copyright Considerations

## Source and acquisition

- **Dataset purpose:** AgeTogether Social → Recent News prototype
- **Provider:** SBS News, Special Broadcasting Service Corporation
- **Feed type:** Official SBS News Australia RSS feed
- **Official RSS URL:** https://www.sbs.com.au/news/topic/australia/feed
- **SBS RSS feed directory:** https://www.sbs.com.au/news/article/feeds/nbv1rs3kw
- **Local acquisition date:** 3 September 2026
- **Raw snapshot:** `data/raw/sbs_news_feed_snapshot.xml`
- **SHA-256:** `5a4cf94543aca33dcbb38e74e8837672710fbc6626cad30d327aa7cc3dc6218b`

The raw XML file is an unchanged static snapshot of the official RSS feed. It is retained so that the Iteration 1 notebook can reproduce the same metadata processing and output files.

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
