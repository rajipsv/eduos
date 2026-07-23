import { getCenters, saveLead, getBranches, getDefaultBranch } from './store.js';
import {
  getSession, getCurrentUser, getEffectiveRole,
  getLinkedStudentId, getLinkedStudentIds,
} from './auth.js';
import {
  TUITION_CATEGORIES,
  inferCategoriesFromSubjects,
  renderCategoryChips,
  renderCategoryBadges,
  getCategoryLabel,
} from './tuition-categories.js';

export const TUITION_PENDING_KEY = 'tuition_pending_center';
export const TUITION_OPEN_KEY = 'tuition_open_center';
export const TUITION_PAGE_SIZE = 6;
export const TUITION_PAGE_STEP = 6;

export function canSendTuitionInquiry() {
  const role = getEffectiveRole();
  return role === 'student' || role === 'parent';
}

function rawByCenter(arr, centerId) {
  return (arr || []).filter((x) => x.centerId === centerId);
}

function getCenterStats(centerId, rawState) {
  return {
    teachers: rawByCenter(rawState?.teachers, centerId).length,
    students: rawByCenter(rawState?.students, centerId).length,
    batches: rawByCenter(rawState?.batches, centerId).length,
  };
}

export function enrichCenterListing(center, rawState) {
  const batches = rawByCenter(rawState?.batches, center.id);
  const fromBatches = [...new Set(
    batches.flatMap((b) => [...(b.subjects || []), ...(b.topics || [])].filter(Boolean)),
  )];
  const stats = getCenterStats(center.id, rawState || {});
  const subjects = center.publicSubjects?.length ? center.publicSubjects : fromBatches.slice(0, 8);
  const categories = center.categories?.length ? center.categories : inferCategoriesFromSubjects(subjects);

  return {
    ...center,
    ...stats,
    subjects,
    categories,
    tagline: center.publicTagline || `Expert tutoring in ${center.city || 'your city'}`,
    rating: center.rating ?? 4.5,
    reviewCount: center.reviewCount ?? 0,
  };
}

export function getListedCenters(rawState) {
  return getCenters()
    .filter((c) => c.status !== 'suspended' && c.listingEnabled !== false)
    .map((c) => enrichCenterListing(c, rawState));
}

function getEnrolledCenterIds(rawState) {
  const session = getSession();
  const ids = new Set();
  const role = getEffectiveRole();

  if (role === 'student') {
    const sid = getLinkedStudentId();
    const student = rawState?.students?.find((s) => s.id === sid);
    if (student?.centerId) ids.add(student.centerId);
    else if (session?.centerId) ids.add(session.centerId);
  }

  if (role === 'parent') {
    const childIds = getLinkedStudentIds();
    for (const cid of childIds) {
      const student = rawState?.students?.find((s) => s.id === cid);
      if (student?.centerId) ids.add(student.centerId);
    }
    if (!ids.size && session?.centerId) ids.add(session.centerId);
  }

  return ids;
}

function enrolledBadge(centerId, rawState) {
  const ids = getEnrolledCenterIds(rawState);
  if (!ids.has(centerId)) return '';
  const role = getEffectiveRole();
  if (role === 'parent') {
    return '<span class="badge badge-green" style="margin-left:6px">Your child enrolled here</span>';
  }
  return '<span class="badge badge-green" style="margin-left:6px">Your center</span>';
}

