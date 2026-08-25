/**
 * Levels Controller and Game Logic
 * Includes Level 0 (Tutorial & Mascot Story), Difficulty Selector,
 * Dynamic Random Quests, Smart Hints, and Friendly AI Duel Mode.
 */
class LevelManager {
  constructor(app) {
    this.app = app;
    this.currentLevel = 0;
    this.difficulty = 'easy'; // 'easy', 'medium', 'hard'

    // Level 0 State (Tutorial & Test Drive)
    this.l0Step = 1;
    this.l0PracticeNum = 6;
    this.l0PracticePrime = 2;

    // Level 1 State
    this.l1Pool = MathUtils.getLevel1Pool('easy');
    this.l1CurrentIndex = 0;
    this.l1Score = 0;
    this.l1Streak = 0;
    this.l1Target = 6;

    // Level 2 State
    this.l2OriginalNum = 12;
    this.l2CurrentNum = 12;
    this.l2PrimeFactorsFound = [];
    this.l2TreeHistory = [];

    // Level 3 State
    this.l3OriginalNum = 12;
    this.l3RawFactors = [2, 2, 3];
    this.l3Counts = {};
    this.l3CurrentState = {};

    // Level 4 State
    this.l4Pair = { a: 12, b: 18 };
    this.l4SubTab = 'venn'; // 'venn', 'rsa', or 'duel'

    // RSA State
    this.rsaP = 7;
    this.rsaQ = 11;

    // AI Friendly Duel State
    this.duelNum = 24;
    this.duelPlayerNum = 24;
    this.duelAiNum = 24;
    this.duelPlayerFactors = [];
    this.duelAiFactors = [];
    this.duelTimer = null;

    // Sandbox State
    this.sandboxNum = 60;
    this.sandboxCurrentNum = 60;
    this.sandboxFactors = [];
    this.sandboxTree = [];
    this.sandboxInterval = null;
  }

  // --- DIFFICULTY CONTROLLER ---
  setDifficulty(diff) {
    this.difficulty = diff;
    window.soundEngine.playClick();

    // Update pool for Level 1
    this.l1Pool = this.shuffle(MathUtils.getLevel1Pool(diff));
    this.l1CurrentIndex = 0;

    // Update target selectors in Level 2 & 3
    this.updateTargetDropdowns();

    // Re-init current level with new difficulty
    if (this.currentLevel === 1) {
      this.renderLevel1Question();
    } else if (this.currentLevel === 2) {
      this.initLevel2(MathUtils.getRandomComposite(diff));
    } else if (this.currentLevel === 3) {
      this.initLevel3(MathUtils.getRandomComposite(diff));
    } else if (this.currentLevel === 4) {
      this.l4Pair = MathUtils.getRandomPair(diff);
      this.renderLevel4();
    }

    this.app.aiSpeak(`ปรับระดับความยากเป็น: ${diff === 'easy' ? 'ง่าย (มือใหม่)' : diff === 'medium' ? 'ปานกลาง (จอมเวทย์)' : 'ท้าทาย (มหาจอมเวทย์)'} เรียบร้อยแล้ว!`, true);
  }

  updateTargetDropdowns() {
    const list = MathUtils.getNumbersByDifficulty(this.difficulty);
    const selL2 = document.getElementById('l2-target-select');
    const selL3 = document.getElementById('l3-target-select');

    if (selL2) {
      selL2.innerHTML = list.map(n => `<option value="${n}">${n}</option>`).join('');
      selL2.value = list[0];
    }
    if (selL3) {
      selL3.innerHTML = list.map(n => `<option value="${n}">${n}</option>`).join('');
      selL3.value = list[0];
    }
  }

  // --- RANDOM QUEST GENERATOR ---
  randomizeCurrentLevelQuest() {
    window.soundEngine.playSlice();
    const isMagic = this.app.theme === 'magic';

    if (this.currentLevel === 1) {
      this.l1CurrentIndex = Math.floor(Math.random() * this.l1Pool.length);
      this.renderLevel1Question();
      this.app.aiSpeak(isMagic ? 'สุ่มผลึกมนตราลูกใหม่เข้ามาแล้ว!' : 'สุ่มก้อนสสารตัวอย่างใหม่เข้ามาแล้ว!', true);
    } else if (this.currentLevel === 2) {
      const newNum = MathUtils.getRandomComposite(this.difficulty, this.l2OriginalNum);
      this.initLevel2(newNum);
      this.app.aiSpeak(isMagic ? `สุ่มโกเลมตัวใหม่พลัง ${newNum} มาประลอง!` : `สุ่มอนุภาคสสารใหม่ขนาด ${newNum} เข้าสู่เลเซอร์!`, true);
    } else if (this.currentLevel === 3) {
      const newNum = MathUtils.getRandomComposite(this.difficulty, this.l3OriginalNum);
      this.initLevel3(newNum);
    } else if (this.currentLevel === 4 && this.l4SubTab === 'venn') {
      this.l4Pair = MathUtils.getRandomPair(this.difficulty);
      this.renderLevel4Venn();
    } else if (this.currentLevel === 4 && this.l4SubTab === 'duel') {
      this.initAiDuel();
    }
  }

  // --- SMART HINT SYSTEM ---
  triggerSmartHint() {
    window.soundEngine.playPrimeGlow();
    const isMagic = this.app.theme === 'magic';
    let targetNum = null;

    if (this.currentLevel === 1) {
      targetNum = this.l1Pool[this.l1CurrentIndex % this.l1Pool.length];
      const isPrime = MathUtils.isPrime(targetNum);
      const hint = isPrime
        ? (isMagic ? `💡 ผลึก ${targetNum} ไม่มีเลขคู่หรือเลขอื่นหารลงตัวเลย นอกจาก 1 กับ ${targetNum} (เป็นจำนวนเฉพาะ!)` : `💡 อนุภาค ${targetNum} เป็นอะตอมเดี่ยวบริสุทธิ์ ไม่สามารถแยกย่อยได้!`)
        : (isMagic ? `💡 ผลึก ${targetNum} สามารถแตกตัวได้ เพราะหารด้วย ${MathUtils.getSmallestPrimeFactor(targetNum)} ลงตัว!` : `💡 สสาร ${targetNum} เป็นสารประกอบ เพราะหารด้วย ${MathUtils.getSmallestPrimeFactor(targetNum)} ลงตัว!`);
      this.app.aiSpeak(hint, true);
      return;
    }

    if (this.currentLevel === 2) targetNum = this.l2CurrentNum;
    if (this.currentLevel === 'sandbox') targetNum = this.sandboxCurrentNum;
    if (this.currentLevel === 4 && this.l4SubTab === 'duel') targetNum = this.duelPlayerNum;

    if (!targetNum || targetNum <= 1) {
      this.app.aiSpeak('ยอดเยี่ยมมาก! จำนวนนี้แยกตัวประกอบเสร็จสมบูรณ์แล้ว', true);
      return;
    }

    const smallestPrime = MathUtils.getSmallestPrimeFactor(targetNum);
    if (smallestPrime) {
      const hintText = MathUtils.getDivisibilityHint(targetNum, smallestPrime);
      this.app.aiSpeak(`💡 คำใบ้จากมิกซี่: ${hintText}`, true);

      // Highlight the matching weapon button
      document.querySelectorAll(`.prime-weapon-btn[data-prime="${smallestPrime}"], .sandbox-weapon-btn[data-prime="${smallestPrime}"]`).forEach(btn => {
        btn.classList.add('hint-pulse');
        setTimeout(() => btn.classList.remove('hint-pulse'), 3000);
      });
    }
  }

