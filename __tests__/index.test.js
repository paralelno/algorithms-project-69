import search from '../src/index.js';

const docs = [
  { id: 'doc1', text: "I can't shoot straight unless I've had a pint!" },
  { id: 'doc2', text: "Don't shoot shoot shoot that thing at me." },
  { id: 'doc3', text: "I'm your shooter." },
];

describe('поиск по обработанному тексту', () => {
  it('находит документ по одному терму', () => {
    expect(search([docs[1]], 'shoot')).toEqual(['doc2']);
  });

  it('ничего не находит, если ни одного терма нет', () => {
    expect(search(docs, 'completely unrelated words')).toEqual([]);
  });

  it('нормализует регистр, пунктуацию и дефисы', () => {
    expect(search([{ id: 'a', text: 'PINT pint Pint' }], 'pint')).toEqual(['a']);
    expect(search([{ id: 'a', text: 'can\'t' }], 'cant')).toEqual(['a']);
    expect(search([{ id: 'a', text: 'alpha-beta' }], 'alphabeta')).toEqual(['a']);
  });

  it('пустой запрос и пустой список -> пустой результат', () => {
    expect(search(docs, '')).toEqual([]);
    expect(search([], 'anything')).toEqual([]);
  });
});

describe('нечёткий поиск по нескольким словам', () => {
  it('собирает документы, где есть хотя бы один терм', () => {
    expect(search(docs, 'shoot at me')).toEqual(['doc2', 'doc1']);
  });

  it('терм без совпадений не ломает поиск', () => {
    expect(search(docs, 'shoot at me, nerd')).toEqual(['doc2', 'doc1']);
  });
});

describe('ранжирование по TF-IDF', () => {
  it('документ с большим tf (больше вхождений терма) выше', () => {
    const a = { id: 'a', text: 'search search search' };
    const b = { id: 'b', text: 'search filler' };
    expect(search([a, b], 'search')).toEqual(['a', 'b']);
  });

  it('документы, где нет ни одного терма, выпадают из выдачи', () => {
    const d1 = { id: 'd1', text: 'omega' };
    const d2 = { id: 'd2', text: 'omega alpha' };
    const d3 = { id: 'd3', text: 'alpha beta gamma' };
    expect(search([d1, d2, d3], 'alpha')).toEqual(['d2', 'd3']);
  });
});