function tuitionCard(listing, rawState) {
  const subjectLine = listing.subjects.length
    ? listing.subjects.slice(0, 4).join(', ')
    : 'Multiple programs';
  const catBadges = renderCategoryBadges(listing.categories?.slice(0, 3) || []);
  return `
    <div class="batch-card" data-tuition-card="${listing.id}" data-search="${[
      listing.name,
      listing.city,
      ...listing.subjects,
      ...(listing.categories || []).map(getCategoryLabel),
    ].join(' ').toLowerCase()}">
      <div class="meta">${listing.city || '—'} · ★ ${listing.rating} (${listing.reviewCount} reviews)</div>
      <h4>${listing.name}${enrolledBadge(listing.id, rawState)}</h4>
      <div class="tuition-card-cats">${catBadges}</div>
      <p style="font-size:0.82rem;color:var(--text-muted);margin:8px 0">${listing.tagline}</p>
      <p style="font-size:0.78rem;color:var(--text-muted)">${subjectLine}</p>
      <div class="meta" style="margin-top:8px">${listing.batches} batch(es) · ${listing.teachers} teacher(s)</div>
      <button class="btn btn-sm btn-primary" style="margin-top:10px" data-action="tuition-view" data-id="${listing.id}">View details</button>
    </div>`;
}

function sortListings(listings, rawState) {
  const enrolled = getEnrolledCenterIds(rawState);
  return [...listings].sort((a, b) => {
    const aEn = enrolled.has(a.id) ? 1 : 0;
    const bEn = enrolled.has(b.id) ? 1 : 0;
    if (aEn !== bEn) return bEn - aEn;
    if (a.featured !== b.featured) return (b.featured ? 1 : 0) - (a.featured ? 1 : 0);
    if (b.rating !== a.rating) return b.rating - a.rating;
    return (b.reviewCount || 0) - (a.reviewCount || 0);
  });
}

function hasActiveFilters({ q = '', city = '', subject = '', category = '' } = {}) {
  return Boolean(q.trim() || city || subject || category);
}

function filterListings(listings, { q = '', city = '', subject = '', category = '' } = {}) {
  const query = q.trim().toLowerCase();
  return listings.filter((l) => {
    if (category && !(l.categories || []).includes(category)) return false;
    if (city && (l.city || '').toLowerCase() !== city.toLowerCase()) return false;
    if (subject && !l.subjects.some((s) => s.toLowerCase().includes(subject.toLowerCase()))) return false;
    if (!query) return true;
    const hay = [
      l.name,
      l.city,
      l.tagline,
      ...l.subjects,
      ...(l.categories || []).map(getCategoryLabel),
    ].join(' ').toLowerCase();
    return hay.includes(query);
  });
}

function pagerHtml({ shown, total, filtering }) {
  if (!total) {
    return '<p class="tuition-pager-note empty-state">No centers match your search. Try another city or subject.</p>';
  }
  if (shown >= total) {
    return `<p class="tuition-pager-note">Showing all <strong>${total}</strong> matching center${total === 1 ? '' : 's'}</p>`;
  }
  const hint = filtering
    ? 'Refine search or load more results below.'
    : `${total} centers on EduOS — search by city or subject, or load more.`;
  return `
    <p class="tuition-pager-note">Showing <strong>${shown}</strong> of <strong>${total}</strong> centers · ${hint}</p>
    <button type="button" class="btn btn-secondary btn-sm" data-action="tuition-load-more">Show more centers</button>`;
}

function getFilterValues() {
  return {
    q: document.getElementById('tuitionSearch')?.value || '',
    city: document.getElementById('tuitionCityFilter')?.value || '',
    subject: document.getElementById('tuitionSubjectFilter')?.value || '',
    category: document.querySelector('.tuition-cat-chip.active')?.dataset.category || '',
  };
}

function syncCategoryChips(activeId) {
  const wrap = document.getElementById('tuitionCategoryFilters');
  if (!wrap) return;
  wrap.querySelectorAll('.tuition-cat-chip').forEach((btn) => {
    const on = btn.dataset.category === activeId;
    btn.classList.toggle('active', on);
    btn.setAttribute('aria-selected', on ? 'true' : 'false');
  });
}

function cityOptions(listings) {
  const cities = [...new Set(listings.map((l) => l.city).filter(Boolean))].sort();
  return cities.map((c) => `<option value="${c}">${c}</option>`).join('');
}

