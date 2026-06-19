// ===== STATE =====
const state = {
  turn: 1, // 1 to 18 (9 rounds * 2 players)
  p: 0, // current player index (0 or 1)
  rollsLeft: 2,
  dice: [],
  draggedEl: null,
  selCat: null, // ID of currently selected category in formula area
  players: [
    {
      total: 0, coreTotal: 0,
      cats: {
        plus: { s: false, d: [], a: null, sc: 0, msg: '', formula: '' },
        minus: { s: false, d: [], a: null, sc: 0, msg: '', formula: '' },
        multi: { s: false, d: [], a: null, sc: 0, msg: '', formula: '' },
        divide: { s: false, d: [], a: null, sc: 0, msg: '', formula: '' },
        tripleMulti: { s: false, d: [], a: null, sc: 0, msg: '', formula: '' },
        heavyDuty: { s: false, d: [], a: null, sc: 0, msg: '', formula: '' },
        cleanShot: { s: false, d: [], a: null, sc: 0, msg: '', formula: '' },
        fraction: { s: false, d: [], a: null, sc: 0, msg: '', formula: '' },
        mathYacht: { s: false, d: [], sc: 0, msg: '', formula: '' },
      }
    },
    {
      total: 0, coreTotal: 0,
      cats: {
        plus: { s: false, d: [], a: null, sc: 0, msg: '', formula: '' },
        minus: { s: false, d: [], a: null, sc: 0, msg: '', formula: '' },
        multi: { s: false, d: [], a: null, sc: 0, msg: '', formula: '' },
        divide: { s: false, d: [], a: null, sc: 0, msg: '', formula: '' },
        tripleMulti: { s: false, d: [], a: null, sc: 0, msg: '', formula: '' },
        heavyDuty: { s: false, d: [], a: null, sc: 0, msg: '', formula: '' },
        cleanShot: { s: false, d: [], a: null, sc: 0, msg: '', formula: '' },
        fraction: { s: false, d: [], a: null, sc: 0, msg: '', formula: '' },
        mathYacht: { s: false, d: [], sc: 0, msg: '', formula: '' },
      }
    }
  ],
  yachtQueue: [] // To process math yacht at the end
};

const ROBOT_FACES = ['🤖','😲','😢','😤','🤩'];
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const dom = {
  tray: $('#dice-tray'),
  keep: $('#keep-tray'),
  rollBtn: $('#roll-btn'),
  formBody: $('#formula-body'),
  formLabel: $('#formula-label')
};

// --- Audio System ---
let audioCtx = null;
let noiseBuffer = null;

function initAudio() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const bufferSize = audioCtx.sampleRate * 0.1; // 100ms noise
  noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const output = noiseBuffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    output[i] = Math.random() * 2 - 1; // White noise
  }
}

function playDiceSound() {
  try {
    initAudio();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    
    for (let i = 0; i < 5; i++) {
      // 주사위 5개가 약간의 시간차를 두고 부딪히는 소리
      const time = audioCtx.currentTime + i * 0.06 + (Math.random() * 0.04);
      const noiseSource = audioCtx.createBufferSource();
      noiseSource.buffer = noiseBuffer;
      
      const filter = audioCtx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 1200 + Math.random() * 800; // 탁한 소리
      
      const gainNode = audioCtx.createGain();
      gainNode.gain.setValueAtTime(0, time);
      gainNode.gain.linearRampToValueAtTime(0.7, time + 0.005);
      gainNode.gain.exponentialRampToValueAtTime(0.001, time + 0.06);
      
      noiseSource.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      noiseSource.start(time);
      noiseSource.stop(time + 0.1);
    }
  } catch (e) {
    console.error('Audio play failed:', e);
  }
}
// --------------------

// ===== TOUCH DRAG SYSTEM =====
let touchDragData = null; // { el, ghost, id, val, originParent }

function createGhost(text) {
  const g = document.createElement('div');
  g.className = 'touch-ghost';
  g.textContent = text;
  document.body.appendChild(g);
  return g;
}

