/**
 * Noir & Mixy AI Companion & Dialogue Assistant for MW
 * Handles dialogue reactions, smart hints, and Gemini API integration.
 */
const Companion = (() => {
  'use strict';

  const STATIC_HINTS = {
    M_STOP_EARLY: {
      1: 'มิกซี่มองเห็นผลึกบางก้อนยังไม่ใช่ธาตุบริสุทธิ์ (จำนวนเฉพาะ) — ลองตรวจดูปลายกิ่งให้ครบนะ!',
      2: 'ดูโหนดที่มีค่ามากกว่า 1 และยังสามารถแยกตัวประกอบต่อได้ ต้องแตกกิ่งต่อให้สุดทางจ้า',
      3: 'ต้องแตกกิ่งจนกระทั่งปลายกิ่งทุกตัวเป็นผลึกธาตุบริสุทธิ์ (จำนวนเฉพาะ) ถึงจะนำมานับตัวประกอบได้ครบถ้วนนะ!'
    },
    M_MULT_EXP: {
      1: 'มิกซี่สะกิด: มีกิ่งที่ "ไม่หยิบธาตุ p เลย" (p⁰ = 1) ด้วยนะ — อย่าลืมนับกิ่งนี้ด้วยล่ะ!',
      2: 'กิ่ง ×p⁰ = ×1 ก็เป็น 1 ทางเลือกสำคัญในแต่ละชั้นเสมอ จึงทำให้มี e+1 ทางเลือกจ้า',
      3: 'จำนวนกิ่งในแต่ละชั้น = (e + 1) เพราะเราเลือกได้ตั้งแต่ p⁰, p¹, … ไปจนถึง p^e นั่นเอง (มี e+1 ทางเลือก ไม่ใช่ e ทางเลือก)'
    },
    M_MISS_ENDS: {
      1: 'นัวชวนสังเกต: ปลายกิ่งบนสุดและล่างสุดของต้นไม้ตัวประกอบคือเลขอะไรเอ่ย?',
      2: '1 หาร n ลงตัวเสมอ และ n ก็หาร n ลงตัวเสมอ — ทั้งคู่คือตัวประกอบที่ต้องนับเสมอนะ',
      3: 'ตัวประกอบทั้งหมดต้องรวมทั้ง 1 และตัวมันเองด้วย — ลองนับปลายกิ่งบนสุดและล่างสุดในต้นไม้ดูอีกครั้งนะ!'
    },
    M_ONE_PRIME: {
      1: '1 ไม่ใช่จำนวนเฉพาะนะจ๊ะ เพราะจำนวนเฉพาะต้องมีตัวประกอบบวก 2 ตัวพอดี (1 และตัวมันเอง)',
      2: 'ในการสลายผลึก ให้เริ่มหารด้วยจำนวนเฉพาะต่ำสุด เช่น 2, 3, 5, 7 จ้า',
      3: 'เริ่มหารด้วย 2 หรือ 3 ก่อนเลย'
    },
    DEFAULT: {
      1: 'ลองสังเกตต้นไม้ตัวประกอบเทียบกับกระจกตารางคู่ — ทั้งสองฝั่งจะตรงกันพอดีเสมอ!',
      2: 'ย้อนดูคัมภีร์บันทึกขั้นตอนทางซ้าย แล้วไล่ตามทีละบรรทัดได้เลยจ้า',
      3: 'ถ้ายังไม่แน่ใจ ลองฝึกกับ n=12 ก่อน แล้วตรวจดูว่าจะได้ 6 ตัวประกอบพอดีเป๊ะ!'
    }
  };

  const SYS_PROMPT = `คุณคือ "นัว" (พ่อมดน้อยอัจฉริยะ) และ "มิกซี่" (หนูเวทมนตร์คู่หู) ผู้ช่วยสอนคณิตศาสตร์เรื่องการแยกตัวประกอบเฉพาะและต้นไม้ตัวประกอบ (Factor Tree)
กฎเหล็ก:
1. ห้ามคำนวณเลขเอง ให้ใช้เฉพาะตัวเลขที่อยู่ใน state เท่านั้น
2. ห้ามเฉลยขั้นตอนถัดไปเด็ดขาดเมื่อ hintTier < 3
3. ตอบกระชับ ไม่เกิน 3 ประโยค ภาษาไทย อบอุ่น มีชีวิตชีวา สไตล์สถาบันเวทมนตร์ ห้ามใช้ LaTeX ซับซ้อน
4. หากผู้เรียนอยู่ในระดับ junior ให้ใช้ภาษาง่ายๆ เปรียบเทียบกับผลึกเวทมนตร์และกิ่งต้นไม้
5. ห้ามแนะนำวิธีอื่นนอกเหนือจากต้นไม้ตัวประกอบและตารางคู่`;

  const EVAL_PROMPT = `ประเมินว่าผู้เรียนเข้าใจว่าทำไมต้องบวก 1 ในสูตร (e+1) ของการหาจำนวนตัวประกอบหรือไม่
ตอบเป็น JSON เท่านั้นในรูปแบบ: {"understood": true/false, "gap": null | "M_MULT_EXP" | "M_MISS_ENDS"}
เกณฑ์: หากผู้เรียนเข้าใจว่า "+1 เพราะมีกิ่ง p^0 หรือ ทางเลือกที่ไม่หยิบจำนวนเฉพาะตัวนั้นเลย (คูณด้วย 1)" หรือความหมายเทียบเท่า ให้ understood: true`;

  /**
   * Set dialogue text with avatar animation
   * @param {string} text
   * @param {'normal'|'happy'|'thinking'|'celebrate'|'warn'} mood
   */
  function speak(text, mood = 'normal') {
    const dialogueEl = document.getElementById('ai-dialogue-text');
    const avatarEl = document.getElementById('ai-mascot-img');
    const badgeEl = document.getElementById('ai-mood-badge');

    if (dialogueEl) {
      dialogueEl.innerHTML = text;
    }

    if (badgeEl) {
      const moodIcons = {
        normal: '🐭',
        happy: '✨',
        thinking: '🔮',
        celebrate: '🎉',
        warn: '⚠️'
      };
      badgeEl.textContent = moodIcons[mood] || '🐭';
    }

    if (avatarEl) {
      avatarEl.classList.remove('pulse-avatar', 'bounce-avatar');
      void avatarEl.offsetWidth; // trigger reflow
      if (mood === 'celebrate' || mood === 'happy') {
        avatarEl.classList.add('bounce-avatar');
      } else {
        avatarEl.classList.add('pulse-avatar');
      }
    }
  }

  /**
   * Get hint from Gemini API or fallback to static hints
   * @param {object} state
   * @returns {Promise<string>}
   */
  async function getHint(state) {
    const apiKey = state.apiKey || sessionStorage.getItem('mw_gemini_key') || '';
    const model = state.model || 'gemini-2.0-flash';

    if (!apiKey) {
      return getStaticHint(state);
    }

    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: SYS_PROMPT }] },
          contents: [{ role: 'user', parts: [{ text: JSON.stringify(state) }] }],
          generationConfig: { maxOutputTokens: 180, temperature: 0.3 }
        })
      });

      if (!response.ok) throw new Error(`API Error: ${response.status}`);
      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      return text || getStaticHint(state);
    } catch (err) {
      console.warn('Fallback to static hint due to:', err);
      return getStaticHint(state);
    }
  }

  /**
   * Evaluate learner's explanation of why +1 is needed
   * @param {string} explanation
   * @param {Array<{p: number, e: number}>} factors
   * @param {string} apiKey
   * @param {string} model
   * @returns {Promise<{understood: boolean, gap: string|null}>}
   */
  async function evaluateExplanation(explanation, factors, apiKey = '', model = 'gemini-2.0-flash') {
    const key = apiKey || sessionStorage.getItem('mw_gemini_key') || '';
    if (!key) {
      return heuristicEval(explanation);
    }

    try {
      const formula = factors.map(({ e }) => `(${e}+1)`).join(' × ');
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: EVAL_PROMPT }] },
          contents: [{ role: 'user', parts: [{ text: `สูตร: ${formula}\nคำอธิบายของผู้เรียน: "${explanation}"` }] }],
          generationConfig: { maxOutputTokens: 80, temperature: 0.1 }
        })
      });

      if (!response.ok) throw new Error(`Eval API Error: ${response.status}`);
      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const match = text.match(/\{[\s\S]*?\}/);
      if (match) {
        return JSON.parse(match[0]);
      }
      return heuristicEval(explanation);
    } catch (err) {
      console.warn('Fallback to heuristic eval:', err);
      return heuristicEval(explanation);
    }
  }

  function heuristicEval(text) {
    const t = (text || '').toLowerCase().trim();
    if (t.length < 5) return { understood: false, gap: 'M_MULT_EXP' };
    if (t.length >= 25) return { understood: true, gap: null };

    const keywords = [
      '+1', 'บวก 1', 'บวกหนึ่ง', 'ไม่หยิบ', 'กิ่ง', 'p0', 'p⁰',
      'ยกกำลัง', 'กำลัง 0', 'กำลังศูนย์', 'ทางเลือก', 'e+1', 'ศูนย์'
    ];
    const hasKeyword = keywords.some(k => t.includes(k));
    return {
      understood: hasKeyword || t.length >= 18,
      gap: hasKeyword ? null : 'M_MULT_EXP'
    };
  }

  function getStaticHint(state) {
    const tier = Math.min(state.hintTier || 1, 3);
    const mid = state.misconceptionId;

    if (mid && STATIC_HINTS[mid] && STATIC_HINTS[mid][tier]) {
      return STATIC_HINTS[mid][tier];
    }
    return STATIC_HINTS.DEFAULT[tier] || STATIC_HINTS.DEFAULT[1];
  }

  return {
    speak,
    getHint,
    evaluateExplanation,
    getStaticHint
  };
})();

// Export globally
if (typeof window !== 'undefined') {
  window.Companion = Companion;
}
