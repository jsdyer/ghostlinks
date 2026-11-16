import { addressKey, availableURL, captureLabel, normalizeAddress, parseIndex, replayURL, waybackCalendar } from "./model.mjs";

const byId = id => document.getElementById(id);
const urlInput = byId("target");
const caseList = byId("cases");
let currentAddress = "";
let cases = [];
let selected = "";
let collectionDate = "";
let imported = [];
let visibleIndex = 25;
let inflight;

function node(tag, text, className) {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = text;
  if (className) element.className = className;
  return element;
}

function link(label, target) {
  const anchor = node("a",label);
  anchor.href = target;
  anchor.target = "_blank";
  anchor.rel = "noopener noreferrer";
  return anchor;
}

function lastCheckLabel(record) {
  if (record.checked.hops.length) return "Redirect observed";
  if (record.checked.status >= 400) return "HTTP error observed";
  if (record.checked.status) return "Direct response observed";
  return "Check inconclusive";
}

function updateResearch(researchValue) {
  inflight?.abort();
  inflight = undefined;
  byId("find-capture").disabled = false;
  byId("capture-result").replaceChildren();
  byId("capture-status").textContent = "";
  byId("url-links").replaceChildren();
  byId("closest").hidden = true;
  try {
    currentAddress = normalizeAddress(researchValue);
  } catch (error) {
    currentAddress = "";
    byId("url-status").textContent = error.message;
    renderImport();
    return;
  }
  const matchingCase = cases.find(record => addressKey(record.url) === addressKey(currentAddress));
  byId("url-status").textContent = currentAddress;
  byId("url-links").append(
    link("Wayback calendar ↗", waybackCalendar(currentAddress)),
    link("Open requested address ↗", currentAddress),
    link("Common Crawl index ↗", "https://index.commoncrawl.org/"),
    link("Government of Canada Web Archive ↗", "https://webarchiveweb.bac-lac.canada.ca/")
  );
  byId("closest").hidden = false;
  if (matchingCase && selected !== matchingCase.id) selectCase(matchingCase.id, false);
  renderImport();
}

async function findCapture(event) {
  event.preventDefault();
  try {
    if (normalizeAddress(urlInput.value) !== currentAddress) updateResearch(urlInput.value);
  } catch {
    updateResearch(urlInput.value);
  }
  if (!currentAddress) return;
  const address = currentAddress;
  const day = byId("archive-date").value;
  const controller = new AbortController();
  inflight?.abort();
  inflight = controller;
  const timer = setTimeout(() => controller.abort(), 12000);
  byId("find-capture").disabled = true;
  byId("capture-result").replaceChildren();
  byId("capture-status").textContent = "Asking the Wayback availability index…";
  try {
    const response = await fetch(availableURL(address,day),{
      signal:controller.signal, credentials:"omit", referrerPolicy:"no-referrer",
    });
    if (!response.ok) throw new Error("HTTP " + response.status);
    const data = await response.json();
    if (inflight !== controller) return;
    const result = data.archived_snapshots?.closest;
    const replay = result?.available && replayURL(result.url,result.timestamp);
    if (replay) {
      byId("capture-status").textContent = `Indexed capture · ${captureLabel(result.timestamp)}`;
      byId("capture-result").append(link("Open reported capture ↗",replay));
    } else {
      byId("capture-status").textContent = "No closest capture was returned. Other URLs, dates, and archives may have evidence.";
    }
  } catch {
    if (inflight === controller) {
      byId("capture-status").textContent = "The live lookup did not complete. Try the Wayback calendar or import an index file.";
    }
  } finally {
    clearTimeout(timer);
    if (inflight === controller) {
      inflight = undefined;
      byId("find-capture").disabled = false;
    }
  }
}