function subjectOptions(listings) {
  const subjects = [...new Set(listings.flatMap((l) => l.subjects))].sort();
  return subjects.map((s) => `<option value="${s}">${s}</option>`).join('');
}

export function renderTuitionMarketplace(rawState, options = {}) {
  const { publicHome = false } = options;
  const listings = sortListings(getListedCenters(rawState), rawState);
  const cities = [...new Set(listings.map((l) => l.city).filter(Boolean))];
  const categoryCount = new Set(listings.flatMap((l) => l.categories || [])).size;
  const initial = listings.slice(0, TUITION_PAGE_SIZE);

  const banner = publicHome ? '' : `
    <div class="vision-banner">
      <h3>Tuition Marketplace</h3>
      <p>Search tuition centers on EduOS — academics, dance, art, music, sports, coding, and more.</p>
    </div>`;

  return `
    ${banner}
    <div class="stats-grid tuition-stats">
      <div class="stat-card"><div class="label">Centers on platform</div><div class="value">${listings.length}</div></div>
      <div class="stat-card"><div class="label">Categories</div><div class="value">${categoryCount || TUITION_CATEGORIES.length}</div></div>
      <div class="stat-card"><div class="label">Cities</div><div class="value">${cities.length}</div></div>
    </div>
    ${renderCategoryChips('')}
    <div class="tuition-search-panel">
      <label class="tuition-search-label" for="tuitionSearch">Refine your search</label>
      <div class="toolbar tuition-toolbar">
        <input id="tuitionSearch" type="search" placeholder="Search name, city, program…" autocomplete="off">
        <select id="tuitionCityFilter" aria-label="Filter by city"><option value="">All cities</option>${cityOptions(listings)}</select>
        <select id="tuitionSubjectFilter" aria-label="Filter by program"><option value="">All programs</option>${subjectOptions(listings)}</select>
      </div>
    </div>
    <div class="card-grid" id="tuitionGrid">${initial.length
    ? initial.map((l) => tuitionCard(l, rawState)).join('')
    : '<p class="empty-state">No tuition centers available right now.</p>'}</div>
    <div class="tuition-pager" id="tuitionPager">${pagerHtml({
    shown: initial.length,
    total: listings.length,
    filtering: false,
  })}</div>`;
}

function inquiryFormHtml(listing, rawState) {
  const role = getEffectiveRole();
  const user = getCurrentUser();
  const session = getSession();
  const branchField = branchPickerHtml(listing.id);

  if (role === 'parent') {
    const childIds = getLinkedStudentIds();
    const children = (rawState?.students || []).filter((s) => childIds.includes(s.id));
    return `
      <div class="form-grid">
        ${branchField}
        <div class="form-group"><label>Child</label>
          <select id="tmChild">${children.map((s) => `<option value="${s.id}">${s.name} · Grade ${s.grade || '—'}</option>`).join('') || '<option value="">No linked child</option>'}
          </select>
        </div>
        <div class="form-group"><label>Your name</label><input id="tmName" value="${user?.parentName || user?.name || ''}"></div>
        <div class="form-group"><label>Email</label><input id="tmEmail" value="${user?.email || ''}"></div>
        <div class="form-group full"><label>Message</label><textarea id="tmMessage" rows="3" placeholder="Tell ${listing.name} what you are looking for…"></textarea></div>
      </div>`;
  }

  const sid = getLinkedStudentId();
  const student = rawState?.students?.find((s) => s.id === sid) || getStudentsFallback(rawState, session);
  return `
    <div class="form-grid">
      ${branchField}
      <div class="form-group"><label>Your name</label><input id="tmName" value="${student?.name || user?.name || ''}"></div>
      <div class="form-group"><label>Email</label><input id="tmEmail" value="${user?.email || ''}"></div>
      <div class="form-group"><label>Grade</label><input id="tmGrade" value="${student?.grade || ''}"></div>
      <div class="form-group full"><label>Message</label><textarea id="tmMessage" rows="3" placeholder="Tell ${listing.name} what you are looking for…"></textarea></div>
    </div>`;
}

