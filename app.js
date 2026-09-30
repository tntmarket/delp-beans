const STORAGE_KEY = "delp-beans-state-v1";
const MAX_MATCHING_ATTEMPTS = 300;

const elements = {
  addForm: document.querySelector("#add-person-form"),
  nameInput: document.querySelector("#person-name"),
  roleInput: document.querySelector("#person-role"),
  peopleList: document.querySelector("#people-list"),
  peopleCount: document.querySelector("#people-count"),
  peopleEmpty: document.querySelector("#people-empty"),
  historyList: document.querySelector("#history-list"),
  historyCount: document.querySelector("#round-count"),
  historyEmpty: document.querySelector("#history-empty"),
  statsRoundCount: document.querySelector("#stats-round-count"),
  statTotalMeetings: document.querySelector("#stat-total-meetings"),
  statUniquePairs: document.querySelector("#stat-unique-pairs"),
  statCrossFunction: document.querySelector("#stat-cross-function"),
  statCrossShare: document.querySelector("#stat-cross-share"),
  statFunctions: document.querySelector("#stat-functions"),
  roleHeatmap: document.querySelector("#role-heatmap"),
  heatmapNote: document.querySelector("#heatmap-note"),
  statsEmpty: document.querySelector("#stats-empty"),
  createRound: document.querySelector("#create-round"),
  simulateWeek: document.querySelector("#simulate-week"),
  resetWeek: document.querySelector("#reset-week"),
  roundDescription: document.querySelector("#round-description"),
  weekLabel: document.querySelector("#week-label"),
  status: document.querySelector("#status-message"),
};

let state = loadState();

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (
      saved &&
      Array.isArray(saved.people) &&
      Array.isArray(saved.rounds) &&
      saved.people.every((person) => typeof person.id === "string" && typeof person.name === "string") &&
      saved.rounds.every((round) => Array.isArray(round.pairs))
    ) {
      return {
        ...saved,
        weekOffset: Number.isInteger(saved.weekOffset) && saved.weekOffset > 0 ? saved.weekOffset : 0,
      };
    }
  } catch {
    // A missing, malformed, or unavailable local store starts with an empty club.
  }

  return { people: [], rounds: [], weekOffset: 0 };
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    showStatus("Couldn’t save changes in this browser. Check your browser storage settings.", true);
    return false;
  }
}

function createId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function showStatus(message, isError = false) {
  elements.status.textContent = message;
  elements.status.classList.toggle("is-error", isError);
}

function initials(name) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toLocaleUpperCase();
}

function makeElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function renderPeople() {
  elements.peopleList.replaceChildren();
  elements.peopleCount.textContent = String(state.people.length);
  elements.peopleEmpty.hidden = state.people.length > 0;

  for (const person of state.people) {
    const row = makeElement("li", "person-row");
    const avatar = makeElement("span", "avatar", initials(person.name));
    avatar.setAttribute("aria-hidden", "true");
    const name = makeElement("span", "person-name", person.name);
    makeEditableField(name, person, "name");
    const details = makeElement("div", "person-details");
    const role = makeElement("span", person.role ? "person-role" : "person-role is-empty", person.role || "Add role");
    makeEditableField(role, person, "role");
    const remove = makeElement("button", "remove-button", "Remove");
    remove.type = "button";
    remove.setAttribute("aria-label", `Remove ${person.name}`);
    remove.addEventListener("click", () => removePerson(person.id));
    details.append(name, role);
    row.append(avatar, details, remove);
    elements.peopleList.append(row);
  }
}

