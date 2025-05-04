// script.js
let isUserTyping = false;
let typingTimeout;

// State & constants
const thirdMolars = [1, 16, 17, 32];
const secondMolars = [2, 15, 18, 31];
let toggleMissing = new Set();
let isDragging = false;
let dragMode = null;    // "add" or "remove"
let lastDragged = null;

// Kennedy class descriptions
const descriptors = {
  "Kennedy Class I":   "Bilateral posterior missing teeth",
  "Kennedy Class II":  "Unilateral posterior missing teeth",
  "Kennedy Class III": "Unilateral bounded edentulous space",
  "Kennedy Class IV":  "Anterior midline crossing missing teeth"
};

// Utility: decide shape
function getToothType(n) {
  if ([1,2,3,14,15,16,17,18,19,30,31,32].includes(n)) return 'molar';
  if ([4,5,12,13,20,21,28,29].includes(n)) return 'premolar';
  if ([6,11,22,27].includes(n)) return 'canine';
  return 'incisor';
}

// Build the tooth grids
function createGrid(id, start, end, reverse = false) {
    const grid = document.getElementById(id);
    const range = reverse 
      ? Array.from({ length: end - start + 1 }, (_, i) => end - i)  // Reversed range for mandibular
      : Array.from({ length: end - start + 1 }, (_, i) => start + i); // Normal range for maxillary
  
    range.forEach(t => {
      const wrapper = document.createElement('div');
      wrapper.className = 'tooth-wrapper';
      wrapper.innerHTML = `
        <div class="tooth-button ${getToothType(t)}" data-tooth="${t}">
          <span class="tooth-label">${t}</span>
        </div>
        <span class="tooth-type-label">${getToothType(t)}</span>`;
      grid.appendChild(wrapper);
    });
  }
  
  // Create grids with correct ranges
  createGrid('maxillaryGrid', 1, 16);  // Maxillary (1-16)
  createGrid('mandibularGrid', 17, 32, true);  // Mandibular (32-17)

// Render selection & disabled states
function renderButtons() {
  document.querySelectorAll('.tooth-button').forEach(btn => {
    const n = +btn.dataset.tooth;
    btn.classList.toggle('selected', toggleMissing.has(n));
  });
  syncText();
  updateDisabledTeeth();
  updateOutput();
}

// Sync text input from selection
function syncText() {
    if (isUserTyping) return; // Don't overwrite while user is typing
  
    const sorted = Array.from(toggleMissing).sort((a, b) => a - b);
    document.getElementById('teethInput').value = sorted.join(',');
  }
  

// Disable ignored teeth buttons
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

// Classification logic
function classifyArch(missing, archRange) {
  const ignore3 = document.getElementById('ignoreThirdMolars').checked;
  const ignore2 = document.getElementById('ignoreSecondMolars').checked;
  const isIgnored = t => (ignore3 && thirdMolars.includes(t)) || (ignore2 && secondMolars.includes(t));

  const relevant = archRange.filter(t => !isIgnored(t));
  const archMiss = missing.filter(n => relevant.includes(n));

  if (archMiss.length === relevant.length) {
    return `<strong>Not Applicable</strong><br><em>All non-ignored teeth missing</em>`;
  }
  if (archMiss.length === 0) return null;

  // contiguous regions
  let regions = [], r = [];
  relevant.forEach(t => {
    if (archMiss.includes(t)) r.push(t);
    else if (r.length) { regions.push(r); r = []; }
  });
  if (r.length) regions.push(r);

  // drop pure 3rd-molar regions
  regions = regions.filter(reg => !reg.every(t => thirdMolars.includes(t)));

  // Class IV
  const isMax = archRange[0] === 1;
  const ante = new Set(isMax ? [6,7,8,9,10,11] : [22,23,24,25,26,27]);
  if (regions.length === 1 && regions[0].every(t => ante.has(t))) {
    const mn = Math.min(...regions[0]), mx = Math.max(...regions[0]);
    const mid = isMax ? 8 : 24;
    if (mn <= mid && mx >= mid + 1) {
      const cls = "Kennedy Class IV";
      return `<strong>${cls}</strong><br><em>${descriptors[cls]}</em>`;
    }
  }

  // distal extensions count
  const L = relevant[0], R = relevant[relevant.length-1];
  let distal = 0;
  regions.forEach(reg => {
    const mn = Math.min(...reg), mx = Math.max(...reg);
    if (mn === L || mx === R) distal++;
  });

    // Classes I, II, III (with correct mod count for II)
    let cls = "Kennedy Class III",
    mod = regions.length - 1;

    if (distal >= 2) {
    cls = "Kennedy Class I";
    mod = regions.length - 2;
    } else if (distal === 1) {
    cls = "Kennedy Class II";
    mod = regions.length - 1;      // now properly count modifications for Class II
    }

    // Always show “Modification” if mod > 0
    return `<strong>${cls}${mod > 0 ? `, Modification ${mod}` : ''}</strong><br><em>${descriptors[cls]}</em>`;
}

