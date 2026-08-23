import test from 'node:test';
import assert from 'node:assert/strict';

import search, { normalizeToken, tokenize } from '../index.js';

const doc1 = { id: 'doc1', text: "I can't shoot straight unless I've had a pint!" };
const doc2 = { id: 'doc2', text: 'Don\'t shoot shoot shoot that thing at me.' };
const doc3 = { id: 'doc3', text: "I'm your shooter." };
const docs = [doc1, doc2, doc3];

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
  assert.deepEqual(tokenize('Don\'t shoot shoot shoot that thing at me.'), [
    'dont', 'shoot', 'shoot', 'shoot', 'that', 'thing', 'at', 'me',
  ]);
});

test('поиск по терму без учёта регистра и знаков препинания', () => {
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