function handleTouchStart(e, el, id, val) {
  e.preventDefault();
  const t = e.touches[0];
  const ghost = createGhost(val);
  ghost.style.left = (t.clientX - 22) + 'px';
  ghost.style.top = (t.clientY - 22) + 'px';
  touchDragData = { el, ghost, id, val, startX: t.clientX, startY: t.clientY };
  el.style.opacity = '0.4';
}

function handleTouchMove(e) {
  if (!touchDragData) return;
  e.preventDefault();
  const t = e.touches[0];
  touchDragData.ghost.style.left = (t.clientX - 22) + 'px';
  touchDragData.ghost.style.top = (t.clientY - 22) + 'px';
  
  // Highlight drop targets
  const target = document.elementFromPoint(t.clientX, t.clientY);
  $$('.drop-slot').forEach(s => s.classList.remove('drag-over'));
  if (target && target.classList.contains('drop-slot')) {
    target.classList.add('drag-over');
  }
}

function handleTouchEnd(e) {
  if (!touchDragData) return;
  const { el, ghost, id, val } = touchDragData;
  ghost.remove();
  el.style.opacity = '1';
  
  const t = e.changedTouches[0];
  const target = document.elementFromPoint(t.clientX, t.clientY);
  $$('.drop-slot').forEach(s => s.classList.remove('drag-over'));
  
  if (target && target.classList.contains('drop-slot') && !target.hasChildNodes()) {
    // Simulate the drop
    const chip = document.createElement('div');
    chip.className = 'dice-in-slot';
    chip.textContent = val;
    chip.dataset.id = id;
    chip.addEventListener('click', () => {
      state.dice.find(d => d.id === id).inSlot = false;
      target.innerHTML = '';
      renderDice();
    });
    target.appendChild(chip);
    state.dice.find(d => d.id === id).inSlot = true;
    el.remove();
  }
  
  touchDragData = null;
}

document.addEventListener('touchmove', handleTouchMove, { passive: false });
document.addEventListener('touchend', handleTouchEnd);

// ===== HELPERS =====
function robotSay(text, emotion = 0) {
  $('#robot-speech').textContent = text;
  $('#robot-face').textContent = ROBOT_FACES[emotion];
}
const gcd = (a, b) => (b === 0 ? Math.abs(a) : gcd(b, a % b));

function updateHeader() {
  $('#disp-round').textContent = Math.ceil(state.turn / 2);
  $('#disp-rolls').textContent = state.rollsLeft;
  const tChip = $('#disp-turn');
  if (state.p === 0) {
    tChip.textContent = '🔴 P1 차례';
    tChip.style.background = 'var(--red)';
    tChip.style.color = 'white';
    $('#board-0').classList.add('active-board');
    $('#board-1').classList.remove('active-board');
  } else {
    tChip.textContent = '🔵 P2 차례';
    tChip.style.background = 'var(--blue)';
    tChip.style.color = 'white';
    $('#board-1').classList.add('active-board');
    $('#board-0').classList.remove('active-board');
  }
}

// ===== 3D DICE =====
function createDice(id, val) {
  const sc = document.createElement('div');
  sc.className = 'dice-scene';
  sc.dataset.id = id; sc.dataset.val = val;
  sc.draggable = true;

  const c = document.createElement('div');
  c.className = 'dice-cube';
  ['front','back','right','left','top','bottom'].forEach(f => {
    const face = document.createElement('div');
    face.className = `dice-face dice-face--${f}`;
    face.textContent = (f==='front') ? val : Math.floor(Math.random()*10);
    c.appendChild(face);
  });
  sc.appendChild(c);

  sc.addEventListener('click', () => {
    if (state.rollsLeft >= 2) return;
    const d = state.dice.find(x => x.id === id);
    if (d && !d.inSlot) { d.held = !d.held; renderDice(); }
  });

  sc.addEventListener('dragstart', e => {
    state.draggedEl = sc;
    e.dataTransfer.setData('text/plain', val);
    setTimeout(() => sc.style.opacity = '0.4', 0);
  });
  sc.addEventListener('dragend', () => {
    sc.style.opacity = '1'; state.draggedEl = null;
  });

  // Touch support
  sc.addEventListener('touchstart', e => {
    handleTouchStart(e, sc, id, val);
  }, { passive: false });

  return sc;
}

