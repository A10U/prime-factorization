/**
 * MW Mathematical Engine
 * Deterministic math calculations, tree generation, and misconception detection.
 * Strictly decoupled from UI and LLM.
 */
const Engine = (() => {
  'use strict';

  /**
   * Prime factorization of n
   * @param {number} n
   * @returns {Array<{p: number, e: number}>}
   */
  function factorize(n) {
    if (!Number.isInteger(n) || n < 2) return [];
    const factors = [];
    let rem = n;
    let d = 2;

    while (d * d <= rem) {
      if (rem % d === 0) {
        let e = 0;
        while (rem % d === 0) {
          e++;
          rem = Math.floor(rem / d);
        }
        factors.push({ p: d, e });
      }
      d++;
    }
    if (rem > 1) {
      factors.push({ p: rem, e: 1 });
    }
    return factors;
  }

  /**
   * Build horizontal factor tree structure
   * Root = 1. Each level li corresponds to prime factor[li],
   * branching out with multipliers p^0, p^1, ..., p^e.
   * Leaves at totalLevels represent all divisors of n.
   * @param {Array<{p: number, e: number}>} factors
   * @returns {Array<{id: number, level: number, value: number, parentId: number|null, edgePrime: number|null, edgePow: number|null, edgeMult: number|null}>}
   */
  function buildTree(factors) {
    const nodes = [
      { id: 0, level: 0, value: 1, parentId: null, edgePrime: null, edgePow: null, edgeMult: null }
    ];
    let nextId = 1;

    for (let li = 0; li < factors.length; li++) {
      const { p, e } = factors[li];
      const currentLevelNodes = nodes.filter(nd => nd.level === li);

      for (const parent of currentLevelNodes) {
        let pk = 1;
        for (let k = 0; k <= e; k++) {
          nodes.push({
            id: nextId++,
            level: li + 1,
            value: parent.value * pk,
            parentId: parent.id,
            edgePrime: p,
            edgePow: k,
            edgeMult: pk
          });
          pk *= p;
        }
      }
    }
    return nodes;
  }

  /**
   * Get all divisors of n, sorted in ascending order
   * @param {Array<{p: number, e: number}>} factors
   * @returns {number[]}
   */
  function allDivisors(factors) {
    let divs = [1];
    for (const { p, e } of factors) {
      const nextDivs = [];
      for (const d of divs) {
        let pk = 1;
        for (let k = 0; k <= e; k++) {
          nextDivs.push(d * pk);
          pk *= p;
        }
      }
      divs = nextDivs;
    }
    return divs.sort((a, b) => a - b);
  }

  /**
   * Find all divisor pairs [a, b] such that a * b = n and a <= b
   * @param {number} n
   * @returns {Array<[number, number]>}
   */
  function divisorPairs(n) {
    const divs = allDivisors(factorize(n));
    const pairs = [];
    for (const d of divs) {
      if (d * d <= n) {
        pairs.push([d, Math.floor(n / d)]);
      }
    }
    return pairs;
  }

  /**
   * Total number of divisors: Product of (e + 1)
   * @param {Array<{p: number, e: number}>} factors
   * @returns {number}
   */
  function divisorCount(factors) {
    if (!factors || !factors.length) return 0;
    return factors.reduce((acc, { e }) => acc * (e + 1), 1);
  }

  /**
   * Validate input number n
   * @param {number} n
   * @returns {{ok: boolean, msg?: string}}
   */
  function validateN(n) {
    if (!Number.isInteger(n) || n < 2) {
      return { ok: false, msg: 'กรุณาใส่จำนวนเต็มบวกที่มากกว่า 1 (ตั้งแต่ 2 ขึ้นไป)' };
    }
    if (n > 999) {
      return { ok: false, msg: 'เพื่อการเรียนรู้ที่ชัดเจน กรุณาใส่จำนวนไม่เกิน 999' };
    }
    const f = factorize(n);
    const cnt = divisorCount(f);
    if (cnt > 24) {
      return { ok: false, msg: `จำนวน ${n} มีตัวประกอบถึง ${cnt} ตัว (เกิน 24 กิ่ง) อาจทำให้ต้นไม้หนาแน่นเกินไป ลองเลือกเลขอื่นนะครับ` };
    }
    return { ok: true };
  }

  /**
   * Check learner's guess for divisor count and detect misconceptions
   * @param {number} guess
   * @param {Array<{p: number, e: number}>} factors
   * @returns {{ok: boolean, misconId: string|null}}
   */
  function checkCountGuess(guess, factors) {
    const correct = divisorCount(factors);
    if (guess === correct) {
      return { ok: true, misconId: null };
    }

    // Check if user multiplied only exponents (e1 * e2 * ...) without +1
    const prodE = factors.length > 1 ? factors.reduce((p, { e }) => p * e, 1) : -1;
    if (factors.length > 1 && guess === prodE) {
      return { ok: false, misconId: 'M_MULT_EXP' };
    }

    // Check if missed endpoints (forgot 1 or n itself)
    if (guess === correct - 1 || guess === correct - 2) {
      return { ok: false, misconId: 'M_MISS_ENDS' };
    }

    // Early stop / missing branches
    if (guess < correct) {
      return { ok: false, misconId: 'M_STOP_EARLY' };
    }

    return { ok: false, misconId: null };
  }

  /**
   * Generate reverse application problem (โจทย์ประยุกต์ย้อนกลับ)
   * @param {'junior'|'exam'} level
   * @returns {{n: number, factors: Array<{p: number, e: number}>, factorCount: number, hints: number[], text: string, level: string}}
   */
  function generateProblem(level = 'junior') {
    const juniorSets = [
      [2, 7], [2, 11], [3, 7], [3, 11], [5, 7], [2, 13], [3, 13], [5, 11]
    ];
    const examSets = [
      [2, 3, 5], [2, 3, 7], [2, 5, 7], [3, 5, 7],
      [2, 3, 11], [2, 5, 11], [3, 5, 11], [2, 7, 11]
    ];

    const sets = level === 'exam' ? examSets : juniorSets;
    const primes = sets[Math.floor(Math.random() * sets.length)];
    const n = primes.reduce((a, b) => a * b, 1);
    const factors = factorize(n);
    const count = divisorCount(factors);

    if (level === 'exam') {
      const hA = primes[0] * primes[1];
      const hB = primes[1] * primes[2];
      return {
        n,
        factors,
        factorCount: count,
        hints: [hA, hB],
        level: 'exam',
        text: `จำนวนหนึ่งมีตัวประกอบทั้งหมด <strong>${count}</strong> ตัว (รวม 1 และตัวเอง) และมีทั้ง <strong>${hA}</strong> กับ <strong>${hB}</strong> เป็นตัวประกอบของจำนวนนั้น จงหาว่าจำนวนนั้นคือจำนวนใด`
      };
    } else {
      return {
        n,
        factors,
        factorCount: count,
        hints: primes,
        level: 'junior',
        text: `ผลึกเวทมนตร์ลึกลับมีตัวประกอบทั้งหมด <strong>${count}</strong> ตัว โดยมี <strong>${primes[0]}</strong> และ <strong>${primes[1]}</strong> เป็นตัวประกอบเฉพาะ จงหาค่าของผลึกเวทมนตร์ก้อนนี้`
      };
    }
  }

  return {
    factorize,
    buildTree,
    allDivisors,
    divisorPairs,
    divisorCount,
    validateN,
    checkCountGuess,
    generateProblem
  };
})();

// Export globally
if (typeof window !== 'undefined') {
  window.Engine = Engine;
}