  // --- LEVEL 0: Tutorial & Mascot Story ---
  initLevel0() {
    this.l0Step = 1;
    this.l0PracticeNum = 6;
    this.renderLevel0();
  }

  renderLevel0() {
    const isMagic = this.app.theme === 'magic';
    const mascotImg = document.getElementById('l0-mascot-img');
    if (mascotImg) mascotImg.src = 'assets/mascot.jpg';

    const practiceEl = document.getElementById('l0-practice-area');
    if (practiceEl) {
      practiceEl.innerHTML = `
        <div class="tutorial-interactive-box">
          <h4 style="color: var(--accent-color); margin-bottom: 0.5rem;">
            ${isMagic ? '🪄 มาร่วมทดลองร่ายเวทย์เฉือนผลึกเลข 6 กับนัวและมิกซี่กันเถอะ!' : '🔬 ทดลองยิงเลเซอร์แยกสสารเลข 6 กับนัว-บอท!'}
          </h4>
          <p style="font-size: 0.95rem; margin-bottom: 0.8rem;">
            เลข <strong>6</strong> เป็นเลขคู่ เราจึงเลือกร่ายเวทย์ Rune <strong>[2]</strong> ยิงใส่ก่อน!
          </p>
          <div style="display: flex; gap: 0.6rem; justify-content: center; margin-bottom: 0.8rem;">
            <button class="prime-weapon-btn" onclick="window.levelManager.stepLevel0Practice(2)">🔥 ยิง Rune [2]</button>
            <button class="prime-weapon-btn" onclick="window.levelManager.stepLevel0Practice(3)">💧 ยิง Rune [3]</button>
          </div>
          <div id="l0-practice-feedback" style="font-weight: 600; color: var(--accent-color);"></div>
        </div>
      `;
    }

    this.app.aiSpeak(
      isMagic
        ? 'สวัสดีจ้า! เราคือ นัว พ่อมดน้อย และ มิกซี่ หนูเวทมนตร์คู่หู ยินดีต้อนรับสู่โลกแห่งจำนวนเฉพาะ!'
        : 'ยินดีต้อนรับสู่ Quantum Lab! ผมคือ Noir-Bot และ Mixy พร้อมพาทุกคนไปสำรวจอะตอมตัวเลขแล้ว!',
      false
    );
  }

  stepLevel0Practice(prime) {
    const feedbackEl = document.getElementById('l0-practice-feedback');
    const isMagic = this.app.theme === 'magic';

    if (prime === 2) {
      window.soundEngine.playSlice();
      feedbackEl.innerHTML = `
        <span style="color: #10b981;">
          ✨ ชิ้งงง! 6 &divide; 2 = 3 ได้อัญมณี [2] และเหลืออัญมณี [3] ซึ่งทั้งสองคือจำนวนเฉพาะ! (6 = 2 &times; 3)
        </span>
        <div style="margin-top: 0.8rem;">
          <button class="btn btn-primary" onclick="window.app.switchLevel(1)">
            ${isMagic ? '🎉 ยอดเยี่ยม! ไปลุย Level 1 กันเลย ➔' : '🚀 ระบบพร้อมแล้ว! เริ่ม Level 1 ➔'}
          </button>
        </div>
      `;
      window.soundEngine.playSuccess();
    } else {
      window.soundEngine.playSlice();
      feedbackEl.innerHTML = `
        <span style="color: #10b981;">
          ✨ ชิ้งงง! 6 &divide; 3 = 2 ได้เหมือนกันเป๊ะ! (6 = 2 &times; 3)
        </span>
        <div style="margin-top: 0.8rem;">
          <button class="btn btn-primary" onclick="window.app.switchLevel(1)">
            ${isMagic ? '🎉 เยี่ยมมาก! ไปลุย Level 1 กันเลย ➔' : '🚀 พร้อมแล้ว! เริ่ม Level 1 ➔'}
          </button>
        </div>
      `;
      window.soundEngine.playSuccess();
    }
  }

  // --- LEVEL 1: Prime vs Composite Scanner ---
  initLevel1() {
    this.l1Score = 0;
    this.l1Streak = 0;
    this.l1Pool = this.shuffle(MathUtils.getLevel1Pool(this.difficulty));
    this.l1CurrentIndex = 0;
    this.renderLevel1Question();
  }

  renderLevel1Question() {
    const num = this.l1Pool[this.l1CurrentIndex % this.l1Pool.length];
    const container = document.getElementById('l1-target-item');
    if (!container) return;

    const isMagic = this.app.theme === 'magic';
    const label = isMagic ? 'ผลึกมนตรา' : 'ก้อนสสาร';

    container.className = 'element-card active floating';
    container.innerHTML = `
      <div class="element-inner">
        <span class="element-tag">${label}</span>
        <span class="element-value">${num}</span>
      </div>
    `;

    const scoreEl = document.getElementById('l1-score');
    if (scoreEl) scoreEl.innerText = this.l1Score;
    const streakEl = document.getElementById('l1-streak');
    if (streakEl) streakEl.innerText = this.l1Streak;
    const progEl = document.getElementById('l1-progress-bar');
    if (progEl) progEl.style.width = `${Math.min(100, (this.l1Score / this.l1Target) * 100)}%`;

    const feedbackEl = document.getElementById('l1-feedback');
    if (feedbackEl) {
      feedbackEl.innerHTML = `
        <div class="hint-text">
          ${isMagic ? '🔮 จงเลือกว่าผลึกนี้คือ "ธาตุบริสุทธิ์ (จำนวนเฉพาะ)" หรือ "แร่ผสม (จำนวนประกอบ)"' : '🔬 ตรวจสอบว่าอนุภาคนี้คือ "อะตอมเดี่ยว (Prime)" หรือ "สสารประกอบ (Composite)"'}
        </div>
      `;
    }

    this.app.aiSpeak(
      isMagic
        ? `หมายเลข ${num} ลอยเข้ามาแล้ว! ลองดูซิว่ามีเลขอื่นที่หารมันลงตัวไหม?`
        : `ตรวจพบก้อนสสารหมายเลข ${num}! วินิจฉัยว่าเป็นอะตอมเดี่ยวหรือสสารประกอบ`,
      false
    );
  }