function renderDice() {
  dom.tray.innerHTML = ''; dom.keep.innerHTML = '';
  const inTray = state.dice.filter(d => !d.held && !d.inSlot);
  const inKeep = state.dice.filter(d => d.held && !d.inSlot);

  if (inTray.length === 0 && inKeep.length === 0) {
    dom.tray.innerHTML = '<span class="ph">주사위를 굴려주세요</span>';
    dom.keep.innerHTML = '<span class="ph">여기로 이동</span>';
    return;
  }
  
  if (inTray.length === 0) dom.tray.innerHTML = '<span class="ph">비어있음</span>';
  else inTray.forEach(d => dom.tray.appendChild(createDice(d.id, d.val)));

  if (inKeep.length === 0) dom.keep.innerHTML = '<span class="ph">여기로 이동</span>';
  else inKeep.forEach(d => {
    const el = createDice(d.id, d.val);
    el.classList.add('held');
    dom.keep.appendChild(el);
  });
}

function rollDice() {
  if (state.rollsLeft <= 0) return;
  if (state.rollsLeft === 2) {
    state.dice = Array.from({length:5}, (_,i) => ({ id:'d'+i, val:0, held:false, inSlot:false }));
  }

  // 효과음 재생
  playDiceSound();

  renderDice();
  dom.tray.querySelectorAll('.dice-scene').forEach(el => el.classList.add('rolling'));
  dom.rollBtn.disabled = true;
  robotSay('주사위가 돌아간다~! 🎲', 1);

  setTimeout(() => {
    state.dice.forEach(d => { if (!d.held && !d.inSlot) d.val = Math.floor(Math.random()*10); });
    state.rollsLeft--;
    renderDice();
    dom.rollBtn.disabled = (state.rollsLeft === 0);
    updateHeader();
    if (state.rollsLeft === 0) robotSay('마지막 결과야! 족보를 선택하고 배치해봐!', 0);
    else robotSay('클릭해서 주사위를 보관할 수 있어!', 0);
  }, 600);
}

// ===== FORMULA AREA =====
const CAT_INFO = {
  plus: { n: '두 자리 덧셈', html: `<div class="drop-slot"></div><div class="drop-slot"></div><span class="op">+</span><div class="drop-slot"></div><div class="drop-slot"></div><span class="eq">=</span><input type="number" class="ans-in">` },
  minus: { n: '두 자리 뺄셈', html: `<div class="drop-slot"></div><div class="drop-slot"></div><span class="op">−</span><div class="drop-slot"></div><div class="drop-slot"></div><span class="eq">=</span><input type="number" class="ans-in">` },
  multi: { n: '기본 곱셈', html: `<div class="drop-slot"></div><span class="op">×</span><div class="drop-slot"></div><span class="eq">=</span><input type="number" class="ans-in">` },
  divide: { n: '기본 나눗셈', html: `<div class="drop-slot"></div><div class="drop-slot"></div><span class="op">÷</span><div class="drop-slot"></div><span class="eq">=</span><input type="number" class="ans-in" placeholder="몫"><span class="rem">...</span><input type="number" class="ans-in" id="rem-in" placeholder="나머지">` },
  tripleMulti: { n: '삼단 곱셈', html: `<div class="drop-slot"></div><span class="op">×</span><div class="drop-slot"></div><span class="op">×</span><div class="drop-slot"></div><span class="eq">=</span><input type="number" class="ans-in">` },
  heavyDuty: { n: '더블 곱셈', html: `<div class="drop-slot"></div><div class="drop-slot"></div><span class="op">×</span><div class="drop-slot"></div><div class="drop-slot"></div><span class="eq">=</span><input type="number" class="ans-in">` },
  cleanShot: { n: '깔끔한 나눗셈', html: `<div class="drop-slot"></div><div class="drop-slot"></div><span class="op">÷</span><div class="drop-slot"></div><span class="eq">=</span><input type="number" class="ans-in">` },
  fraction: { n: '분수 만들기', html: `<div class="frac-grp"><div class="drop-slot"></div><div class="frac-bar"></div><div class="drop-slot"></div></div><span class="op">+</span><div class="frac-grp"><div class="drop-slot"></div><div class="frac-bar"></div><div class="drop-slot"></div></div><span class="eq">=</span><div class="frac-ans-grp"><input type="number" class="ans-in" id="f-num" placeholder="분자"><div class="frac-bar"></div><input type="number" class="ans-in" id="f-den" placeholder="분모"></div>` },
  mathYacht: { n: '🏆 매스 얏', html: `<div class="drop-slot"></div><div class="drop-slot"></div><div class="drop-slot"></div><div class="drop-slot"></div><div class="drop-slot"></div>` }
};

