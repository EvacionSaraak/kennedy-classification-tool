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
function classifyArch(missing, archRange) {
  if (!missing.length) return '**Fully dentate**';

  const thirdMolars = [1, 16, 17, 32];
  const onlyThirdsMissing = missing.every(tooth => thirdMolars.includes(tooth));
  if (onlyThirdsMissing) {
    return '**Unspecified Class**\n*Third molars only missing*';
  }

  const present = archRange.filter(tooth => !missing.includes(tooth));
  const min = Math.min(...archRange); // 1 or 17
  const max = Math.max(...archRange); // 16 or 32

  const sorted = [...missing].sort((a, b) => a - b);

  const isDistalLeftMissing = missing.includes(min);
  const isDistalRightMissing = missing.includes(max);
  if (isDistalLeftMissing && isDistalRightMissing) {
    return '**Class I**\n*Bilateral posterior edentulous areas*';
  }

  if (isDistalLeftMissing || isDistalRightMissing) {
    return '**Class II**\n*Unilateral posterior edentulous area*';
  }

  // Check for bounded edentulous space (Class III)
  let boundedSpaces = 0;
  for (let i = 0; i < sorted.length; i++) {
    const tooth = sorted[i];
    const left = tooth - 1;
    const right = tooth + 1;
    if (present.includes(left) && present.includes(right)) {
      boundedSpaces++;
    }
  }

  if (boundedSpaces > 0) {
    return '**Class III**\n*Bounded edentulous space (between present teeth)*';
  }

  // Check for Class IV (anterior crossing midline)
  const mid = Math.floor((min + max) / 2);
  const crossesMidline = sorted.some(t => t <= mid) && sorted.some(t => t > mid);
  if (crossesMidline && sorted.length === missing.length) {
    return '**Class IV**\n*Single anterior space crossing the midline*';
  }

  return '**Unclassified**\n*Pattern does not match known Kennedy types*';
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