  handleLevel1Choice(choiceIsPrime) {
    const num = this.l1Pool[this.l1CurrentIndex % this.l1Pool.length];
    const actualIsPrime = MathUtils.isPrime(num);
    const isCorrect = choiceIsPrime === actualIsPrime;
    const isMagic = this.app.theme === 'magic';
    const targetEl = document.getElementById('l1-target-item');
    const feedbackEl = document.getElementById('l1-feedback');

    if (isCorrect) {
      this.l1Score++;
      this.l1Streak++;
      window.soundEngine.playSuccess();

      if (actualIsPrime) {
        window.soundEngine.playPrimeGlow();
        if (targetEl) targetEl.classList.add('glow-success');
        if (feedbackEl) {
          feedbackEl.innerHTML = `
            <div class="alert alert-success">
              <strong>${isMagic ? '✨ ถูกต้อง! ธาตุบริสุทธิ์ (Prime)' : '⚛️ ถูกต้อง! อะตอมเดี่ยว (Prime)'}</strong>
              <p>${num} มีเพียง 1 และ ${num} เท่านั้นที่หารลงตัว ไม่สามารถแตกตัวได้อีกแล้ว!</p>
            </div>
          `;
        }
        this.app.aiSpeak(`ถูกต้อง! ${num} คือจำนวนเฉพาะ ไม่สามารถแยกย่อยได้อีกแล้ว`, true);
      } else {
        window.soundEngine.playBreak();
        if (targetEl) targetEl.classList.add('shatter-anim');
        const factors = MathUtils.getPrimeFactors(num);
        if (feedbackEl) {
          feedbackEl.innerHTML = `
            <div class="alert alert-success">
              <strong>${isMagic ? '💥 ถูกต้อง! แร่ผสม (Composite)' : '⚡ ถูกต้อง! สสารประกอบ (Composite)'}</strong>
              <p>${num} แตกตัวออกเป็น: <strong>${factors.join(' &times; ')}</strong></p>
            </div>
          `;
        }
        this.app.aiSpeak(`ยอดเยี่ยม! ${num} เป็นจำนวนประกอบ เพราะแตกตัวได้เป็น ${factors.join(' คูณ ')}`, true);
      }

      if (this.l1Score >= this.l1Target) {
        setTimeout(() => {
          this.showLevelCompletion(1);
        }, 1200);
        return;
      }
    } else {
      this.l1Streak = 0;
      window.soundEngine.playError();
      if (targetEl) targetEl.classList.add('shake-anim');

      if (actualIsPrime) {
        if (feedbackEl) {
          feedbackEl.innerHTML = `
            <div class="alert alert-danger">
              <strong>${isMagic ? '❌ ไม่ถูกต้อง! นี่คือธาตุบริสุทธิ์' : '❌ ผิดพลาด! นี่คืออะตอมเดี่ยว'}</strong>
              <p>${num} เป็นจำนวนเฉพาะ (Prime) เพราะไม่มีเลขใดหารลงตัวนอกจาก 1 และ ${num}</p>
            </div>
          `;
        }
        this.app.aiSpeak(`อ๊ะ! ${num} เป็นจำนวนเฉพาะนะ เพราะไม่มีเลขอื่นหารมันลงตัวเลย`, true);
      } else {
        const smallest = MathUtils.getSmallestPrimeFactor(num);
        if (feedbackEl) {
          feedbackEl.innerHTML = `
            <div class="alert alert-danger">
              <strong>${isMagic ? '❌ ไม่ถูกต้อง! นี่คือแร่ผสม' : '❌ ผิดพลาด! นี่คือสสารประกอบ'}</strong>
              <p>${num} หารด้วย ${smallest} ลงตัว (${num} &divide; ${smallest} = ${num / smallest}) จึงไม่ใช่จำนวนเฉพาะ</p>
            </div>
          `;
        }
        this.app.aiSpeak(`${num} เป็นจำนวนประกอบนะ ลองดูสิว่ามันหารด้วย ${smallest} ลงตัว`, true);
      }
    }

    setTimeout(() => {
      this.l1CurrentIndex++;
      this.renderLevel1Question();
    }, 1800);
  }

  // --- LEVEL 2: Slicing & Interactive Factor Tree ---
  initLevel2(targetNum = null) {
    this.l2OriginalNum = targetNum || MathUtils.getNumbersByDifficulty(this.difficulty)[0] || 12;
    this.l2CurrentNum = this.l2OriginalNum;
    this.l2PrimeFactorsFound = [];
    this.l2TreeHistory = [
      { id: 1, parentId: null, value: this.l2OriginalNum, isPrime: MathUtils.isPrime(this.l2OriginalNum), active: true }
    ];

    this.renderLevel2();
  }

  renderLevel2() {
    const isMagic = this.app.theme === 'magic';
    const targetSelect = document.getElementById('l2-target-select');
    if (targetSelect) targetSelect.value = this.l2OriginalNum;

    // Render Factor inventory / collected
    const collectedEl = document.getElementById('l2-collected-factors');
    if (collectedEl) {
      if (this.l2PrimeFactorsFound.length === 0) {
        collectedEl.innerHTML = `<span class="placeholder-text">${isMagic ? 'ยังไม่มีอัญมณีธาตุที่สลายได้' : 'ยังไม่มีอะตอมที่เก็บได้'}</span>`;
      } else {
        collectedEl.innerHTML = this.l2PrimeFactorsFound
          .map(f => `<span class="factor-badge prime-rune">${f}</span>`)
          .join(' &times; ');
      }
    }

    // Render Factor Tree SVG
    this.renderFactorTreeSvg('l2-tree-svg', this.l2TreeHistory);

    // Update feedback / AI status
    const feedbackEl = document.getElementById('l2-feedback');
    if (feedbackEl) {
      if (this.l2CurrentNum === 1 || MathUtils.isPrime(this.l2CurrentNum)) {
        if (this.l2CurrentNum > 1 && MathUtils.isPrime(this.l2CurrentNum)) {
          feedbackEl.innerHTML = `
            <div class="alert alert-info">
              ${isMagic ? `🌟 พลังเหลือ ${this.l2CurrentNum} ซึ่งเป็นอัญมณีธาตุบริสุทธิ์แล้ว! ยิง Rune [${this.l2CurrentNum}] เพื่อปิดฉาก!` : `⚛️ อนุภาคเหลือ ${this.l2CurrentNum} ซึ่งเป็นอะตอมเดี่ยวบริสุทธิ์แล้ว! ยิงเลเซอร์ [${this.l2CurrentNum}] เพื่อสังเคราะห์สมบูรณ์!`}
            </div>
          `;
        }
      } else {
        feedbackEl.innerHTML = `
          <div class="hint-text">
            ${isMagic ? `เลือก Rune ด้านล่างเพื่อร่ายเวทย์เฉือนผลึก <strong>${this.l2CurrentNum}</strong> (หรือกด 💡 ขอคำใบ้ได้นะ!)` : `เลือกความถี่เลเซอร์ด้านล่างเพื่อยิงผ่าสสาร <strong>${this.l2CurrentNum}</strong>`}
          </div>
        `;
      }
    }
  }