function selectCategory(catId) {
  if (state.rollsLeft === 2) { robotSay('주사위를 먼저 굴려주세요!', 3); return; }
  if (state.players[state.p].cats[catId].s) { robotSay('이미 완료한 족보입니다.', 2); return; }

  // Return any slotted dice back to tray
  state.dice.forEach(d => d.inSlot = false);
  
  state.selCat = catId;
  $$('.cat-row').forEach(r => r.classList.remove('selected'));
  $(`.cat-row[data-p="${state.p}"][data-cat="${catId}"]`).classList.add('selected');

  dom.formLabel.textContent = `[${state.p === 0 ? 'P1':'P2'}] ${CAT_INFO[catId].n} 배치 중...`;
  dom.formBody.innerHTML = CAT_INFO[catId].html + `<button class="confirm-btn" id="confirm-btn">완료</button>`;
  
  // Drag & drop on slots
  $$('.drop-slot').forEach(slot => {
    slot.addEventListener('dragover', e => { e.preventDefault(); slot.classList.add('drag-over'); });
    slot.addEventListener('dragleave', () => slot.classList.remove('drag-over'));
    slot.addEventListener('drop', e => {
      e.preventDefault(); slot.classList.remove('drag-over');
      if (!state.draggedEl || slot.hasChildNodes()) return;
      
      const did = state.draggedEl.dataset.id;
      const val = state.draggedEl.dataset.val;
      
      const chip = document.createElement('div');
      chip.className = 'dice-in-slot';
      chip.textContent = val;
      chip.dataset.id = did;
      
      chip.addEventListener('click', () => {
        state.dice.find(d => d.id === did).inSlot = false;
        slot.innerHTML = '';
        renderDice();
      });
      
      slot.appendChild(chip);
      state.dice.find(d => d.id === did).inSlot = true;
      state.draggedEl.remove();
    });
  });

  $('#confirm-btn').addEventListener('click', confirmCategory);
  renderDice();
}

$$('.cat-row').forEach(row => {
  row.addEventListener('click', () => {
    const p = parseInt(row.dataset.p);
    if (p !== state.p) return; // Cannot select opponent's board
    selectCategory(row.dataset.cat);
  });
});