function getStudentsFallback(rawState, session) {
  if (!session?.centerId) return null;
  return (rawState?.students || []).find((s) => s.centerId === session.centerId);
}

function branchPickerHtml(centerId) {
  const branches = getBranches(centerId);
  if (branches.length <= 1) return '';
  const defaultId = getDefaultBranch(centerId)?.id || branches[0]?.id;
  return `
    <div class="form-group">
      <label>Preferred branch</label>
      <select id="tmBranch">${branches.map((b) =>
    `<option value="${b.id}"${b.id === defaultId ? ' selected' : ''}>${b.name}${b.city ? ` · ${b.city}` : ''}</option>`,
  ).join('')}</select>
    </div>`;
}

function resolveInquiryBranchId(listing, rawState, role) {
  const picked = document.getElementById('tmBranch')?.value;
  if (picked) return picked;

  if (role === 'student') {
    const sid = getLinkedStudentId();
    const student = rawState?.students?.find((s) => s.id === sid);
    if (student?.branchId) return student.branchId;
  }

  if (role === 'parent') {
    const childId = document.getElementById('tmChild')?.value;
    const child = rawState?.students?.find((s) => s.id === childId);
    if (child?.branchId) return child.branchId;
  }

  return getDefaultBranch(listing.id)?.id || null;
}

function guestInquiryFormHtml(listing) {
  return `
    <div class="panel">
      <div class="panel-header"><h3>Send inquiry</h3></div>
      <div class="panel-body">
        <p style="font-size:0.88rem;color:var(--text-muted);line-height:1.6;margin-bottom:14px">No sign-in needed. Tell <strong>${listing.name}</strong> what you are looking for — they will contact you to schedule a demo and complete enrollment.</p>
        <div class="form-grid">
          ${branchPickerHtml(listing.id)}
          <div class="form-group"><label>Your name</label><input id="tmName" placeholder="Parent or guardian name" autocomplete="name"></div>
          <div class="form-group"><label>Mobile</label><input id="tmPhone" type="tel" placeholder="10-digit mobile" autocomplete="tel"></div>
          <div class="form-group"><label>Email</label><input id="tmEmail" type="email" placeholder="you@email.com" autocomplete="email"></div>
          <div class="form-group"><label>Child name</label><input id="tmChildName" placeholder="Student name (optional)"></div>
          <div class="form-group"><label>Grade</label><input id="tmGrade" placeholder="8, 9, 10…"></div>
          <div class="form-group full"><label>Message</label><textarea id="tmMessage" rows="3" placeholder="Programs interested in, preferred timing…"></textarea></div>
        </div>
        <button class="btn btn-primary" style="margin-top:12px" data-action="tuition-inquire" data-id="${listing.id}">Send inquiry</button>
        <p style="font-size:0.78rem;color:var(--text-muted);margin-top:12px">Already enrolled? <button type="button" class="btn btn-ghost btn-sm" data-action="tuition-login" data-portal="family" data-id="${listing.id}">Family sign in</button></p>
      </div>
    </div>`;
}

function inquiryBlockHtml(listing, rawState) {
  if (canSendTuitionInquiry()) {
    return `<div class="panel">
      <div class="panel-header"><h3>Send inquiry</h3></div>
      <div class="panel-body">
        ${inquiryFormHtml(listing, rawState)}
        <button class="btn btn-primary" style="margin-top:12px" data-action="tuition-inquire" data-id="${listing.id}">Send inquiry</button>
      </div>
    </div>`;
  }
  return guestInquiryFormHtml(listing);
}

