import {
  db, auth, doc, getDoc, setDoc, deleteDoc, onSnapshot, collection, writeBatch, serverTimestamp,
  ensureSignedIn, normalizePhone, isValidPhoneInput, COMPETITIONS, escapeHtml,
} from "./common.js";

const el = (id) => document.getElementById(id);
const show = (id) => el(id).classList.remove("hidden");
const hide = (id) => el(id).classList.add("hidden");

let configData = {};
let contestantsCache = { movement: [], sound: [] };
let votesCache = { movement: {}, sound: {} };

async function init() {
  try {
    await ensureSignedIn();
  } catch (e) {
    console.error("Sign-in failed", e);
  }

  el("gate-btn").addEventListener("click", onGate);
  el("admin-code-input").addEventListener("keydown", (e) => { if (e.key === "Enter") onGate(); });

  document.querySelectorAll(".tab-row button").forEach((btn) => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });

  el("open-movement").addEventListener("click", () => setVotingState("movement", true));
  el("close-movement").addEventListener("click", () => setVotingState("movement", false));
  el("open-sound").addEventListener("click", () => setVotingState("sound", true));
  el("close-sound").addEventListener("click", () => setVotingState("sound", false));

  el("import-btn").addEventListener("click", onImport);
  el("lookup-btn").addEventListener("click", onLookup);

  el("add-movement").addEventListener("click", () => addContestant("movement"));
  el("add-sound").addEventListener("click", () => addContestant("sound"));
}

async function onGate() {
  const code = el("admin-code-input").value.trim();
  hide("gate-error");
  if (!code) {
    el("gate-error").textContent = "Please enter the admin code.";
    show("gate-error");
    return;
  }
  el("gate-btn-label").innerHTML = '<span class="spinner"></span> Checking...';
  el("gate-btn").disabled = true;
  try {
    const uid = auth.currentUser.uid;
    await setDoc(doc(db, "adminTokens", uid), {
      adminCode: code,
      ts: serverTimestamp(),
    });
    hide("screen-gate");
    show("screen-admin");
    startAdminListeners();
  } catch (e) {
    console.error(e);
    el("gate-error").textContent = "Incorrect admin code.";
    show("gate-error");
  } finally {
    el("gate-btn-label").textContent = "Enter";
    el("gate-btn").disabled = false;
  }
}

function switchTab(name) {
  document.querySelectorAll(".tab-row button").forEach((b) => b.classList.toggle("active", b.dataset.tab === name));
  document.querySelectorAll(".tab-panel").forEach((p) => p.classList.add("hidden"));
  el(`tab-${name}`).classList.remove("hidden");
}

function startAdminListeners() {
  onSnapshot(doc(db, "config", "main"), (snap) => {
    configData = snap.exists() ? snap.data() : {};
    renderStatus();
  });

  COMPETITIONS.forEach((comp) => {
    onSnapshot(collection(db, comp.contestantsCollection), (snap) => {
      const list = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      list.sort((a, b) => (a.number ?? 0) - (b.number ?? 0));
      contestantsCache[comp.id] = list;
      renderContestantsAdmin(comp.id);
      renderResults(comp.id);
    });

    onSnapshot(collection(db, comp.votesCollection), (snap) => {
      const map = {};
      snap.forEach((d) => { map[d.id] = d.data(); });
      votesCache[comp.id] = map;
      renderResults(comp.id);
    });
  });
}

function renderStatus() {
  COMPETITIONS.forEach((comp) => {
    const open = !!configData[`${comp.id}Open`];
    el(`status-text-${comp.id}`).textContent = open
      ? "Voting is currently OPEN."
      : "Voting is currently CLOSED.";
    el(`open-${comp.id}`).disabled = open;
    el(`close-${comp.id}`).disabled = !open;
  });
}

async function setVotingState(compId, openState) {
  await setDoc(doc(db, "config", "main"), { [`${compId}Open`]: openState }, { merge: true });
}

async function onImport() {
  const raw = el("import-textarea").value;
  hide("import-error");
  hide("import-success");
  const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);
  const entries = [];
  const bad = [];
  for (const line of lines) {
    const parts = line.split(",");
    if (parts.length < 2) { bad.push(line); continue; }
    const phoneRaw = parts[0];
    const points = parseInt(parts[1], 10);
    if (!isValidPhoneInput(phoneRaw) || isNaN(points) || points < 0) { bad.push(line); continue; }
    entries.push({ phone: normalizePhone(phoneRaw), points });
  }
  if (!entries.length) {
    el("import-error").textContent = "No valid lines found. Use: phone,points — one per line.";
    show("import-error");
    return;
  }
  el("import-btn-label").innerHTML = '<span class="spinner"></span> Importing...';
  el("import-btn").disabled = true;
  try {
    const chunkSize = 400;
    for (let i = 0; i < entries.length; i += chunkSize) {
      const chunk = entries.slice(i, i + chunkSize);
      const batch = writeBatch(db);
      chunk.forEach((entry) => {
        batch.set(doc(db, "voters", entry.phone), { phone: entry.phone, points: entry.points }, { merge: true });
      });
      await batch.commit();
    }
    let msg = `Imported ${entries.length} voter(s).`;
    if (bad.length) msg += ` Skipped ${bad.length} invalid line(s): ${bad.slice(0, 5).join(" | ")}${bad.length > 5 ? "…" : ""}`;
    el("import-success").textContent = msg;
    show("import-success");
    el("import-textarea").value = "";
  } catch (e) {
    console.error(e);
    el("import-error").textContent = "Import failed. Check your admin session and try again.";
    show("import-error");
  } finally {
    el("import-btn-label").textContent = "Import voters";
    el("import-btn").disabled = false;
  }
}

