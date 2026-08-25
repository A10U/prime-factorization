/**
 * Main Application Controller
 * Handles Themes (Magic vs Sci-Fi), AI Assistant (Nobi & Pipo), Navigation, and UI State.
 */
class App {
  constructor() {
    this.theme = 'magic'; // 'magic' or 'scifi'
    this.currentLevel = 0; // Starts at Level 0 (Tutorial & Story)
    this.soundMuted = false;
    this.speechEnabled = true;
    this.levelManager = new LevelManager(this);
    window.levelManager = this.levelManager;
  }

  init() {
    this.bindEvents();
    this.applyTheme(this.theme);
    this.levelManager.updateTargetDropdowns();
    this.switchLevel(0); // Start at Level 0
    this.setupAiSpeech();
  }

  bindEvents() {
    // Theme Switcher Button
    const themeBtn = document.getElementById('theme-toggle-btn');
    if (themeBtn) {
      themeBtn.addEventListener('click', () => {
        this.toggleTheme();
      });
    }

    // Sound Switcher Button
    const soundBtn = document.getElementById('sound-toggle-btn');
    if (soundBtn) {
      soundBtn.addEventListener('click', () => {
        const isEnabled = window.soundEngine.toggleSound();
        soundBtn.innerHTML = isEnabled ? '🔊 เสียง: เปิด' : '🔇 เสียง: ปิด';
        window.soundEngine.playClick();
      });
    }

    // Smart Hint Main Button
    const hintBtn = document.getElementById('btn-smart-hint');
    if (hintBtn) {
      hintBtn.addEventListener('click', () => {
        this.levelManager.triggerSmartHint();
      });
    }

    // Difficulty Selector
    const diffSelect = document.getElementById('difficulty-select');
    if (diffSelect) {
      diffSelect.addEventListener('change', (e) => {
        this.levelManager.setDifficulty(e.target.value);
      });
    }

    // Random Quest Buttons
    document.querySelectorAll('.btn-random-quest').forEach(btn => {
      btn.addEventListener('click', () => {
        this.levelManager.randomizeCurrentLevelQuest();
      });
    });

    // Nav Tabs
    document.querySelectorAll('.nav-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const level = tab.dataset.level === 'sandbox' ? 'sandbox' : parseInt(tab.dataset.level, 10);
        window.soundEngine.playClick();
        this.switchLevel(level);
      });
    });

    // Level 1 Buttons
    const btnPrime = document.getElementById('l1-btn-prime');
    const btnComposite = document.getElementById('l1-btn-composite');
    if (btnPrime) btnPrime.addEventListener('click', () => this.levelManager.handleLevel1Choice(true));
    if (btnComposite) btnComposite.addEventListener('click', () => this.levelManager.handleLevel1Choice(false));

    // Level 2 Prime Slice Weapons
    document.querySelectorAll('.prime-weapon-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const prime = parseInt(btn.dataset.prime, 10);
        if (this.currentLevel === 2) {
          this.levelManager.handleLevel2Slice(prime);
        } else if (this.currentLevel === 4 && this.levelManager.l4SubTab === 'duel') {
          this.levelManager.handleDuelPlayerSlice(prime);
        }
      });
    });

    // Level 2 Reset / Target selector
    const l2TargetSelect = document.getElementById('l2-target-select');
    if (l2TargetSelect) {
      l2TargetSelect.addEventListener('change', (e) => {
        const val = parseInt(e.target.value, 10);
        window.soundEngine.playClick();
        this.levelManager.initLevel2(val);
      });
    }

    // Level 3 Selector
    const l3Select = document.getElementById('l3-target-select');
    if (l3Select) {
      l3Select.addEventListener('change', (e) => {
        const val = parseInt(e.target.value, 10);
        window.soundEngine.playClick();
        this.levelManager.initLevel3(val);
      });
    }

    // Level 4 Tabs & RSA inputs
    const tabVenn = document.getElementById('l4-tab-venn');
    const tabRsa = document.getElementById('l4-tab-rsa');
    const tabDuel = document.getElementById('l4-tab-duel');
    if (tabVenn) tabVenn.addEventListener('click', () => this.levelManager.switchLevel4Tab('venn'));
    if (tabRsa) tabRsa.addEventListener('click', () => this.levelManager.switchLevel4Tab('rsa'));
    if (tabDuel) tabDuel.addEventListener('click', () => this.levelManager.switchLevel4Tab('duel'));

    const btnNextVenn = document.getElementById('btn-next-venn');
    if (btnNextVenn) btnNextVenn.addEventListener('click', () => this.levelManager.nextVennPair());

    const btnUpdateRsa = document.getElementById('btn-update-rsa');
    if (btnUpdateRsa) btnUpdateRsa.addEventListener('click', () => this.levelManager.updateRsaPrimes());

    const btnNewDuel = document.getElementById('btn-new-duel');
    if (btnNewDuel) btnNewDuel.addEventListener('click', () => this.levelManager.initAiDuel());

    // Sandbox Controls
    const btnSandboxSlice = document.querySelectorAll('.sandbox-weapon-btn');
    btnSandboxSlice.forEach(btn => {
      btn.addEventListener('click', () => {
        const prime = parseInt(btn.dataset.prime, 10);
        this.levelManager.handleSandboxSlice(prime);
      });
    });

    const btnSandboxAuto = document.getElementById('btn-sandbox-auto');
    if (btnSandboxAuto) btnSandboxAuto.addEventListener('click', () => this.levelManager.autoFactorizeSandbox());

    const btnSandboxReset = document.getElementById('btn-sandbox-reset');
    if (btnSandboxReset) {
      btnSandboxReset.addEventListener('click', () => {
        const val = parseInt(document.getElementById('sandbox-input-num').value, 10) || 60;
        this.levelManager.initSandbox(val);
      });
    }

    // Modal Close
    const modalClose = document.getElementById('modal-close-btn');
    if (modalClose) modalClose.addEventListener('click', () => this.levelManager.closeModal());
  }

  toggleTheme() {
    this.theme = this.theme === 'magic' ? 'scifi' : 'magic';
    window.soundEngine.setTheme(this.theme);
    window.soundEngine.playSlice();
    this.applyTheme(this.theme);
  }

  applyTheme(theme) {
    document.body.className = `theme-${theme}`;
    const isMagic = theme === 'magic';

    const themeBtn = document.getElementById('theme-toggle-btn');
    if (themeBtn) {
      themeBtn.innerHTML = isMagic ? '🪄 โหมดเวทมนตร์ (สลับเป็น Sci-Fi)' : '⚛️ โหมดควอนตัม (สลับเป็นเวทมนตร์)';
    }

    const appTitle = document.getElementById('app-main-title');
    const appSubtitle = document.getElementById('app-subtitle');
    const aiName = document.getElementById('ai-companion-name');

    if (isMagic) {
      if (appTitle) appTitle.innerHTML = '✨ สถาบันเวทมนตร์แห่งตัวเลข <span class="badge-title">Noir & Mixy Magic Academy</span>';
      if (appSubtitle) appSubtitle.innerText = 'ศาสตร์แห่งการสลายผลึกและหลอมอัญมณีธาตุบริสุทธิ์กับพ่อมดน้อยนัว';
      if (aiName) aiName.innerText = 'นัว & มิกซี่ (Noir & Mixy 🧙‍♂️🐭)';
    } else {
      if (appTitle) appTitle.innerHTML = '⚛️ Quantum Particle Lab <span class="badge-title">Noir-Bot & Robo-Mixy</span>';
      if (appSubtitle) appSubtitle.innerText = 'ห้องทดลองเลเซอร์แยกสสารและค้นหาอะตอมปฐมภูมิ';
      if (aiName) aiName.innerText = 'Noir-Bot & Robo-Mixy (AI ประจำแล็บ 🤖)';
    }

    // Re-render active level
    this.refreshCurrentLevel();
  }

  switchLevel(level) {
    this.currentLevel = level;
    this.levelManager.currentLevel = level;

    // Update nav active classes
    document.querySelectorAll('.nav-tab').forEach(tab => {
      const tabLvl = tab.dataset.level === 'sandbox' ? 'sandbox' : parseInt(tab.dataset.level, 10);
      tab.classList.toggle('active', tabLvl === level);
    });

    // Show/hide sections
    document.querySelectorAll('.level-screen').forEach(screen => {
      const screenLvl = screen.dataset.level === 'sandbox' ? 'sandbox' : parseInt(screen.dataset.level, 10);
      screen.classList.toggle('active', screenLvl === level);
    });

    this.refreshCurrentLevel();
  }

  refreshCurrentLevel() {
    if (this.currentLevel === 0) {
      this.levelManager.initLevel0();
    } else if (this.currentLevel === 1) {
      this.levelManager.initLevel1();
    } else if (this.currentLevel === 2) {
      this.levelManager.initLevel2();
    } else if (this.currentLevel === 3) {
      this.levelManager.initLevel3();
    } else if (this.currentLevel === 4) {
      this.levelManager.initLevel4();
    } else if (this.currentLevel === 'sandbox') {
      this.levelManager.initSandbox();
    }
  }

  // AI Speech & Dialogue Helper
  setupAiSpeech() {
    this.speechSynth = window.speechSynthesis;
  }

  aiSpeak(text, forceSpeak = false) {
    const bubbleText = document.getElementById('ai-dialogue-text');
    if (bubbleText) {
      bubbleText.innerText = text;
    }

    if (this.speechEnabled && this.speechSynth && forceSpeak) {
      try {
        this.speechSynth.cancel();
        const utter = new SpeechSynthesisUtterance(text);
        utter.lang = 'th-TH';
        utter.rate = 1.05;
        this.speechSynth.speak(utter);
      } catch (e) {
        // Fallback silently if speech synthesis not permitted
      }
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.app = new App();
  window.app.init();
});
