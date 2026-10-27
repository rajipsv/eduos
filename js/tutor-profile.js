// Tutor public profiles: sections the tutor names themselves (e.g. "Certifications",
// "Olympiad results"), each with items. The tutor edits a draft; the center admin publishes
// a frozen copy that the public marketplace shows. Parent reviews are public as soon as they
// are posted; the admin can hide one.
import { esc, safeUrl } from './html.js';
import { getState, getTeacher, saveTeacher, persist } from './store.js';

const LIMITS = { sections: 10, items: 20 };

function uid(prefix) {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/** What a new profile starts with. Tutors can rename or delete any of these. */
export function starterProfile() {
  return {
    intro: '',
    sections: ['Why parents choose me', 'Certifications', 'Awards & achievements'].map((title) => ({
      id: uid('sec'),
      title,
      items: [],
    })),
  };
}

export function profileStatusBadge(teacher) {
  if (teacher?.profileStatus === 'pending') return '<span class="badge badge-orange">Waiting for approval</span>';
  if (teacher?.publicProfile) return '<span class="badge badge-green">Published</span>';
  return '<span class="badge badge-gray">Draft</span>';
}

// --- Saving -------------------------------------------------------------------------------

export function saveProfileDraft(teacherId, profile, { submit = false } = {}) {
  const t = getTeacher(teacherId);
  if (!t) return null;
  saveTeacher({ ...t, profileDraft: profile, profileStatus: submit ? 'pending' : t.publicProfile ? t.profileStatus || 'published' : 'draft' });
  return getTeacher(teacherId);
}

/** Admin: make the current draft public. Later draft edits don't show until published again. */
export function publishProfile(teacherId) {
  const t = getTeacher(teacherId);
  if (!t?.profileDraft) return null;
  saveTeacher({
    ...t,
    publicProfile: JSON.parse(JSON.stringify(t.profileDraft)),
    profileStatus: 'published',
    publishedAt: new Date().toISOString(),
  });
  return getTeacher(teacherId);
}

export function unpublishProfile(teacherId) {
  const t = getTeacher(teacherId);
  if (!t) return null;
  saveTeacher({ ...t, publicProfile: null, profileStatus: 'draft' });
  return getTeacher(teacherId);
}

// --- Reviews ------------------------------------------------------------------------------

export function getTutorReviews(teacherId = null) {
  const list = getState().tutorReviews || [];
  return teacherId ? list.filter((r) => r.teacherId === teacherId) : list;
}

export const reviewId = (teacherId, studentId) => `rev_${teacherId}_${studentId}`;

/** A parent's review of their child's tutor (one per child; posting again edits it). */
export function saveTutorReview({ teacherId, studentId, rating, comment, parentName }) {
  const s = getState();
  s.tutorReviews = s.tutorReviews || [];
  const id = reviewId(teacherId, studentId);
  const existing = s.tutorReviews.find((r) => r.id === id);
  const now = new Date().toISOString();
  const review = {
    ...(existing || {}),
    id,
    teacherId,
    studentId,
    rating: Math.min(5, Math.max(1, Math.round(Number(rating) || 0))),
    comment: String(comment || '').trim().slice(0, 1000),
    parentName: String(parentName || '').trim().slice(0, 120),
    status: existing?.status || 'visible',
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };
  if (existing) Object.assign(existing, review);
  else s.tutorReviews.push(review);
  persist();
  return review;
}

/** Admin: hide or show a review on the public marketplace. */
export function setReviewVisible(id, visible) {
  const r = getTutorReviews().find((x) => x.id === id);
  if (!r) return;
  r.status = visible ? 'visible' : 'hidden';
  persist();
}

export function reviewSummary(reviews) {
  const shown = reviews.filter((r) => r.status !== 'hidden');
  const rating = shown.length ? Math.round((shown.reduce((n, r) => n + r.rating, 0) / shown.length) * 10) / 10 : null;
  return { rating, count: shown.length };
}

export const stars = (n) => {
  const full = Math.round(Number(n) || 0);
  return `<span class="tutor-stars" aria-label="${full} out of 5">${'★'.repeat(full)}${'☆'.repeat(5 - full)}</span>`;
};

// --- Public view ----------------------------------------------------------------------------

const initials = (name) =>
  String(name || '?')
    .replace(/^(Dr|Mr|Mrs|Ms|Prof)\.?\s+/i, '')
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] || '')
    .join('')
    .toUpperCase();

