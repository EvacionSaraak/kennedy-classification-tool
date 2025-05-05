// ========== State & Constants ==========
let isUserTyping = false;
let typingTimeout;
let toggleMissing = new Set();
let isDragging = false;
let dragMode = null;
let lastDragged = null;

const thirdMolars = [1, 16, 17, 32];
const secondMolars = [2, 15, 18, 31];

const descriptors = {
  "Class I": "Bilateral distal extension (posterior teeth missing on both sides)",
  "Class II": "Unilateral distal extension (posterior teeth missing on one side)",
  "Class III": "Unilateral bounded edentulous space (bounded by natural teeth)",
  "Class IV": "Single bilateral anterior space crossing the midline",
  "Unspecified": "No classification applies"
};

// ========== Utility Functions ==========
function capitalizeFirstLetter(val) {
  return String(val).charAt(0).toUpperCase() + String(val).slice(1);
}

function getToothType(n) {
  if ([1,2,3,14,15,16,17,18,19,30,31,32].includes(n)) return 'molar';
  if ([4,5,12,13,20,21,28,29].includes(n)) return 'premolar';
  if ([6,11,22,27].includes(n)) return 'canine';
  return 'incisor';
}

function getGaps(range, missing) {
  const gaps = [];
  let current = [];

  for (const tooth of range) {
    if (missing.includes(tooth)) current.push(tooth);
    else if (current.length) {
      gaps.push([...current]);
      current = [];
    }
  }
  if (current.length) gaps.push([...current]);
  return gaps;
}

function formatClassification(item) {
  const label = item.mod
    ? `<strong>${item.class} modification ${item.mod}</strong>`
    : `<strong>${item.class}</strong>`;
  return `${label}<br><em>${item.desc}</em>`;
}

// ========== Classification ==========
function classifyArch(selected, archRange, ignoreThird, ignoreSecond) {
  const isIgnored = t =>
    (ignoreThird && thirdMolars.includes(t)) ||
    (ignoreSecond && secondMolars.includes(t));

  const effectiveArch = archRange.filter(t => !isIgnored(t));
  const effectiveMissing = selected.filter(t => effectiveArch.includes(t));
  if (effectiveMissing.length === 0) return null;

  const gaps = getGaps(effectiveArch, effectiveMissing);
  if (gaps.length === 0) return null;

  const leftMost = effectiveArch[0];
  const rightMost = effectiveArch[effectiveArch.length - 1];
  const hasLeftDistal = effectiveMissing.includes(leftMost);
  const hasRightDistal = effectiveMissing.includes(rightMost);

  const isMaxillary = archRange[0] < 17;
  const anteriorRange = isMaxillary ? [6, 7, 8, 9, 10, 11] : [22, 23, 24, 25, 26, 27];
  const midlineTeeth = isMaxillary ? [8, 9] : [24, 25];

  // CLASS IV STRICT CHECK
  const isSingleGap = gaps.length === 1;
  const singleGapTeeth = isSingleGap ? gaps[0] : [];
  const isInAnterior = singleGapTeeth.every(t => anteriorRange.includes(t));
  const crossesMidline = midlineTeeth.every(t => singleGapTeeth.includes(t));

  if (isSingleGap && isInAnterior && crossesMidline) {
    return { class: "Class IV", desc: descriptors["Class IV"] };
  }

  // Unspecified if both distal ends are missing (i.e., reaches both ends)
  const reachesBothEnds = hasLeftDistal && hasRightDistal && crossesMidline;
  if (reachesBothEnds) {
    return { class: "Unspecified", desc: descriptors["Unspecified"] };
  }

  // Class I: bilateral posterior extension
  if (hasLeftDistal && hasRightDistal) {
    const mod = gaps.length - 2 > 0 ? gaps.length - 2 : undefined;
    return { class: "Class I", desc: descriptors["Class I"], mod };
  }

  // Class II: unilateral posterior extension
  if (hasLeftDistal || hasRightDistal) {
    const mod = gaps.length - 1 > 0 ? gaps.length - 1 : undefined;
    return { class: "Class II", desc: descriptors["Class II"], mod };
  }

  // Class III: single bounded gap
  if (gaps.length === 1) {
    return { class: "Class III", desc: descriptors["Class III"] };
  }

  // Class III with modification
  if (gaps.length > 1) {
    return { class: "Class III", desc: descriptors["Class III"], mod: gaps.length - 1 };
  }

  return { class: "Unspecified", desc: descriptors["Unspecified"] };
}


// ========== Grid & Render ==========
function createGrid(id, start, end, reverse = false) {
  const grid = document.getElementById(id);
  const range = reverse
    ? Array.from({ length: end - start + 1 }, (_, i) => end - i)
    : Array.from({ length: end - start + 1 }, (_, i) => start + i);

  range.forEach(t => {
    const wrapper = document.createElement('div');
    wrapper.className = 'tooth-wrapper';
    wrapper.innerHTML = `
      <div class="tooth-button ${getToothType(t)}" data-tooth="${t}">
        <span class="tooth-label">${t}</span>
      </div>
      <span class="tooth-type-label">${capitalizeFirstLetter(getToothType(t))}</span>`;
    grid.appendChild(wrapper);
  });
}