// ===== DELAYED RECORDING (NO SCORING YET) =====
function confirmCategory() {
  const catId = state.selCat;
  const slots = $$('.drop-slot');
  let vals = [];
  let allFilled = true;
  slots.forEach(s => {
    if (s.hasChildNodes()) vals.push(parseInt(s.firstChild.dataset.id.replace('d','')));
    else allFilled = false;
  });

  if (!allFilled) { robotSay('모든 빈칸에 주사위를 넣어주세요!', 2); return; }
  
  vals = vals.map(id => state.dice.find(d => d.id === `d${id}`).val);
  
  let ans = null;
  let formulaStr = '';

  if (catId === 'fraction') {
    const num = $('#f-num').value; const den = $('#f-den').value;
    if (!num || !den) { robotSay('정답을 입력하세요!', 2); return; }
    ans = { num: parseInt(num), den: parseInt(den) };
    formulaStr = `${vals[0]}/${vals[1]} + ${vals[2]}/${vals[3]} = ${ans.num}/${ans.den}`;
  } else if (catId === 'divide') {
    const qInp = $('.ans-in').value;
    const rInp = $('#rem-in').value;
    if (!qInp || !rInp) { robotSay('몫과 나머지를 모두 입력하세요!', 2); return; }
    ans = { q: parseInt(qInp), r: parseInt(rInp) };
    formulaStr = `${vals[0]}${vals[1]} ÷ ${vals[2]} = ${ans.q} ... ${ans.r}`;
  } else if (catId !== 'mathYacht') {
    const inp = $('.ans-in').value;
    if (!inp) { robotSay('정답을 입력하세요!', 2); return; }
    ans = parseInt(inp);
    
    if (catId === 'plus') formulaStr = `${vals[0]}${vals[1]} + ${vals[2]}${vals[3]} = ${ans}`;
    if (catId === 'minus') formulaStr = `${vals[0]}${vals[1]} - ${vals[2]}${vals[3]} = ${ans}`;
    if (catId === 'multi') formulaStr = `${vals[0]} × ${vals[1]} = ${ans}`;
    if (catId === 'tripleMulti') formulaStr = `${vals[0]} × ${vals[1]} × ${vals[2]} = ${ans}`;
    if (catId === 'heavyDuty') formulaStr = `${vals[0]}${vals[1]} × ${vals[2]}${vals[3]} = ${ans}`;
    if (catId === 'cleanShot') formulaStr = `${vals[0]}${vals[1]} ÷ ${vals[2]} = ${ans}`;
  } else {
    formulaStr = `(대기 중)`;
  }

  const catObj = state.players[state.p].cats[catId];
  catObj.s = true;
  catObj.d = vals;
  catObj.a = ans;
  catObj.formula = formulaStr;
  
  // UI Update (Just mark completed)
  const row = $(`.cat-row[data-p="${state.p}"][data-cat="${catId}"]`);
  row.classList.remove('selected');
  row.classList.add('completed');
  row.querySelector('.cs').textContent = '완료';
  row.querySelector('.cr-record').textContent = formulaStr;

  robotSay(`입력 완료! 다음 턴으로! (결과는 나중에 공개됩니다)`, 4);

  state.selCat = null;
  dom.formLabel.textContent = '족보를 선택하세요';
  dom.formBody.innerHTML = '';
  
  state.turn++;
  if (state.turn > 18) {
    setTimeout(processYachtQueue, 1000);
  } else {
    state.p = (state.p === 0) ? 1 : 0;
    state.rollsLeft = 2;
    state.dice = [];
    updateHeader();
    renderDice();
    dom.rollBtn.disabled = false;
  }
}

// ===== ENDGAME: MATH YACHT =====
function processYachtQueue() {
  [0, 1].forEach(pi => {
    const my = state.players[pi].cats.mathYacht;
    if (my.s && my.d.length === 5) state.yachtQueue.push(pi);
  });
  playNextYacht();
}

