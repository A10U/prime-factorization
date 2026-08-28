/**
 * MW MAGIC ACADEMY — MAIN APPLICATION CONTROLLER
 * Orchestrates State Machine, Tree Layout, Pair Sync, Audio & Companions.
 */
(() => {
  'use strict';

  /* ================================================================
     HELPERS & CONSTANTS
     ================================================================ */
  const STAGES = ['PICK', 'PEEL', 'TREE', 'COUNT', 'APPLY'];
  const STAGE_LABELS = {
    PICK: 'เลือกเลขผลึก',
    PEEL: 'ผ่าแยกผลึก',
    TREE: 'ต้นไม้ตัวประกอบ',
    COUNT: 'นับสูตรยกกำลัง',
    APPLY: 'โจทย์ประยุกต์'
  };

  const SUPERSCRIPTS = '⁰¹²³⁴⁵⁶⁷⁸⁹';
  function toSup(n) {
    return String(n).split('').map(c => SUPERSCRIPTS[+c] ?? c).join('');
  }

  function fmtFactorization(factors) {
    if (!factors || !factors.length) return '';
    return factors.map(({ p, e }) => e === 1 ? `${p}` : `${p}${toSup(e)}`).join(' × ');
  }

  function getEl(id) {
    return document.getElementById(id);
  }

  function createFbBanner(msg, type = 'info') {
    const d = document.createElement('div');
    d.className = `fb-banner ${type}`;
    d.innerHTML = msg;
    return d;
  }

  /* ================================================================
     APPLICATION STATE
     ================================================================ */
  const S = {
    stage: 'PICK',
    n: null,
    level: 'junior', // 'junior' | 'exam'
    firstTime: true,

    // PEEL Stage
    peelRem: null,
    peelSteps: [],
    factors: [],

    // TREE Stage
    treeNodes: [],
    expanded: 0,

    // COUNT Stage
    countSubmitted: false,
    countAttempts: 0,
    countEval: null,
    explainAttempts: 0,

    // APPLY Stage
    applyProb: null,
    applyPhase: 'hypothesis',
    applyHypoN: null,
    applyAttempts: 0,

    // Hints & AI
    hintTier: 0,
    misconId: null,
    apiKey: sessionStorage.getItem('mw_gemini_key') || '',
    model: sessionStorage.getItem('mw_gemini_model') || 'gemini-2.0-flash',
    theme: localStorage.getItem('mw_theme') || 'magic'
  };

  /* ================================================================
     PROGRESS & LOGGING
     ================================================================ */
  function renderProgress() {
    const curIdx = STAGES.indexOf(S.stage);
    const progressEl = getEl('stage-progress');
    if (!progressEl) return;

    progressEl.innerHTML = STAGES.map((s, i) => {
      const isDone = i < curIdx;
      const isActive = i === curIdx;
      const cls = isDone ? 'done' : isActive ? 'active' : '';
      return `
        ${i > 0 ? '<span class="sp-arrow" aria-hidden="true">›</span>' : ''}
        <div class="sp-step ${cls}">
          <div class="sp-dot ${cls}">${isDone ? '✓' : i + 1}</div>
          <span class="sp-label">${STAGE_LABELS[s]}</span>
        </div>`;
    }).join('');
  }

  function addLog(text, type = 'info') {
    const logWrap = getEl('log-entries');
    if (!logWrap) return;
    const item = document.createElement('div');
    item.className = `log-item ${type}`;
    item.textContent = text;
    logWrap.appendChild(item);
    logWrap.scrollTop = logWrap.scrollHeight;
  }

  /* ================================================================
     SVG FACTOR TREE LAYOUT & RENDERING
     ================================================================ */
  function layoutTree(nodes, totalLevels) {
    const LEAF_HEIGHT = 68;
    const COLUMN_WIDTH = 260; // Widen spacing for spacious factor tree!
    const PADDING_X = 80;
    const PADDING_Y = 40;

    const leaves = nodes.filter(nd => nd.level === totalLevels);
    const leafCount = Math.max(leaves.length, 1);
    const svgH = Math.max(leafCount * LEAF_HEIGHT + PADDING_Y * 2, 260);
    const svgW = totalLevels * COLUMN_WIDTH + PADDING_X * 2;
    const pos = {};

    leaves.forEach((leaf, i) => {
      pos[leaf.id] = {
        x: PADDING_X + totalLevels * COLUMN_WIDTH,
        y: PADDING_Y + i * LEAF_HEIGHT
      };
    });

    for (let lv = totalLevels - 1; lv >= 0; lv--) {
      for (const nd of nodes.filter(n => n.level === lv)) {
        const children = nodes.filter(n => n.parentId === nd.id);
        if (children.length && children.every(c => pos[c.id])) {
          const ys = children.map(c => pos[c.id].y);
          pos[nd.id] = {
            x: PADDING_X + lv * COLUMN_WIDTH,
            y: ys.reduce((a, b) => a + b, 0) / ys.length
          };
        }
      }
    }

    return { pos, svgW, svgH };
  }

  function drawTree() {
    if (!S.treeNodes.length || !S.factors.length) return;
    const totalLvl = S.factors.length;
    const { pos, svgW, svgH } = layoutTree(S.treeNodes, totalLvl);
    const exp = S.expanded;

    const svg = getEl('tree-svg');
    const emptyState = getEl('tree-empty-state');
    if (emptyState) emptyState.style.display = 'none';

    svg.setAttribute('width', svgW);
    svg.setAttribute('height', svgH);
    svg.setAttribute('viewBox', `0 0 ${svgW} ${svgH}`);

    let html = '';

    // 1. Draw Edges
    for (const nd of S.treeNodes) {
      if (nd.parentId === null || !pos[nd.id]) continue;
      const par = S.treeNodes.find(n => n.id === nd.parentId);
      if (!pos[par.id]) continue;

      const pp = pos[par.id];
      const cp = pos[nd.id];
      const revealed = nd.level <= exp;
      const isNext = nd.level === exp + 1;
      if (!revealed && !isNext) continue;

      const alpha = revealed ? 0.8 : 0.2;
      const dash = revealed ? '' : '5 4';

      html += `<line x1="${pp.x}" y1="${pp.y}" x2="${cp.x}" y2="${cp.y}" stroke="rgba(139,92,246,${alpha})" stroke-width="${revealed ? 2.6 : 1.4}" stroke-dasharray="${dash}" stroke-linecap="round"/>`;

      if (revealed && nd.edgeMult !== null) {
        const mx = (pp.x + cp.x) / 2 + 8;
        const my = (pp.y + cp.y) / 2 - 5;
        html += `<text x="${mx}" y="${my}" text-anchor="start" fill="#F59E0B" font-size="11.5" font-weight="700" font-family="Inter">×${nd.edgeMult}</text>`;
      }
    }

    // 2. Draw Nodes
    for (const nd of S.treeNodes) {
      if (!pos[nd.id]) continue;
      const { x, y } = pos[nd.id];
      const revealed = nd.level <= exp;
      const isNext = nd.level === exp + 1;
      if (!revealed && !isNext) continue;

      const isLeaf = nd.level === totalLvl;
      const isNew = nd.level === exp;
      const r = nd.level === 0 ? 23 : isLeaf ? 21 : 18;

      if (revealed) {
        const stroke = isLeaf ? '#10B981' : '#8B5CF6';
        const fill   = isLeaf ? 'rgba(16,185,129,0.18)' : 'rgba(139,92,246,0.18)';
        const tc     = isLeaf ? '#6EE7B7' : '#C4B5FD';
        const glow   = isLeaf ? 'rgba(16,185,129,0.35)' : 'rgba(139,92,246,0.35)';
        const fs     = nd.value > 99 ? 11 : nd.value > 9 ? 13 : 14.5;
        const anim   = isNew ? `style="animation:nodeIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)"` : '';

        html += `
          <circle cx="${x}" cy="${y}" r="${r + 8}" fill="${glow}" ${anim}/>
          <circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="2.4" ${anim}/>
          <text x="${x}" y="${y + 5}" text-anchor="middle" fill="${tc}" font-size="${fs}" font-weight="700" font-family="Inter" ${anim}>${nd.value}</text>`;
      } else {
        html += `
          <circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="rgba(139,92,246,0.25)" stroke-width="1.5" stroke-dasharray="4 3"/>
          <text x="${x}" y="${y + 5}" text-anchor="middle" fill="rgba(139,92,246,0.35)" font-size="12" font-family="Inter">?</text>`;
      }
    }

    svg.innerHTML = html;
  }

  /* ================================================================
     DIVISOR PAIRS TABLE
     ================================================================ */
  function drawPairTable() {
    if (!S.n) return;
    const pairs = Engine.divisorPairs(S.n);
    const leafVals = new Set(
      S.treeNodes
        .filter(nd => nd.level === S.factors.length && nd.level <= S.expanded)
        .map(nd => nd.value)
    );

    const wrap = getEl('pair-table-entries');
    if (!wrap) return;

    wrap.innerHTML = pairs.map(([a, b]) => {
      const isVerified = leafVals.has(a) && leafVals.has(b);
      return `
        <div class="pair-row ${isVerified ? 'verified' : ''}">
          <span class="pair-a">${a}</span>
          <span class="pair-op">×</span>
          <span class="pair-b">${b}</span>
          <span class="pair-op">=</span>
          <span class="pair-n">${S.n}</span>
          ${isVerified ? '<span class="pair-check">✓</span>' : ''}
        </div>`;
    }).join('');
  }

  /* ================================================================
     STAGE 1: PICK (เลือกผลึกตัวเลข)
     ================================================================ */
  function renderPICK() {
    S.stage = 'PICK';
    renderProgress();

    getEl('tree-panel').style.display = 'none';
    getEl('pair-panel').style.display = 'none';
    getEl('stage-content-wrap').style.display = 'flex';

    const numbers = S.level === 'junior'
      ? [12, 18, 24, 36, 48, 60]
      : [84, 105, 126, 180, 210, 360];

    getEl('stage-content-wrap').innerHTML = `
      <div class="pick-container">
        <h1 class="pick-hero-title">✨ เลือกผลึกตัวเลขแห่งสถาบันเวทมนตร์</h1>
        <p class="pick-hero-desc">
          สร้างต้นไม้ตัวประกอบเพื่อค้นพบที่มาของสูตร (e₁+1)(e₂+1)…<br>
          เรียนรู้จากโครงสร้างรูปภาพจริง เข้าใจลึกซึ้ง ไม่ต้องท่องจำ
        </p>

        <!-- Doctor Video Feature Card -->
        <div class="video-preview-card" id="card-open-video">
          <div class="vpc-badge">🎬 วิดีโอต้นแบบการสอน: DOCTOR'S METHOD</div>
          <div class="vpc-main">
            <div class="vpc-icon">▶️</div>
            <div class="vpc-info">
              <div class="vpc-title">ชมวิธีคิดต้นไม้ตัวประกอบ (Doctor's Guide)</div>
              <div class="vpc-desc">ดูคลิปการสอนจริง: การแตกกิ่งทีละชั้น และการเชื่อมโยงกับตารางคู่</div>
            </div>
            <button class="btn btn-primary btn-video-top" id="btn-watch-video" type="button">ชมวิดีโอ 🎬</button>
          </div>
        </div>

        <div class="level-toggle-group" role="group" aria-label="ระดับการเรียนรู้">
          <button class="level-tab-btn ${S.level === 'junior' ? 'active' : ''}" id="lv-junior">🎒 ประถม / ม.ต้น</button>
          <button class="level-tab-btn ${S.level === 'exam' ? 'active' : ''}" id="lv-exam">📝 ติวสอบเข้มข้น</button>
        </div>

        <div class="n-input-box">
          <input type="number" id="n-input" min="2" max="999"
            placeholder="${S.level === 'junior' ? 'เลือกหรือพิมพ์เลข เช่น 12 – 60' : 'เลือกหรือพิมพ์เลข เช่น 84 – 999'}"
            value="${S.n || ''}">
        </div>

        <div class="quick-nums-row">
          ${numbers.map((v, idx) => `
            <button class="q-chip ${S.firstTime && idx === 0 ? 'star' : ''}" data-val="${v}">
              ${v}${S.firstTime && idx === 0 ? ' ⭐ แนะนำ' : ''}
            </button>
          `).join('')}
        </div>

        <div id="pick-feedback"></div>
      </div>`;

    getEl('action-bar').innerHTML = `
      <span style="color:var(--text-dim);font-size:13.5px">
        ${S.firstTime ? '💡 นัวแนะนำ: เริ่มต้นด้วยเลข 12 เพื่อตรวจสอบด้วยมือก่อนตามแนวทาง S1' : 'พร้อมเริ่มการผ่าผลึกแล้วหรือยัง?'}
      </span>
      <button class="btn btn-primary" id="start-btn" style="margin-left:auto">เริ่มผ่าผลึกตัวเลข →</button>`;

    getEl('hint-ribbon-text').textContent = '';
    getEl('btn-request-hint').disabled = false;

    Companion.speak(
      S.firstTime
        ? 'สวัสดีจ้า! ข้าคือนัว และนี่มิกซี่คู่หู 🧙‍♂️🐭 วันนี้เราจะพาเจ้าไปสำรวจศาสตร์แห่งต้นไม้ตัวประกอบกัน! ลองเลือกผลึกเลข 12 เป็นด่านแรกดูสิ!'
        : 'เลือกผลึกก้อนใหม่ที่เจ้าต้องการศึกษา แล้วมากดเริ่มผ่าผลึกกันเลย!',
      'normal'
    );

    // Event listeners
    getEl('card-open-video')?.addEventListener('click', openVideoModal);
    getEl('lv-junior')?.addEventListener('click', () => {
      soundEngine.playClick();
      S.level = 'junior';
      renderPICK();
    });
    getEl('lv-exam')?.addEventListener('click', () => {
      soundEngine.playClick();
      S.level = 'exam';
      renderPICK();
    });

    document.querySelectorAll('.q-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        soundEngine.playClick();
        getEl('n-input').value = btn.dataset.val;
      });
    });

    getEl('start-btn')?.addEventListener('click', startPEEL);
    getEl('n-input')?.addEventListener('keydown', e => {
      if (e.key === 'Enter') startPEEL();
    });
  }

  function startPEEL() {
    const inputVal = parseInt(getEl('n-input').value);
    const check = Engine.validateN(inputVal);

    if (!check.ok) {
      soundEngine.playError();
      getEl('pick-feedback').replaceChildren(createFbBanner(check.msg, 'err'));
      Companion.speak(check.msg, 'warn');
      return;
    }

    soundEngine.playSlice();
    S.n = inputVal;
    S.peelRem = inputVal;
    S.peelSteps = [];
    S.factors = Engine.factorize(inputVal);
    S.treeNodes = [];
    S.expanded = 0;
    S.countSubmitted = false;
    S.countAttempts = 0;
    S.countEval = null;
    S.explainAttempts = 0;
    S.applyProb = null;
    S.hintTier = 0;
    S.misconId = null;
    S.firstTime = false;

    getEl('log-entries').innerHTML = '';
    getEl('hint-ribbon-text').textContent = '';
    addLog(`💎 ผลึกเป้าหมาย n = ${inputVal}`, 'info');

    renderPEEL();
  }

  /* ================================================================
     STAGE 2: PEEL (ผ่าแยกผลึกธาตุบริสุทธิ์)
     ================================================================ */
  function renderPEEL() {
    S.stage = 'PEEL';
    renderProgress();

    getEl('tree-panel').style.display = 'none';
    getEl('pair-panel').style.display = 'none';
    getEl('stage-content-wrap').style.display = 'flex';

    const rem = S.peelRem;
    const isDone = rem === 1;
    const PRIMES = [2, 3, 5, 7, 11, 13, 17, 19, 23];

    getEl('stage-content-wrap').innerHTML = `
      <div class="peel-container">
        <div class="peel-badge">ผลึกคงเหลือที่ต้องผ่าแยก</div>
        <div class="peel-crystal-display" id="peel-crystal-val">${rem}</div>

        ${!isDone ? `
          <p class="peel-instruction">เลือกผลึกธาตุบริสุทธิ์ (จำนวนเฉพาะ) ที่สามารถหาร <strong>${rem}</strong> ได้ลงตัว</p>
          <div class="prime-element-grid" role="group" aria-label="เลือกจำนวนเฉพาะที่หารลงตัว">
            ${PRIMES.map(p => `
              <button class="btn-prime-crystal" data-p="${p}" ${rem % p !== 0 ? 'disabled' : ''}>
                ${p}
              </button>
            `).join('')}
          </div>
        ` : `
          <div class="peel-done-card">
            <div class="peel-done-title">✨ หลอมรวมผลึกธาตุบริสุทธิ์สำเร็จครบถ้วน!</div>
            <div class="peel-done-formula">${S.n} = ${fmtFactorization(S.factors)}</div>
          </div>
        `}

        ${S.peelSteps.length ? `
          <div class="peel-steps-history">
            ${S.peelSteps.map(s => `${s.n} ÷ ${s.p} = ${s.q}`).join('  ›  ')}
          </div>
        ` : ''}

        <div id="peel-feedback"></div>
      </div>`;

    if (isDone) {
      soundEngine.playSuccess();
      Companion.speak(
        `ยอดเยี่ยมมาก! เราผ่าแยกผลึก ${S.n} ออกเป็นผลึกธาตุบริสุทธิ์ได้ ${fmtFactorization(S.factors)} สำเร็จแล้ว! พร้อมไปปลูกต้นไม้ตัวประกอบกันต่อเลย!`,
        'celebrate'
      );
    } else {
      Companion.speak(
        `ตอนนี้ผลึกเหลือ ${rem} เจ้าคิดว่าผลึกธาตุบริสุทธิ์ (จำนวนเฉพาะ) ตัวไหนสามารถผ่ามันได้ลงตัว?`,
        'thinking'
      );
    }

    getEl('action-bar').innerHTML = isDone ? `
      <span class="peel-done-formula" style="font-size:15px">${S.n} = ${fmtFactorization(S.factors)}</span>
      <button class="btn btn-primary" id="go-tree-btn" style="margin-left:auto">ปลูกต้นไม้ตัวประกอบ →</button>
    ` : `
      <span style="color:var(--text-dim);font-size:13.5px">ผ่าแยกด้วยจำนวนเฉพาะทีละตัวจนกระทั่งเหลือ 1</span>
      <button class="btn btn-ghost" id="btn-repick" style="margin-left:auto">← เลือกผลึกใหม่</button>`;

    document.querySelectorAll('.btn-prime-crystal').forEach(btn => {
      btn.addEventListener('click', () => {
        soundEngine.playPrimeGlow();
        const p = +btn.dataset.p;
        const q = Math.floor(S.peelRem / p);
        S.peelSteps.push({ n: S.peelRem, p, q });
        addLog(`⚡ ผ่าผลึก: ${S.peelRem} ÷ ${p} = ${q}`, 'peel');
        S.peelRem = q;

        if (q === 1) {
          addLog(`∴  ${S.n} = ${fmtFactorization(S.factors)}`, 'result');
        }
        renderPEEL();
      });
    });

    getEl('go-tree-btn')?.addEventListener('click', startTREE);
    getEl('btn-repick')?.addEventListener('click', renderPICK);
  }

  /* ================================================================
     STAGE 3: TREE (ต้นไม้ตัวประกอบ & กระจกตารางคู่)
     ================================================================ */
  function startTREE() {
    soundEngine.playBranch();
    S.treeNodes = Engine.buildTree(S.factors);
    S.expanded = 0;
    S.stage = 'TREE';
    renderProgress();
    renderTREE();
  }

  function renderTREE() {
    getEl('tree-panel').style.display = 'flex';
    getEl('pair-panel').style.display = 'flex';
    getEl('stage-content-wrap').style.display = 'none';

    const oldSection = getEl('count-stage-section');
    if (oldSection) oldSection.remove();

    getEl('tree-n-badge').textContent = `n = ${S.n}`;
    drawTree();
    drawPairTable();

    const totalLvl = S.factors.length;
    const isTreeComplete = S.expanded >= totalLvl;

    const leaves = S.treeNodes
      .filter(nd => nd.level === totalLvl)
      .map(nd => nd.value)
      .sort((a, b) => a - b);
    const actualDivisors = Engine.allDivisors(S.factors);
    const isPairsMatched = isTreeComplete && JSON.stringify(leaves) === JSON.stringify(actualDivisors);

    const nextFactor = S.factors[S.expanded];

    if (!isTreeComplete) {
      Companion.speak(
        `กด "ร่ายเวทย์แตกกิ่ง" ชั้นที่ ${S.expanded + 1} เพื่อแตกทางเลือกของธาตุ ×${nextFactor.p} กันเลย!`,
        'thinking'
      );
    } else if (isPairsMatched) {
      soundEngine.playFuse();
      Companion.speak(
        `ดูที่กระจกตารางคู่ทางขวาสิ! ปลายกิ่งของต้นไม้ตรงกับคู่คูณของ ${S.n} ครบถ้วนทุกตัวพอดีเป๊ะเลย!`,
        'celebrate'
      );
    }

    getEl('action-bar').innerHTML = `
      <span style="color:var(--text-muted);font-size:13.5px">
        ชั้นที่แสดง: <strong style="color:var(--c-purple-l)">${S.expanded}/${totalLvl}</strong>
        ${S.expanded > 0 ? `&nbsp;·&nbsp;${S.factors.slice(0, S.expanded).map(f => `${f.p}${toSup(f.e)}`).join(' × ')}` : ''}
      </span>

      ${!isTreeComplete ? `
        <button class="btn btn-primary" id="btn-expand-tree" style="margin-left:auto">
          🌿 ร่ายเวทย์แตกกิ่ง — ชั้น ${S.expanded + 1} (×${nextFactor.p}${nextFactor.e > 1 ? `<sup>${nextFactor.e}</sup>` : ''})
        </button>
      ` : isPairsMatched ? `
        <span style="color:var(--c-green-l);font-size:13.5px;margin-left:auto">✓ ปลายกิ่งตรงกับกระจกตารางคู่ครบสมบูรณ์</span>
        <button class="btn btn-green" id="btn-goto-count">→ นับสูตรยกกำลัง</button>
      ` : `
        <span style="color:var(--c-red-l);font-size:13.5px;margin-left:auto">⚠️ ตรวจสอบว่าปลายกิ่งตรงกับตารางคู่หรือไม่</span>
      `}`;

    getEl('btn-expand-tree')?.addEventListener('click', () => {
      soundEngine.playBranch();
      const f = S.factors[S.expanded];
      addLog(`🌿 แตกกิ่งชั้น ${S.expanded + 1}: ×${f.p}${toSup(f.e)} → ${f.e + 1} กิ่ง`, 'peel');
      S.expanded++;
      renderTREE();
    });

    getEl('btn-goto-count')?.addEventListener('click', () => {
      soundEngine.playClick();
      addLog(`✓ ปลายกิ่งตัวประกอบครบถ้วน: ${actualDivisors.join(', ')}`, 'result');
      renderCOUNT();
    });
  }

  /* ================================================================
     STAGE 4: COUNT (นับสูตรยกกำลัง & ทำความเข้าใจ +1)
     ================================================================ */
  function renderCOUNT() {
    S.stage = 'COUNT';
    renderProgress();

    getEl('tree-panel').style.display = 'flex';
    getEl('pair-panel').style.display = 'flex';
    getEl('stage-content-wrap').style.display = 'none';

    const oldSection = getEl('count-stage-section');
    if (oldSection) oldSection.remove();

    const totalDivisors = Engine.divisorCount(S.factors);
    const section = document.createElement('div');
    section.id = 'count-stage-section';

    if (!S.countSubmitted) {
      Companion.speak(
        `จากต้นไม้ตัวประกอบด้านบน เจ้าลองนับหรือทายดูสิว่า ${S.n} มีตัวประกอบทั้งหมดกี่ตัว?`,
        'thinking'
      );

      section.innerHTML = `
        <div class="count-question">
          🎯 จากต้นไม้ตัวประกอบด้านบน — <strong>${S.n}</strong> มีตัวประกอบทั้งหมดกี่ตัว?<br>
          <small style="color:var(--text-dim);font-size:12px">ลองทายคำตอบก่อนเปิดเผยสูตรเวทมนตร์</small>
        </div>
        <div class="count-input-row">
          <input type="number" id="count-input" min="1" max="200" placeholder="?" aria-label="จำนวนตัวประกอบที่ทาย">
          <button class="btn btn-primary" id="btn-submit-count">ตรวจคำตอบ</button>
        </div>
        <div id="count-feedback"></div>`;

      getEl('action-bar').innerHTML = `
        <button class="btn btn-ghost" id="btn-back-tree2">← ย้อนดูต้นไม้</button>`;
      getEl('btn-back-tree2')?.addEventListener('click', renderTREE);

    } else {
      const formulaHtml = S.factors.map(({ e }) =>
        `(<span class="formula-exp-highlight">${e}</span>+1)`
      ).join(' × ');
      const expandedNums = S.factors.map(({ e }) => e + 1).join(' × ');

      const branchBreakdownRows = S.factors.map(({ p, e }) => {
        const choices = Array.from({ length: e + 1 }, (_, k) => `×${Math.pow(p, k)} (p<sup>${k}</sup>)`).join(', ');
        return `
          <div class="bb-row">
            <span class="bb-prime">ชั้น ×${p}${e > 1 ? `<sup>${e}</sup>` : ''}</span>
            <span class="bb-choices">${choices}</span>
            <span class="bb-count">(${e}+1 = ${e + 1} กิ่ง)</span>
          </div>`;
      }).join('');

      section.innerHTML = `
        <div class="drawer-header-bar" id="btn-toggle-count-drawer" title="คลิกเพื่อย่อหรือขยายแผงสูตร">
          <span class="drawer-title-text">🔮 โครงสร้างสูตรและการนับกิ่งตัวประกอบ</span>
          <button class="btn-drawer-toggle" id="btn-drawer-toggle-text">▾ ย่อเก็บ</button>
        </div>
        <div class="drawer-body-content" id="count-drawer-body">
          <div class="count-cards-grid">
            <div class="formula-forge-box">
              <div class="formula-forge-label">🔮 สูตรการหาจำนวนตัวประกอบ</div>
              <div class="formula-forge-main">
                ${formulaHtml} = ${expandedNums} = <strong>${totalDivisors}</strong> ตัว
              </div>
              <div class="formula-forge-note">
                แต่ละชั้นของจำนวนเฉพาะ p มี (e + 1) กิ่ง เพราะเลือกยกกำลังได้ตั้งแต่ p⁰ จนถึง p^e
              </div>
            </div>

            <div class="branch-breakdown-card">
              <div class="bb-title">🔍 นับกิ่งจริงจากต้นไม้ตัวประกอบ</div>
              ${branchBreakdownRows}
              <div class="bb-total">→ จำนวนกิ่งทั้งหมดคูณกัน = ${S.factors.map(({ e }) => e + 1).join(' × ')} = <strong>${totalDivisors}</strong> ตัวประกอบ</div>
            </div>
          </div>

          <div class="guided-explain-box">
            <div class="guided-title">💡 ทำไมในสูตรถึงต้องบวก 1 (+1)?</div>
            <div class="guided-body">
              ในแต่ละชั้นของต้นไม้ เราเลือกยกกำลังได้ตั้งแต่ <strong>p⁰ = 1</strong> (ทางเลือกที่ไม่หยิบ p เลย) ไปจนถึง <strong>p^e</strong> จึงมีทางเลือกทั้งหมด <strong>(e + 1)</strong> ทาง
            </div>
          </div>
        </div>`;

      soundEngine.playSuccess();
      Companion.speak(
        `ยอดเยี่ยมมาก! จำนวนกิ่งทั้งหมดคูณกันได้ ${totalDivisors} ตัวพอดีเป๊ะ! พร้อมไปลุยโจทย์ประยุกต์ย้อนกลับกันต่อได้เลย!`,
        'celebrate'
      );

      getEl('action-bar').innerHTML = `
        <button class="btn btn-ghost" id="btn-back-tree">← ย้อนดูต้นไม้</button>
        <button class="btn btn-green" id="btn-goto-apply" style="margin-left:auto">🎯 ท้าทายโจทย์ประยุกต์ย้อนกลับ →</button>`;
      getEl('btn-goto-apply')?.addEventListener('click', startAPPLY);
      getEl('btn-back-tree')?.addEventListener('click', renderTREE);

      getEl('btn-toggle-count-drawer')?.addEventListener('click', () => {
        soundEngine.playClick();
        section.classList.toggle('collapsed');
        const btnText = getEl('btn-drawer-toggle-text');
        if (btnText) {
          btnText.textContent = section.classList.contains('collapsed') ? '▴ ขยายดูสูตร' : '▾ ย่อเก็บ';
        }
      });
    }

    getEl('tree-panel').appendChild(section);

    // Bind event handlers
    getEl('btn-submit-count')?.addEventListener('click', submitCountGuess);
    getEl('count-input')?.addEventListener('keydown', e => {
      if (e.key === 'Enter') submitCountGuess();
    });
  }

  function submitCountGuess() {
    const guess = parseInt(getEl('count-input')?.value);
    if (!guess || isNaN(guess)) return;

    const check = Engine.checkCountGuess(guess, S.factors);
    S.countAttempts++;
    S.misconId = check.misconId;

    const fbBox = getEl('count-feedback');
    const correctCount = Engine.divisorCount(S.factors);

    if (check.ok) {
      soundEngine.playSuccess();
      addLog(`ทายจำนวนตัวประกอบ: ${guess} ✅ ถูกต้อง!`, 'result');
      fbBox.replaceChildren(createFbBanner(`🎯 ยอดเยี่ยม! ${S.n} มีตัวประกอบทั้งหมด <strong>${guess}</strong> ตัว`, 'ok'));
      S.countSubmitted = true;
      getEl('btn-submit-count').disabled = true;
      setTimeout(renderCOUNT, 800);
    } else {
      soundEngine.playError();
      const hintMsg = check.misconId
        ? Companion.getStaticHint({ misconceptionId: check.misconId, hintTier: 1 })
        : 'ลองนับปลายกิ่งในต้นไม้อีกครั้งดูนะ!';
      addLog(`ทาย: ${guess} ❌`, 'hint');
      fbBox.replaceChildren(createFbBanner(`ยังไม่ถูกต้อง — ${hintMsg}`, 'err'));
      getEl('hint-ribbon-text').textContent = hintMsg;
      Companion.speak(hintMsg, 'thinking');

      if (S.countAttempts >= 3) {
        fbBox.replaceChildren(createFbBanner(`คำตอบที่ถูกต้องคือ <strong>${correctCount}</strong> ตัว — มาดูโครงสร้างสูตรในขั้นถัดไปกันเลย!`, 'info'));
        S.countSubmitted = true;
        setTimeout(renderCOUNT, 1200);
      }
    }
  }

  /* ================================================================
     STAGE 5: APPLY (โจทย์ประยุกต์ย้อนกลับ)
     ================================================================ */
  function startAPPLY() {
    soundEngine.playBranch();
    S.applyProb = Engine.generateProblem(S.level);
    S.applyPhase = 'hypothesis';
    S.applyHypoN = null;
    S.applyAttempts = 0;
    S.stage = 'APPLY';
    renderProgress();
    renderAPPLY();
  }

  function renderAPPLY() {
    const oldSection = getEl('count-stage-section');
    if (oldSection) oldSection.remove();

    getEl('tree-panel').style.display = 'none';
    getEl('pair-panel').style.display = 'none';
    getEl('stage-content-wrap').style.display = 'flex';

    const prob = S.applyProb;
    const phase = S.applyPhase;

    if (phase === 'hypothesis') {
      Companion.speak(
        `นี่คือโจทย์ประยุกต์ย้อนกลับ! เริ่มจากแยกตัวประกอบของคำใบ้ ${prob.hints.join(' และ ')} แล้วตั้งสมมติฐานว่าตัวเลขนั้นคืออะไร!`,
        'thinking'
      );
    }

    getEl('stage-content-wrap').innerHTML = `
      <div class="apply-container">
        <div class="apply-header-row">
          <div class="apply-badge-tag">🎯 โจทย์ประยุกต์ย้อนกลับ</div>
          <div class="phase-indicator-dots">
            <div class="phase-dot ${phase === 'hypothesis' ? 'active' : 'done'}" title="ขั้นตอนที่ 1: ตั้งสมมติฐาน"></div>
            <div class="phase-dot ${phase === 'verify' ? 'active' : ''}" title="ขั้นตอนที่ 2: ตรวจสอบ"></div>
          </div>
          <span style="font-size:12.5px;color:var(--text-dim);margin-left:4px">
            ขั้นตอน ${phase === 'hypothesis' ? '1' : '2'}/2: ${phase === 'hypothesis' ? 'ตั้งสมมติฐาน' : 'ตรวจสอบด้วยต้นไม้'}
          </span>
        </div>

        <div class="apply-quest-box">${prob.text}</div>

        ${phase === 'hypothesis' ? `
          <div class="apply-hint-guide">
            💡 คำแนะนำ: แยกตัวประกอบของ ${prob.hints.join(' และ ')} ก่อน → เพื่อดูว่าต้องมีจำนวนเฉพาะใดเป็นส่วนประกอบ
          </div>
          <div>
            <div style="font-size:13.5px;color:var(--text-muted);margin-bottom:8px">จำนวนที่คาดว่าเป็นคำตอบ:</div>
            <input type="number" id="apply-input-box" min="2" max="9999" placeholder="ใส่จำนวนที่คาดว่าเป็นคำตอบ…">
          </div>
          <div id="apply-feedback"></div>
        ` : `
          <div class="fb-banner ok">
            ✓ สมมติฐาน: จำนวนนั้นคือ <strong>${S.applyHypoN}</strong> = ${fmtFactorization(Engine.factorize(S.applyHypoN))}
          </div>
          <div>
            <div style="font-size:14px;color:var(--text-muted);margin-bottom:8px">
              ตรวจสอบ: <strong>${S.applyHypoN}</strong> มีตัวประกอบทั้งหมดกี่ตัว?<br>
              <small style="color:var(--text-dim)">(สร้างต้นไม้ในใจหรือทดบนกระดาษ แล้วนับตามสูตร)</small>
            </div>
            <div style="display:flex;gap:12px;align-items:center">
              <input type="number" id="verify-input-box" min="1" max="100" placeholder="?">
              <button class="btn btn-primary" id="btn-verify-apply">ตรวจสอบผลึก ✓</button>
            </div>
          </div>
          <div id="apply-feedback"></div>
        `}
      </div>`;

    getEl('action-bar').innerHTML = phase === 'hypothesis' ? `
      <button class="btn btn-ghost" id="btn-pick-again">← เลือกผลึกใหม่</button>
      <button class="btn btn-primary" id="btn-submit-hypo" style="margin-left:auto">ยืนยันสมมติฐาน →</button>
    ` : `
      <button class="btn btn-ghost" id="btn-new-problem">🔄 ลองโจทย์ข้อใหม่</button>
      <button class="btn btn-ghost" id="btn-pick-again2" style="margin-left:auto">← เลือกผลึกใหม่</button>`;

    getEl('btn-submit-hypo')?.addEventListener('click', submitHypothesis);
    getEl('apply-input-box')?.addEventListener('keydown', e => {
      if (e.key === 'Enter') submitHypothesis();
    });

    getEl('btn-verify-apply')?.addEventListener('click', submitVerification);
    getEl('verify-input-box')?.addEventListener('keydown', e => {
      if (e.key === 'Enter') submitVerification();
    });

    getEl('btn-new-problem')?.addEventListener('click', startAPPLY);
    getEl('btn-pick-again')?.addEventListener('click', () => { S.n = null; renderPICK(); });
    getEl('btn-pick-again2')?.addEventListener('click', () => { S.n = null; renderPICK(); });
  }

  function submitHypothesis() {
    const val = parseInt(getEl('apply-input-box')?.value);
    if (!val || val < 2) {
      soundEngine.playError();
      getEl('apply-feedback').replaceChildren(createFbBanner('กรุณาใส่จำนวนที่ถูกต้อง', 'err'));
      return;
    }

    const prob = S.applyProb;
    const badHint = prob.hints.find(h => val % h !== 0);

    if (badHint) {
      soundEngine.playError();
      getEl('apply-feedback').replaceChildren(
        createFbBanner(`<strong>${badHint}</strong> ต้องเป็นตัวประกอบของคำตอบ แต่ ${val} ÷ ${badHint} ไม่ลงตัว`, 'err')
      );
      addLog(`สมมติฐาน ${val} ❌ (${badHint} หารไม่ลงตัว)`, 'hint');
      S.applyAttempts++;
      if (S.applyAttempts >= 2) {
        const hintText = `ลองแยกตัวประกอบ ${prob.hints.join(' และ ')} ก่อน แล้วดูว่ามีจำนวนเฉพาะร่วมกันคืออะไร`;
        getEl('hint-ribbon-text').textContent = hintText;
        Companion.speak(hintText, 'thinking');
      }
      return;
    }

    soundEngine.playSuccess();
    S.applyHypoN = val;
    S.applyPhase = 'verify';
    addLog(`สมมติฐาน: ${val} — ${prob.hints.join(', ')} เป็นตัวประกอบ ✓`, 'peel');
    renderAPPLY();
  }

  function submitVerification() {
    const val = parseInt(getEl('verify-input-box')?.value);
    if (!val || isNaN(val)) return;

    const hypoN = S.applyHypoN;
    const hypoF = Engine.factorize(hypoN);
    const hypoCount = Engine.divisorCount(hypoF);
    const probCount = S.applyProb.factorCount;
    const correctN = S.applyProb.n;

    const isCountMatch = val === hypoCount;
    const isNMatch = hypoN === correctN;

    if (isCountMatch && isNMatch) {
      soundEngine.playSuccess();
      addLog(`✅ ยืนยันสมบูรณ์: ${hypoN} มีตัวประกอบ ${val} ตัว = ${probCount} ✓ ถูกต้อง!`, 'result');
      getEl('apply-feedback').replaceChildren(createFbBanner(
        `🎉 ยอดเยี่ยมที่สุด! <strong>${correctN}</strong> = ${fmtFactorization(hypoF)} → มีตัวประกอบ <strong>${hypoCount}</strong> ตัว ครบถ้วนตามเงื่อนไข!`,
        'ok'
      ));
      Companion.speak(
        `ยอดเยี่ยมที่สุด! เจ้าสามารถแก้โจทย์ประยุกต์ย้อนกลับได้สำเร็จอย่างงดงาม! ศาสตร์แห่งตัวประกอบเฉพาะอยู่ในกำมือเจ้าแล้ว!`,
        'celebrate'
      );

      getEl('action-bar').innerHTML = `
        <button class="btn btn-ghost" id="btn-new-problem2">🔄 ลองโจทย์ข้อใหม่</button>
        <button class="btn btn-primary" id="btn-pick-again3" style="margin-left:auto">← ศึกษาผลึกเลขอื่น</button>`;
      getEl('btn-new-problem2')?.addEventListener('click', startAPPLY);
      getEl('btn-pick-again3')?.addEventListener('click', () => { S.n = null; renderPICK(); });
    } else if (!isCountMatch) {
      soundEngine.playError();
      const hint = (val === hypoCount - 1 || val === hypoCount - 2)
        ? 'อย่าลืมนับ 1 และตัวมันเองด้วยนะ'
        : `ลองเขียนสูตร (e+1) ของ ${hypoN} ดูอีกครั้ง`;
      getEl('apply-feedback').replaceChildren(createFbBanner(`จำนวนตัวประกอบยังไม่ถูกต้อง — ${hint}`, 'err'));
      addLog(`ตรวจสอบตัวประกอบ: ${val} ❌`, 'hint');
    } else {
      soundEngine.playError();
      getEl('apply-feedback').replaceChildren(createFbBanner(
        `จำนวนกิ่งถูกต้อง (${val} ตัว) แต่ผลึก ${hypoN} อาจยังไม่ใช่คำตอบที่ตรงกับเงื่อนไขทั้งหมด — ลองตรวจคำใบ้อีกครั้ง`,
        'info'
      ));
    }
  }

  /* ================================================================
     HINT REQUEST SYSTEM
     ================================================================ */
  getEl('btn-request-hint')?.addEventListener('click', async () => {
    soundEngine.playClick();
    const btn = getEl('btn-request-hint');
    btn.disabled = true;
    btn.textContent = '⏳ กำลังคิด…';

    S.hintTier = Math.min((S.hintTier || 0) + 1, 3);

    const snapshot = {
      stage: S.stage,
      n: S.n,
      factorsRevealed: S.factors,
      expandedLevels: S.expanded,
      leavesSoFar: S.treeNodes
        .filter(nd => nd.level === S.factors.length && nd.level <= S.expanded)
        .map(nd => nd.value),
      learnerLevel: S.level,
      attempts: S.countAttempts,
      misconceptionId: S.misconId,
      hintTier: S.hintTier
    };

    const hint = await Companion.getHint(snapshot);
    getEl('hint-ribbon-text').textContent = hint;
    addLog(`💡 คำใบ้: ${hint.slice(0, 40)}…`, 'hint');
    Companion.speak(hint, 'thinking');

    btn.textContent = S.hintTier >= 3 ? '💡 คำใบ้ระดับสูงสุดแล้ว' : '💡 ขอคำใบ้จากมิกซี่';
    btn.disabled = S.hintTier >= 3;
  });

  /* ================================================================
     MODALS (DOCTOR VIDEO & SETTINGS)
     ================================================================ */
  function openVideoModal() {
    soundEngine.playClick();
    const modal = getEl('video-modal');
    const video = getEl('doctor-video');
    if (modal) {
      modal.classList.add('open');
      if (video) {
        video.currentTime = 0;
        video.play().catch(() => {});
      }
    }
  }

  function closeVideoModal() {
    const modal = getEl('video-modal');
    const video = getEl('doctor-video');
    if (modal) {
      modal.classList.remove('open');
      if (video) video.pause();
    }
  }

  getEl('btn-open-video-header')?.addEventListener('click', openVideoModal);
  getEl('btn-close-video')?.addEventListener('click', closeVideoModal);
  getEl('video-modal')?.addEventListener('click', e => {
    if (e.target === getEl('video-modal')) closeVideoModal();
  });

  // Settings Modal
  getEl('btn-settings')?.addEventListener('click', () => {
    soundEngine.playClick();
    getEl('api-key-input').value = S.apiKey;
    getEl('model-select').value = S.model;
    getEl('settings-modal').classList.add('open');
  });

  getEl('btn-modal-cancel')?.addEventListener('click', () => {
    getEl('settings-modal').classList.remove('open');
  });

  getEl('btn-modal-save')?.addEventListener('click', () => {
    soundEngine.playClick();
    S.apiKey = getEl('api-key-input').value.trim();
    S.model = getEl('model-select').value;
    sessionStorage.setItem('mw_gemini_key', S.apiKey);
    sessionStorage.setItem('mw_gemini_model', S.model);
    getEl('settings-modal').classList.remove('open');
    Companion.speak('บันทึกการตั้งค่า AI สำเร็จแล้วจ้า!', 'happy');
  });

  getEl('settings-modal')?.addEventListener('click', e => {
    if (e.target === getEl('settings-modal')) getEl('settings-modal').classList.remove('open');
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeVideoModal();
      getEl('settings-modal')?.classList.remove('open');
    }
  });

  /* ================================================================
     THEME, SOUND, SIDEBAR & MINIMIZE / MAXIMIZE TOGGLERS
     ================================================================ */
  // 1. Companion bar minimize / maximize
  getEl('btn-toggle-companion')?.addEventListener('click', () => {
    soundEngine.playClick();
    const bar = getEl('ai-companion-bar');
    bar?.classList.toggle('minimized');
    const label = getEl('companion-toggle-label');
    if (label) {
      label.textContent = bar?.classList.contains('minimized') ? '▴ ขยายบทสนทนา' : '▾ ย่อบทสนทนา';
    }
  });

  // 2. Tree focus mode (Maximize factor tree view)
  getEl('btn-focus-tree')?.addEventListener('click', () => {
    soundEngine.playClick();
    const btn = getEl('btn-focus-tree');
    const label = getEl('focus-tree-label');
    const compBar = getEl('ai-companion-bar');
    const countSection = getEl('count-stage-section');

    const isCurrentlyFocused = btn?.classList.contains('active');

    if (!isCurrentlyFocused) {
      btn?.classList.add('active');
      if (label) label.textContent = '⤡ คืนมุมมองเดิม';
      compBar?.classList.add('minimized');
      const compLabel = getEl('companion-toggle-label');
      if (compLabel) compLabel.textContent = '▴ ขยายบทสนทนา';

      if (countSection) {
        countSection.classList.add('collapsed');
        const drawerBtnText = getEl('btn-drawer-toggle-text');
        if (drawerBtnText) drawerBtnText.textContent = '▴ ขยายดูสูตร';
      }
    } else {
      btn?.classList.remove('active');
      if (label) label.textContent = '⛶ ขยายเต็มจอ';
      compBar?.classList.remove('minimized');
      const compLabel = getEl('companion-toggle-label');
      if (compLabel) compLabel.textContent = '▾ ย่อบทสนทนา';

      if (countSection) {
        countSection.classList.remove('collapsed');
        const drawerBtnText = getEl('btn-drawer-toggle-text');
        if (drawerBtnText) drawerBtnText.textContent = '▾ ย่อเก็บ';
      }
    }
  });

  // 3. Step log sidebar
  getEl('btn-toggle-log')?.addEventListener('click', () => {
    soundEngine.playClick();
    const panel = getEl('step-log-panel');
    panel?.classList.toggle('collapsed');
  });

  getEl('btn-close-log')?.addEventListener('click', () => {
    soundEngine.playClick();
    const panel = getEl('step-log-panel');
    panel?.classList.add('collapsed');
  });

  getEl('btn-theme-toggle')?.addEventListener('click', () => {
    S.theme = S.theme === 'magic' ? 'scifi' : 'magic';
    localStorage.setItem('mw_theme', S.theme);
    document.body.className = `theme-${S.theme}`;
    soundEngine.setTheme(S.theme);
    soundEngine.playClick();
    getEl('btn-theme-toggle').textContent = S.theme === 'magic' ? '🪄 โหมดเวทมนตร์' : '🔬 โหมดไซไฟ';
  });

  getEl('btn-sound-toggle')?.addEventListener('click', () => {
    const isEnabled = soundEngine.toggleSound();
    getEl('btn-sound-toggle').textContent = isEnabled ? '🔊 เสียง: เปิด' : '🔇 เสียง: ปิด';
    if (isEnabled) soundEngine.playClick();
  });

  /* ================================================================
     UNIT TESTS RUNNER
     ================================================================ */
  window.runTests = function() {
    let pass = 0, fail = 0;
    function assert(label, condition) {
      if (condition) {
        console.log(`✅ ${label}`);
        pass++;
      } else {
        console.error(`❌ ${label}`);
        fail++;
      }
    }

    console.log('🧪 Starting MW Mathematical Engine Unit Tests...');

    // 1. Factorization tests
    const f12 = Engine.factorize(12);
    assert('factorize(12) == [{p:2,e:2},{p:3,e:1}]', JSON.stringify(f12) === JSON.stringify([{ p: 2, e: 2 }, { p: 3, e: 1 }]));
    assert('factorize(1) == []', Engine.factorize(1).length === 0);
    assert('factorize(7) == [{p:7,e:1}]', JSON.stringify(Engine.factorize(7)) === JSON.stringify([{ p: 7, e: 1 }]));
    assert('factorize(360)', Engine.factorize(360).length === 3);

    // 2. Divisor list & count tests
    const d12 = Engine.allDivisors(f12);
    assert('allDivisors(12) == [1,2,3,4,6,12]', JSON.stringify(d12) === JSON.stringify([1, 2, 3, 4, 6, 12]));
    assert('divisorCount(12) == 6', Engine.divisorCount(f12) === 6);
    assert('divisorCount(7) == 2', Engine.divisorCount(Engine.factorize(7)) === 2);

    // 3. Tree leaves matching all divisors
    for (const testN of [12, 36, 105, 84, 360]) {
      const f = Engine.factorize(testN);
      const tree = Engine.buildTree(f);
      const leaves = tree.filter(n => n.level === f.length).map(n => n.value).sort((a, b) => a - b);
      const divs = Engine.allDivisors(f);
      assert(`buildTree(${testN}) leaves == allDivisors`, JSON.stringify(leaves) === JSON.stringify(divs));
    }

    // 4. Misconception detector
    assert('checkCountGuess correct', Engine.checkCountGuess(6, f12).ok);
    assert('checkCountGuess M_MULT_EXP', Engine.checkCountGuess(2, f12).misconId === 'M_MULT_EXP');
    assert('checkCountGuess M_MISS_ENDS', Engine.checkCountGuess(4, f12).misconId === 'M_MISS_ENDS');

    console.log(`\n🎉 ทดสอบเสร็จสิ้น: ผ่าน ${pass} ข้อ, ไม่ผ่าน ${fail} ข้อ`);
    return { pass, fail };
  };

  /* ================================================================
     INIT
     ================================================================ */
  document.body.className = `theme-${S.theme}`;
  getEl('btn-theme-toggle').textContent = S.theme === 'magic' ? '🪄 โหมดเวทมนตร์' : '🔬 โหมดไซไฟ';
  getEl('btn-sound-toggle').textContent = soundEngine.enabled ? '🔊 เสียง: เปิด' : '🔇 เสียง: ปิด';

  renderProgress();
  renderPICK();
})();
