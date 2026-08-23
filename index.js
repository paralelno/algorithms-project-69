/**
 * Поисковый движок.
 *
 * Обработка текста (шаг 1): текст режется на токены по пробелам и переводам
 * строк, из каждого токена оставляем только «словесные» символы (\w),
 * склеиваем их в один терм, приводим к нижнему регистру. Если от токена
 * ничего не осталось — выбрасываем.
 *
 * Правило одно на весь проект и применяется и к документам, и к запросам.
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
 * Поисковый движок.
 *
 * Шаг 1: поиск по одному терму, независимый от знаков препинания и регистра.
 * Результаты ранжируются по частоте вхождения терма в документе
 * (документ, в котором терма больше, идёт раньше).
 *
 * @param {Array<{id: string, text: string}>} docs
 * @param {string} query
 * @returns {string[]} id найденных документов, отсортированных по релевантности
 */
const search = (docs, query) => {
  const terms = tokenize(query);
  if (terms.length === 0) return [];

  const wanted = terms[0];

  const found = [];
  for (const doc of docs) {
    const docTerms = tokenize(doc.text);
    const frequency = docTerms.reduce(
      (count, term) => (term === wanted ? count + 1 : count),
      0,
    );
    if (frequency > 0) {
      found.push({ id: doc.id, frequency });
    }
  }

  found.sort((a, b) => b.frequency - a.frequency);
  return found.map((d) => d.id);
};

export { normalizeToken, tokenize, search };
export default search;
