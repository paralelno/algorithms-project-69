/**
 * Поисковый движок.
 *
 * Обработка текста (шаг 1): текст режется на токены по пробелам и переводам
 * строк, из каждого токена оставляем только «словесные» символы (\w),
 * склеиваем их в один терм, приводим к нижнему регистру. Если от токена
 * ничего не осталось — выбрасываем. Правило одно на весь проект и применяется
 * и к документам, и к запросам.
 *
 * Релевантность (шаг 2): вес документа = число вхождений искомого терма в
 * его текст. Документы сортируются по весу по убыванию, документы без терма
 * не попадают в результат. Метрика вынесена в отдельную функцию relevance,
 * чтобы в следующих шагах (нечёткий поиск, TF-IDF) её можно было заменить
 * правкой одной функции, а не всей сортировки.
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
 * Релевантность документа по одному терму: число вхождений терма в текст.
 * Это метрика шага 2; в шаге «TF-IDF» будет заменена другой формулой.
 */
const relevance = (doc, term) =>
  tokenize(doc.text).reduce((count, t) => (t === term ? count + 1 : count), 0);

/**
 * Поисковый движок.
 *
 * @param {Array<{id: string, text: string}>} docs
 * @param {string} query
 * @returns {string[]} id найденных документов, отсортированных по релевантности
 */
const search = (docs, query) => {
  const terms = tokenize(query);
  if (terms.length === 0) return [];

  const wanted = terms[0];

  return docs
    .map((doc) => ({ id: doc.id, weight: relevance(doc, wanted) }))
    .filter((doc) => doc.weight > 0)
    .sort((a, b) => b.weight - a.weight)
    .map((doc) => doc.id);
};

export { normalizeToken, tokenize, relevance, search };
export default search;