function makeEditableField(field, person, key) {
  field.contentEditable = "true";
  field.setAttribute("role", "textbox");
  field.setAttribute("aria-label", key === "name" ? "Edit member name" : `Edit job role for ${person.name}`);
  field.setAttribute("spellcheck", "false");
  field.title = "Click to edit";

  field.addEventListener("focus", () => {
    if (key === "role" && !person.role) field.textContent = "";
  });
  field.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      field.blur();
    } else if (event.key === "Escape") {
      event.preventDefault();
      field.textContent = person[key] || (key === "role" ? "Add role" : person.name);
      field.blur();
    }
  });
  field.addEventListener("blur", () => {
    const updated = field.textContent.trim().replace(/\s+/g, " ");
    const value = key === "name" && !updated ? person.name : updated;

    if (key === "name" && state.people.some((other) =>
      other.id !== person.id && other.name.toLocaleLowerCase() === value.toLocaleLowerCase()
    )) {
      showStatus(`${value} is already on the club list.`, true);
      render();
      return;
    }

    if (value === (person[key] ?? "")) {
      field.textContent = value || (key === "role" ? "Add role" : person.name);
      return;
    }

    person[key] = value;
    const saved = saveState();
    render();
    if (saved) showStatus(`${key === "name" ? "Name" : "Job role"} updated.`);
  });
}

