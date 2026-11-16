import assert from "node:assert/strict";
import test from "node:test";
import { addressKey, availableURL, normalizeAddress, parseIndex, replayURL, validStamp } from "../web/model.mjs";

test("normalizes public URLs and encodes query text for the availability lookup", () => {
  const address = normalizeAddress("example.ca/old?name=a%20b&year=2002#section");
  assert.equal(address, "https://example.ca/old?name=a%20b&year=2002");
  const lookup = new URL(availableURL(address, "2002-06-01"));
  assert.equal(lookup.searchParams.get("url"), address);
  assert.equal(lookup.searchParams.get("timestamp"), "20020601");
  for (const unsafe of ["file:///etc/passwd", "http://user@example.ca", "javascript:alert(1)", "localhost", "server.internal"]) {
    assert.throws(() => normalizeAddress(unsafe));
  }
});

test("matches original addresses across protocol and www variants only", () => {
  assert.equal(addressKey("http://www.example.ca/old?k=1"), addressKey("https://example.ca/old?k=1"));
  assert.notEqual(addressKey("https://example.ca/old?k=1"), addressKey("https://example.ca/old?k=2"));
  assert.notEqual(addressKey("https://example.ca/old"), addressKey("https://example.ca:8080/old"));
});

test("accepts a dated replay from the real Wayback host", () => {
  const stamp = "20040229020304";
  assert.equal(validStamp(stamp), true);
  assert.equal(validStamp("20030229020304"), false);
  assert.equal(replayURL("http://web.archive.org/web/20040229020304/http://example.ca/",stamp),
    "https://web.archive.org/web/20040229020304/http://example.ca/");
  assert.equal(replayURL("https://web.archive.org.bad.ca/web/20040229020304/http://example.ca/",stamp),"");
  assert.equal(replayURL("https://web.archive.org/web/20040228020304/http://example.ca/",stamp),"");
});

test("imports a CDX header and deduplicates in chronological order", () => {
  const latest = ["20050401020304","http://example.ca/","301","text/html"];
  const older = ["20040229020304","http://example.ca/","200","text/html"];
  const results = parseIndex(JSON.stringify([["timestamp","original","statuscode","mimetype"], latest,older,older]));
  assert.deepEqual(results.map(item => item.date), [older[0],latest[0]]);
  assert.equal(results[0].format,"Wayback CDX");
  assert.equal(results[1].status,"301");
  assert.equal(results[0].replay,"https://web.archive.org/web/20040229020304/http://example.ca/");
});

test("imports Common Crawl JSON lines with separate provenance and no Wayback replay", () => {
  const row = { timestamp:"20040229020304", url:"http://example.ca/old", status:"200", mime:"text/html", filename:"source.warc.gz" };
  const results = parseIndex(JSON.stringify(row) + "\n" + JSON.stringify({...row, timestamp:"20040230020304"}));
  assert.equal(results.length,1);
  assert.equal(results[0].format,"Common Crawl index");
  assert.equal(results[0].replay,"");
  assert.throws(() => parseIndex("{}"),/No valid/);
  assert.throws(() => parseIndex("bad file"),/Expected/);
});