/** Small card for the "Our tutors" list. */
export function tutorCardHtml(tutor) {
  const intro = tutor.publicProfile?.intro || '';
  return `
    <button type="button" class="tutor-card" data-action="open-tutor" data-id="${esc(tutor.id)}">
      <span class="tutor-avatar">${esc(initials(tutor.name))}</span>
      <span class="tutor-card-body">
        <strong>${esc(tutor.name)}</strong>
        <small>${esc((tutor.subjects || []).join(', ') || 'Tutor')}</small>
        ${tutor.rating ? `<small>${stars(tutor.rating)} ${esc(tutor.rating)} (${esc(tutor.reviewCount)})</small>` : ''}
        ${intro ? `<small class="tutor-card-intro">${esc(intro.length > 90 ? `${intro.slice(0, 90)}…` : intro)}</small>` : ''}
      </span>
    </button>`;
}

/** The full public profile. `tutor`: { name, subjects, publicProfile, rating, reviewCount, reviews } */
export function tutorProfileHtml(tutor, profile = tutor.publicProfile) {
  const p = profile || { intro: '', sections: [] };
  const sections = (p.sections || []).filter((s) => s.items?.length);
  const reviews = tutor.reviews || [];
  return `
    <div class="tutor-profile">
      <div class="tutor-profile-head">
        <span class="tutor-avatar tutor-avatar-lg">${esc(initials(tutor.name))}</span>
        <div>
          <h3 style="margin:0">${esc(tutor.name)}</h3>
          <div class="meta">${esc((tutor.subjects || []).join(', '))}</div>
          ${tutor.rating ? `<div>${stars(tutor.rating)} <strong>${esc(tutor.rating)}</strong> · ${esc(tutor.reviewCount)} parent review${tutor.reviewCount === 1 ? '' : 's'}</div>` : ''}
        </div>
      </div>
      ${p.intro ? `<p class="tutor-intro">${esc(p.intro)}</p>` : ''}
      ${sections.map((s) => `
        <div class="tutor-section">
          <h4>${esc(s.title)}</h4>
          <ul>${s.items.map((it) => `
            <li>
              <strong>${esc(it.text)}</strong>${it.detail ? `<br><span class="meta">${esc(it.detail)}</span>` : ''}
              ${it.link ? ` <a href="${safeUrl(it.link)}" target="_blank" rel="noopener noreferrer" class="tutor-verify">Verify ↗</a>` : ''}
            </li>`).join('')}
          </ul>
        </div>`).join('')}
      ${!p.intro && !sections.length ? '<p class="empty-state">This tutor hasn\'t added details yet.</p>' : ''}
      <div class="tutor-section">
        <h4>What parents say</h4>
        ${reviews.length
          ? reviews.map((r) => `<div class="tutor-review"><div>${stars(r.rating)} <strong>${esc(r.name)}</strong> <span class="meta">${esc(r.date || '')}</span></div>${r.comment ? `<p>${esc(r.comment)}</p>` : ''}</div>`).join('')
          : '<p class="meta">No reviews yet.</p>'}
      </div>
    </div>`;
}

/**
 * Tutors with a published profile for a marketplace listing. Server mode sends them with
 * the public listing; browser-only mode builds them from local data.
 */
