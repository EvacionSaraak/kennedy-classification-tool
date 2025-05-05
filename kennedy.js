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
function classifyArch(selected, archRange, ignoreThird, ignoreSecond) {
  const thirdMolars = [1, 16, 17, 32];
  const secondMolars = [2, 15, 18, 31];

  // Filter selected teeth within arch
  const inArch = selected.filter(t => archRange.includes(t));

  const isIgnored = (t) =>
    (ignoreThird && thirdMolars.includes(t)) ||
    (ignoreSecond && secondMolars.includes(t));

  const effectiveMissing = inArch.filter(t => !isIgnored(t));

  // If all missing teeth are ignored, return Unspecified
  if (effectiveMissing.length === 0 && inArch.length > 0) {
    return {
      cls: "Unspecified Class",
      desc: "Only excluded teeth are missing."
    };
  }

  if (effectiveMissing.length === 0) return null;

  // Group missing teeth into continuous gaps
  const gaps = getGaps(archRange, effectiveMissing);

  const distalTeeth = [archRange[0], archRange[archRange.length - 1]];
  const distalGaps = gaps.filter(gap => gap.includes(distalTeeth[0]) || gap.includes(distalTeeth[1]));
  const boundedGaps = gaps.length - distalGaps.length;

  // Determine classification
  const modCount = gaps.length - 1;
  let cls, desc;

  if (distalGaps.length === 2) {
    cls = "Class I";
    desc = "Bilateral posterior edentulous areas.";
  } else if (distalGaps.length === 1) {
    cls = "Class II";
    desc = "Unilateral posterior edentulous area.";
  } else if (gaps.length === 1) {
    cls = "Class III";
    desc = "Single bounded edentulous space.";
  } else {
    cls = "Class III";
    desc = "Multiple bounded edentulous spaces.";
  }

  if (modCount > 0) {
    desc += ` Kennedy ${cls} modification ${modCount}`;
  }

  return { cls, desc };
}

// ➕ Helper: gap grouping
function getGaps(range, missing) {
  const gaps = [];
  let current = [];

  for (const tooth of range) {
    if (missing.includes(tooth)) {
      current.push(tooth);
    } else if (current.length) {
      gaps.push([...current]);
      current = [];
    }
  }
  if (current.length) gaps.push([...current]);

  return gaps;
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
