export const TUITION_CATEGORIES = [
  { id: 'academics', label: 'Academics', emoji: '▣' },
  { id: 'dance', label: 'Dance', emoji: '♫' },
  { id: 'art', label: 'Art', emoji: '◐' },
  { id: 'drawing', label: 'Drawing', emoji: '✎' },
  { id: 'music', label: 'Music', emoji: '♪' },
  { id: 'sports', label: 'Sports', emoji: '⚡' },
  { id: 'coding', label: 'Coding', emoji: '{ }' },
  { id: 'languages', label: 'Languages', emoji: 'Aa' },
  { id: 'craft', label: 'Craft & DIY', emoji: '✂' },
  { id: 'theatre', label: 'Theatre', emoji: '★' },
];

const CATEGORY_MAP = Object.fromEntries(TUITION_CATEGORIES.map((c) => [c.id, c]));

export function getCategoryMeta(id) {
  return CATEGORY_MAP[id] || { id, label: id, emoji: '•' };
}

export function getCategoryLabel(id) {
  return getCategoryMeta(id).label;
}

export function inferCategoriesFromSubjects(subjects = []) {
  const hay = subjects.join(' ').toLowerCase();
  const found = new Set();
  const rules = [
    { id: 'academics', keys: ['physics', 'chemistry', 'math', 'algebra', 'science', 'biology', 'exam', 'board'] },
    { id: 'dance', keys: ['dance', 'classical', 'bollywood', 'contemporary', 'hip-hop', 'bharatanatyam'] },
    { id: 'art', keys: ['art', 'painting', 'fine art', 'canvas', 'watercolor'] },
    { id: 'drawing', keys: ['drawing', 'sketch', 'illustration', 'cartoon', 'portrait'] },
    { id: 'music', keys: ['music', 'vocal', 'guitar', 'piano', 'violin', 'singing'] },
    { id: 'sports', keys: ['sport', 'cricket', 'football', 'swimming', 'badminton', 'fitness'] },
    { id: 'coding', keys: ['coding', 'programming', 'python', 'robotics', 'java', 'web dev'] },
    { id: 'languages', keys: ['english', 'hindi', 'french', 'spanish', 'language', 'ielts'] },
    { id: 'craft', keys: ['craft', 'pottery', 'diy', 'handmade', 'sculpture'] },
    { id: 'theatre', keys: ['theatre', 'theater', 'drama', 'acting', 'stage'] },
  ];
  for (const rule of rules) {
    if (rule.keys.some((k) => hay.includes(k))) found.add(rule.id);
  }
  return found.size ? [...found] : ['academics'];
}

export function renderCategoryChips(activeId = '') {
  const all = [{ id: '', label: 'All', emoji: '◎' }, ...TUITION_CATEGORIES];
  return `
    <div class="tuition-category-chips" id="tuitionCategoryFilters" role="tablist" aria-label="Tuition categories">
      ${all.map((c) => `
        <button
          type="button"
          class="tuition-cat-chip${activeId === c.id ? ' active' : ''}"
          data-category="${c.id}"
          role="tab"
          aria-selected="${activeId === c.id}"
        >${c.emoji ? `<span class="tuition-cat-emoji">${c.emoji}</span>` : ''}${c.label}</button>`).join('')}
    </div>`;
}

export function renderCategoryBadges(categoryIds = []) {
  if (!categoryIds.length) return '';
  return categoryIds.map((id) => {
    const c = getCategoryMeta(id);
    return `<span class="badge badge-gray tuition-cat-badge">${c.emoji} ${c.label}</span>`;
  }).join('');
}