function playNextYacht() {
  if (state.yachtQueue.length === 0) {
    doSettlement();
    return;
  }
  
  const pi = state.yachtQueue.shift();
  const d = state.players[pi].cats.mathYacht.d;
  
  $('#modal-overlay').classList.remove('hidden');
  
  let html = `<div class="ult-title">🏆 [P${pi+1}] 매스 얏 도전!</div>
    <p style="margin-bottom:12px;color:#555;">숫자와 기호로 정확히 100을 만드세요!</p>
    <div class="ult-pool" id="u-dice">${d.map((v,i)=>`<div class="ult-token ut-dice" draggable="true" data-v="${v}" id="ud-${i}">${v}</div>`).join('')}</div>
    <div class="ult-pool" id="u-ops">
      <div class="ult-token ut-op" draggable="true" data-v="+">+</div>
      <div class="ult-token ut-op" draggable="true" data-v="-">−</div>
      <div class="ult-token ut-op" draggable="true" data-v="*">×</div>
      <div class="ult-token ut-op" draggable="true" data-v="/">÷</div>
      <div class="ult-token ut-op" draggable="true" data-v="(">(</div>
      <div class="ult-token ut-op" draggable="true" data-v=")">)</div>
    </div>
    <div class="ult-board" id="u-board"></div>
    <div class="ult-actions">
      <button class="ult-btn ub-check" id="u-chk">확인</button>
      <button class="ult-btn ub-reset" id="u-rst">초기화</button>
      <button class="ult-btn ub-skip" id="u-skp">포기</button>
    </div>
    <div class="ult-feedback" id="u-fb"></div>
  `;
  $('#modal').innerHTML = html;
  
  let dragged = null;
  let yachtTouchData = null;

  function mkDrag(el) {
    el.addEventListener('dragstart', e => { dragged = el; e.dataTransfer.setData('text/plain', el.dataset.v); setTimeout(()=>el.style.opacity='0.4',0); });
    el.addEventListener('dragend', () => { el.style.opacity='1'; dragged=null; });
    // Touch support for yacht modal
    el.addEventListener('touchstart', e => {
      e.preventDefault();
      const t = e.touches[0];
      const ghost = createGhost(el.textContent);
      ghost.style.left = (t.clientX - 18) + 'px';
      ghost.style.top = (t.clientY - 18) + 'px';
      yachtTouchData = { el, ghost };
      el.style.opacity = '0.4';
    }, { passive: false });
  }
  $$('.ult-token').forEach(mkDrag);

  // Yacht modal touch move & end
  const modalEl = $('#modal');
  modalEl.addEventListener('touchmove', e => {
    if (!yachtTouchData) return;
    e.preventDefault();
    const t = e.touches[0];
    yachtTouchData.ghost.style.left = (t.clientX - 18) + 'px';
    yachtTouchData.ghost.style.top = (t.clientY - 18) + 'px';
  }, { passive: false });
  modalEl.addEventListener('touchend', e => {
    if (!yachtTouchData) return;
    const { el, ghost } = yachtTouchData;
    ghost.remove();
    el.style.opacity = '1';
    const t = e.changedTouches[0];
    const target = document.elementFromPoint(t.clientX, t.clientY);
    const board = $('#u-board');
    if (target && (target === board || board.contains(target))) {
      if (el.classList.contains('ut-op')) {
        const clone = el.cloneNode(true);
        clone.className = 'ub-item';
        clone.addEventListener('click', () => clone.remove());
        board.appendChild(clone);
      } else {
        el.className = 'ub-item ud-used';
        const ref = el;
        el.addEventListener('click', () => {
          ref.className = 'ult-token ut-dice';
          ref.setAttribute('draggable', 'true');
          $('#u-dice').appendChild(ref);
          mkDrag(ref);
        });
        board.appendChild(el);
      }
    }
    yachtTouchData = null;
  });
  
  const board = $('#u-board');
  board.addEventListener('dragover', e => e.preventDefault());
  board.addEventListener('drop', e => {
    e.preventDefault();
    if (!dragged) return;
    if (dragged.classList.contains('ut-op')) {
      const clone = dragged.cloneNode(true);
      clone.className = 'ub-item';
      clone.addEventListener('click', () => clone.remove());
      board.appendChild(clone);
    } else {
      dragged.className = 'ub-item ud-used';
      const ref = dragged;
      dragged.addEventListener('click', () => {
        ref.className = 'ult-token ut-dice';
        ref.setAttribute('draggable', 'true');
        $('#u-dice').appendChild(ref);
        mkDrag(ref);
      });
      board.appendChild(dragged);
    }
  });

  $('#u-rst').addEventListener('click', () => {
    $$('.ud-used').forEach(el => {
      el.className = 'ult-token ut-dice';
      el.setAttribute('draggable', 'true');
      $('#u-dice').appendChild(el);
      mkDrag(el);
    });
    $$('.ub-item').forEach(el => el.remove());
    $('#u-fb').textContent = '';
  });

  $('#u-skp').addEventListener('click', () => playNextYacht());

  $('#u-chk').addEventListener('click', () => {
    const items = board.querySelectorAll('.ub-item');
    if (items.length === 0) return;
    if (board.querySelectorAll('.ud-used').length < 5) {
      $('#u-fb').textContent = '주사위 5개를 모두 사용하세요!';
      $('#u-fb').style.color = 'var(--red)';
      return;
    }
    const expr = Array.from(items).map(i => i.dataset.v).join('');
    try {
      if (!/^[\d+\-*/()]+$/.test(expr)) throw new Error();
      const res = new Function('return (' + expr + ')')();
      let diff = Math.abs(100 - res);
      let score = 0;
      if (diff === 0) score = 750;
      else if (diff === 1) score = 300;
      else if (diff === 2) score = 250;
      else if (diff === 3) score = 200;
      else if (diff === 4) score = 150;
      else if (diff === 5) score = 100;

      if (score > 0) {
        if (diff === 0) {
          $('#u-fb').textContent = '🎉 완벽한 매스 얏! +750점';
          $('#u-fb').style.color = 'var(--green)';
        } else {
          $('#u-fb').textContent = `아깝다! (오차 ${diff}) +${score}점`;
          $('#u-fb').style.color = 'var(--blue)';
        }
        state.players[pi].cats.mathYacht.sc = score;
        state.players[pi].cats.mathYacht.msg = `성공! +${score}`;
        state.players[pi].cats.mathYacht.formula = `${expr} = ${res}`;
        const rRow = $(`.cat-row[data-p="${pi}"][data-cat="mathYacht"] .cr-record`);
        if (rRow) rRow.textContent = `${expr} = ${res}`;
        $('#u-chk').disabled = true;
        setTimeout(playNextYacht, 1500);
      } else {
        $('#u-fb').textContent = `결과: ${res} — 100이 아닙니다.`;
        $('#u-fb').style.color = 'var(--red)';
        state.players[pi].cats.mathYacht.sc = 0;
        state.players[pi].cats.mathYacht.msg = '실패 (100 아님)';
        state.players[pi].cats.mathYacht.formula = `${expr} = ${res}`;
        const rRow = $(`.cat-row[data-p="${pi}"][data-cat="mathYacht"] .cr-record`);
        if (rRow) rRow.textContent = `${expr} = ${res}`;
      }
    } catch {
      $('#u-fb').textContent = '수식이 올바르지 않습니다!';
      $('#u-fb').style.color = 'var(--red)';
    }
  });
}