  handleLevel2Slice(prime) {
    if (this.l2CurrentNum <= 1) return;
    const isMagic = this.app.theme === 'magic';
    const feedbackEl = document.getElementById('l2-feedback');

    // Check if prime divides current number
    if (this.l2CurrentNum % prime === 0) {
      window.soundEngine.playSlice();
      const nextNum = this.l2CurrentNum / prime;
      this.l2PrimeFactorsFound.push(prime);

      const activeNode = this.l2TreeHistory.find(n => n.active);
      if (activeNode) {
        activeNode.active = false;
        const primeChildId = this.l2TreeHistory.length + 1;
        const compChildId = this.l2TreeHistory.length + 2;

        const isNextPrime = MathUtils.isPrime(nextNum);

        this.l2TreeHistory.push({
          id: primeChildId,
          parentId: activeNode.id,
          value: prime,
          isPrime: true,
          isCollected: true,
          active: false,
          side: 'left'
        });

        if (nextNum > 1) {
          this.l2TreeHistory.push({
            id: compChildId,
            parentId: activeNode.id,
            value: nextNum,
            isPrime: isNextPrime,
            isCollected: isNextPrime,
            active: !isNextPrime,
            side: 'right'
          });

          if (isNextPrime) {
            this.l2PrimeFactorsFound.push(nextNum);
          }
        }
      }

      this.l2CurrentNum = MathUtils.isPrime(nextNum) ? 1 : nextNum;
      this.renderLevel2();

      this.app.aiSpeak(
        isMagic
          ? `เฉือนสำเร็จ! ได้อัญมณี [${prime}] ออกมา ${this.l2CurrentNum === 1 ? 'สลายผลึกเสร็จสิ้น!' : `เหลือพลัง ${nextNum}`}`
          : `เลเซอร์ [${prime}] ผ่าสสารสำเร็จ! ${this.l2CurrentNum === 1 ? 'แยกอะตอมสมบูรณ์!' : `สสารเหลือพลังงาน ${nextNum}`}`,
        true
      );

      // Check if finished
      if (this.l2CurrentNum === 1) {
        window.soundEngine.playSuccess();
        if (feedbackEl) {
          feedbackEl.innerHTML = `
            <div class="alert alert-success">
              <strong>🎉 ${isMagic ? 'สลายผลึกสมบูรณ์!' : 'แยกอะตอมครบถ้วน!'}</strong>
              <p>${this.l2OriginalNum} = ${this.l2PrimeFactorsFound.join(' &times; ')}</p>
            </div>
          `;
        }
        setTimeout(() => {
          this.showLevelCompletion(2);
        }, 1500);
      }
    } else {
      window.soundEngine.playError();
      const hint = MathUtils.getDivisibilityHint(this.l2CurrentNum, prime);
      if (feedbackEl) {
        feedbackEl.innerHTML = `
          <div class="alert alert-danger">
            <strong>${isMagic ? '🛡️ บาเรียเวทมนตร์ต้านทาน!' : '⚠️ การยิงเลเซอร์ล้มเหลว!'}</strong>
            <p>${hint}</p>
          </div>
        `;
      }
      this.app.aiSpeak(hint, true);
    }
  }

  // --- Render Factor Tree on SVG (Iterative BFS) ---
  renderFactorTreeSvg(svgId, treeData) {
    const svg = document.getElementById(svgId);
    if (!svg) return;

    svg.innerHTML = '';
    if (!treeData || treeData.length === 0) return;

    const width = svg.clientWidth || 500;
    const levelHeight = 60;
    const positions = {};

    const root = treeData.find(n => !n.parentId);
    if (!root) return;

    const queue = [{ id: root.id, x: width / 2, y: 40, spread: width * 0.24 }];
    const visited = new Set();
    let maxY = 120;

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current || visited.has(current.id)) continue;
      visited.add(current.id);

      positions[current.id] = { x: current.x, y: current.y };
      if (current.y > maxY) maxY = current.y;