function renderImport() {
  const matching = currentAddress ? imported.filter(row => addressKey(row.url) === addressKey(currentAddress)) : imported;
  byId("index-list").replaceChildren();
  byId("clear-index").hidden = !imported.length;
  byId("index-more").hidden = matching.length <= visibleIndex;
  if (!imported.length) {
    byId("index-status").textContent = "";
    return;
  }
  byId("index-status").textContent = currentAddress
    ? `${matching.length.toLocaleString()} entries for this address in ${imported.length.toLocaleString()} imported records.`
    : `${imported.length.toLocaleString()} imported entries. Investigate a URL to narrow this timeline.`;
  for (const row of matching.slice(0,visibleIndex)) {
    const item = node("li");
    item.append(node("span",`${captureLabel(row.date)} · ${row.format}${row.status ? " · HTTP " + row.status : ""}`, "event-meta"));
    if (row.replay) item.append(link(row.url + " ↗",row.replay));
    else item.append(node("span",row.url));
    if (row.mime) item.append(node("span",row.mime,"event-meta"));
    byId("index-list").append(item);
  }
}

async function openIndex(event) {
  const file = event.currentTarget.files[0];
  if (!file) return;
  try {
    if (file.size > 5 * 1024 * 1024) throw new Error("Choose an index export smaller than 5 MiB.");
    imported = parseIndex(await file.text());
    visibleIndex = 25;
    renderImport();
  } catch (error) {
    byId("index-status").textContent = error.message;
  }
  event.target.value = "";
}

function renderCases() {
  const query = byId("case-search").value.trim().toLowerCase();
  const displayed = cases.filter(item => [item.title,item.category,item.url,lastCheckLabel(item)].join(" ").toLowerCase().includes(query));
  caseList.replaceChildren();
  byId("case-status").textContent = displayed.length ? `${displayed.length} of ${cases.length} files` : "No files match. Try an address in the research field above.";
  for (const record of displayed) {
    const button = node("button",undefined,"case-button");
    button.type = "button";
    button.setAttribute("aria-pressed",String(selected === record.id));
    button.dataset.case = record.id;
    button.append(node("strong",record.title),node("small",new URL(record.url).hostname),node("small",lastCheckLabel(record)));
    const item = node("li");
    item.append(button);
    caseList.append(item);
  }
}

function archiveEvent(capture) {
  const row = node("li");
  row.append(
    node("span",`${captureLabel(capture.date)} · Wayback index`, "event-meta"),
    node("span",capture.original,"event-title"),
    node("span",capture.status ? `Recorded status ${capture.status}` : "Status unreported", "event-meta")
  );
  const links = node("div",undefined,"links");
  links.append(link("Open capture ↗",capture.archive),link("Index receipt ↗",capture.source));
  row.append(links);
  return row;
}

function checkEvent(check) {
  const row = node("li",undefined,"current");
  row.append(node("span",`${collectionDate} · HTTPS request during curation`,"event-meta"));
  if (check.hops.length) {
    row.append(node("strong",`${check.hops.length} redirect${check.hops.length === 1 ? "" : "s"} observed`));
    const list = node("ol",undefined,"hops");
    for (const hop of check.hops) list.append(node("li",`${hop.code} · ${hop.to}`));
    row.append(list);
  }
  if (check.status) {
    row.append(node("p",`Final response HTTP ${check.status}${check.title ? " · " + check.title : ""}`, "event-meta"));
    if (check.status >= 400) row.append(node("p","This check could not retrieve the page. The response may come from an intermediary.","event-meta"));
  } else {
    row.append(node("p","The request did not complete. Availability is inconclusive.","event-meta"));
  }
  const links = node("div",undefined,"links");
  links.append(link("Open checked URL ↗",check.requested));
  if (check.final && check.final !== check.requested) links.append(link("Open observed destination ↗",check.final));
  row.append(links);
  return row;
}