async function onLookup() {
  const raw = el("lookup-phone").value;
  const resultEl = el("lookup-result");
  if (!isValidPhoneInput(raw)) {
    resultEl.innerHTML = '<p class="lead">Enter a valid phone number.</p>';
    return;
  }
  const phone = normalizePhone(raw);
  resultEl.innerHTML = '<p class="lead">Looking up...</p>';
  const voterSnap = await getDoc(doc(db, "voters", phone));
  if (!voterSnap.exists()) {
    resultEl.innerHTML = '<p class="lead">No voter found with this number.</p>';
    return;
  }
  const voter = voterSnap.data();
  const movementVoted = await getDoc(doc(db, "votes_movement", phone));
  const soundVoted = await getDoc(doc(db, "votes_sound", phone));
  resultEl.innerHTML = `
    <div class="contestant-row">
      <div class="contestant-name">${escapeHtml(phone)} — ${voter.points ?? 0} point(s)</div>
    </div>
    <p class="mini-note">Cre8 Movement: ${movementVoted.exists() ? "voted" : "not yet voted"} · Cre8 Sound: ${soundVoted.exists() ? "voted" : "not yet voted"}</p>
  `;
}

function renderContestantsAdmin(compId) {
  const comp = COMPETITIONS.find((c) => c.id === compId);
  const container = el(`contestants-${compId}`);
  const list = contestantsCache[compId];
  if (!list.length) {
    container.innerHTML = '<p class="lead">No finalists added yet.</p>';
    return;
  }
  container.innerHTML = list.map((c) => `
    <div class="contestant-admin-row" data-id="${c.id}">
      <input type="number" class="num-input" value="${escapeHtml(c.number ?? "")}" data-field="number" />
      <input type="text" value="${escapeHtml(c.name ?? "")}" data-field="name" />
      <button class="btn-ghost btn-small save-btn" style="width:auto">Save</button>
      <button class="btn-ghost btn-small delete-btn" style="width:auto">Delete</button>
    </div>
  `).join("");

  container.querySelectorAll(".save-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const row = btn.closest(".contestant-admin-row");
      const id = row.dataset.id;
      const name = row.querySelector('[data-field="name"]').value.trim();
      const number = parseInt(row.querySelector('[data-field="number"]').value, 10) || 0;
      await setDoc(doc(db, comp.contestantsCollection, id), { name, number }, { merge: true });
    });
  });

  container.querySelectorAll(".delete-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const row = btn.closest(".contestant-admin-row");
      const id = row.dataset.id;
      if (confirm("Remove this finalist?")) {
        await deleteDoc(doc(db, comp.contestantsCollection, id));
      }
    });
  });
}

async function addContestant(compId) {
  const comp = COMPETITIONS.find((c) => c.id === compId);
  const nameInput = el(`new-name-${compId}`);
  const numInput = el(`new-num-${compId}`);
  const name = nameInput.value.trim();
  const number = parseInt(numInput.value, 10) || 0;
  if (!name) return;
  const ref = doc(collection(db, comp.contestantsCollection));
  await setDoc(ref, { name, number });
  nameInput.value = "";
  numInput.value = "";
}

function renderResults(compId) {
  const list = contestantsCache[compId];
  const votes = votesCache[compId];
  const tbody = el(`results-${compId}`).querySelector("tbody");
  if (!list.length) {
    tbody.innerHTML = '<tr><td>No finalists yet.</td></tr>';
    return;
  }
  const totals = {};
  list.forEach((c) => { totals[c.id] = 0; });
  Object.values(votes).forEach((v) => {
    Object.entries(v.allocations || {}).forEach(([id, pts]) => {
      totals[id] = (totals[id] || 0) + pts;
    });
  });
  const maxTotal = Math.max(1, ...Object.values(totals));
  const rows = list
    .slice()
    .sort((a, b) => (totals[b.id] || 0) - (totals[a.id] || 0))
    .map((c) => {
      const total = totals[c.id] || 0;
      const pct = Math.round((total / maxTotal) * 100);
      return `
        <tr>
          <td>${escapeHtml(c.number ?? "")} ${escapeHtml(c.name ?? "")}</td>
          <td style="width:45%">
            <div class="bar-bg"><div class="bar-fill" style="width:${pct}%"></div></div>
          </td>
          <td style="text-align:right;font-weight:700">${total}</td>
        </tr>
      `;
    }).join("");
  tbody.innerHTML = rows;
}

init();
