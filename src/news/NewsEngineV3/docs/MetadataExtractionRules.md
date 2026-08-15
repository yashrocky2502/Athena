# ATHENA NEWS ENGINE V3 — METADATA EXTRACTION RULES

## Metadata Fields

| Field | Source / Extraction Logic | Fallback Value |
| :--- | :--- | :--- |
| `publisher` | Raw input field or header | `'FINANCIAL_NEWS'` |
| `publisherId` | Raw input `V3PublisherId` | `'MONEYCONTROL'` |
| `title` | Cleaned title field | Non-empty string |
| `author` | Byline extraction (`By Reuters`, `ET Bureau`, `FE Bureau`) | `undefined` |
| `publishedAt` | `DateNormalizer` ISO string | Current UTC timestamp |
| `displayDate` | Original display timestamp string | Formatted UTC string |
| `canonicalUrl` | `CanonicalUrlResolver` output | `https://news.example.com` |
| `category` | Header section or categorizer | `'Markets'` |
| `language` | `LanguageDetector` result | `'en'` |
