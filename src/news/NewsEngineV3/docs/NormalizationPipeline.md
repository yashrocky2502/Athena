# ATHENA NEWS ENGINE V3 — NORMALIZATION PIPELINE

## 24-Step Execution Sequence

1. **Raw Article Input**: Accepts raw HTML string, title, publisher metadata, and source URL.
2. **HTML Tag Stripping**: Removes `<script>`, `<style>`, `<iframe>`, `<svg>`, `<noscript>`, tracking pixels.
3. **Block Element Boundary Preservation**: Converts `<p>`, `<div>`, `<br>`, `<h1>`-`<h6>` tags into newline breaks.
4. **HTML Entity Decoding**: Decodes `&amp;`, `&quot;`, `&#39;`, `&nbsp;`, `&#8377;` (₹).
5. **NFC Unicode Normalization**: Applies standard NFC unicode normalization.
6. **Quote Standardisation**: Converts `“`, `”`, `‘`, `’` into standard `"` and `'`.
7. **Dash Standardisation**: Normalizes em-dashes (`—`) and en-dashes (`–`) to hyphens (`-`).
8. **Control Character Removal**: Strips zero-width characters and control codes.
9. **Boilerplate Line Removal**: Filters copyright lines, disclaimers, and subscription links.
10. **Noise Phrase Removal**: Removes "Read More", "Live Updates", "Should You Buy" links.
11. **Ad Container Removal**: Strips inline advertisement text and sponsored callouts.
12. **Social & Navigation Removal**: Removes breadcrumbs and social media share widgets.
13. **Whitespace Collapsing**: Collapses multiple spaces and normalizes line breaks.
14. **Paragraph Building**: Splits text on double newlines and builds indexed paragraph structures with hashes.
15. **Financial Token Protection**: Masks `Rs.`, `Co. Ltd.`, `Q1 FY27`, `5.4%` from false sentence splits.
16. **Sentence Segmentation**: Tokenizes paragraphs into sentence objects with paragraph indices and global indices.
17. **Metadata Extraction**: Normalizes publisher, author byline, category, and tags.
18. **Company & Ticker Detection**: Matches companies to BSE/NSE tickers, exchanges, and sectors.
19. **Date Normalization**: Converts dates into ISO-8601 strings, adjusting for IST time offset.
20. **Currency Metric Normalization**: Extracts INR/USD financial metrics into Crores & Millions.
21. **Language Detection**: Identifies language code (`en`, `hi`, `gu`).
22. **Canonical URL Resolution**: Resolves source URL and strips `utm_*`, `gclid`, `fbclid` tracking params.
23. **Document Hash Generation**: Computes raw hash, normalized document hash, paragraph hashes, and sentence hashes.
24. **Quality Gate Validation**: Verifies sentence count (>=2), paragraph count (>=1), missing fields, and noise ratio.
