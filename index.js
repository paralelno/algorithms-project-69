/**
 * Поисковый движок.
 *
 * Обработка текста (шаг 1): текст режется на токены по пробелам и переводам
 * строк, из каждого токена оставляем только «словесные» символы (\w),
 * склеиваем их в один терм, приводим к нижнему регистру. Если от токена
 * ничего не осталось — выбрасываем. Правило одно на весь проект и применяется
 * и к документам, и к запросам.
 *
 * Релевантность (шаг 2): вес документа = число вхождений искомого терма.
 * Нечёткий поиск (шаг 3): запрос — строка из любого числа слов; документ
 * попадает в результат, если в нём есть хотя бы один терм запроса; сортировка
 * в два ключа — количество РАЗНЫХ термов запроса, затем сумма вхождений.
 *
 * Обратный индекс (шаг 4): индекс строится один раз по всем документам —
 * «слово -> документы» (раньше было «документы -> слова»). Ключ — нормализованный
 * терм, значение — список пар {id, count}: в каких документах встречается терм
 * и сколько раз (count нужен для релевантности, тогда текст документа не
 * обходим второй раз). Поиск идёт по индексу, сигнатура search(docs, query)
 * и результаты не меняются.
 *
 * Метрика relevance — единственная, которую заменит шаг «TF-IDF».
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
 * Обратный индекс: { терм: [{id, count}, ...] }.
 * Строится один раз по всем документам. Порядок документов внутри ключа
 * не важен (ранжирование происходит на выдаче).
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
 * Релевантность документа к набору термов запроса:
 *   matched — сколько РАЗНЫХ термов запроса нашлось в документе,
 *   total   — сумма их вхождений в документе.
 *
 * Метрика шага 2 (одно слово) и шага 3 (несколько слов); в шаге «TF-IDF»
 * заменится другой формулой.
 */
const relevance = (doc, queryTerms) => {
  const wanted = new Set(queryTerms);
  const seen = new Set();
  let total = 0;
  for (const term of tokenize(doc.text)) {
    if (wanted.has(term)) {
      total += 1;
      seen.add(term);
    }
  }
  return { matched: seen.size, total };
};

/**
 * Поисковый движок (по обратному индексу).
 *
 * @param {Array<{id: string, text: string}>} docs
 * @param {string} query — одно или несколько слов
 * @returns {string[]} id найденных документов, отсортированных по релевантности
 */
const search = (docs, query) => {
  const queryTerms = [...new Set(tokenize(query))];
  if (queryTerms.length === 0) return [];

  const index = buildIndex(docs);

  // Агрегируем по индексу: сколько разных термов запроса и сумма вхождений
  const scores = {};
  for (const term of queryTerms) {
    const entries = index[term];
    if (!entries) continue; // терм ни в одном документе — игнорируем
    for (const { id, count } of entries) {
      if (!scores[id]) scores[id] = { matched: 0, total: 0 };
      scores[id].matched += 1;
      scores[id].total += count;
    }
  }

  return Object.entries(scores)
    .map(([id, score]) => ({ id, ...score }))
    .filter((doc) => doc.matched > 0)
    .sort((a, b) => (b.matched - a.matched) || (b.total - a.total))
    .map((doc) => doc.id);
};

export { normalizeToken, tokenize, buildIndex, relevance, search };
export default search;
