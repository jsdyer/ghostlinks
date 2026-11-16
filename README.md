# Ghost Links

[Ghost Links](https://coolcode.ca/ghostlinks/) follows historical Canadian government web addresses through Internet Archive capture metadata, dated redirect observations, and links to current publishers. Search the research files, investigate another public URL, or open the [Open Data Graveyard](https://coolcode.ca/opendatagraveyard/) for leads from Canada's catalogue of removed datasets.

## Research a URL

Enter a public address to get a Wayback calendar link and shortcuts to other archives. **Ask Wayback** requests a single indexed capture near an optional date from the public [Wayback availability API](https://archive.org/help/wayback_api.php). A capture's timestamp and status are index records. Full archive calendars, original URLs and public successor pages stay linked when the lookup times out or reports no matches.

To inspect multiple observations without sending the file anywhere, import the JSON array output of [Wayback CDX](https://github.com/internetarchive/wayback/blob/master/wayback-cdx-server/README.md) with the timestamp and original columns, or use newline-delimited JSON from a [Common Crawl index](https://index.commoncrawl.org/). The browser reads up to 5 MiB and 10,000 input rows per file. If you have entered a research address, the timeline shows rows matching the hostname, path, and query string, with HTTP/HTTPS and the optional `www` prefix treated as equivalents.

Use `#case=industry` to link to a curated record. Other apps can use `#url=` plus the percent-encoded original URL. That fills the research field and builds links locally. The site contacts the Internet Archive when the visitor selects **Ask Wayback** or opens a source link.

## Update the research files

`web/cases.json` keeps the verified curation date, original addresses, official successor links, dated Wayback observations and an HTTPS probe for each research file. To refresh a record, query `https://archive.org/wayback/available` with the original URL and a target date in `YYYYMMDD` format. Save the request URL and exact indexed timestamps, and record observed redirect status/location pairs separately from the archive observations. An HTTP error during a probe can come from an intermediary. Missing captures indicate gaps in the evidence. The project distributes capture metadata and links while the archive serves the pages.

[Library and Archives Canada](https://www.canada.ca/en/library-archives/services/government/web-social-media-preservation-program/search-web-archive.html) maintains a separate web archive where more Canadian material may be discoverable.

## Build and serve locally

Python 3 validates the evidence and copies the static site to `dist/`. The build uses the checked-in snapshot and runs offline.

```sh
python3 scripts/build.py
node --test tests/model.test.mjs
python3 -m http.server 8000 -d dist
```

GitHub Actions deploys the build artifact to GitHub Pages. The app's stylesheet, scripts, and data use relative paths so the same build works in the project subdirectory.
