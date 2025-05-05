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

function capitalizeFirstLetter(val) {
    return String(val).charAt(0).toUpperCase() + String(val).slice(1);
}

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
        <span class="tooth-type-label">${capitalizeFirstLetter(getToothType(t))}</span>`;
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

// Classify Arch
/** Methodology in determining Classification
 * Simplified Kennedy classifier.
 * @param {number[]} selected      – all selected (missing) teeth
 * @param {number[]} range         – full arch range (e.g. [1…16])
 * @param {boolean} ignore3rd      – ignore 3rd molars?
 * @param {boolean} ignore2nd      – ignore 2nd molars?
 * @returns {{cls:string,desc:string,mod:number}|null}
 */
function classifyArch(selected, range, ignore3rd, ignore2nd) {
  // 1) Filter selected teeth to what's in this arch, minus ignored
  const ignored3 = new Set([1,16,17,32]);
  const ignored2 = new Set([2,15,18,31]);
  let missing = selected
    .filter(t=>range.includes(t))
    .filter(t=>!(ignore3rd && ignored3.has(t)))
    .filter(t=>!(ignore2nd && ignored2.has(t)));

  if (missing.length === 0) return null;

  // 2) If only ignored teeth were selected → Unspecified
  const origInArch = selected.filter(t=>range.includes(t));
  if (origInArch.length && origInArch.every(t=>
       (ignore3rd && ignored3.has(t)) ||
       (ignore2nd && ignored2.has(t))
     )) {
    return { cls:'Unspecified Class', desc:'Only excluded teeth are missing', mod:0 };
  }

  // 3) Build contiguous regions
  const regions = [];
  for (let t of range) {
    if (missing.includes(t)) {
      if (!regions.length || regions[regions.length-1].slice(-1)[0] !== t-1) {
        regions.push([]);
      }
      regions[regions.length-1].push(t);
    }
  }

  // 4) Class IV: single region crossing the midline (teeth 8–9 or 24–25)
  if (regions.length===1) {
    const r = regions[0];
    const mid1 = range[0]===1 ? 8 : 24;
    const mid2 = mid1 + 1;
    if (r.includes(mid1) && r.includes(mid2)) {
      return { cls:'Kennedy Class IV', desc:descriptors['Kennedy Class IV'], mod:0 };
    }
  }

  // 5) Count how many regions touch an end (distal extensions)
  const leftEnd  = range[0],
        rightEnd = range[range.length-1];
  const distalCount = regions.filter(r=>
    r.includes(leftEnd) || r.includes(rightEnd)
  ).length;

  // 6) Decide Class & Mod
  let cls, mod;
  if (distalCount >= 2) {
    cls = 'Kennedy Class I';
    mod = regions.length - 2;
  } else if (distalCount === 1) {
    cls = 'Kennedy Class II';
    mod = regions.length - 1;
  } else {
    cls = 'Kennedy Class III';
    mod = regions.length - 1;
  }

  return { cls, desc: descriptors[cls], mod };
}

// Formats Classification for Output
function formatClassification(item) {
  const modText = item.mod > 0 ? `, Modification ${item.mod}` : '';    // Displays Modification for Classifications
  return `<strong>${item.cls}${modText}</strong><br><em>${item.desc}</em>`;
}

function updateOutput() {
  const ignoreThird = document.getElementById("ignoreThirdMolars").checked;
  const ignoreSecond = document.getElementById("ignoreSecondMolars").checked;

  // All selected/missing teeth
  const selected = Array.from(document.querySelectorAll(".tooth-button.selected"))
    .map(btn => parseInt(btn.dataset.tooth));

  const maxObj = classifyArch(selected, [...Array(16)].map((_, i) => i + 1), ignoreThird, ignoreSecond);
  const manObj = classifyArch(selected, [...Array(16)].map((_, i) => i + 17), ignoreThird, ignoreSecond);

  const parts = [];
  if (maxObj) parts.push(`<div><strong>Maxillary:</strong><br>${formatClassification(maxObj)}</div>`);
  if (manObj) parts.push(`<div><strong>Mandibular:</strong><br>${formatClassification(manObj)}</div>`);

  document.getElementById('output').innerHTML = parts.join('') || '';
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
