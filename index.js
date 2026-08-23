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
 * Документы сортируются по весу по убыванию, документы без терма — в результат
 * не попадают.
 *
 * Нечёткий поиск (шаг 3): запрос — строка из любого числа слов. Документ
 * попадает в результат, если в нём есть хотя бы один терм запроса (совпадение
 * всех слов не требуется). Термы запроса, которых нет ни в одном документе,
 * игнорируются. Сортировка в два ключа: сначала по количеству РАЗНЫХ термов
 * запроса, найденных в документе, затем по сумме их вхождений.
 *
 * Метрика relevance — единственная, которую заменяет шаг «TF-IDF».
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
 * Поисковый движок.
 *
 * @param {Array<{id: string, text: string}>} docs
 * @param {string} query — одно или несколько слов
 * @returns {string[]} id найденных документов, отсортированных по релевантности
 */
const search = (docs, query) => {
  const queryTerms = tokenize(query);
  if (queryTerms.length === 0) return [];

  return docs
    .map((doc) => {
      const { matched, total } = relevance(doc, queryTerms);
      return { id: doc.id, matched, total };
    })
    .filter((doc) => doc.matched > 0)
    .sort((a, b) => (b.matched - a.matched) || (b.total - a.total))
    .map((doc) => doc.id);
};

export { normalizeToken, tokenize, relevance, search };
export default search;
