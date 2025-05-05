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

function getToothName(n) {
  const toothNames = {
  1: 'Third Molar (Wisdom Tooth)',
  2: 'Second Molar',
  3: 'First Molar',
  4: 'Second Bicuspid / Premolar',
  5: 'First Bicuspid / Premolar',
  6: 'Canine',
  7: 'Lateral Incisor',
  8: 'Central Incisor',
  9: 'Central Incisor',
  10: 'Lateral Incisor',
  11: 'Canine',
  12: 'First Bicuspid / Premolar',
  13: 'Second Bicuspid / Premolar',
  14: 'First Molar',
  15: 'Second Molar',
  16: 'Third Molar (Wisdom Tooth)',
  17: 'Third Molar (Wisdom Tooth)',
  18: 'Second Molar',
  19: 'First Molar',
  20: 'Second Bicuspid / Premolar',
  21: 'First Bicuspid / Premolar',
  22: 'Canine',
  23: 'Lateral Incisor',
  24: 'Central Incisor',
  25: 'Central Incisor',
  26: 'Lateral Incisor',
  27: 'Canine',
  28: 'First Bicuspid / Premolar',
  29: 'Second Bicuspid / Premolar',
  30: 'First Molar',
  31: 'Second Molar',
  32: 'Third Molar (Wisdom Tooth)',
};
  return toothNames[n] || `Tooth ${n}`;
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
	    
	  const tooltip = document.getElementById('tooltip');

	document.querySelectorAll('.tooth-button').forEach(btn => {
	  const toothNum = btn.getAttribute('data-tooth');
	  const name = getToothName(parseInt(toothNum));

	  btn.addEventListener('mouseenter', (e) => {
		tooltip.textContent = name;
		tooltip.style.opacity = 1;
	  });

	  btn.addEventListener('mousemove', (e) => {
		tooltip.style.left = e.pageX + 10 + 'px';
		tooltip.style.top = e.pageY + 10 + 'px';
	  });

	  btn.addEventListener('mouseleave', () => {
		tooltip.style.opacity = 0;
	  });
	});
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
function classifyArch(selected, archRange, ignoreThird, ignoreSecond) {
  const thirdMolars = archRange.filter(t => t === 1 || t === 16 || t === 17 || t === 32);
  const secondMolars = archRange.filter(t => t === 2 || t === 15 || t === 18 || t === 31);

  // Filter based on ignore flags
  let missing = selected.filter(t => archRange.includes(t));
  if (ignoreThird) missing = missing.filter(t => !thirdMolars.includes(t));
  if (ignoreSecond) missing = missing.filter(t => !secondMolars.includes(t));

  if (missing.length === 0) return null;

  // If the only missing teeth are ignored ones, return Unspecified
  const original = selected.filter(t => archRange.includes(t));
  const ignored = original.filter(t =>
    (ignoreThird && thirdMolars.includes(t)) ||
    (ignoreSecond && secondMolars.includes(t))
  );
  if (original.length === ignored.length) {
    return { cls: 'Unspecified Class', desc: 'Only excluded teeth are missing.' };
  }

  // Sort and group
  const gaps = [];
  let gap = [];
  for (let i = 0; i < archRange.length; i++) {
    const tooth = archRange[i];
    if (missing.includes(tooth)) {
      gap.push(tooth);
    } else if (gap.length) {
      gaps.push([...gap]);
      gap = [];
    }
  }
  if (gap.length) gaps.push([...gap]);

  if (gaps.length === 0) {
    return null;
  } else if (gaps.length === 1) {
    const gap = gaps[0];
    const ends = [archRange[0], archRange[archRange.length - 1]];
    if (gap.includes(ends[0]) || gap.includes(ends[1])) {
      return { cls: 'Class II', desc: 'Unilateral edentulous area at the posterior.' };
    } else {
      return { cls: 'Class III', desc: 'Unilateral edentulous area bounded by teeth.' };
    }
  } else {
    const distalMost = gaps.some(g => {
      const last = g[g.length - 1];
      return last === archRange[0] || last === archRange[archRange.length - 1];
    });
    return {
      class: distalMost ? 'Class I' : 'Class IV',
      desc: distalMost ? 'Bilateral posterior edentulous areas.' : 'Bilateral anterior bounded edentulous areas.'
    };
  }
}


// Formats Classification for Output
function formatClassification(item) {
  return `<strong>${item.cls}</strong><br><em>${item.desc}</em>`;
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