function formatRoundDate(dateString) {
  const date = new Date(`${dateString}T12:00:00`);
  return new Intl.DateTimeFormat(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function personName(id, fallback) {
  return fallback ?? state.people.find((person) => person.id === id)?.name ?? "Former member";
}

function personRole(id, fallback) {
  return fallback ?? state.people.find((person) => person.id === id)?.role ?? "";
}

function makeHistoryPerson(id, round) {
  const person = makeElement("span", "match-person");
  person.append(makeElement("span", "match-name", personName(id, round.names?.[id])));
  const role = personRole(id, round.roles?.[id]);
  if (role) person.append(makeElement("span", "person-role match-role", role));
  return person;
}

function renderHistory() {
  elements.historyList.replaceChildren();
  const rounds = [...state.rounds].sort((a, b) => b.date.localeCompare(a.date));
  elements.historyCount.textContent = `${rounds.length} ${rounds.length === 1 ? "round" : "rounds"}`;
  elements.historyEmpty.hidden = rounds.length > 0;

  for (const round of rounds) {
    const section = makeElement("article", "history-round");
    const date = makeElement("p", "round-date", formatRoundDate(round.date));
    const matches = makeElement("div", "match-list");

    for (const pair of round.pairs) {
      const match = makeElement("div", "match-row");
      match.append(
        makeHistoryPerson(pair[0], round),
        makeElement("span", "match-ampersand", "&"),
        makeHistoryPerson(pair[1], round),
      );
      matches.append(match);
    }

    section.append(date, matches);
    if (round.sitOut) {
      section.append(makeElement("p", "sit-out", `${personName(round.sitOut, round.names?.[round.sitOut])} sat this one out.`));
    }
    elements.historyList.append(section);
  }
}

function renderStats() {
  const rounds = [...state.rounds].sort((a, b) => b.date.localeCompare(a.date));
  const roleLabels = new Map();
  const matrix = new Map();
  const uniquePairs = new Set();
  let totalMeetings = 0;
  let crossFunctionMeetings = 0;
  let roleKnownMeetings = 0;

  function roleFor(round, personId) {
    const role = round.roles?.[personId]?.trim();
    if (!role) return { key: "__role_not_set__", label: "Role not set" };
    const key = role.toLocaleLowerCase();
    if (!roleLabels.has(key)) roleLabels.set(key, role);
    return { key, label: roleLabels.get(key) };
  }

  function increment(row, column) {
    const rowCounts = matrix.get(row) ?? new Map();
    rowCounts.set(column, (rowCounts.get(column) ?? 0) + 1);
    matrix.set(row, rowCounts);
  }

  for (const round of rounds) {
    for (const pair of round.pairs) {
      if (!Array.isArray(pair) || pair.length < 2) continue;
      const [firstId, secondId] = pair;
      totalMeetings += 1;
      uniquePairs.add(pairKey(firstId, secondId));

      const firstRole = roleFor(round, firstId);
      const secondRole = roleFor(round, secondId);
      if (firstRole.key !== "__role_not_set__" && secondRole.key !== "__role_not_set__") {
        roleKnownMeetings += 1;
        if (firstRole.key !== secondRole.key) crossFunctionMeetings += 1;
      }
      increment(firstRole.key, secondRole.key);
      if (firstRole.key !== secondRole.key) increment(secondRole.key, firstRole.key);
    }
  }

  const roleKeys = [...roleLabels.keys()].sort((first, second) =>
    roleLabels.get(first).localeCompare(roleLabels.get(second)),
  );
  const hasUnspecifiedRole = [...matrix.keys()].includes("__role_not_set__");
  if (hasUnspecifiedRole) roleKeys.push("__role_not_set__");

  elements.statsRoundCount.textContent = `Across ${rounds.length} ${rounds.length === 1 ? "round" : "rounds"}`;
  elements.statTotalMeetings.textContent = String(totalMeetings);
  elements.statUniquePairs.textContent = String(uniquePairs.size);
  elements.statCrossFunction.textContent = String(crossFunctionMeetings);
  elements.statCrossShare.textContent = roleKnownMeetings
    ? `${Math.round((crossFunctionMeetings / roleKnownMeetings) * 100)}% of role-known introductions`
    : "Add roles to see cross-functional matches";
  elements.statFunctions.textContent = String(roleLabels.size);
  elements.statsEmpty.hidden = totalMeetings > 0;
  elements.roleHeatmap.replaceChildren();

  const maximum = Math.max(
    0,
    ...roleKeys.flatMap((row) => roleKeys.map((column) => matrix.get(row)?.get(column) ?? 0)),
  );

  if (roleKeys.length > 0) {
    const labelFor = (key) => key === "__role_not_set__" ? "Role not set" : roleLabels.get(key);
    const table = makeElement("table", "heatmap-table");
    const caption = makeElement("caption", "sr-only", "Number of introductions between job functions");
    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");
    const corner = makeElement("th", "heatmap-axis-label", "Function");
    corner.scope = "col";
    headerRow.append(corner);
    for (const column of roleKeys) {
      const header = makeElement("th", "", labelFor(column));
      header.scope = "col";
      headerRow.append(header);
    }
    thead.append(headerRow);

    const tbody = document.createElement("tbody");
    for (const rowKey of roleKeys) {
      const row = document.createElement("tr");
      const rowHeader = makeElement("th", "", labelFor(rowKey));
      rowHeader.scope = "row";
      row.append(rowHeader);

      for (const columnKey of roleKeys) {
        const count = matrix.get(rowKey)?.get(columnKey) ?? 0;
        const cell = document.createElement("td");
        const intensity = maximum ? count / maximum : 0;
        const value = makeElement("span", `heatmap-cell${count === maximum && count > 0 ? " is-maximum" : ""}`, String(count));
        value.style.backgroundColor = count
          ? `rgba(41, 92, 66, ${0.08 + intensity * 0.76})`
          : "#f4f3ed";
        if (intensity > 0.58) value.style.color = "#ffffff";
        cell.append(value);
        row.append(cell);
      }
      tbody.append(row);
    }

    table.append(caption, thead, tbody);
    elements.roleHeatmap.append(table);
  }

  if (totalMeetings === 0) {
    elements.heatmapNote.textContent = "";
  } else if (roleLabels.size === 0) {
    elements.heatmapNote.textContent = "These earlier pairings have no saved role details yet.";
  } else if (roleLabels.size < 2) {
    elements.heatmapNote.textContent = "Add members from another function to see cross-functional connections.";
  } else if (hasUnspecifiedRole) {
    elements.heatmapNote.textContent = "Pairings without role details are grouped under “Role not set”.";
  } else {
    elements.heatmapNote.textContent = "Counts include repeat meetings across different weekly rounds.";
  }
}

function getSimulatedDate() {
  const date = new Date();
  date.setDate(date.getDate() + state.weekOffset * 7);
  return date;
}

function getWeekStart(date) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const daysSinceMonday = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - daysSinceMonday);
  return start;
}