// ===== FINAL SETTLEMENT (SCORING) =====
function doSettlement() {
  [0, 1].forEach(pi => {
    for (const [id, c] of Object.entries(state.players[pi].cats)) {
      if (id === 'mathYacht') continue; // Handled
      if (!c.s) { c.msg = '미사용 (0점)'; continue; }
      const res = validateScore(id, c.d, c.a);
      c.sc = res.score;
      c.msg = res.msg;
      
      state.players[pi].total += res.score;
      if (['plus','minus','multi','divide'].includes(id)) {
        state.players[pi].coreTotal += res.score;
      }
    }
    if (state.players[pi].coreTotal >= 550) {
      state.players[pi].total += 350;
    }
    state.players[pi].total += state.players[pi].cats.mathYacht.sc;
  });

  showFinalResults();
}

function validateScore(id, d, a) {
  let expected, score = 0;
  switch (id) {
    case 'plus':
      expected = (d[0]*10+d[1]) + (d[2]*10+d[3]);
      if (a === expected) score = expected;
      break;
    case 'minus':
      expected = (d[0]*10+d[1]) - (d[2]*10+d[3]);
      if (expected < 0) return { ok: false, score: 0, msg: '오답 (음수)' };
      if (a === expected) score = expected;
      break;
    case 'multi':
      expected = d[0] * d[1];
      if (a === expected) score = expected * 2;
      break;
    case 'divide':
      if (d[2] === 0) return { ok: false, score: -100, msg: '0나눔 패널티 (-100)' };
      let numDivide = d[0]*10+d[1];
      let eQ = Math.floor(numDivide / d[2]);
      let eR = numDivide % d[2];
      if (a.q === eQ && a.r === eR) score = eQ * 3;
      else return { ok: false, score: 0, msg: `오답 (정답: 몫 ${eQ}, 나머지 ${eR})` };
      break;
    case 'tripleMulti':
      expected = d[0] * d[1] * d[2];
      if (a === expected) {
        if (expected >= 450) score = 300;
        else return { ok: false, score: 0, msg: `조건미달 (450미만)` };
      }
      break;
    case 'heavyDuty':
      expected = (d[0]*10+d[1]) * (d[2]*10+d[3]);
      if (a === expected) {
        if (expected >= 7500) score = 300;
        else return { ok: false, score: 0, msg: `조건미달 (7500미만)` };
      }
      break;
    case 'cleanShot':
      if (d[2] === 0) return { ok: false, score: -100, msg: '0나눔 패널티 (-100)' };
      const numC = d[0]*10+d[1];
      if (numC % d[2] !== 0) return { ok: false, score: 0, msg: '나머지 있음' };
      expected = numC / d[2];
      if (a === expected) {
        if (expected >= 40) score = 250;
        else return { ok: false, score: 0, msg: `조건미달 (몫 40미만)` };
      }
      break;
    case 'fraction':
      if (d[1] === 0 || d[3] === 0) return { ok: false, score: -100, msg: '분모 0 패널티 (-100)' };
      let eNum = d[0]*d[3] + d[2]*d[1];
      let eDen = d[1]*d[3];
      if (eNum === 0) {
        return { ok: false, score: 0, msg: '조건미달 (합 80미만)' }; 
      } else {
        const g = gcd(eNum, eDen);
        eNum /= g; eDen /= g;
        if (eNum + eDen >= 80) {
          if (a.num === eNum && a.den === eDen) score = 250;
          else return { ok: false, score: 0, msg: `오답 (정답: ${eNum}/${eDen})` };
        } else {
          return { ok: false, score: 0, msg: `조건미달 (합 80미만)` };
        }
      }
      break;
  }
  if (score > 0) return { ok: true, score, msg: `정답 +${score}` };
  if (score < 0) return { ok: false, score, msg: `패널티 ${score}` }; // specifically for -100
  return { ok: false, score: 0, msg: `오답` };
}