export function listingTutors(listing, rawState) {
  if (listing._tutors) return listing._tutors;
  const reviews = (rawState?.tutorReviews || []).filter((r) => r.status !== 'hidden');
  return (rawState?.teachers || [])
    .filter((t) => t.centerId === listing.id && t.publicProfile)
    .map((t) => {
      const mine = reviews.filter((r) => r.teacherId === t.id).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
      const { rating, count } = reviewSummary(mine);
      return {
        id: t.id,
        name: t.name,
        subjects: t.subjects || [],
        publicProfile: t.publicProfile,
        rating,
        reviewCount: count,
        reviews: mine.slice(0, 10).map((r) => ({
          name: String(r.parentName || 'Parent').trim().split(/\s+/)[0],
          rating: r.rating,
          comment: r.comment || '',
          date: String(r.createdAt || '').slice(0, 10),
        })),
      };
    });
}

// --- Editor ---------------------------------------------------------------------------------

function editorHtml(profile) {
  const sections = profile.sections || [];
  return `
    <div class="form-group full"><label>Short introduction</label>
      <textarea data-pf="intro" rows="3" maxlength="1000" placeholder="e.g. 12 years teaching board-exam Physics. I keep batches small so every student gets attention.">${esc(profile.intro || '')}</textarea>
    </div>
    ${sections.map((s, si) => `
      <div class="tutor-edit-section" data-sec="${si}">
        <div class="tutor-edit-row">
          <input data-pf="title" data-sec="${si}" value="${esc(s.title)}" maxlength="80" placeholder="Section heading, e.g. Certifications">
          <button type="button" class="btn btn-sm btn-ghost" data-pf-act="sec-up" data-sec="${si}" ${si === 0 ? 'disabled' : ''} title="Move up">↑</button>
          <button type="button" class="btn btn-sm btn-ghost" data-pf-act="sec-down" data-sec="${si}" ${si === sections.length - 1 ? 'disabled' : ''} title="Move down">↓</button>
          <button type="button" class="btn btn-sm btn-danger" data-pf-act="sec-del" data-sec="${si}">Delete section</button>
        </div>
        ${(s.items || []).map((it, ii) => `
          <div class="tutor-edit-item">
            <input data-pf="text" data-sec="${si}" data-item="${ii}" value="${esc(it.text)}" maxlength="200" placeholder="e.g. B.Ed — Mumbai University, 2015">
            <input data-pf="detail" data-sec="${si}" data-item="${ii}" value="${esc(it.detail || '')}" maxlength="500" placeholder="Details (optional)">
            <input data-pf="link" data-sec="${si}" data-item="${ii}" value="${esc(it.link || '')}" maxlength="500" placeholder="Verification link (optional), https://…">
            <div class="tutor-edit-row">
              <button type="button" class="btn btn-sm btn-ghost" data-pf-act="item-up" data-sec="${si}" data-item="${ii}" ${ii === 0 ? 'disabled' : ''}>↑</button>
              <button type="button" class="btn btn-sm btn-ghost" data-pf-act="item-down" data-sec="${si}" data-item="${ii}" ${ii === s.items.length - 1 ? 'disabled' : ''}>↓</button>
              <button type="button" class="btn btn-sm btn-ghost" data-pf-act="item-del" data-sec="${si}" data-item="${ii}">Remove</button>
            </div>
          </div>`).join('')}
        ${(s.items || []).length < LIMITS.items ? `<button type="button" class="btn btn-sm btn-secondary" data-pf-act="item-add" data-sec="${si}">+ Add item</button>` : ''}
      </div>`).join('')}
    ${sections.length < LIMITS.sections ? '<button type="button" class="btn btn-secondary" data-pf-act="sec-add">+ Add section</button>' : ''}`;
}

