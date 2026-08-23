/**
 * Поисковый движок.
 *
 * Обработка текста (шаг 1): текст режется на токены по пробелам и переводам
 * строк, из каждого токена оставляем только «словесные» символы (\w),
 * склеиваем их в один терм, приводим к нижнему регистру. Если от токена
 * ничего не осталось — выбрасываем. Правило одно на весь проект и применяется
 * и к документам, и к запросам.
 *
 * Обратный индекс (шаг 4): индекс строится один раз — «слово -> документы».
 * Ключ — нормализованный терм, значение — список пар {id, count}: в каких
 * документах встречается терм и сколько раз (count — для релевантности).
 *
 * TF-IDF (шаг 5): метрика ранжирования, заменяющая подсчёт вхождений шагов 2–3.
 * Учитывает длину документа (tf) и редкость слова (idf):
 *   tf(терм, док)  = вхошений терма в документе / всего термов в документе
 *   df(терм)       = в скольких документах встречается терм
 *   idf(терм)      = log2(1 + (N - df(терм) + 1) / (df(терм) + 0.5))
 *   вес(документ)  = сумма tf * idf по термам запроса, которые есть в документе
 * Документы сортируются по весу по убыванию; документ, в котором нет ни одного
 * терма запроса, в результат не попадает. Формула idf берётся именно в этом
 * виде (всегда положительная, иначе документ с «мусорным» словом выпал бы).
 *
 * Сигнатура search(docs, query) и формат результата (массив id) не меняются.
 */

const WORD_CHARS = /\w+/g;

/**
 * Нормализует один токен в терм:
 *   pint!       -> pint
 *   TRASH       -> trash
 *   can't       -> cant
 *   I've        -> ive
 *   alpha-beta  -> alphabeta
 *   —           -> ''   (выбрасывается)
 */
const normalizeToken = (token) => {
  const matches = String(token).match(WORD_CHARS);
  if (!matches) return '';
  return matches.join('').toLowerCase();
};

/**
 * Разбивает текст на токены (пробелы и переводы строк) и приводит каждый
 * к терму. Пустые термы выбрасываются.
 */
const tokenize = (text) => {
  if (text == null) return [];
  return String(text)
    .split(/\s+/)
    .map(normalizeToken)
    .filter((term) => term.length > 0);
};

/**
 * Обратный индекс: { терм: [{id, count}, ...] }. Строится один раз.
 */
const buildIndex = (docs) => {
  const index = {};
  for (const doc of docs) {
    const counts = {};
    for (const term of tokenize(doc.text)) {
      counts[term] = (counts[term] || 0) + 1;
    }
    for (const [term, count] of Object.entries(counts)) {
      if (!index[term]) index[term] = [];
      index[term].push({ id: doc.id, count });
    }
  }
  return index;
};

/**
 * Частота терма в документе: вхошений / всего термов в документе.
 */
const tf = (term, doc) => {
  const docTerms = tokenize(doc.text);
  if (docTerms.length === 0) return 0;
  const count = docTerms.reduce((n, t) => (t === term ? n + 1 : n), 0);
  return count / docTerms.length;
};

/**
 * Обратно-документальная частота. Формула зафиксирована заданием:
 * idf(терм) = log2(1 + (N - df(терм) + 1) / (df(терм) + 0.5)).
 * Всегда положительна, в отличие от классического log(N / df).
 */
const idf = (term, index, totalDocs) => {
  const df = index[term] ? index[term].length : 0;
  return Math.log2(1 + (totalDocs - df + 1) / (df + 0.5));
};

/**
 * Вес документа по TF-IDF: сумма tf * idf по термам запроса, которые есть
 * в документе. Это метрика ранжирования (шаг 5).
 */
const relevance = (doc, queryTerms, index, totalDocs) => {
  let weight = 0;
  for (const term of queryTerms) {
    const t = tf(term, doc);
    if (t > 0) weight += t * idf(term, index, totalDocs);
  }
  return weight;
};

/**
 * Поисковый движок (по обратному индексу, ранжирование TF-IDF).
 *
 * @param {Array<{id: string, text: string}>} docs
 * @param {string} query — одно или несколько слов
 * @returns {string[]} id найденных документов, отсортированных по весу TF-IDF
 */
const search = (docs, query) => {
  const queryTerms = [...new Set(tokenize(query))];
  if (queryTerms.length === 0) return [];

  const totalDocs = docs.length;
  const index = buildIndex(docs);

  return docs
    .map((doc) => ({ id: doc.id, weight: relevance(doc, queryTerms, index, totalDocs) }))
    .filter((doc) => doc.weight > 0)
    .sort((a, b) => b.weight - a.weight)
    .map((doc) => doc.id);
};

export { normalizeToken, tokenize, buildIndex, tf, idf, relevance, search };
export default search;
