// app.js
const CONFIG = {
  SHEET_ID: "1PwWhUZr7WDYCKRusbGpM5hPUinxM9mtSG6uVECSaiuI", // your sheet id
  TAB_NAME: "Mappings", // sheet tab name
};

// column names from your sheet / JSON
const COLS = {
  franchise: "Franchise (series)",
  format1: "Content format 1",
  volume: "volume/season",
  seq: "sequence number",
  title: 'title (chapter, not official title, just like "chapter 2")',
  format2: "Content format 2",

  // LN-side columns – adjust if headers differ
  lnVolume: "LN volume/season",
  lnSeq: "LN sequence number",
  lnTitle: 'LN title (chapter, not official title, just like "chapter 2")',
  notes: "Notes",
};

document.addEventListener("DOMContentLoaded", () => {
  const homeSection = document.getElementById("homeSection");
  const seriesSection = document.getElementById("seriesSection");
  const homeStatus = document.getElementById("homeStatus");
  const homeButton = document.getElementById("homeButton");
  const seriesGrid = document.getElementById("seriesGrid");

  const statusEl = document.getElementById("status");
  const tableBody = document.querySelector("#chaptersTable tbody");
  const tableHead = document.getElementById("tableHead");
  const seriesFilter = document.getElementById("seriesFilter");
  const groupModeSelect = document.getElementById("groupMode");
  const searchInput = document.getElementById("searchInput");
  const seriesTitle = document.getElementById("seriesTitle");
  const detailSection = document.getElementById("detailSection");
  const detailContent = document.getElementById("detailContent");

  let allRows = [];
  let currentSeries = null;
  let lastSelectedRowEl = null;

  // simple view switching
  function showHome() {
    homeSection.classList.remove("hidden");
    seriesSection.classList.add("hidden");
  }

  function showSeriesView() {
    homeSection.classList.add("hidden");
    seriesSection.classList.remove("hidden");
  }

  homeButton.addEventListener("click", () => {
    showHome();
  });

  // ---- Data loading ----
  async function loadData() {
    try {
      statusEl.textContent = "Loading data…";
      homeStatus.textContent = "Loading series…";

      const url = `https://opensheet.elk.sh/${CONFIG.SHEET_ID}/${encodeURIComponent(
        CONFIG.TAB_NAME
      )}`;

      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      // only manga rows with a sequence number
      allRows = data.filter(
        (row) =>
          row[COLS.format1] &&
          row[COLS.format1].toLowerCase() === "manga" &&
          row[COLS.seq]
      );

      setupHome();
      setupSeriesFilter();
      updateView();
      statusEl.textContent = "";
    } catch (err) {
      console.error(err);
      statusEl.textContent =
        "Failed to load data from Google Sheets. Check console for details.";
      homeStatus.textContent =
        "Failed to load series. Check console for details.";
    }
  }

  // ---- Home page ----
  function setupHome() {
    const seriesMap = new Map(); // name -> {rows, mangaChapters, lnChapters}

    for (const row of allRows) {
      const name = row[COLS.franchise] || "Unknown series";
      if (!seriesMap.has(name)) {
        seriesMap.set(name, {
          name,
          rows: [],
          mangaTitles: new Set(),
          lnTitles: new Set(),
        });
      }
      const s = seriesMap.get(name);
      s.rows.push(row);
      if (row[COLS.title]) s.mangaTitles.add(row[COLS.title]);
      if (row[COLS.lnTitle]) s.lnTitles.add(row[COLS.lnTitle]);
    }

    const seriesList = Array.from(seriesMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );

    seriesGrid.innerHTML = "";
    if (seriesList.length === 0) {
      homeStatus.textContent = "No series found in this sheet.";
      return;
    }
    homeStatus.textContent = "";

    for (const s of seriesList) {
      const card = document.createElement("article");
      card.className = "series-card";

      card.innerHTML = `
        <h3 class="series-card-title">${s.name}</h3>
        <p class="series-card-meta">
          ${s.rows.length} mapping rows<br/>
          ${s.mangaTitles.size} unique manga chapter labels<br/>
          ${s.lnTitles.size} unique LN chapter labels
        </p>
      `;

      card.addEventListener("click", () => {
        currentSeries = s.name;
        seriesFilter.value = currentSeries;
        seriesTitle.textContent = `${currentSeries} – Chapters`;
        searchInput.value = "";
        groupModeSelect.value = "chapters";
        updateView();
        showSeriesView();
      });

      seriesGrid.appendChild(card);
    }

    // default series = first
    if (!currentSeries && seriesList[0]) {
      currentSeries = seriesList[0].name;
    }
  }

  // ---- Series filter & controls ----
  function setupSeriesFilter() {
    const seriesSet = new Set(
      allRows.map((row) => row[COLS.franchise] || "Unknown series")
    );
    const seriesList = Array.from(seriesSet).sort();

    seriesFilter.innerHTML = "";
    for (const name of seriesList) {
      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name;
      seriesFilter.appendChild(opt);
    }

    if (!currentSeries) {
      currentSeries = seriesList[0] || null;
    }
    if (currentSeries) {
      seriesFilter.value = currentSeries;
      seriesTitle.textContent = `${currentSeries} – Chapters`;
    }

    seriesFilter.addEventListener("change", () => {
      currentSeries = seriesFilter.value;
      seriesTitle.textContent = `${currentSeries} – Chapters`;
      updateView();
      showSeriesView();
    });

    searchInput.addEventListener("input", () => {
      updateView();
    });

    groupModeSelect.addEventListener("change", () => {
      updateView();
    });
  }

  // ---- Main view update ----
  function updateView() {
    if (!currentSeries) return;

    const searchTerm = searchInput.value.trim().toLowerCase();
    const mode = groupModeSelect.value;

    // rows for this series
    let rows = allRows.filter((row) => row[COLS.franchise] === currentSeries);

    // sort by manga sequence
    rows.sort(
      (a, b) => Number(a[COLS.seq] || 0) - Number(b[COLS.seq] || 0)
    );

    // search filter
    if (searchTerm) {
      rows = rows.filter((row) => {
        const seq = String(row[COLS.seq] || "").toLowerCase();
        const title = String(row[COLS.title] || "").toLowerCase();
        const lnTitle = String(row[COLS.lnTitle] || "").toLowerCase();
        const lnSeq = String(row[COLS.lnSeq] || "").toLowerCase();
        return (
          seq.includes(searchTerm) ||
          title.includes(searchTerm) ||
          lnTitle.includes(searchTerm) ||
          lnSeq.includes(searchTerm)
        );
      });
    }

    if (mode === "chapters") {
      renderChapterTable(rows);
    } else {
      renderLnGroupTable(rows);
    }
  }

  // ---- Chapters view (raw mappings) ----
  function renderChapterTable(rows) {
    tableBody.innerHTML = "";
    lastSelectedRowEl = null;
    detailSection.classList.add("hidden");
    detailContent.innerHTML =
      "<p>Select a row in the table to see more information.</p>";

    // table header
    tableHead.innerHTML = `
      <tr>
        <th>#</th>
        <th>Manga vol</th>
        <th>Manga chapter</th>
        <th>LN vol</th>
        <th>LN chapter</th>
        <th>Format</th>
      </tr>
    `;

    if (rows.length === 0) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 6;
      td.textContent = "No chapters match your filters.";
      tr.appendChild(td);
      tableBody.appendChild(tr);
      return;
    }

    // duplication counts
    const mangaTitleCounts = rows.reduce((acc, row) => {
      const t = row[COLS.title] || "";
      acc[t] = (acc[t] || 0) + 1;
      return acc;
    }, {});

    const lnTitleCounts = rows.reduce((acc, row) => {
      const t = row[COLS.lnTitle] || "";
      if (!t) return acc;
      acc[t] = (acc[t] || 0) + 1;
      return acc;
    }, {});

    for (const row of rows) {
      const tr = document.createElement("tr");

      const seq = row[COLS.seq] || "";
      const volume = row[COLS.volume] || "";
      const title = row[COLS.title] || "";
      const format1 = row[COLS.format1] || "";
      const lnVolume = row[COLS.lnVolume] || "";
      const lnTitle = row[COLS.lnTitle] || "";
      const lnSeq = row[COLS.lnSeq] || "";
      const isMangaDup = mangaTitleCounts[title] > 1;
      const isLnDup = lnTitle && lnTitleCounts[lnTitle] > 1;

      const tdSeq = document.createElement("td");
      tdSeq.textContent = seq;
      tr.appendChild(tdSeq);

      const tdMangaVol = document.createElement("td");
      tdMangaVol.textContent = volume;
      tr.appendChild(tdMangaVol);

      const tdMangaTitle = document.createElement("td");
      tdMangaTitle.textContent = title;
      if (isMangaDup) {
        const badge = document.createElement("span");
        badge.className = "badge-duplicate";
        badge.textContent = `x${mangaTitleCounts[title]}`;
        tdMangaTitle.appendChild(badge);
      }
      tr.appendChild(tdMangaTitle);

      const tdLnVol = document.createElement("td");
      tdLnVol.textContent = lnVolume || "–";
      tr.appendChild(tdLnVol);

      const tdLnTitle = document.createElement("td");
      tdLnTitle.textContent = lnTitle || "–";
      if (isLnDup) {
        const badge = document.createElement("span");
        badge.className = "badge-duplicate badge-ln-dup";
        badge.textContent = `x${lnTitleCounts[lnTitle]}`;
        tdLnTitle.appendChild(badge);
      }
      tr.appendChild(tdLnTitle);

      const tdFmt = document.createElement("td");
      tdFmt.textContent = format1;
      tr.appendChild(tdFmt);

      tr.addEventListener("click", () => {
        if (lastSelectedRowEl) {
          lastSelectedRowEl.classList.remove("selected-row");
        }
        tr.classList.add("selected-row");
        lastSelectedRowEl = tr;
        showChapterDetails(row, mangaTitleCounts, lnTitleCounts);
      });

      tableBody.appendChild(tr);
    }
  }

  function showChapterDetails(row, mangaTitleCounts, lnTitleCounts) {
    const seq = row[COLS.seq] || "";
    const volume = row[COLS.volume] || "";
    const title = row[COLS.title] || "";
    const lnVolume = row[COLS.lnVolume] || "";
    const lnSeq = row[COLS.lnSeq] || "";
    const lnTitle = row[COLS.lnTitle] || "";
    const notes = row[COLS.notes] || "";
    const series = row[COLS.franchise] || "";
    const format1 = row[COLS.format1] || "";
    const format2 = row[COLS.format2] || "";

    const mangaDupCount = mangaTitleCounts[title] || 1;
    const lnDupCount = lnTitle ? lnTitleCounts[lnTitle] || 1 : 1;

    let duplicationInfo = "";
    if (mangaDupCount > 1) {
      duplicationInfo += `<p><span class="detail-label">Manga duplication:</span> This manga chapter label appears in <span class="detail-value">${mangaDupCount}</span> mapping rows.</p>`;
    }
    if (lnTitle && lnDupCount > 1) {
      duplicationInfo += `<p><span class="detail-label">LN duplication:</span> This LN chapter label appears in <span class="detail-value">${lnDupCount}</span> mapping rows.</p>`;
    }
    if (!duplicationInfo) {
      duplicationInfo =
        '<p><span class="detail-label">Duplication:</span> No duplicates detected for this chapter label.</p>';
    }

    detailContent.innerHTML = `
      <p><span class="detail-label">Series:</span> <span class="detail-value">${series}</span></p>

      <p><span class="detail-label">Manga:</span>
        <span class="detail-value">
          Volume ${volume || "?"}, sequence #${seq || "?"}, ${title || "(no title)"}
        </span>
      </p>

      <p><span class="detail-label">LN mapping:</span>
        <span class="detail-value">
          ${
            lnTitle
              ? `Volume ${lnVolume || "?"}, sequence #${lnSeq || "?"}, ${lnTitle}`
              : "No LN mapping info provided for this row."
          }
        </span>
      </p>

      <p><span class="detail-label">Formats:</span>
        <span class="detail-value">${format1 || "?"} → ${format2 || "??"}</span>
      </p>

      ${duplicationInfo}

      <p><span class="detail-label">Notes:</span>
        <span class="detail-value">${notes || "—"}</span>
      </p>
    `;

    detailSection.classList.remove("hidden");
  }

  // ---- LN groups view ----
  function renderLnGroupTable(rows) {
    tableBody.innerHTML = "";
    lastSelectedRowEl = null;
    detailSection.classList.add("hidden");
    detailContent.innerHTML =
      "<p>Select a group in the table to see more information.</p>";

    // table header
    tableHead.innerHTML = `
      <tr>
        <th>#</th>
        <th>LN vol</th>
        <th>LN chapter</th>
        <th>LN seq</th>
        <th># manga chapters</th>
        <th>Manga seq range</th>
      </tr>
    `;

    if (rows.length === 0) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 6;
      td.textContent = "No data for this series.";
      tr.appendChild(td);
      tableBody.appendChild(tr);
      return;
    }

    // build groups by LN chapter (vol + title)
    const groupsMap = new Map(); // key -> group

    for (const row of rows) {
      const lnTitle = row[COLS.lnTitle] || "";
      const lnVolume = row[COLS.lnVolume] || "";
      const lnSeq = row[COLS.lnSeq] || "";
      const key = lnTitle + "||" + lnVolume;

      if (!groupsMap.has(key)) {
        groupsMap.set(key, {
          lnTitle,
          lnVolume,
          lnSeq,
          rows: [],
          mangaSeqs: [],
        });
      }
      const g = groupsMap.get(key);
      g.rows.push(row);
      const seq = Number(row[COLS.seq] || 0);
      if (!Number.isNaN(seq)) g.mangaSeqs.push(seq);
    }

    // turn into array and sort
    let groups = Array.from(groupsMap.values());

    groups.forEach((g) => {
      g.mangaSeqs.sort((a, b) => a - b);
    });

    groups.sort((a, b) => {
      const aSeq = Number(a.lnSeq || a.mangaSeqs[0] || 0);
      const bSeq = Number(b.lnSeq || b.mangaSeqs[0] || 0);
      return aSeq - bSeq;
    });

    // render
    groups.forEach((group, index) => {
      const tr = document.createElement("tr");

      const tdIndex = document.createElement("td");
      tdIndex.textContent = String(index + 1);
      tr.appendChild(tdIndex);

      const tdLnVol = document.createElement("td");
      tdLnVol.textContent = group.lnVolume || "–";
      tr.appendChild(tdLnVol);

      const tdLnTitle = document.createElement("td");
      tdLnTitle.textContent = group.lnTitle || "(no LN mapping)";
      tr.appendChild(tdLnTitle);

      const tdLnSeq = document.createElement("td");
      tdLnSeq.textContent = group.lnSeq || "–";
      tr.appendChild(tdLnSeq);

      const tdCount = document.createElement("td");
      tdCount.textContent = String(group.rows.length);
      tr.appendChild(tdCount);

      const tdRange = document.createElement("td");
      if (group.mangaSeqs.length === 0) {
        tdRange.textContent = "–";
      } else if (group.mangaSeqs.length === 1) {
        tdRange.textContent = `#${group.mangaSeqs[0]}`;
      } else {
        const first = group.mangaSeqs[0];
        const last = group.mangaSeqs[group.mangaSeqs.length - 1];
        tdRange.textContent = `#${first}–${last}`;
      }
      tr.appendChild(tdRange);

      tr.addEventListener("click", () => {
        if (lastSelectedRowEl) {
          lastSelectedRowEl.classList.remove("selected-row");
        }
        tr.classList.add("selected-row");
        lastSelectedRowEl = tr;
        showLnGroupDetails(group);
      });

      tableBody.appendChild(tr);
    });
  }

  function showLnGroupDetails(group) {
    const series = currentSeries;
    const lnTitle = group.lnTitle || "(no LN mapping)";
    const lnVolume = group.lnVolume || "–";
    const lnSeq = group.lnSeq || "–";
    const mangaChapters = group.rows
      .map((row) => {
        const seq = row[COLS.seq] || "?";
        const title = row[COLS.title] || "";
        const volume = row[COLS.volume] || "";
        return `Vol ${volume || "?"}, #${seq}: ${title}`;
      })
      .join("<br/>");

    detailContent.innerHTML = `
      <p><span class="detail-label">Series:</span>
        <span class="detail-value">${series}</span>
      </p>

      <p><span class="detail-label">LN chapter:</span>
        <span class="detail-value">
          Volume ${lnVolume}, sequence #${lnSeq}, ${lnTitle}
        </span>
      </p>

      <p><span class="detail-label">Mapped manga chapters:</span><br/>
        <span class="detail-value">${mangaChapters || "—"}</span>
      </p>

      <p><span class="detail-label">Group size:</span>
        <span class="detail-value">${group.rows.length} mapping row(s)</span>
      </p>
    `;

    detailSection.classList.remove("hidden");
  }

  loadData();
});