function centerDetailHtml(listing, rawState) {
  const subjects = listing.subjects.length
    ? listing.subjects.map((s) => `<span class="badge badge-gray" style="margin:0 6px 6px 0">${s}</span>`).join('')
    : '<span class="badge badge-gray">General programs</span>';
  const categories = renderCategoryBadges(listing.categories || []);

  const inquiryBlock = inquiryBlockHtml(listing, rawState);

  return `
    <div class="panel" style="margin-bottom:16px">
      <div class="panel-header">
        <h3>${listing.name}</h3>
        <span class="badge badge-green">${listing.status || 'active'}</span>
      </div>
      <div class="panel-body">
        <p style="font-size:0.88rem;line-height:1.7">${listing.tagline}</p>
        <p style="font-size:0.84rem;margin-top:10px"><strong>${listing.city || '—'}</strong> · ★ ${listing.rating} (${listing.reviewCount} reviews) · Joined ${listing.createdAt || '—'}</p>
        ${listing.phone ? `<p style="font-size:0.84rem;margin-top:6px"><strong>Phone:</strong> ${listing.phone}</p>` : ''}
        ${categories ? `<div style="margin-top:12px">${categories}</div>` : ''}
        <div style="margin-top:12px"><strong style="font-size:0.82rem">Programs:</strong><br>${subjects}</div>
        <div class="stats-grid" style="margin-top:16px">
          <div class="stat-card"><div class="label">Batches</div><div class="value">${listing.batches}</div></div>
          <div class="stat-card"><div class="label">Teachers</div><div class="value">${listing.teachers}</div></div>
          <div class="stat-card"><div class="label">Students</div><div class="value">${listing.students}</div></div>
        </div>
      </div>
    </div>
    ${inquiryBlock}`;
}

function bindDetailModalActions(listing, rawState, ctx) {
  const { closeModal, toast, onLoginRequest } = ctx;

  document.querySelector('[data-action="tuition-inquire"]')?.addEventListener('click', () => {
    submitInquiry(listing, rawState, toast, closeModal);
  });

  document.querySelectorAll('[data-action="tuition-login"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      closeModal?.();
      onLoginRequest?.(btn.dataset.portal, btn.dataset.id || listing.id);
    });
  });
}

function openCenterModal(listing, rawState, ctx) {
  const { showModal, closeModal } = ctx;
  if (!listing || !showModal) return;
  showModal({
    title: listing.name,
    body: centerDetailHtml(listing, rawState),
    footer: '<button class="btn btn-secondary" data-modal-cancel>Close</button>',
    wide: true,
    onMount: () => bindDetailModalActions(listing, rawState, ctx),
  });
}