function renderRecord(record) {
  const panel = byId("record");
  panel.replaceChildren();
  const title = node("h2",record.title);
  title.id = "record-heading";
  title.tabIndex = -1;
  const heading = node("div");
  heading.append(node("p",record.category,"kicker"),title);
  const top = node("div",undefined,"record-top");
  const copy = node("button","Copy case link","button");
  copy.type = "button";
  const copied = node("p",undefined,"status");
  copied.setAttribute("role","status");
  copy.addEventListener("click",async () => {
    const url = new URL(location.href);
    url.hash = new URLSearchParams({case:record.id}).toString();
    try {
      await navigator.clipboard.writeText(url.href);
      copied.textContent = "Case link copied.";
    } catch {
      copied.replaceChildren(link("Open the shareable case link ↗",url.href));
    }
  });
  top.append(heading,copy);
  const research = node("button","Investigate this address","button");
  research.type = "button";
  research.addEventListener("click",() => {
    urlInput.value = record.url;
    updateResearch(record.url);
    urlInput.focus();
  });
  const actions = node("div",undefined,"links");
  actions.append(research,link("Full Wayback calendar ↗",waybackCalendar(record.url)));
  const timeline = node("ol",undefined,"timeline");
  for (const capture of [...record.captures].sort((a,b) => a.date.localeCompare(b.date))) timeline.append(archiveEvent(capture));
  timeline.append(checkEvent(record.checked));
  const replace = node("div",undefined,"replacement");
  replace.append(node("h3","Current publisher"),link(record.replacement + " ↗",record.replacement));
  panel.append(top,copied,node("p",record.url,"record-url"),node("p",record.notes,"record-intro"),actions,
    node("div",undefined,"record-separator"),node("h3","Evidence timeline"),timeline,replace);
}

function selectCase(id, updateHash = true) {
  const record = cases.find(item => item.id === id);
  if (!record) return;
  selected = id;
  if (updateHash) {
    const params = new URLSearchParams(location.hash.slice(1));
    params.set("case",id);
    history.replaceState(null,"","#" + params);
  }
  renderRecord(record);
  for (const button of caseList.querySelectorAll("button[data-case]")) {
    button.setAttribute("aria-pressed",String(button.dataset.case === id));
  }
}

function readLocation(prefill = true) {
  const params = new URLSearchParams(location.hash.slice(1));
  if (prefill && params.has("url")) {
    urlInput.value = params.get("url").slice(0,2048);
    updateResearch(urlInput.value);
  }
  if (params.has("case")) {
    selectCase(params.get("case"),false);
  } else if (params.has("url") && currentAddress) {
    const matching = cases.find(record => addressKey(record.url) === addressKey(currentAddress));
    if (matching) selectCase(matching.id,false);
  }
}

caseList.addEventListener("click",event => {
  const button = event.target.closest("button[data-case]");
  if (button) selectCase(button.dataset.case);
});
byId("case-search").addEventListener("input",renderCases);
byId("url-form").addEventListener("submit",event => {
  event.preventDefault();
  updateResearch(urlInput.value);
});
byId("closest-form").addEventListener("submit",findCapture);
byId("index-file").addEventListener("change",openIndex);
byId("clear-index").addEventListener("click",() => {imported = []; visibleIndex = 25; renderImport();});
byId("index-more").addEventListener("click",() => { visibleIndex += 25; renderImport(); });
window.addEventListener("hashchange",() => readLocation());
readLocation();

try {
  const response = await fetch("./cases.json",{credentials:"same-origin"});
  if (!response.ok) throw new Error("Case index unavailable");
  const snapshot = await response.json();
  if (snapshot.version !== 1 || !Array.isArray(snapshot.cases) || !snapshot.cases.length) {
    throw new Error("Case index invalid");
  }
  cases = snapshot.cases;
  collectionDate = snapshot.date;
  byId("case-count").textContent = cases.length;
  byId("capture-count").textContent = cases.reduce((sum,item) => sum + item.captures.length,0);
  byId("checked").textContent = collectionDate;
  renderCases();
  selectCase(cases[0].id,false);
  readLocation(false);
} catch {
  byId("case-status").textContent = "The research files could not be loaded. You can still investigate an address above.";
}
