/**
 * Mathematical Utility Functions for Prime Factorization
 */
const MathUtils = {
  // Check if a number is prime
  isPrime(n) {
    if (n <= 1) return false;
    if (n <= 3) return true;
    if (n % 2 === 0 || n % 3 === 0) return false;
    for (let i = 5; i * i <= n; i += 6) {
      if (n % i === 0 || n % (i + 2) === 0) return false;
    }
    return true;
  },

  // Get list of primes up to maxN
  getPrimes(maxN = 100) {
    const primes = [];
    for (let i = 2; i <= maxN; i++) {
      if (this.isPrime(i)) primes.push(i);
    }
    return primes;
  },

  // Get prime factors as array [2, 2, 3, 5]
  getPrimeFactors(n) {
    let num = n;
    const factors = [];
    let d = 2;
    while (d * d <= num) {
      while (num % d === 0) {
        factors.push(d);
        num = Math.floor(num / d);
      }
      d = d === 2 ? 3 : d + 2;
    }
    if (num > 1) {
      factors.push(num);
    }
    return factors;
  },

  // Group factors into powers [{base: 2, exp: 2}, {base: 3, exp: 1}]
  getExponentialForm(factors) {
    const counts = {};
    factors.forEach(f => {
      counts[f] = (counts[f] || 0) + 1;
    });
    return Object.keys(counts)
      .map(k => parseInt(k, 10))
      .sort((a, b) => a - b)
      .map(base => ({ base, exp: counts[base] }));
  },

  // Format as HTML string: e.g. 2² × 3 × 5
  formatExponentialHtml(expList) {
    return expList
      .map(item => {
        if (item.exp === 1) return `<span>${item.base}</span>`;
        return `<span>${item.base}<sup>${item.exp}</sup></span>`;
      })
      .join(' &times; ');
  },

  // Generate numbers based on difficulty level
  getNumbersByDifficulty(difficulty = 'easy') {
    if (difficulty === 'easy') {
      // 6 to 30 (Composite numbers with 2-3 factors)
      return [6, 8, 9, 10, 12, 14, 15, 16, 18, 20, 21, 24, 25, 27, 28, 30];
    } else if (difficulty === 'medium') {
      // 32 to 100
      return [32, 36, 40, 42, 45, 48, 50, 54, 60, 64, 70, 72, 75, 80, 84, 90, 96, 100];
    } else {
      // 108 to 360
      return [108, 112, 120, 126, 135, 140, 144, 150, 160, 168, 180, 196, 200, 210, 216, 240, 252, 280, 300, 360];
    }
  },

  // Get a random composite number based on difficulty
  getRandomComposite(difficulty = 'easy', exclude = null) {
    const list = this.getNumbersByDifficulty(difficulty).filter(n => n !== exclude);
    return list[Math.floor(Math.random() * list.length)] || 60;
  },

  // Level 1 pool generator (Mix of primes and composites)
  getLevel1Pool(difficulty = 'easy') {
    if (difficulty === 'easy') {
      return [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
    } else if (difficulty === 'medium') {
      return [13, 17, 19, 21, 23, 25, 27, 29, 31, 33, 35, 37, 39, 41, 45, 49, 51, 53, 57, 59];
    } else {
      return [41, 43, 47, 51, 57, 61, 67, 71, 73, 77, 79, 83, 87, 89, 91, 93, 97, 101, 103, 111];
    }
  },

  // Generate pair of numbers for Level 4 GCD/LCM
  getRandomPair(difficulty = 'easy') {
    if (difficulty === 'easy') {
      const pairs = [
        { a: 6, b: 8 }, { a: 8, b: 12 }, { a: 12, b: 18 }, { a: 10, b: 15 }, { a: 14, b: 21 }, { a: 15, b: 20 }
      ];
      return pairs[Math.floor(Math.random() * pairs.length)];
    } else if (difficulty === 'medium') {
      const pairs = [
        { a: 24, b: 36 }, { a: 20, b: 30 }, { a: 18, b: 45 }, { a: 28, b: 42 }, { a: 45, b: 60 }, { a: 30, b: 75 }
      ];
      return pairs[Math.floor(Math.random() * pairs.length)];
    } else {
      const pairs = [
        { a: 48, b: 72 }, { a: 60, b: 90 }, { a: 72, b: 108 }, { a: 84, b: 126 }, { a: 90, b: 120 }, { a: 120, b: 180 }
      ];
      return pairs[Math.floor(Math.random() * pairs.length)];
    }
  },

  // Calculate GCD (ห.ร.ม.) and LCM (ค.ร.น.) with Prime Venn decomposition
  calculateGcdLcm(a, b) {
    const factorsA = this.getPrimeFactors(a);
    const factorsB = this.getPrimeFactors(b);

    const countsA = {};
    const countsB = {};
    factorsA.forEach(f => countsA[f] = (countsA[f] || 0) + 1);
    factorsB.forEach(f => countsB[f] = (countsB[f] || 0) + 1);

    const allPrimes = Array.from(new Set([...factorsA, ...factorsB])).sort((x, y) => x - y);

    const commonFactors = [];
    const onlyAFactors = [];
    const onlyBFactors = [];

    allPrimes.forEach(p => {
      const cA = countsA[p] || 0;
      const cB = countsB[p] || 0;
      const commonCount = Math.min(cA, cB);
      const onlyACount = cA - commonCount;
      const onlyBCount = cB - commonCount;

      for (let i = 0; i < commonCount; i++) commonFactors.push(p);
      for (let i = 0; i < onlyACount; i++) onlyAFactors.push(p);
      for (let i = 0; i < onlyBCount; i++) onlyBFactors.push(p);
    });

    const gcd = commonFactors.reduce((acc, curr) => acc * curr, 1);
    const lcm = [...onlyAFactors, ...commonFactors, ...onlyBFactors].reduce((acc, curr) => acc * curr, 1);

    return {
      numA: a,
      numB: b,
      factorsA,
      factorsB,
      onlyA: onlyAFactors,
      common: commonFactors,
      onlyB: onlyBFactors,
      gcd,
      lcm
    };
  },

  // Divisibility Tips for Kids (AI Assistant hints)
  getDivisibilityHint(num, prime) {
    if (num % prime === 0) {
      if (prime === 2) return `⚡ ${num} เป็นเลขคู่ จึงหารด้วย 2 ลงตัวแน่นอน!`;
      if (prime === 3) {
        const sumDigits = String(num).split('').reduce((a, b) => a + parseInt(b, 10), 0);
        return `✨ ผลบวกเลขโดด (${String(num).split('').join('+')} = ${sumDigits}) หาร 3 ลงตัว ดังนั้น ${num} หาร 3 ลงตัว!`;
      }
      if (prime === 5) return `💨 ${num} ลงท้ายด้วย ${num % 10} จึงหารด้วย 5 ลงตัวอย่างแน่นอน!`;
      return `🌟 ยอดเยี่ยม! ${num} &divide; ${prime} = ${num / prime}`;
    } else {
      if (prime === 2) return `❌ ${num} เป็นเลขคี่ (ไม่ได้ลงท้ายด้วย 0, 2, 4, 6, 8) จึงหารด้วย 2 ไม่ลงตัว!`;
      if (prime === 3) {
        const sumDigits = String(num).split('').reduce((a, b) => a + parseInt(b, 10), 0);
        return `❌ ผลบวกเลขโดด (${String(num).split('').join('+')} = ${sumDigits}) หาร 3 ไม่ลงตัว!`;
      }
      if (prime === 5) return `❌ ${num} ไม่ได้ลงท้ายด้วย 0 หรือ 5 จึงหาร 5 ไม่ลงตัว!`;
      return `❌ ${num} หารด้วย ${prime} เหลือเศษ ${num % prime}! ลองหาจำนวนเฉพาะตัวอื่นดูนะ`;
    }
  },

  // First prime factor that divides num
  getSmallestPrimeFactor(num) {
    if (num <= 1) return null;
    const factors = this.getPrimeFactors(num);
    return factors.length > 0 ? factors[0] : null;
  }
};

window.MathUtils = MathUtils;
