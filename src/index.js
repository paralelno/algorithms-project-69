/**
 * Поисковый движок (обратный индекс + ранжирование TF-IDF).
 *
 * Обработка текста: текст режется на токены по пробелам и переводам строк,
 * из каждого токена оставляем только «словесные» символы (\w), склеиваем в
 * один терм, приводим к нижнему регистру; пустые термы выбрасываем. Правило
 * одно и применяется и к документам, и к запросу.
 *
 * Обратный индекс: строится один раз по всем документам — «терм -> документы».
 * Ключ — нормализованный терм; поиск идёт по индексу, а не по текстам.
 *
 * TF-IDF — метрика ранжирования:
 *   tf(терм, док) = вхождений терма в документе / всего термов в документе
 *   df(терм)      = в скольких документах встречается терм
 *   idf(терм)     = log2(1 + (N - df(терм) + 1) / (df(терм) + 0.5))
 *   вес(док)      = сумма tf * idf по термам запроса, которые есть в документе
 * Документы сортируются по весу по убыванию; документ, в котором нет ни
 * одного терма запроса, в результат не попадает.
 *
 * Наружу смотрит одна функция: search(docs, query) -> массив id документов.
 */

const WORD_CHARS = /\w+/g;

// Нормализует один токен в терм: pint! -> pint, can't -> cant, alpha-beta -> alphabeta.
const normalizeToken = (token) => {
  const matched = String(token).match(WORD_CHARS);
  return matched ? matched.join('').toLowerCase() : null;
};

// Разбивает текст на токены (пробелы, переводы строк) и приводит к термам.
const tokenize = (text) => String(text)
  .split('\n')
  .flatMap((line) => line.split(' '))
  .map(normalizeToken)
  .filter((term) => term !== null);

// Частоты термов в одном документе: { терм: вхождений }.
const countTerms = (terms) => terms.reduce((acc, term) => {
  const value = acc[term] || 0;
  acc[term] = value + 1;
  return acc;
}, {});

// Обратно-документальная частота (формула зафиксирована заданием).
const inverseDocFrequency = (docCount, termDocCount) => Math.log2(
  1 + (docCount - termDocCount + 1) / (termDocCount + 0.5),
);

// Обратный индекс: { терм: [{ docId, tfIdf }] }.
const buildIndex = (docs) => {
  const docTerms = docs.reduce((acc, doc) => {
    acc[doc.id] = tokenize(doc.text);
    return acc;
  }, {});

  const perDoc = docs.map((doc) => {
    const terms = docTerms[doc.id];
    const freqs = countTerms(terms);
    const total = terms.length;
    return Object.keys(freqs).map((term) => ({
      term,
      docId: doc.id,
      termFrequency: total === 0 ? 0 : freqs[term] / total,
    }));
  });

  const all = perDoc.reduce((acc, list) => acc.concat(list), []);
  return all.reduce((acc, entry) => {
    const existing = acc[entry.term] || [];
    acc[entry.term] = existing.concat([entry]);
    return acc;
  }, {});
};

/**
 * @param {Array<{id: string, text: string}>} docs
 * @param {string} query — одно или несколько слов
 * @returns {string[]} id найденных документов, отсортированных по весу TF-IDF
 */
const search = (docs, query) => {
  const docCount = docs.length;
  const index = buildIndex(docs);

  const queryTerms = tokenize(query);
  const chosen = queryTerms.reduce((acc, term) => {
    if (!index[term]) return acc;
    const termDocs = index[term];
    return acc.concat(termDocs.map((e) => ({
      docId: e.docId,
      tfIdf: e.termFrequency * inverseDocFrequency(docCount, termDocs.length),
    })));
  }, []);

  const weights = chosen.reduce((acc, entry) => {
    const sum = acc[entry.docId] || 0;
    acc[entry.docId] = sum + entry.tfIdf;
    return acc;
  }, {});

  return Object.keys(weights).sort((a, b) => weights[b] - weights[a]);
};

export default search;
