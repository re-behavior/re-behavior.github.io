const manifestUrl = "case-manifest.json?v=reading-order-20260509";

const caseList = document.querySelector("#case-list");
const caseTitle = document.querySelector("#case-title");
const sourceLink = document.querySelector("#source-link");
const metadata = document.querySelector("#metadata");
const cells = document.querySelector("#cells");
const template = document.querySelector("#cell-template");

let manifest = [];

const metaFields = [
  "case",
  "date_observed",
  "date_published",
  "source_type",
  "primary_source",
  "archive_link",
  "model",
  "system",
  "organization",
  "verification",
  "tags"
];

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function renderInline(value) {
  return escapeHtml(value).replace(/`([^`]+)`/g, "<code>$1</code>");
}

function renderLinkValue(value) {
  const text = value || "unknown";
  if (!value || value === "unknown") return escapeHtml(text);
  return `<a href="${escapeHtml(value)}" target="_blank" rel="noreferrer">${escapeHtml(value)}</a>`;
}

function renderMetaValue(field, value) {
  if (field === "primary_source" || field === "archive_link") {
    return renderLinkValue(value);
  }
  return renderInline(value || "unknown");
}

function displayTitle(title) {
  if (title === "Observed behavior") return "Behavior";
  return title || "Note";
}

function setError(error) {
  cells.innerHTML = `<div class="error">${escapeHtml(error.message || error)}</div>`;
}

async function loadJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`could not load ${url}`);
  }
  return response.json();
}

function renderCaseList(activePath) {
  caseList.innerHTML = "";
  for (const item of manifest) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `case-link${item.path === activePath ? " active" : ""}`;
    button.innerHTML = `<span class="case-id">${escapeHtml(item.case)}</span>${escapeHtml(item.title)}`;
    button.addEventListener("click", () => {
      location.hash = item.case;
      loadCase(item.path);
    });
    caseList.append(button);
  }
}

function renderMetadata(record) {
  metadata.innerHTML = "";
  for (const field of metaFields) {
    const row = document.createElement("div");
    row.className = "meta-row";
    const value = Array.isArray(record[field]) ? record[field].join(", ") : record[field];
    row.innerHTML = `
      <div class="meta-label">${escapeHtml(field)}</div>
      <div class="meta-value">${renderMetaValue(field, value)}</div>
    `;
    metadata.append(row);
  }
}

function cellShell(cell, index) {
  const node = template.content.firstElementChild.cloneNode(true);
  const run = node.querySelector(".run-button");
  const count = node.querySelector(".execution-count");
  const body = node.querySelector(".cell-body");
  const execution = cell.execution_count ?? "";
  count.textContent = execution === "" ? "[ ]:" : `[${execution}]:`;
  node.dataset.cellType = cell.type;
  node.dataset.index = String(index);
  return { node, run, body };
}

function typeText(target, text, onDone) {
  const chars = Array.from(text || "");
  target.textContent = "";
  let index = 0;
  const speed = 34;

  function tick() {
    target.textContent = chars.slice(0, index).join("");
    index += 1;
    if (index <= chars.length) {
      window.setTimeout(tick, speed);
    } else if (onDone) {
      onDone();
    }
  }

  tick();
}

function revealOutput(cell, run, output, notice) {
  const text = output.dataset.output || "";
  output.classList.add("visible");
  notice.classList.remove("visible");
  run.disabled = true;

  if (cell.playback === "typewriter") {
    output.classList.add("typing");
    typeText(output, text, () => {
      output.classList.remove("typing");
      notice.classList.add("visible");
      run.disabled = false;
    });
    return;
  }

  output.textContent = text;
  notice.classList.add("visible");
  run.disabled = false;
}

function renderMarkdownCell(cell, index) {
  const { node, run, body } = cellShell(cell, index);
  run.classList.add("hidden");
  const paragraphs = (cell.body || []).map((paragraph) => `<p>${renderInline(paragraph)}</p>`).join("");
  body.innerHTML = `<h2>${escapeHtml(displayTitle(cell.title))}</h2>${paragraphs}`;
  return node;
}

function renderPromptCell(cell, index) {
  const { node, run, body } = cellShell(cell, index);
  body.innerHTML = `
    <div class="input"><span class="cell-label">Prompt</span>${escapeHtml(cell.input || "")}</div>
    <div class="output"><span class="cell-label">Output</span><span class="output-text"></span></div>
    <div class="notice">${escapeHtml(cell.notice || "")}</div>
  `;
  const output = body.querySelector(".output");
  const outputText = body.querySelector(".output-text");
  const notice = body.querySelector(".notice");
  outputText.dataset.output = cell.output || "";
  run.addEventListener("click", () => {
    revealOutput(cell, run, outputText, notice);
    output.classList.add("visible");
  });
  return node;
}

function renderTranscriptCell(cell, index) {
  const { node, run, body } = cellShell(cell, index);
  body.innerHTML = `
    <div class="input"><span class="cell-label">Context</span>${escapeHtml(cell.context || "")}</div>
    <div class="output"><span class="cell-label">Excerpt</span><span class="output-text"></span></div>
    <div class="notice">${escapeHtml(cell.notice || "")}</div>
  `;
  const output = body.querySelector(".output");
  const outputText = body.querySelector(".output-text");
  const notice = body.querySelector(".notice");
  outputText.dataset.output = cell.output || "";
  run.addEventListener("click", () => {
    output.classList.add("visible");
    revealOutput(cell, run, outputText, notice);
  });
  return node;
}

function renderDocumentCell(cell, index) {
  const { node, run, body } = cellShell(cell, index);
  body.innerHTML = `
    <div class="input"><span class="cell-label">Record</span>${escapeHtml(cell.context || "")}</div>
    <div class="output"><span class="cell-label">Excerpt</span><span class="output-text"></span></div>
    <div class="notice">${escapeHtml(cell.notice || "")}</div>
  `;
  const output = body.querySelector(".output");
  const outputText = body.querySelector(".output-text");
  const notice = body.querySelector(".notice");
  outputText.dataset.output = cell.output || "";
  run.addEventListener("click", () => {
    output.classList.add("visible");
    revealOutput(cell, run, outputText, notice);
  });
  return node;
}

function renderDataCell(cell, index) {
  const { node, run, body } = cellShell(cell, index);
  const data = JSON.stringify(cell.data || {}, null, 2);
  body.innerHTML = `
    <h2>${escapeHtml(cell.label || "Data")}</h2>
    <div class="data-output">${escapeHtml(data)}</div>
    <div class="notice">${escapeHtml(cell.notice || "")}</div>
  `;
  const output = body.querySelector(".data-output");
  const notice = body.querySelector(".notice");
  run.addEventListener("click", () => {
    output.classList.add("visible");
    notice.classList.add("visible");
  });
  return node;
}

function renderCodeCell(cell, index) {
  const { node, run, body } = cellShell(cell, index);
  body.innerHTML = `
    <div class="code-input">${escapeHtml(cell.input || "")}</div>
    <div class="output">${escapeHtml(cell.fallback_output || "not executed")}</div>
    <div class="notice">${escapeHtml(cell.notice || "")}</div>
  `;
  const output = body.querySelector(".output");
  const notice = body.querySelector(".notice");
  run.addEventListener("click", () => {
    output.classList.add("visible");
    notice.classList.add("visible");
  });
  return node;
}

function renderRelatedCell(cell, index) {
  const liveItems = (cell.items || []).filter((item) => {
    const match = String(item).match(/^(\d{3})\./);
    return match ? manifest.some((entry) => entry.case === match[1]) : true;
  });
  if (liveItems.length === 0) return null;

  const { node, run, body } = cellShell(cell, index);
  run.classList.add("hidden");
  const items = liveItems.map((item) => {
    const match = String(item).match(/^(\d{3})\./);
    if (!match) return `<li>${renderInline(item)}</li>`;
    return `<li><a href="#${escapeHtml(match[1])}">${renderInline(item)}</a></li>`;
  }).join("");
  body.innerHTML = `<h2>Related files</h2><ul class="related-list">${items}</ul>`;
  return node;
}

function renderCells(record) {
  cells.innerHTML = "";
  for (const [index, cell] of (record.cells || []).entries()) {
    let rendered;
    if (cell.type === "markdown") rendered = renderMarkdownCell(cell, index);
    else if (cell.type === "prompt") rendered = renderPromptCell(cell, index);
    else if (cell.type === "transcript") rendered = renderTranscriptCell(cell, index);
    else if (cell.type === "document") rendered = renderDocumentCell(cell, index);
    else if (cell.type === "data") rendered = renderDataCell(cell, index);
    else if (cell.type === "code") rendered = renderCodeCell(cell, index);
    else if (cell.type === "related") rendered = renderRelatedCell(cell, index);
    else rendered = renderMarkdownCell({ title: cell.type, body: ["Unsupported cell type."] }, index);
    if (rendered) cells.append(rendered);
  }
}

async function loadCase(path) {
  try {
    const record = await loadJson(path);
    document.title = `${record.case} ${record.title} | re: behavior`;
    caseTitle.textContent = `${record.case} ${record.title}`;
    sourceLink.href = record.primary_source || "#";
    sourceLink.textContent = record.primary_source ? "primary source" : "source";
    renderCaseList(path);
    renderMetadata(record);
    renderCells(record);
    window.scrollTo({ top: 0 });
  } catch (error) {
    setError(error);
  }
}

async function boot() {
  try {
    manifest = await loadJson(manifestUrl);
    const hash = location.hash.replace("#", "");
    const selected = manifest.find((item) => item.case === hash) || manifest[0];
    renderCaseList(selected.path);
    await loadCase(selected.path);
  } catch (error) {
    setError(error);
  }
}

window.addEventListener("hashchange", () => {
  const hash = location.hash.replace("#", "");
  const selected = manifest.find((item) => item.case === hash);
  if (selected) loadCase(selected.path);
});

boot();
