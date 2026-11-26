import {
  db, doc, getDoc, setDoc, onSnapshot, collection, serverTimestamp,
  ensureSignedIn, normalizePhone, isValidPhoneInput, COMPETITIONS, escapeHtml,
} from "./common.js";

const el = (id) => document.getElementById(id);
const show = (id) => el(id).classList.remove("hidden");
const hide = (id) => el(id).classList.add("hidden");

let currentPhone = null;
let currentVoter = null; // { points }
let currentCompId = null;
let configData = {};
let contestantsCache = {};
let allocations = {};

function setScreen(name) {
  ["screen-login", "screen-home", "screen-vote", "screen-voted"].forEach((s) => hide(s));
  show(`screen-${name}`);
}

function competitionStatus(compId) {
  const key = `${compId}Open`;
  return configData[key] ? "open" : "closed";
}

async function init() {
  try {
    await ensureSignedIn();
  } catch (e) {
    console.error("Sign-in failed", e);
  }

  // Live config (open/closed state for each competition).
  onSnapshot(doc(db, "config", "main"), (snap) => {
    configData = snap.exists() ? snap.data() : {};
    if (!el("screen-home").classList.contains("hidden")) {
      refreshHomeStatus();
    }
    if (currentCompId && !el("screen-vote").classList.contains("hidden")) {
      if (competitionStatus(currentCompId) !== "open") {
        el("vote-error").textContent = "Voting for this competition has just been closed by the organiser.";
        show("vote-error");
        el("submit-vote-btn").disabled = true;
      }
    }
  });

  const saved = sessionStorage.getItem("cf_phone");
  if (saved) {
    currentPhone = saved;
    await loadVoterAndShowHome();
  }

  el("login-btn").addEventListener("click", onLogin);
  el("phone-input").addEventListener("keydown", (e) => { if (e.key === "Enter") onLogin(); });
  el("logout-btn").addEventListener("click", () => {
    sessionStorage.removeItem("cf_phone");
    currentPhone = null;
    setScreen("login");
  });
  el("back-btn").addEventListener("click", () => setScreen("home"));
  el("voted-back-btn").addEventListener("click", () => setScreen("home"));
  el("btn-vote-movement").addEventListener("click", () => openVoteScreen("movement"));
  el("btn-vote-sound").addEventListener("click", () => openVoteScreen("sound"));
  el("submit-vote-btn").addEventListener("click", submitVote);
}

async function onLogin() {
  const raw = el("phone-input").value;
  hide("login-error");
  if (!isValidPhoneInput(raw)) {
    el("login-error").textContent = "Please enter a valid phone number.";
    show("login-error");
    return;
  }
  const phone = normalizePhone(raw);
  el("login-btn-label").innerHTML = '<span class="spinner"></span> Checking...';
  el("login-btn").disabled = true;
  try {
    const snap = await getDoc(doc(db, "voters", phone));
    if (!snap.exists()) {
      el("login-error").textContent = "We couldn't find this number. Please check with the registration booth.";
      show("login-error");
      return;
    }
    currentPhone = phone;
    currentVoter = snap.data();
    sessionStorage.setItem("cf_phone", phone);
    await showHome();
  } catch (e) {
    console.error(e);
    el("login-error").textContent = "Something went wrong, please try again.";
    show("login-error");
  } finally {
    el("login-btn-label").textContent = "Continue";
    el("login-btn").disabled = false;
  }
}

async function loadVoterAndShowHome() {
  const snap = await getDoc(doc(db, "voters", currentPhone));
  if (!snap.exists()) {
    sessionStorage.removeItem("cf_phone");
    currentPhone = null;
    setScreen("login");
    return;
  }
  currentVoter = snap.data();
  await showHome();
}

async function showHome() {
  el("points-value").textContent = currentVoter?.points ?? 0;
  await refreshHomeStatus();
  setScreen("home");
}

async function refreshHomeStatus() {
  for (const comp of COMPETITIONS) {
    const status = competitionStatus(comp.id);
    const votedSnap = await getDoc(doc(db, comp.votesCollection, currentPhone));
    const pillEl = el(`pill-${comp.id}`);
    const btnEl = el(`btn-vote-${comp.id}`);
    if (votedSnap.exists()) {
      pillEl.textContent = "You already voted";
      pillEl.className = "pill voted";
      btnEl.textContent = "View my vote";
      btnEl.disabled = false;
      btnEl.onclick = () => showVotedScreen(comp.id, votedSnap.data());
    } else if (status === "open") {
      pillEl.textContent = "Voting open";
      pillEl.className = "pill open";
      btnEl.textContent = "Vote now";
      btnEl.disabled = false;
      btnEl.onclick = () => openVoteScreen(comp.id);
    } else {
      pillEl.textContent = "Voting not open yet";
      pillEl.className = "pill closed";
      btnEl.textContent = "Not open yet";
      btnEl.disabled = true;
    }
  }
}