// Update output display
function updateOutput() {
  const sel = Array.from(toggleMissing);
  const up = classifyArch(sel, [...Array(16)].map((_,i) => i+1));
  const lo = classifyArch(sel, [...Array(16)].map((_,i) => i+17));
  const out = [];
  if (up) out.push(`<div><strong>Maxillary:</strong><br>${up}</div>`);
  if (lo) out.push(`<div><strong>Mandibular:</strong><br>${lo}</div>`);
  document.getElementById('output').innerHTML =
    out.length ? out.join('') : 'No missing teeth.';
}

// Toggle a tooth’s selection
function toggleTooth(n) {
  if (toggleMissing.has(n)) toggleMissing.delete(n);
  else toggleMissing.add(n);
}

// Mouse event handlers
function onMouseDown(e) {
  const btn = e.target.closest('.tooth-button');
  if (!btn || btn.classList.contains('disabled')) return;
  const t = +btn.dataset.tooth;
  dragMode = toggleMissing.has(t) ? 'remove' : 'add';
  isDragging = true;
  lastDragged = null;
  if (dragMode === 'remove') toggleMissing.delete(t);
  else toggleMissing.add(t);
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

// Bind grid events
['maxillaryGrid','mandibularGrid'].forEach(id => {
  const grid = document.getElementById(id);
  grid.addEventListener('mousedown', onMouseDown);
  grid.addEventListener('mouseenter', onMouseEnter, true);
});
document.addEventListener('mouseup', onMouseUp);

// Input listener
document.getElementById('teethInput').addEventListener('input', (e) => {
    const input = e.target.value.trim();
  
    // Validate: Only digits 1–32, comma-separated
    const valid = /^(\s*\d{1,2}\s*(,\s*\d{1,2}\s*)*)?$/.test(input);
    if (!valid) {
      e.target.classList.add('invalid');
      return;
    } else {
      e.target.classList.remove('invalid');
    }
  
    // Set isUserTyping to true when the user is typing
    isUserTyping = true;
  
    const values = input
      .split(',')
      .map(n => parseInt(n.trim()))
      .filter(n => !isNaN(n) && n >= 1 && n <= 32);
  
    toggleMissing.clear();
    values.forEach(n => toggleMissing.add(n));
  
    renderButtons(); // Update visual state
  });

  // When input stops being edited, allow syncText to run
document.getElementById('teethInput').addEventListener('blur', () => {
    // Once the user exits the input box (blur event), stop typing
    isUserTyping = false;
    syncText(); // Now sort and update the text field after typing ends
});
// Ignore-second ⇒ auto-check 3rd & refresh

document.getElementById('ignoreSecondMolars').addEventListener('change', e => {
  if (e.target.checked) {
    document.getElementById('ignoreThirdMolars').checked = true;
  }
  renderButtons(); // includes disabled update
});

// Ignore-third ⇒ if turning off while 2nd is on, uncheck 2nd & refresh
document.getElementById('ignoreThirdMolars').addEventListener('change', e => {
  const secondCB = document.getElementById('ignoreSecondMolars');
  if (!e.target.checked && secondCB.checked) {
    secondCB.checked = false;
  }
  renderButtons();
});

// Reset button
document.getElementById('resetBtn').addEventListener('click', () => {
  toggleMissing.clear();
  document.querySelectorAll('input[type=checkbox]').forEach(cb => cb.checked = false);
  renderButtons();
});

// Initial render
renderButtons();