export function bindTuitionMarketplaceEvents(ctx) {
  const { showModal, closeModal, toast, rawState, onLoginRequest } = ctx;
  const modalCtx = { showModal, closeModal, toast, rawState, onLoginRequest };
  let displayCount = TUITION_PAGE_SIZE;

  const bindViewButtons = () => {
    const listings = getListedCenters(rawState);
    document.querySelectorAll('[data-action="tuition-view"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const listing = listings.find((l) => l.id === btn.dataset.id);
        openCenterModal(listing, rawState, modalCtx);
      });
    });
  };

  const refreshGrid = ({ resetPage = false } = {}) => {
    const grid = document.getElementById('tuitionGrid');
    const pager = document.getElementById('tuitionPager');
    if (!grid) return;

    const filters = getFilterValues();
    if (resetPage) displayCount = TUITION_PAGE_SIZE;

    const all = sortListings(getListedCenters(rawState), rawState);
    const filtered = filterListings(all, filters);
    const visible = filtered.slice(0, displayCount);
    const filtering = hasActiveFilters(filters);

    grid.innerHTML = visible.length
      ? visible.map((l) => tuitionCard(l, rawState)).join('')
      : '<p class="empty-state">No centers match your search. Try another category, city, or program.</p>';

    if (pager) {
      pager.innerHTML = pagerHtml({
        shown: visible.length,
        total: filtered.length,
        filtering,
      });
      pager.querySelector('[data-action="tuition-load-more"]')?.addEventListener('click', () => {
        displayCount += TUITION_PAGE_STEP;
        refreshGrid({ resetPage: false });
      });
    }

    bindViewButtons();
  };

  refreshGrid({ resetPage: true });

  const search = document.getElementById('tuitionSearch');
  const cityFilter = document.getElementById('tuitionCityFilter');
  const subjectFilter = document.getElementById('tuitionSubjectFilter');

  const onFilterChange = () => refreshGrid({ resetPage: true });

  document.getElementById('tuitionCategoryFilters')?.querySelectorAll('.tuition-cat-chip').forEach((btn) => {
    btn.addEventListener('click', () => {
      const current = document.querySelector('.tuition-cat-chip.active')?.dataset.category || '';
      const next = current === btn.dataset.category && btn.dataset.category ? '' : btn.dataset.category;
      syncCategoryChips(next);
      refreshGrid({ resetPage: true });
    });
  });

  if (search && !search.dataset.bound) {
    search.dataset.bound = '1';
    search.addEventListener('input', onFilterChange);
  }
  if (cityFilter && !cityFilter.dataset.bound) {
    cityFilter.dataset.bound = '1';
    cityFilter.addEventListener('change', onFilterChange);
  }
  if (subjectFilter && !subjectFilter.dataset.bound) {
    subjectFilter.dataset.bound = '1';
    subjectFilter.addEventListener('change', onFilterChange);
  }

  const openId = sessionStorage.getItem(TUITION_OPEN_KEY);
  if (openId) {
    sessionStorage.removeItem(TUITION_OPEN_KEY);
    const listing = getListedCenters(rawState).find((l) => l.id === openId);
    if (listing) openCenterModal(listing, rawState, modalCtx);
  }
}

function submitInquiry(listing, rawState, toast, closeModal) {
  const role = getEffectiveRole();
  const name = document.getElementById('tmName')?.value?.trim();
  const email = document.getElementById('tmEmail')?.value?.trim() || '';
  const phone = document.getElementById('tmPhone')?.value?.trim() || '';
  const message = document.getElementById('tmMessage')?.value?.trim() || '';
  const branchId = resolveInquiryBranchId(listing, rawState, role);

  if (!name) {
    toast('Name is required', 'error');
    return;
  }

  if (!canSendTuitionInquiry() && !phone && !email) {
    toast('Please enter a mobile number or email so the center can reach you', 'error');
    return;
  }

  let grade = '';
  let notes = message;
  let source = 'Guest Marketplace';
  let leadName = name;

  if (role === 'parent') {
    const childId = document.getElementById('tmChild')?.value;
    const child = rawState?.students?.find((s) => s.id === childId);
    grade = child?.grade || document.getElementById('tmGrade')?.value?.trim() || '';
    source = 'Parent Marketplace';
    notes = child
      ? `Child: ${child.name}. ${message}`.trim()
      : message;
  } else if (role === 'student') {
    grade = document.getElementById('tmGrade')?.value?.trim() || '';
    source = 'Student Marketplace';
  } else {
    const childName = document.getElementById('tmChildName')?.value?.trim();
    grade = document.getElementById('tmGrade')?.value?.trim() || '';
    if (childName) {
      leadName = childName;
      notes = [`Parent: ${name}`, childName ? `Child: ${childName}` : '', message].filter(Boolean).join('. ');
    } else {
      notes = message;
    }
  }

  saveLead({
    centerId: listing.id,
    branchId,
    name: leadName,
    email,
    grade,
    phone,
    parentName: canSendTuitionInquiry() && role === 'parent' ? name : (role === 'student' ? undefined : name),
    course: listing.subjects.slice(0, 3).join(', '),
    source,
    stage: 'inquiry',
    notes,
    activities: [{
      id: `act_${Date.now()}`,
      type: 'inquiry',
      note: `Submitted via Tuition Marketplace (${source})`,
      at: new Date().toISOString(),
    }],
  });

  closeModal?.();
  toast(`Inquiry sent to ${listing.name}. The center will contact you soon.`, 'success');
}