async function openVoteScreen(compId) {
  const comp = COMPETITIONS.find((c) => c.id === compId);
  if (competitionStatus(compId) !== "open") return;

  const votedSnap = await getDoc(doc(db, comp.votesCollection, currentPhone));
  if (votedSnap.exists()) {
    showVotedScreen(compId, votedSnap.data());
    return;
  }

  currentCompId = compId;
  allocations = {};
  el("vote-title").textContent = comp.label;
  hide("vote-error");

  const contestantsSnap = await getDoc(doc(db, "config", "main")); // ensures config fresh (lightweight)
  const list = await fetchContestants(comp.contestantsCollection);
  contestantsCache[compId] = list;

  renderContestants(list);
  updateRemaining();
  setScreen("vote");
}

function fetchContestants(collectionName) {
  return new Promise((resolve) => {
    onSnapshot(collection(db, collectionName), (snap) => {
      const list = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      list.sort((a, b) => (a.number ?? 0) - (b.number ?? 0));
      resolve(list);
    }, () => resolve([]));
  });
}

function renderContestants(list) {
  const container = el("contestant-list");
  if (!list.length) {
    container.innerHTML = '<p class="lead">No finalists have been added for this competition yet.</p>';
    return;
  }
  container.innerHTML = list.map((c) => `
    <div class="contestant-row">
      <div class="contestant-info">
        <div class="contestant-num">${escapeHtml(c.number ?? "?")}</div>
        <div class="contestant-name">${escapeHtml(c.name ?? "Unnamed")}</div>
      </div>
      <div class="stepper">
        <button type="button" data-action="dec" data-id="${c.id}">-</button>
        <input type="number" min="0" value="0" data-id="${c.id}" />
        <button type="button" data-action="inc" data-id="${c.id}">+</button>
      </div>
    </div>
  `).join("");

  container.querySelectorAll("button[data-action]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      const input = container.querySelector(`input[data-id="${id}"]`);
      let val = parseInt(input.value, 10) || 0;
      val += btn.dataset.action === "inc" ? 1 : -1;
      if (val < 0) val = 0;
      input.value = val;
      allocations[id] = val;
      updateRemaining();
    });
  });

  container.querySelectorAll("input[data-id]").forEach((input) => {
    input.addEventListener("input", () => {
      let val = parseInt(input.value, 10);
      if (isNaN(val) || val < 0) val = 0;
      input.value = val;
      allocations[input.dataset.id] = val;
      updateRemaining();
    });
  });
}

function updateRemaining() {
  const used = Object.values(allocations).reduce((a, b) => a + b, 0);
  const total = currentVoter?.points ?? 0;
  const remaining = total - used;
  el("vote-points-remaining").textContent = remaining;
  const banner = el("vote-points-banner");
  banner.classList.toggle("negative", remaining < 0);
  el("submit-vote-btn").disabled = remaining < 0 || used === 0;
}

async function submitVote() {
  if (!currentCompId) return;
  const comp = COMPETITIONS.find((c) => c.id === currentCompId);
  const used = Object.values(allocations).reduce((a, b) => a + b, 0);
  const total = currentVoter?.points ?? 0;
  if (used === 0) {
    el("vote-error").textContent = "Please give at least one point to a finalist.";
    show("vote-error");
    return;
  }
  if (used > total) {
    el("vote-error").textContent = "You've allocated more points than you have.";
    show("vote-error");
    return;
  }

  const cleanAllocations = {};
  Object.entries(allocations).forEach(([k, v]) => { if (v > 0) cleanAllocations[k] = v; });

  el("submit-vote-btn").disabled = true;
  el("submit-vote-btn").innerHTML = '<span class="spinner"></span> Submitting...';
  try {
    await setDoc(doc(db, comp.votesCollection, currentPhone), {
      phone: currentPhone,
      allocations: cleanAllocations,
      pointsUsed: used,
      submittedAt: serverTimestamp(),
    });
    showVotedScreen(currentCompId, { allocations: cleanAllocations });
    refreshHomeStatus();
  } catch (e) {
    console.error(e);
    el("vote-error").textContent = "Could not submit your vote (it may already be submitted, or voting just closed). Please go back and try again.";
    show("vote-error");
  } finally {
    el("submit-vote-btn").textContent = "Submit my vote";
  }
}

function showVotedScreen(compId, data) {
  const comp = COMPETITIONS.find((c) => c.id === compId);
  el("voted-title").textContent = `Thanks for voting in ${comp.label}!`;
  const list = contestantsCache[compId] || [];
  const nameFor = (id) => {
    const found = list.find((c) => c.id === id);
    return found ? found.name : id;
  };
  const rows = Object.entries(data.allocations || {})
    .filter(([, pts]) => pts > 0)
    .map(([id, pts]) => `<div class="contestant-row"><div class="contestant-name">${escapeHtml(nameFor(id))}</div><strong>${pts} pt${pts === 1 ? "" : "s"}</strong></div>`)
    .join("") || '<p class="lead">No breakdown available.</p>';
  el("voted-breakdown").innerHTML = rows;
  setScreen("voted");
}

init();