function showFinalResults() {
  $('#modal-overlay').classList.remove('hidden');
  const t0 = state.players[0].total;
  const t1 = state.players[1].total;
  let wText = t0 > t1 ? '🔴 Player 1 승리!' : (t1 > t0 ? '🔵 Player 2 승리!' : '무승부!');
  
  const cats = ['plus','minus','multi','divide','tripleMulti','heavyDuty','cleanShot','fraction','mathYacht'];
  const cNames = ['두 자리 덧셈','두 자리 뺄셈','기본 곱셈','기본 나눗셈','삼단 곱셈','더블 곱셈','깔끔한 나눗셈','분수 만들기','매스 얏'];

  function buildCol(pi) {
    let html = `<div class="set-col"><div class="set-header">${pi===0?'🔴 Player 1':'🔵 Player 2'}</div>`;
    cats.forEach((c, i) => {
      const co = state.players[pi].cats[c];
      const cls = co.sc > 0 ? 'res-pass' : (co.sc < 0 ? 'res-fail' : (co.s ? 'res-fail' : 'res-skip'));
      html += `<div class="set-item"><span class="set-name">${cNames[i]}</span><span class="set-res ${cls}">${co.msg || '미참여'}</span></div>`;
    });
    if (state.players[pi].coreTotal >= 550) {
      html += `<div class="bonus-row">기본 사칙 보너스 +350</div>`;
    }
    html += `</div>`;
    return html;
  }

  let html = `
    <div class="ult-title">🏁 최종 정산 보고서</div>
    <div class="settlement-grid">
      ${buildCol(0)}
      ${buildCol(1)}
    </div>
    <div class="winner-text">${wText}</div>
    <div class="final-wrap">
      <div class="final-p">
        <span style="color:var(--red)">P1: ${t0}점</span>
        <span style="color:var(--blue)">P2: ${t1}점</span>
      </div>
    </div>
    <button class="ult-btn ub-check" style="margin-top:10px;font-size:1.1rem" onclick="location.reload()">🎲 다시 하기</button>
  `;
  $('#modal').innerHTML = html;
}

// ===== INIT =====
dom.rollBtn.addEventListener('click', rollDice);
updateHeader();
