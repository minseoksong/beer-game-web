// i18n 무결성 — 모든 언어가 같은 키 구조를 갖는지 확인.
// (서버에서 직접 클라이언트 파일 읽기 — Node가 동일 머신에서 도는 가정)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TR_PATH = path.join(__dirname, '..', '..', 'client', 'src', 'i18n', 'translations.js');

const src = fs.readFileSync(TR_PATH, 'utf8');
// 매우 단순한 import — 실행으로 평가
const TRANSLATIONS = await import(`file://${TR_PATH}`).then(m => m.TRANSLATIONS);

function flatten(obj, prefix = '') {
  const keys = [];
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      keys.push(...flatten(v, path));
    } else {
      keys.push(path);
    }
  }
  return keys;
}

const langs = Object.keys(TRANSLATIONS);
console.log(`언어: ${langs.join(', ')}`);

const keysByLang = {};
for (const lang of langs) {
  keysByLang[lang] = new Set(flatten(TRANSLATIONS[lang]));
  console.log(`  ${lang}: ${keysByLang[lang].size}개 키`);
}

let issues = 0;
const allKeys = new Set();
langs.forEach(l => keysByLang[l].forEach(k => allKeys.add(k)));

for (const key of allKeys) {
  for (const lang of langs) {
    if (!keysByLang[lang].has(key)) {
      console.error(`  ❌ ${lang} 누락: ${key}`);
      issues++;
    }
  }
}

if (issues === 0) {
  console.log(`✅ 모든 언어가 ${allKeys.size}개 키를 동일하게 가짐`);
} else {
  console.error(`💥 ${issues}개 누락`);
  process.exit(1);
}