/** Reads the editor's inputs back into a profile object. */
function readEditor(root, profile) {
  const next = JSON.parse(JSON.stringify(profile));
  const intro = root.querySelector('[data-pf="intro"]');
  if (intro) next.intro = intro.value.trim();
  root.querySelectorAll('[data-pf="title"]').forEach((el) => {
    next.sections[Number(el.dataset.sec)].title = el.value.trim();
  });
  for (const field of ['text', 'detail', 'link']) {
    root.querySelectorAll(`[data-pf="${field}"]`).forEach((el) => {
      next.sections[Number(el.dataset.sec)].items[Number(el.dataset.item)][field] = el.value.trim();
    });
  }
  return next;
}

/** Drops empty items and untitled empty sections before saving. */
export function cleanProfile(profile) {
  return {
    intro: (profile.intro || '').trim(),
    sections: (profile.sections || [])
      .map((s) => ({
        id: s.id,
        title: (s.title || '').trim() || 'Untitled',
        items: (s.items || [])
          .filter((it) => (it.text || '').trim())
          .map((it) => ({
            id: it.id,
            text: it.text.trim(),
            ...(it.detail ? { detail: it.detail.trim() } : {}),
            ...(it.link ? { link: it.link.trim() } : {}),
          })),
      }))
      .filter((s) => s.items.length || s.title !== 'Untitled'),
  };
}

/** Links must be http(s); returns an error message or null. */
export function profileError(profile) {
  for (const s of profile.sections) {
    for (const it of s.items) {
      if (it.link && !/^https?:\/\//i.test(it.link)) return `"${it.text}": the link must start with https://`;
    }
  }
  return null;
}

/**
 * Mounts the section editor in `root`. Returns { get } to read the current profile.
 * The editor keeps its own copy and re-renders on structural changes.
 */
export function mountProfileEditor(root, initial) {
  let profile = JSON.parse(JSON.stringify(initial || starterProfile()));
  const render = () => {
    // eslint-disable-next-line no-unsanitized/property -- every value is escaped with esc()
    root.innerHTML = editorHtml(profile);
  };
  const move = (arr, i, d) => {
    const j = i + d;
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
  };
  root.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-pf-act]');
    if (!btn) return;
    profile = readEditor(root, profile);
    const si = Number(btn.dataset.sec);
    const ii = Number(btn.dataset.item);
    const items = profile.sections[si]?.items;
    switch (btn.dataset.pfAct) {
      case 'sec-add':
        profile.sections.push({ id: uid('sec'), title: '', items: [{ id: uid('it'), text: '' }] });
        break;
      case 'sec-del':
        if (confirm(`Delete the section "${profile.sections[si].title || 'Untitled'}"?`)) profile.sections.splice(si, 1);
        break;
      case 'sec-up':
        move(profile.sections, si, -1);
        break;
      case 'sec-down':
        move(profile.sections, si, 1);
        break;
      case 'item-add':
        items.push({ id: uid('it'), text: '' });
        break;
      case 'item-del':
        items.splice(ii, 1);
        break;
      case 'item-up':
        move(items, ii, -1);
        break;
      case 'item-down':
        move(items, ii, 1);
        break;
      default:
        return;
    }
    render();
  });
  render();
  return { get: () => cleanProfile(readEditor(root, profile)) };
}

/**
 * The profile editor in a modal. Tutors save and submit; admins (canPublish) also publish
 * or unpublish. `onChange` runs after anything is saved.
 */