      const children = treeData.filter(n => n.parentId === current.id && n.id !== current.id);
      if (children.length >= 2) {
        const leftChild = children.find(c => c.side === 'left') || children[0];
        const rightChild = children.find(c => c.side === 'right') || children[1];
        queue.push({
          id: leftChild.id,
          x: current.x - current.spread,
          y: current.y + levelHeight,
          spread: Math.max(26, current.spread * 0.55)
        });
        queue.push({
          id: rightChild.id,
          x: current.x + current.spread,
          y: current.y + levelHeight,
          spread: Math.max(26, current.spread * 0.55)
        });
      } else if (children.length === 1) {
        queue.push({
          id: children[0].id,
          x: current.x,
          y: current.y + levelHeight,
          spread: Math.max(26, current.spread * 0.55)
        });
      }
    }

    const totalHeight = Math.max(320, maxY + 50);
    svg.setAttribute('viewBox', `0 0 ${width} ${totalHeight}`);

    // Draw branch lines
    treeData.forEach(node => {
      if (node.parentId !== null && positions[node.parentId] && positions[node.id]) {
        const p1 = positions[node.parentId];
        const p2 = positions[node.id];
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', p1.x);
        line.setAttribute('y1', p1.y);
        line.setAttribute('x2', p2.x);
        line.setAttribute('y2', p2.y);
        line.setAttribute('stroke', 'var(--accent-glow)');
        line.setAttribute('stroke-width', '3');
        line.setAttribute('stroke-linecap', 'round');
        line.setAttribute('stroke-dasharray', node.active ? '4,4' : 'none');
        svg.appendChild(line);
      }
    });

    // Draw Nodes
    treeData.forEach(node => {
      if (!positions[node.id]) return;
      const { x, y } = positions[node.id];
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('transform', `translate(${x}, ${y})`);
      g.classList.add('tree-node');

      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('r', '20');

      if (node.isPrime && node.isCollected) {
        circle.setAttribute('fill', 'var(--badge-prime-bg)');
        circle.setAttribute('stroke', 'var(--badge-prime-border)');
        circle.setAttribute('stroke-width', '3');
      } else if (node.active) {
        circle.setAttribute('fill', 'var(--active-node-bg)');
        circle.setAttribute('stroke', 'var(--accent-glow)');
        circle.setAttribute('stroke-width', '3');
      } else {
        circle.setAttribute('fill', 'var(--bg-card)');
        circle.setAttribute('stroke', 'var(--border-color)');
        circle.setAttribute('stroke-width', '2');
      }

      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('dy', '6');
      text.setAttribute('fill', 'var(--text-color)');
      text.setAttribute('font-weight', 'bold');
      text.setAttribute('font-size', '14px');
      text.textContent = node.value;

      g.appendChild(circle);
      g.appendChild(text);
      svg.appendChild(g);
    });
  }

  // --- LEVEL 3: Exponent Condenser ---
  initLevel3(num = null) {
    this.l3OriginalNum = num || MathUtils.getNumbersByDifficulty(this.difficulty)[0] || 12;
    this.l3RawFactors = MathUtils.getPrimeFactors(this.l3OriginalNum);

    const counts = {};
    this.l3RawFactors.forEach(f => {
      counts[f] = (counts[f] || 0) + 1;
    });

    this.l3Counts = counts;
    this.l3CurrentState = {};
    Object.keys(counts).forEach(k => {
      this.l3CurrentState[k] = 1;
    });

    this.renderLevel3();
  }

  renderLevel3() {
    const isMagic = this.app.theme === 'magic';
    const selectEl = document.getElementById('l3-target-select');
    if (selectEl) selectEl.value = this.l3OriginalNum;

    // Render raw factors display
    const rawEqEl = document.getElementById('l3-raw-equation');
    if (rawEqEl) {
      rawEqEl.innerHTML = `${this.l3OriginalNum} = ${this.l3RawFactors.join(' &times; ')}`;
    }

    // Render Fusion Slots for each unique prime
    const slotsContainer = document.getElementById('l3-fusion-slots');
    if (slotsContainer) {
      slotsContainer.innerHTML = '';

      const uniquePrimes = Object.keys(this.l3Counts).map(k => parseInt(k, 10)).sort((a, b) => a - b);

      uniquePrimes.forEach(prime => {
        const totalAvailable = this.l3Counts[prime];
        const currentPower = this.l3CurrentState[prime];
        const isFullyFused = currentPower >= totalAvailable;

        const slot = document.createElement('div');
        slot.className = `fusion-slot ${isFullyFused ? 'fully-fused' : ''}`;
        slot.innerHTML = `
          <div class="slot-header">
            <span class="prime-tag">${isMagic ? 'รูนธาตุ' : 'อะตอม'} [${prime}]</span>
            <span class="count-badge">${currentPower} / ${totalAvailable}</span>
          </div>
          <div class="slot-display">
            <div class="power-orb ${isFullyFused ? 'orb-glowing' : ''}">
              <span class="base">${prime}</span>
              <sup class="exponent">${currentPower}</sup>
            </div>
          </div>
          <button class="btn btn-sm ${isFullyFused ? 'btn-success' : 'btn-primary'}" 
                  onclick="window.levelManager.fusePrimeExponent(${prime})"
                  ${isFullyFused ? 'disabled' : ''}>
            ${isFullyFused ? (isMagic ? '✨ ควบแน่นสมบูรณ์' : '⚛️ รวมสูตรสมบูรณ์') : (isMagic ? '⚡ รวมพลัง (+1)' : '🔗 รวมพันธะ (+1)')}
          </button>
        `;
        slotsContainer.appendChild(slot);
      });
    }

    // Render resulting formula
    const uniquePrimes = Object.keys(this.l3Counts).map(k => parseInt(k, 10)).sort((a, b) => a - b);
    const expList = uniquePrimes.map(p => ({ base: p, exp: this.l3CurrentState[p] }));
    const formulaHtml = MathUtils.formatExponentialHtml(expList);
    const formEl = document.getElementById('l3-exponent-formula');
    if (formEl) {
      formEl.innerHTML = `${this.l3OriginalNum} = ${formulaHtml}`;
    }

    // Check completion
    const allDone = uniquePrimes.every(p => this.l3CurrentState[p] === this.l3Counts[p]);
    const feedbackEl = document.getElementById('l3-feedback');

    if (feedbackEl) {
      if (allDone) {
        window.soundEngine.playSuccess();
        feedbackEl.innerHTML = `
          <div class="alert alert-success">
            <strong>🏆 ${isMagic ? 'คัมภีร์เวทย์เลขยกกำลังสมบูรณ์!' : 'สังเคราะห์สูตรโมเลกุลสำเร็จ!'}</strong>
            <p>เขียนในรูปเลขยกกำลัง: <strong>${this.l3OriginalNum} = ${formulaHtml}</strong></p>
            <div class="theorem-box">
              <em>"Fundamental Theorem of Arithmetic"</em>: ทุกจำนวนเต็มสามารถแยกตัวประกอบเฉพาะได้แบบเดียวเท่านั้นในจักรวาลนี้!
            </div>
          </div>
        `;
        this.app.aiSpeak(
          `ยอดเยี่ยมมาก! รวมพลังเลขยกกำลังได้สมบูรณ์ คือ ${this.l3OriginalNum} เท่ากับ ${uniquePrimes.map(p => `${p} ยกกำลัง ${this.l3Counts[p]}`).join(' คูณ ')}`,
          true
        );
        setTimeout(() => {
          this.showLevelCompletion(3);
        }, 1800);
      } else {
        feedbackEl.innerHTML = `
          <div class="hint-text">
            ${isMagic ? 'กดปุ่มเพื่อรวมอัญมณีที่ซ้ำกัน ให้กลายเป็นเลขยกกำลังที่กะทัดรัดและทรงพลัง!' : 'กดปุ่มเพื่อรวมอะตอมชนิดเดียวกันเข้าสู่รูปเลขยกกำลัง เพื่อบันทึกสูตรโมเลกุล'}
          </div>
        `;
      }
    }
  }

  fusePrimeExponent(prime) {
    if (this.l3CurrentState[prime] < this.l3Counts[prime]) {
      this.l3CurrentState[prime]++;
      window.soundEngine.playFuse();
      this.renderLevel3();
    }
  }

  // --- LEVEL 4: Real-World Applications (Venn, RSA & AI Duel) ---
  initLevel4() {
    this.l4Pair = MathUtils.getRandomPair(this.difficulty);
    this.renderLevel4();
  }

  renderLevel4() {
    if (this.l4SubTab === 'venn') {
      this.renderLevel4Venn();
    } else if (this.l4SubTab === 'rsa') {
      this.renderLevel4Rsa();
    } else if (this.l4SubTab === 'duel') {
      this.initAiDuel();
    }
  }

  switchLevel4Tab(tab) {
    this.l4SubTab = tab;
    const tabVenn = document.getElementById('l4-tab-venn');
    const tabRsa = document.getElementById('l4-tab-rsa');
    const tabDuel = document.getElementById('l4-tab-duel');
    const secVenn = document.getElementById('l4-venn-section');
    const secRsa = document.getElementById('l4-rsa-section');
    const secDuel = document.getElementById('l4-duel-section');

    if (tabVenn) tabVenn.classList.toggle('active', tab === 'venn');
    if (tabRsa) tabRsa.classList.toggle('active', tab === 'rsa');
    if (tabDuel) tabDuel.classList.toggle('active', tab === 'duel');

    if (secVenn) secVenn.style.display = tab === 'venn' ? 'block' : 'none';
    if (secRsa) secRsa.style.display = tab === 'rsa' ? 'block' : 'none';
    if (secDuel) secDuel.style.display = tab === 'duel' ? 'block' : 'none';

    this.renderLevel4();
  }

  renderLevel4Venn() {
    const pair = this.l4Pair;
    const data = MathUtils.calculateGcdLcm(pair.a, pair.b);
    const isMagic = this.app.theme === 'magic';

    const numAEl = document.getElementById('l4-num-a');
    if (numAEl) numAEl.innerText = data.numA;
    const numBEl = document.getElementById('l4-num-b');
    if (numBEl) numBEl.innerText = data.numB;

    const facAEl = document.getElementById('l4-factors-a');
    if (facAEl) facAEl.innerHTML = data.factorsA.map(f => `<span class="factor-badge">${f}</span>`).join(' &times; ');
    const facBEl = document.getElementById('l4-factors-b');
    if (facBEl) facBEl.innerHTML = data.factorsB.map(f => `<span class="factor-badge">${f}</span>`).join(' &times; ');

    const leftEl = document.getElementById('venn-only-a');
    const midEl = document.getElementById('venn-common');
    const rightEl = document.getElementById('venn-only-b');

    if (leftEl) leftEl.innerHTML = data.onlyA.length ? data.onlyA.map(f => `<div class="venn-rune rune-a">${f}</div>`).join('') : '<span class="empty-tag">-</span>';
    if (midEl) midEl.innerHTML = data.common.length ? data.common.map(f => `<div class="venn-rune rune-common">${f}</div>`).join('') : '<span class="empty-tag">1</span>';
    if (rightEl) rightEl.innerHTML = data.onlyB.length ? data.onlyB.map(f => `<div class="venn-rune rune-b">${f}</div>`).join('') : '<span class="empty-tag">-</span>';

    const gcdFormula = data.common.length ? data.common.join(' &times; ') : '1';
    const allFactors = [...data.onlyA, ...data.common, ...data.onlyB];
    const lcmFormula = allFactors.join(' &times; ');

    const gcdResEl = document.getElementById('l4-gcd-result');
    if (gcdResEl) {
      gcdResEl.innerHTML = `
        <strong>${isMagic ? 'ห.ร.ม. (พลังร่วมสูงสุด)' : 'ห.ร.ม. (GCD - ส่วนร่วม)'}:</strong> 
        <span>${gcdFormula} = <span class="highlight-val">${data.gcd}</span></span>
      `;
    }

    const lcmResEl = document.getElementById('l4-lcm-result');
    if (lcmResEl) {
      lcmResEl.innerHTML = `
        <strong>${isMagic ? 'ค.ร.น. (พลังรวมสร้างสรรค์)' : 'ค.ร.น. (LCM - ส่วนรวมทั้งหมด)'}:</strong> 
        <span>${lcmFormula} = <span class="highlight-val">${data.lcm}</span></span>
      `;
    }

    this.app.aiSpeak(
      isMagic
        ? `เปรียบเทียบผลึก ${data.numA} และ ${data.numB}! ตัวประกอบตรงกลางคือ ห.ร.ม. เท่ากับ ${data.gcd} และรวมทั้งหมดคือ ค.ร.น. เท่ากับ ${data.lcm}`
        : `วิเคราะห์สาร ${data.numA} และ ${data.numB}! อะตอมส่วนร่วมคือ ห.ร.ม. = ${data.gcd} ส่วนอะตอมทั้งหมดคือ ค.ร.น. = ${data.lcm}`,
      false
    );
  }

  nextVennPair() {
    this.l4Pair = MathUtils.getRandomPair(this.difficulty);
    window.soundEngine.playClick();
    this.renderLevel4Venn();
  }

  renderLevel4Rsa() {
    const isMagic = this.app.theme === 'magic';
    const p = this.rsaP;
    const q = this.rsaQ;
    const n = p * q;

    const selP = document.getElementById('rsa-prime-p');
    if (selP) selP.value = p;
    const selQ = document.getElementById('rsa-prime-q');
    if (selQ) selQ.value = q;

    const calcStep = document.getElementById('rsa-calc-step');
    if (calcStep) {
      calcStep.innerHTML = `${p} &times; ${q} = <span class="highlight-val">${n}</span>`;
    }

    const explanationEl = document.getElementById('rsa-explanation');
    if (explanationEl) {
      explanationEl.innerHTML = `
        <div class="alert alert-info">
          <h4>${isMagic ? '🔐 ความลับแห่งเกราะป้องกันมหาเวทย์ (RSA Cryptography)' : '🔐 กลไกความปลอดภัยไซเบอร์ระดับโลก (RSA Cryptography)'}</h4>
          <p>
            1. <strong>การคูณ (สร้างแม่กุญแจ):</strong> นำจำนวนเฉพาะ <i>p = ${p}</i> และ <i>q = ${q}</i> มาคูณกันได้แม่กุญแจ <i>N = ${n}</i> ซึ่งทำได้รวดเร็วในเสี้ยววินาที<br/>
            2. <strong>การแยกตัวประกอบกลับคืน (ผู้บุกรุกถอดรหัส):</strong> หากรู้เพียงเลข <i>N = ${n}</i> (ในชีวิตจริงคือเลขยาวหลายร้อยหลัก) ซูเปอร์คอมพิวเตอร์ต้องใช้เวลาหลายพันปีในการแยกกลับคืนเป็น <i>p</i> และ <i>q</i>!
          </p>
          <p class="mb-0"><strong>นี่คือเหตุผลที่การแยกตัวประกอบเฉพาะ (Prime Factorization) คือรากฐานของความปลอดภัยในอินเทอร์เน็ตและธุรกรรมธนาคารทั่วโลก!</strong></p>
        </div>
      `;
    }
  }

  updateRsaPrimes() {
    const p = parseInt(document.getElementById('rsa-prime-p').value, 10);
    const q = parseInt(document.getElementById('rsa-prime-q').value, 10);

    if (MathUtils.isPrime(p) && MathUtils.isPrime(q)) {
      this.rsaP = p;
      this.rsaQ = q;
      window.soundEngine.playSlice();
      this.renderLevel4Rsa();
    } else {
      window.soundEngine.playError();
      alert('กรุณาเลือกเฉพาะจำนวนเฉพาะ (Prime Numbers) เช่น 2, 3, 5, 7, 11, 13, 17, 19, 23, 29');
    }
  }

  // --- FRIENDLY AI DUEL MODE ---
  initAiDuel() {
    if (this.duelTimer) {
      clearTimeout(this.duelTimer);
      this.duelTimer = null;
    }
    this.duelNum = MathUtils.getRandomComposite(this.difficulty);
    this.duelPlayerNum = this.duelNum;
    this.duelAiNum = this.duelNum;
    this.duelPlayerFactors = [];
    this.duelAiFactors = [];

    this.renderDuelArena();
    this.scheduleAiTurn();

    const isMagic = this.app.theme === 'magic';
    this.app.aiSpeak(
      isMagic
        ? `⚔️ เริ่มการดวลเวทย์สลายผลึก ${this.duelNum}! มาดูกันซิว่าเจ้าหรือมิกซี่จะสลายหมดก่อนกัน!`
        : `⚔️ เริ่มการแข่งขันแยกอนุภาค ${this.duelNum}! ชิงความเร็วกับ Mixy-AI เลย!`,
      true
    );
  }

  renderDuelArena() {
    const isMagic = this.app.theme === 'magic';
    const playerTargetEl = document.getElementById('duel-player-target');
    const aiTargetEl = document.getElementById('duel-ai-target');
    const playerHp = document.getElementById('duel-player-hp');
    const aiHp = document.getElementById('duel-ai-hp');

    if (playerTargetEl) playerTargetEl.innerText = this.duelPlayerNum;
    if (aiTargetEl) aiTargetEl.innerText = this.duelAiNum;

    // Progress fills
    const totalFactors = MathUtils.getPrimeFactors(this.duelNum).length;
    const playerDone = this.duelPlayerFactors.length;
    const aiDone = this.duelAiFactors.length;

    if (playerHp) playerHp.style.width = `${Math.min(100, (playerDone / totalFactors) * 100)}%`;
    if (aiHp) aiHp.style.width = `${Math.min(100, (aiDone / totalFactors) * 100)}%`;

    const playerFacs = document.getElementById('duel-player-factors');
    if (playerFacs) {
      playerFacs.innerHTML = this.duelPlayerFactors.length ? this.duelPlayerFactors.map(f => `<span class="factor-badge prime-rune">${f}</span>`).join(' &times; ') : '<span class="placeholder-text">ยังไม่เริ่มยิง</span>';
    }

    const aiFacs = document.getElementById('duel-ai-factors');
    if (aiFacs) {
      aiFacs.innerHTML = this.duelAiFactors.length ? this.duelAiFactors.map(f => `<span class="factor-badge prime-rune">${f}</span>`).join(' &times; ') : '<span class="placeholder-text">กำลังร่ายเวทย์...</span>';
    }
  }

  handleDuelPlayerSlice(prime) {
    if (this.duelPlayerNum <= 1) return;

    if (this.duelPlayerNum % prime === 0) {
      window.soundEngine.playSlice();
      const nextNum = this.duelPlayerNum / prime;
      this.duelPlayerFactors.push(prime);
      if (MathUtils.isPrime(nextNum)) {
        this.duelPlayerFactors.push(nextNum);
        this.duelPlayerNum = 1;
      } else {
        this.duelPlayerNum = nextNum;
      }

      this.renderDuelArena();

      if (this.duelPlayerNum === 1) {
        window.soundEngine.playSuccess();
        clearTimeout(this.duelTimer);
        this.app.aiSpeak('🎉 ไชโย! เจ้าชนะการดวลเวทย์รอบนี้แล้ว! ยอดเยี่ยมมาก!', true);
        alert('🎉 ชนะแล้ว! คุณสลายผลึกได้เร็วกว่า AI!');
      }
    } else {
      window.soundEngine.playError();
      const hint = MathUtils.getDivisibilityHint(this.duelPlayerNum, prime);
      this.app.aiSpeak(hint, true);
    }
  }

  scheduleAiTurn() {
    if (this.duelAiNum <= 1 || this.duelPlayerNum <= 1) return;

    // AI delay is friendly: 3.2 to 4.5 seconds
    const delay = 3200 + Math.random() * 1500;
    this.duelTimer = setTimeout(() => {
      if (this.duelAiNum <= 1 || this.duelPlayerNum <= 1) return;

      const smallest = MathUtils.getSmallestPrimeFactor(this.duelAiNum);
      if (smallest) {
        // 25% chance AI pauses to cheer the player (ออมมือให้เด็ก)
        if (Math.random() < 0.25) {
          this.app.aiSpeak('มิกซี่กำลังคิดอยู่... เจ้าหนูสู้ๆ นะ!', false);
        } else {
          window.soundEngine.playSlice();
          const next = this.duelAiNum / smallest;
          this.duelAiFactors.push(smallest);
          if (MathUtils.isPrime(next)) {
            this.duelAiFactors.push(next);
            this.duelAiNum = 1;
          } else {
            this.duelAiNum = next;
          }
          this.renderDuelArena();
        }
      }

      if (this.duelAiNum > 1 && this.duelPlayerNum > 1) {
        this.scheduleAiTurn();
      } else if (this.duelAiNum === 1 && this.duelPlayerNum > 1) {
        this.app.aiSpeak('มิกซี่สลายผลึกเสร็จแล้ว! แต่เจ้าก็ทำได้ดีมากๆ เลย ลองอีกรอบไหม?', true);
      }
    }, delay);
  }

  // --- SANDBOX MODE ---
  initSandbox(num = 60) {
    if (this.sandboxInterval) {
      clearInterval(this.sandboxInterval);
      this.sandboxInterval = null;
    }
    this.sandboxNum = num;
    this.sandboxCurrentNum = num;
    this.sandboxFactors = [];
    this.sandboxTree = [
      { id: 1, parentId: null, value: num, isPrime: MathUtils.isPrime(num), active: true }
    ];
    this.renderSandbox();
  }

  renderSandbox() {
    const inputEl = document.getElementById('sandbox-input-num');
    if (inputEl) inputEl.value = this.sandboxNum;

    const collectedEl = document.getElementById('sandbox-collected');
    if (collectedEl) {
      if (this.sandboxFactors.length === 0) {
        collectedEl.innerHTML = '<span class="placeholder-text">ยังไม่มีตัวประกอบที่แยกออกมา</span>';
      } else {
        collectedEl.innerHTML = this.sandboxFactors
          .map(f => `<span class="factor-badge prime-rune">${f}</span>`)
          .join(' &times; ');
      }
    }

    // Exponential form
    const expDisplay = document.getElementById('sandbox-exp-display');
    if (expDisplay) {
      if (this.sandboxFactors.length > 0) {
        const expList = MathUtils.getExponentialForm(this.sandboxFactors);
        const expHtml = MathUtils.formatExponentialHtml(expList);
        expDisplay.innerHTML = `${this.sandboxNum} = ${expHtml}`;
      } else {
        expDisplay.innerText = '-';
      }
    }

    this.renderFactorTreeSvg('sandbox-tree-svg', this.sandboxTree);
  }

  handleSandboxSlice(prime) {
    if (this.sandboxCurrentNum <= 1) return;

    if (this.sandboxCurrentNum % prime === 0) {
      window.soundEngine.playSlice();
      const nextNum = this.sandboxCurrentNum / prime;
      this.sandboxFactors.push(prime);

      const activeNode = this.sandboxTree.find(n => n.active);
      if (activeNode) {
        activeNode.active = false;
        const primeChildId = this.sandboxTree.length + 1;
        const compChildId = this.sandboxTree.length + 2;

        const isNextPrime = MathUtils.isPrime(nextNum);

        this.sandboxTree.push({
          id: primeChildId,
          parentId: activeNode.id,
          value: prime,
          isPrime: true,
          isCollected: true,
          active: false,
          side: 'left'
        });

        if (nextNum > 1) {
          this.sandboxTree.push({
            id: compChildId,
            parentId: activeNode.id,
            value: nextNum,
            isPrime: isNextPrime,
            isCollected: isNextPrime,
            active: !isNextPrime,
            side: 'right'
          });

          if (isNextPrime) {
            this.sandboxFactors.push(nextNum);
          }
        }
      }

      this.sandboxCurrentNum = MathUtils.isPrime(nextNum) ? 1 : nextNum;
      this.renderSandbox();

      if (this.sandboxCurrentNum === 1) {
        window.soundEngine.playSuccess();
      }
    } else {
      window.soundEngine.playError();
      const hint = MathUtils.getDivisibilityHint(this.sandboxCurrentNum, prime);
      this.app.aiSpeak(hint, true);
    }
  }

  autoFactorizeSandbox() {
    const num = parseInt(document.getElementById('sandbox-input-num').value, 10);
    if (!num || num < 2 || num > 9999) {
      alert('กรุณาใส่ตัวเลขระหว่าง 2 ถึง 9999');
      return;
    }

    if (this.sandboxInterval) {
      clearInterval(this.sandboxInterval);
      this.sandboxInterval = null;
    }

    this.initSandbox(num);
    const allFactors = MathUtils.getPrimeFactors(num);
    let step = 0;

    this.sandboxInterval = setInterval(() => {
      if (step < allFactors.length && this.sandboxCurrentNum > 1) {
        this.handleSandboxSlice(allFactors[step]);
        step++;
      } else {
        clearInterval(this.sandboxInterval);
        this.sandboxInterval = null;
      }
    }, 450);
  }

  // --- Completion Modal ---
  showLevelCompletion(level) {
    const modal = document.getElementById('level-complete-modal');
    const title = document.getElementById('complete-title');
    const desc = document.getElementById('complete-desc');
    const nextBtn = document.getElementById('btn-next-level');

    const isMagic = this.app.theme === 'magic';
    if (title) title.innerText = isMagic ? `🎉 ผ่านบททดสอบด่านที่ ${level}!` : `🏆 ผ่านการทดลองระดับ ${level}!`;

    if (desc && nextBtn) {
      if (level === 1) {
        desc.innerText = isMagic
          ? 'ยินดีด้วย! เจ้าสามารถจำแนกอัญมณีธาตุบริสุทธิ์ (Prime) และแร่ผสม (Composite) ได้อย่างแม่นยำ!'
          : 'ยอดเยี่ยม! การตรวจจับอะตอมเดี่ยว (Prime) และสสารประกอบ (Composite) เสร็จสิ้นอย่างสมบูรณ์!';
        nextBtn.onclick = () => {
          this.closeModal();
          this.app.switchLevel(2);
        };
      } else if (level === 2) {
        desc.innerText = isMagic
          ? 'สุดยอดนักเวทย์! เจ้าเชี่ยวชาญการใช้รูนผ่าสลายผลึกและสร้างต้นไม้เวทมนตร์ Factor Tree แล้ว!'
          : 'เยี่ยมยอด! เลเซอร์แยกอนุภาคทำงานได้อย่างไร้ที่ติ และสร้างโครงสร้าง Factor Tree สำเร็จ!';
        nextBtn.onclick = () => {
          this.closeModal();
          this.app.switchLevel(3);
        };
      } else if (level === 3) {
        desc.innerText = isMagic
          ? 'ยินดีด้วย! เจ้าเข้าใจศาสตร์แห่งการรวมพลังเป็นสูตรเลขยกกำลัง (Index Notation) แล้ว!'
          : 'ยอดเยี่ยม! สูตรเคมีคณิตศาสตร์ในรูปเลขยกกำลังถูกบันทึกลงในฐานข้อมูลเรียบร้อย!';
        nextBtn.onclick = () => {
          this.closeModal();
          this.app.switchLevel(4);
        };
      }
    }

    if (modal) modal.classList.add('active');
  }

  closeModal() {
    const modal = document.getElementById('level-complete-modal');
    if (modal) modal.classList.remove('active');
  }

  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
}

window.LevelManager = LevelManager;
