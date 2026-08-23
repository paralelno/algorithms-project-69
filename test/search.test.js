import test from 'node:test';
import assert from 'node:assert/strict';

import search, { normalizeToken, tokenize, buildIndex, relevance } from '../index.js';

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

test('relevance: одно слово — matched=1, total=число вхождений', () => {
  assert.deepEqual(relevance(doc2, ['shoot']), { matched: 1, total: 3 });
  assert.deepEqual(relevance(doc1, ['shoot']), { matched: 1, total: 1 });
  assert.deepEqual(relevance(doc3, ['shoot']), { matched: 0, total: 0 });
  assert.deepEqual(relevance(doc1, ['pint']), { matched: 1, total: 1 });
});

test('relevance: не зависит от регистра и знаков препинания', () => {
  assert.deepEqual(relevance({ text: 'PINT! PINT pint' }, ['pint']), { matched: 1, total: 3 });
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
