import test from 'node:test';
import assert from 'node:assert/strict';

import search, { normalizeToken, tokenize, buildIndex, tf, idf, relevance } from '../index.js';

const doc1 = { id: 'doc1', text: "I can't shoot straight unless I've had a pint!" };
const doc2 = { id: 'doc2', text: "Don't shoot shoot shoot that thing at me." };
const doc3 = { id: 'doc3', text: "I'm your shooter." };
const docs = [doc1, doc2, doc3];

// ── Шаг 1: обработка текста ──────────────────────────────────────────────
test('нормализация токена: знак препинания', () => {
  assert.equal(normalizeToken('pint!'), 'pint');
});

test('нормализация токена: верхний регистр', () => {
  assert.equal(normalizeToken('TRASH'), 'trash');
});

test('нормализация токена: слово с апострофом', () => {
  assert.equal(normalizeToken("can't"), 'cant');
  assert.equal(normalizeToken("I've"), 'ive');
});

test('нормализация токена: дефис склеивает в один терм', () => {
  assert.equal(normalizeToken('alpha-beta'), 'alphabeta');
});

test('нормализация токена: без словесных символов — выбрасывается', () => {
  assert.equal(normalizeToken('—'), '');
  assert.equal(normalizeToken('!!!'), '');
});

test('tokenize: разбирает текст по словам', () => {
  assert.deepEqual(tokenize("Don't shoot shoot shoot that thing at me."), [
    'dont', 'shoot', 'shoot', 'shoot', 'that', 'thing', 'at', 'me',
  ]);
});

// ── Шаг 2: релевантность (одно слово — частный случай) ──────────────────
test('поиск: shoot ранжирует doc2 (3 вхождения) перед doc1 (1), doc3 выпадает', () => {
  assert.deepEqual(search(docs, 'shoot'), ['doc2', 'doc1']);
});

test('поиск: pint и pint! — один результат', () => {
  assert.deepEqual(search([doc1], 'pint'), ['doc1']);
  assert.deepEqual(search([doc1], 'pint!'), ['doc1']);
});

test('поиск: can\'t и cant находят один документ, а can — нет', () => {
  assert.deepEqual(search([doc1], "can't"), ['doc1']);
  assert.deepEqual(search([doc1], 'cant'), ['doc1']);
  assert.deepEqual(search([doc1], 'can'), []);
});

test('поиск по пустому запросу — пусто', () => {
  assert.deepEqual(search(docs, '   '), []);
});

test('relevance: одно слово — вес > 0, чем больше вхождений, тем выше', () => {
  const index = buildIndex(docs);
  const N = docs.length;
  const wDoc2 = relevance(doc2, ['shoot'], index, N);
  const wDoc1 = relevance(doc1, ['shoot'], index, N);
  const wDoc3 = relevance(doc3, ['shoot'], index, N);
  assert.ok(wDoc2 > wDoc1);
  assert.equal(wDoc3, 0);
  assert.ok(relevance(doc1, ['pint'], index, N) > 0);
});

test('relevance: не зависит от регистра и знаков препинания', () => {
  const doc = { id: 'x', text: 'PINT! PINT pint' };
  const index = buildIndex([doc]);
  assert.ok(relevance(doc, ['pint'], index, 1) > 0);
});

// ── Шаг 3: нечёткий поиск (несколько слов) ───────────────────────────────
test('нечёткий: shoot at me -> doc2 (3 терма) перед doc1 (1 терм)', () => {
  assert.deepEqual(search(docs, 'shoot at me'), ['doc2', 'doc1']);
});

test('нечёткий: лишнее слово nerd без совпадений игнорируется', () => {
  assert.deepEqual(search(docs, 'shoot at me, nerd'), ['doc2', 'doc1']);
});

test('нечёткий: документ с хотя бы одним термом попадает в результат', () => {
  const d4 = { id: 'doc4', text: 'at the end' };
  assert.deepEqual(search([d4, doc3], 'shoot at me'), ['doc4']);
});

test('нечёткий: сначала количество разных термов, затем сумма вхождений', () => {
  // a: два разных терма по 1 вхождению (matched=2, total=2)
  // b: один терм по 3 вхождения (matched=1, total=3)
  // a должен идти раньше b, несмотря на меньший total
  const a = { id: 'a', text: 'shoot at' };
  const b = { id: 'b', text: 'shoot shoot shoot' };
  assert.deepEqual(search([b, a], 'shoot at me'), ['a', 'b']);
});