function renderButtons() {
  document.querySelectorAll('.tooth-button').forEach(btn => {
    const n = +btn.dataset.tooth;
    btn.classList.toggle('selected', toggleMissing.has(n));
  });
  syncText();
  updateDisabledTeeth();
  updateOutput();
}

function updateDisabledTeeth() {
  const ig3 = document.getElementById('ignoreThirdMolars').checked;
  const ig2 = document.getElementById('ignoreSecondMolars').checked;
  document.querySelectorAll('.tooth-button').forEach(btn => {
    const t = +btn.dataset.tooth;
    const disable3 = ig3 && thirdMolars.includes(t);
    const disable2 = ig2 && secondMolars.includes(t);
    btn.classList.toggle('disabled', disable3 || disable2);
  });
}

// ========== Input & Interaction ==========
function syncText() {
  if (isUserTyping) return;
  const sorted = Array.from(toggleMissing).sort((a, b) => a - b);
  document.getElementById('teethInput').value = sorted.join(',');
}

function toggleTooth(n) {
  toggleMissing.has(n) ? toggleMissing.delete(n) : toggleMissing.add(n);
}

function onMouseDown(e) {
  const btn = e.target.closest('.tooth-button');
  if (!btn || btn.classList.contains('disabled')) return;
  const t = +btn.dataset.tooth;
  dragMode = toggleMissing.has(t) ? 'remove' : 'add';
  isDragging = true;
  lastDragged = null;
  toggleTooth(t);
  renderButtons();
}

function onMouseEnter(e) {
  if (!isDragging) return;
  const btn = e.target.closest('.tooth-button');
  if (!btn || btn.classList.contains('disabled')) return;
  const t = +btn.dataset.tooth;
  if (t === lastDragged) return;
  lastDragged = t;
  if (dragMode === 'remove') toggleMissing.delete(t);
  else toggleMissing.add(t);
  renderButtons();
}

function onMouseUp() {
  isDragging = false;
  dragMode = null;
  lastDragged = null;
}

// ========== Output Update ==========
function updateOutput() {
  const ignoreThird = document.getElementById("ignoreThirdMolars").checked;
  const ignoreSecond = document.getElementById("ignoreSecondMolars").checked;
  const selected = Array.from(document.querySelectorAll(".tooth-button.selected"))
    .map(btn => parseInt(btn.dataset.tooth));

  const maxObj = classifyArch(selected, [...Array(16)].map((_, i) => i + 1), ignoreThird, ignoreSecond);
  const manObj = classifyArch(selected, [...Array(16)].map((_, i) => i + 17), ignoreThird, ignoreSecond);

  const parts = [];
  if (maxObj) parts.push(`<div><strong>Maxillary:</strong><br>${formatClassification(maxObj)}</div>`);
  if (manObj) parts.push(`<div><strong>Mandibular:</strong><br>${formatClassification(manObj)}</div>`);

  document.getElementById('output').innerHTML = parts.join('') || '';
}

// ========== Initialization ==========
createGrid('maxillaryGrid', 1, 16);
createGrid('mandibularGrid', 17, 32, true);
renderButtons();

['maxillaryGrid', 'mandibularGrid'].forEach(id => {
  const grid = document.getElementById(id);
  grid.addEventListener('mousedown', onMouseDown);
  grid.addEventListener('mouseenter', onMouseEnter, true);
});
document.addEventListener('mouseup', onMouseUp);

document.getElementById('teethInput').addEventListener('input', (e) => {
  const input = e.target.value.trim();
  const valid = /^(\s*\d{1,2}\s*(,\s*\d{1,2}\s*)*)?$/.test(input);
  e.target.classList.toggle('invalid', !valid);
  if (!valid) return;

  isUserTyping = true;
  const values = input.split(',').map(n => parseInt(n.trim())).filter(n => !isNaN(n) && n >= 1 && n <= 32);
  toggleMissing.clear();
  values.forEach(n => toggleMissing.add(n));
  renderButtons();
});

document.getElementById('teethInput').addEventListener('blur', () => {
  isUserTyping = false;
  syncText();
});

document.getElementById('ignoreSecondMolars').addEventListener('change', e => {
  if (e.target.checked) {
    document.getElementById('ignoreThirdMolars').checked = true;
  }
  renderButtons();
});

document.getElementById('ignoreThirdMolars').addEventListener('change', e => {
  const secondCB = document.getElementById('ignoreSecondMolars');
  if (!e.target.checked && secondCB.checked) {
    secondCB.checked = false;
  }
  renderButtons();
});

document.getElementById('resetBtn').addEventListener('click', () => {
  toggleMissing.clear();
  document.querySelectorAll('input[type=checkbox]').forEach(cb => cb.checked = false);
  renderButtons();
});