export function openProfileEditorModal(teacherId, { showModal, closeModal, toast }, { canPublish = false, onChange } = {}) {
  const teacher = getTeacher(teacherId);
  if (!teacher) return;
  let editor = null;
  const save = (extra) => {
    const profile = editor.get();
    const err = profileError(profile);
    if (err) {
      toast(err, 'error');
      return null;
    }
    return saveProfileDraft(teacherId, profile, extra);
  };
  showModal({
    title: `Public profile — ${teacher.name}`,
    wide: true,
    body: `
      <p class="meta" style="margin:0 0 12px">${profileStatusBadge(teacher)} Add your own sections — certificates, awards, results, anything parents should know. ${canPublish ? 'Publishing shows it on the marketplace.' : 'Your center admin publishes it to the marketplace.'}</p>
      <div id="tutorProfileEditor" class="tutor-editor"></div>
      <div id="tutorProfilePreview" class="tutor-preview hidden"></div>`,
    footer: `
      <button type="button" class="btn btn-secondary" data-modal-cancel>Cancel</button>
      <button type="button" class="btn btn-ghost" id="pfPreview">Preview</button>
      <button type="button" class="btn btn-secondary" id="pfSave">Save draft</button>
      ${canPublish
        ? `${teacher.publicProfile ? '<button type="button" class="btn btn-danger" id="pfUnpublish">Unpublish</button>' : ''}<button type="button" class="btn btn-primary" id="pfPublish">Save & publish</button>`
        : '<button type="button" class="btn btn-primary" id="pfSubmit">Submit for review</button>'}`,
    onMount: () => {
      editor = mountProfileEditor(document.getElementById('tutorProfileEditor'), teacher.profileDraft || teacher.publicProfile || starterProfile());
      const done = (msg) => {
        closeModal();
        toast(msg, 'success');
        onChange?.();
      };
      document.getElementById('pfSave').onclick = () => save({}) && done('Profile draft saved');
      document.getElementById('pfSubmit')?.addEventListener('click', () => save({ submit: true }) && done('Sent to your center admin for review'));
      document.getElementById('pfPublish')?.addEventListener('click', () => {
        if (!save({})) return;
        publishProfile(teacherId);
        done('Profile published to the marketplace');
      });
      document.getElementById('pfUnpublish')?.addEventListener('click', () => {
        unpublishProfile(teacherId);
        done('Profile removed from the marketplace');
      });
      // Preview shows the draft as parents will see it; the button switches back to editing.
      const previewBtn = document.getElementById('pfPreview');
      previewBtn.onclick = () => {
        const editEl = document.getElementById('tutorProfileEditor');
        const previewEl = document.getElementById('tutorProfilePreview');
        const showing = !previewEl.classList.contains('hidden');
        // eslint-disable-next-line no-unsanitized/property -- every value is escaped with esc()
        if (!showing) previewEl.innerHTML = tutorProfileHtml({ ...teacher, reviews: [] }, editor.get());
        previewEl.classList.toggle('hidden', showing);
        editEl.classList.toggle('hidden', !showing);
        previewBtn.textContent = showing ? 'Preview' : 'Back to editing';
      };
    },
  });
}

/** Demo content for the sample tutor (Dr. Anita Desai). */
export function demoTutorProfile() {
  return {
    intro:
      '10+ years teaching board-exam Physics and Chemistry. I keep batches small and explain every concept with experiments students can try at home.',
    sections: [
      {
        id: 'sec_demo_why',
        title: 'Why parents choose me',
        items: [
          { id: 'it_demo_1', text: 'Small batches — never more than 20 students' },
          { id: 'it_demo_2', text: 'Weekly progress update to every parent on WhatsApp' },
          { id: 'it_demo_3', text: 'Extra doubt-clearing class before every unit test' },
        ],
      },
      {
        id: 'sec_demo_cert',
        title: 'Certifications',
        items: [
          { id: 'it_demo_4', text: 'M.Sc Physics — University of Mumbai', detail: '2011' },
          { id: 'it_demo_5', text: 'B.Ed — SNDT Women’s University', detail: '2013' },
          { id: 'it_demo_6', text: 'CTET qualified', detail: '2014', link: 'https://ctet.nic.in/' },
        ],
      },
      {
        id: 'sec_demo_awards',
        title: 'Results & awards',
        items: [
          { id: 'it_demo_7', text: '14 students scored 95%+ in Class 10 Science boards', detail: '2024' },
          { id: 'it_demo_8', text: 'Best Science Teacher — Mumbai Tutors’ Forum', detail: '2022' },
        ],
      },
    ],
  };
}