function formatWeekLabel() {
  const weekStart = getWeekStart(getSimulatedDate());
  const date = new Intl.DateTimeFormat(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(weekStart);
  return state.weekOffset
    ? `Week of ${date} · Simulated +${state.weekOffset} ${state.weekOffset === 1 ? "week" : "weeks"}`
    : `Week of ${date} · Live calendar`;
}

function getWeekKey(date = getSimulatedDate()) {
  const day = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const weekday = day.getUTCDay() || 7;
  day.setUTCDate(day.getUTCDate() + 4 - weekday);
  const yearStart = new Date(Date.UTC(day.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((day - yearStart) / 86400000) + 1) / 7);
  return `${day.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function pairKey(firstId, secondId) {
  return [firstId, secondId].sort().join("::");
}

function randomize(items) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = Math.floor(Math.random() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}

function getPairingHistory() {
  const history = new Map();
  const rounds = [...state.rounds].sort((a, b) => b.date.localeCompare(a.date));
  rounds.forEach((round, index) => {
    for (const pair of round.pairs) {
      const key = pairKey(pair[0], pair[1]);
      const record = history.get(key) ?? { count: 0, latestRound: index };
      record.count += 1;
      record.latestRound = Math.min(record.latestRound, index);
      history.set(key, record);
    }
  });
  return history;
}

function getSitOutCounts() {
  const counts = new Map(state.people.map((person) => [person.id, 0]));
  for (const round of state.rounds) {
    if (round.sitOut && counts.has(round.sitOut)) {
      counts.set(round.sitOut, counts.get(round.sitOut) + 1);
    }
  }
  return counts;
}

function hasSameKnownRole(firstId, secondId, roles) {
  const firstRole = roles.get(firstId);
  const secondRole = roles.get(secondId);
  return Boolean(firstRole && secondRole && firstRole === secondRole);
}

function matchingScore(pairs, history, sitOutCount, roles) {
  let repeatedPairs = 0;
  let sameRolePairs = 0;
  let previousPairCount = 0;
  let recentPairWeight = 0;

  for (const [firstId, secondId] of pairs) {
    if (hasSameKnownRole(firstId, secondId, roles)) sameRolePairs += 1;
    const record = history.get(pairKey(firstId, secondId));
    if (record) {
      repeatedPairs += 1;
      previousPairCount += record.count;
      recentPairWeight += 1 / (record.latestRound + 1);
    }
  }

  return [repeatedPairs, sameRolePairs, previousPairCount, recentPairWeight, sitOutCount];
}

function scoreIsBetter(candidate, current) {
  for (let index = 0; index < candidate.length; index += 1) {
    if (Math.abs(candidate[index] - current[index]) < 1e-9) continue;
    return candidate[index] < current[index];
  }
  return false;
}

function createBestMatching() {
  const history = getPairingHistory();
  const sitOutCounts = getSitOutCounts();
  const roles = new Map(state.people.map((person) => [person.id, person.role?.trim().toLocaleLowerCase() ?? ""]));
  let best = null;

  for (let attempt = 0; attempt < MAX_MATCHING_ATTEMPTS; attempt += 1) {
    let available = randomize(state.people);
    let sitOut = null;

    if (available.length % 2 === 1) {
      sitOut = available[0];
      available = available.filter((person) => person.id !== sitOut.id);
    }

    const pairs = [];
    while (available.length > 0) {
      const first = available.shift();
      let bestIndex = 0;
      let bestPartnerScore = null;

      for (let index = 0; index < available.length; index += 1) {
        const partner = available[index];
        const record = history.get(pairKey(first.id, partner.id));
        const score = [
          record ? 1 : 0,
          hasSameKnownRole(first.id, partner.id, roles) ? 1 : 0,
          record?.count ?? 0,
          record ? 1 / (record.latestRound + 1) : 0,
          Math.random(),
        ];
        if (!bestPartnerScore || scoreIsBetter(score, bestPartnerScore)) {
          bestPartnerScore = score;
          bestIndex = index;
        }
      }

      const [partner] = available.splice(bestIndex, 1);
      pairs.push([first.id, partner.id]);
    }

    const score = matchingScore(
      pairs,
      history,
      sitOut ? sitOutCounts.get(sitOut.id) ?? 0 : 0,
      roles,
    );
    if (!best || scoreIsBetter(score, best.score)) {
      best = { pairs, sitOut: sitOut?.id ?? null, score };
    }
  }

  return best;
}

function renderRoundAction() {
  const alreadyMatched = state.rounds.some((round) => round.weekKey === getWeekKey());
  const hasEnoughPeople = state.people.length >= 2;
  elements.createRound.disabled = alreadyMatched || !hasEnoughPeople;
  elements.weekLabel.textContent = formatWeekLabel();
  elements.resetWeek.hidden = state.weekOffset === 0;

  if (alreadyMatched) {
    elements.roundDescription.textContent = "This week’s pairings are ready. Come back next week for a fresh round.";
    elements.createRound.innerHTML = "This week’s pairs are ready <span aria-hidden=\"true\">✓</span>";
  } else if (!hasEnoughPeople) {
    elements.roundDescription.textContent = "Add at least two club members to create this week’s pairings.";
    elements.createRound.innerHTML = "Create this week’s pairs <span aria-hidden=\"true\">→</span>";
  } else {
    elements.roundDescription.textContent = "We’ll use past pairings to make this week’s introductions as fresh as possible.";
    elements.createRound.innerHTML = "Create this week’s pairs <span aria-hidden=\"true\">→</span>";
  }
}

function render() {
  renderPeople();
  renderHistory();
  renderStats();
  renderRoundAction();
}

function addPerson(name, role) {
  const cleanName = name.trim().replace(/\s+/g, " ");
  const cleanRole = role.trim().replace(/\s+/g, " ");
  if (!cleanName) return;
  if (state.people.some((person) => person.name.toLocaleLowerCase() === cleanName.toLocaleLowerCase())) {
    showStatus(`${cleanName} is already on the club list.`, true);
    return;
  }

  state.people.push({ id: createId(), name: cleanName, role: cleanRole });
  if (saveState()) {
    showStatus(`${cleanName} added to the club.`);
    elements.nameInput.value = "";
    elements.roleInput.value = "";
  }
  render();
}

function removePerson(id) {
  const person = state.people.find((entry) => entry.id === id);
  state.people = state.people.filter((entry) => entry.id !== id);
  if (saveState()) showStatus(`${person?.name ?? "Member"} removed. Past pairings are kept in the history.`);
  render();
}

function createRound() {
  if (state.people.length < 2) {
    showStatus("Add at least two people before creating pairings.", true);
    return;
  }
  if (state.rounds.some((round) => round.weekKey === getWeekKey())) {
    showStatus("This week’s pairings have already been created.", true);
    render();
    return;
  }

  const matching = createBestMatching();
  const date = getSimulatedDate();
  const dateString = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
  const round = {
    id: createId(),
    date: dateString,
    weekKey: getWeekKey(date),
    pairs: matching.pairs,
    sitOut: matching.sitOut,
    names: Object.fromEntries(state.people.map((person) => [person.id, person.name])),
    roles: Object.fromEntries(state.people.map((person) => [person.id, person.role ?? ""])),
  };

  state.rounds.push(round);
  if (saveState()) {
    const pairCount = matching.pairs.length;
    showStatus(`This week’s ${pairCount === 1 ? "pair is" : `${pairCount} pairs are`} ready. Let the good conversations begin.`);
  }
  render();
}

function simulateNextWeek() {
  state.weekOffset += 1;
  if (saveState()) showStatus(`Advanced to ${formatWeekLabel()}.`);
  render();
}

function resetWeek() {
  state.weekOffset = 0;
  if (saveState()) showStatus("Returned to the real calendar week.");
  render();
}

function handleKeyboardShortcut(event) {
  const target = event.target;
  const isTyping = target?.isContentEditable ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(target?.tagName);
  if (
    isTyping ||
    event.altKey ||
    event.ctrlKey ||
    event.metaKey ||
    event.shiftKey ||
    event.repeat
  ) return;

  const shortcuts = {
    a: () => elements.addForm.requestSubmit(),
    p: () => {
      if (!elements.createRound.disabled) elements.createRound.click();
    },
    w: () => elements.simulateWeek.click(),
    r: () => {
      if (!elements.resetWeek.hidden) elements.resetWeek.click();
    },
  };
  const action = shortcuts[event.key.toLocaleLowerCase()];
  if (!action) return;

  event.preventDefault();
  action();
}

elements.addForm.addEventListener("submit", (event) => {
  event.preventDefault();
  addPerson(elements.nameInput.value, elements.roleInput.value);
});
elements.createRound.addEventListener("click", createRound);
elements.simulateWeek.addEventListener("click", simulateNextWeek);
elements.resetWeek.addEventListener("click", resetWeek);
document.addEventListener("keydown", handleKeyboardShortcut);

render();