test('нечёткий: запрос со знаками препинания', () => {
  assert.deepEqual(search(docs, "Shoot! at, me"), ['doc2', 'doc1']);
});

// ── Шаг 4: обратный индекс ──────────────────────────────────────────────
test('обратный индекс: терм -> список {id, count}', () => {
  const d1 = { id: 'doc1', text: 'some text' };
  const d2 = { id: 'doc2', text: 'some text text too' };
  const index = buildIndex([d1, d2]);
  assert.deepEqual(index, {
    some: [{ id: 'doc1', count: 1 }, { id: 'doc2', count: 1 }],
    text: [{ id: 'doc1', count: 1 }, { id: 'doc2', count: 2 }],
    too: [{ id: 'doc2', count: 1 }],
  });
});

test('обратный индекс: ключ — нормализованный терм', () => {
  const index = buildIndex([{ id: 'x', text: 'PINT! pint' }]);
  assert.ok(index.pint);
  assert.equal(index.pint.length, 1);
  assert.equal(index.pint[0].count, 2);
  assert.equal(index['pint!'], undefined);
});

test('обратный индекс: результаты поиска не изменились', () => {
  assert.deepEqual(search(docs, 'shoot'), ['doc2', 'doc1']);
  assert.deepEqual(search(docs, 'shoot at me'), ['doc2', 'doc1']);
  assert.deepEqual(search(docs, 'shoot at me, nerd'), ['doc2', 'doc1']);
});

test('обратный индекс: терм без совпадений игнорируется', () => {
  const index = buildIndex(docs);
  assert.equal(index.nerd, undefined);
});

// ── Шаг 5: TF-IDF ───────────────────────────────────────────────────────
test('TF-IDF: спам из повторяющегося слова проигрывает документу со всеми словами', () => {
  const spam = { id: 'spam', text: 'trash trash trash trash' };
  const article = { id: 'article', text: 'trash island' };
  assert.deepEqual(search([spam, article], 'trash island'), ['article', 'spam']);
});

test('TF-IDF: tf — вхождения / всего термов в документе', () => {
  const spam = { id: 'spam', text: 'trash trash trash trash' };
  const article = { id: 'article', text: 'trash island' };
  assert.equal(tf('trash', spam), 1);        // 4/4
  assert.equal(tf('trash', article), 0.5);   // 1/2
  assert.equal(tf('island', article), 0.5);  // 1/2
});

test('TF-IDF: idf — логарифмическая формула из задания (всегда > 0)', () => {
  const spam = { id: 'spam', text: 'trash trash trash trash' };
  const article = { id: 'article', text: 'trash island' };
  const index = buildIndex([spam, article]);
  // df(trash)=2 -> log2(1 + (2-2+1)/(2+0.5)) = log2(1.4) ≈ 0.485
  assert.ok(Math.abs(idf('trash', index, 2) - Math.log2(1.4)) < 1e-9);
  // df(island)=1 -> log2(1 + (2-1+1)/(1+0.5)) = log2(2.333) ≈ 1.222
  assert.ok(Math.abs(idf('island', index, 2) - Math.log2(1 + 2 / 1.5)) < 1e-9);
  // idf всегда положительна даже для термина во всех документах
  assert.ok(idf('trash', index, 2) > 0);
});

test('TF-IDF: вес = сумма tf*idf по найденным термам запроса', () => {
  const spam = { id: 'spam', text: 'trash trash trash trash' };
  const article = { id: 'article', text: 'trash island' };
  const index = buildIndex([spam, article]);
  const idfTrash = idf('trash', index, 2);
  const idfIsland = idf('island', index, 2);
  const wSpam = relevance(spam, ['trash', 'island'], index, 2);
  const wArticle = relevance(article, ['trash', 'island'], index, 2);
  assert.ok(Math.abs(wSpam - 1 * idfTrash) < 1e-9);
  assert.ok(Math.abs(wArticle - (0.5 * idfTrash + 0.5 * idfIsland)) < 1e-9);
});

test('TF-IDF: документ без термов запроса не попадает в результат', () => {
  const other = { id: 'other', text: 'completely different words here' };
  const result = search([other], 'trash island');
  assert.deepEqual(result, []);
});

test('TF-IDF: ранжирование на примерах предыдущих шагов сохраняется', () => {
  assert.deepEqual(search(docs, 'shoot'), ['doc2', 'doc1']);
});
