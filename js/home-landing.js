import { esc } from './html.js';

export const LANDING_FEATURES = [
  {
    icon: '→',
    title: 'Education CRM',
    desc: 'Capture leads from your website, WhatsApp, and walk-ins. Run demos and enroll students in one pipeline.',
  },
  {
    icon: '▣',
    title: 'Academy OS',
    desc: 'Batches, schedules, attendance, tests, and tutors — the daily operations backbone of your center.',
  },
  {
    icon: '▩',
    title: 'Parent Communication',
    desc: 'Automated WhatsApp, email, and SMS when attendance drops or test results are posted.',
  },
  {
    icon: '★',
    title: 'Student Success',
    desc: 'Track homework, skills, interventions, and progress — not just grades, but learning journeys.',
  },
  {
    icon: '◆',
    title: 'Business Intelligence',
    desc: 'KPIs, trends, and daily decisions. Tutorsala tells you what to do next, not just what happened.',
  },
  {
    icon: '✦',
    title: 'AI Assistants',
    desc: 'Role-aware AI for owners, tutors, parents, and students — insights and message drafts in seconds.',
  },
];

export const LANDING_TESTIMONIALS = [
  {
    quote: 'We replaced five spreadsheets and a WhatsApp group. Parents finally get updates on time — and our enrollment pipeline actually works.',
    name: 'Priya Mehta',
    role: 'Owner, Bright Minds Academy',
    city: 'Mumbai',
    rating: 5,
  },
  {
    quote: 'I can see my son\'s homework, attendance, and teacher feedback in one place. No more chasing the tutor on phone.',
    name: 'Rajesh Sharma',
    role: 'Parent',
    city: 'Mumbai',
    rating: 5,
  },
  {
    quote: 'Marking attendance and messaging parents used to take an hour after class. Now it\'s done before I leave the desk.',
    name: 'Dr. Anita Desai',
    role: 'Physics Tutor',
    city: 'Bright Minds Academy',
    rating: 5,
  },
];

export const LANDING_STATS = [
  { value: '9', label: 'Platform pillars' },
  { value: '4', label: 'Role-based portals' },
  { value: '1', label: 'Ops platform — not an LMS' },
];

/** Internal sales WhatsApp — not shown on UI; used for wa.me links only. */
const TUTORSALA_SALES_WHATSAPP = '919553371972';
export const TUTORSALA_SALES_EMAIL = 'hello@tutorsala.com';

/** Meta ads / demo funnel — standalone page at repo root. */
export const START_PAGE_PATH = 'start-page.html';

const UTM_KEYS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
  'utm_id',
  'fbclid',
];

/** Link to the demo funnel; forwards current UTM tags when present. */
export function buildStartPageUrl(extra = {}) {
  const base = typeof window !== 'undefined' ? window.location.origin : '';
  const url = new URL(START_PAGE_PATH, base || 'http://localhost');
  if (typeof window !== 'undefined') {
    const current = new URLSearchParams(window.location.search);
    UTM_KEYS.forEach((key) => {
      const value = current.get(key);
      if (value) url.searchParams.set(key, value);
    });
  }
  Object.entries(extra).forEach(([key, value]) => {
    if (value != null && value !== '') url.searchParams.set(key, value);
  });
  const path = `${url.pathname}${url.search}`;
  return base ? `${base}${path}` : path;
}

export const LANDING_PRICING_TIERS = [
  {
    id: 'starter',
    name: 'Starter',
    listPrice: '₹36,000',
    price: '₹18,000',
    discount: '50% off',
    period: '/ year',
    note: '1 branch · up to 100 active students',
    featured: true,
    features: [
      'Full Tutorsala workspace — CRM, academy, comms, family portal',
      'Marketplace listing & guest inquiries',
      'Best for single-location centers (~40–100 students)',
    ],
  },
  {
    id: 'branch',
    name: 'Multi-branch add-on',
    listPrice: '₹24,000',
    price: '+ ₹12,000',
    discount: '50% off',
    period: '/ branch / year',
    note: '+ ₹30 / student / year above 100 per branch',
    featured: false,
    features: [
      'Add locations as branches on one center account',
      'Branch switcher & branch-scoped CRM',
      'One academy = one Tutorsala center (no duplicate signups)',
    ],
  },
  {
    id: 'pilot',
    name: 'Design partner',
    price: '30-day pilot',
    period: ' · no charge',
    note: 'Limited early centers',
    featured: false,
    features: [
      'Full platform access during pilot',
      'Feedback calls & case study (with permission)',
      'Convert to Starter or branch plan after pilot',
    ],
  },
];

export const LOGIN_PORTALS = [
  { id: 'platform', title: 'Platform owner', subtitle: 'All centers · monitor · support' },
  { id: 'center', title: 'Center admin', subtitle: 'CRM, batches, staff, BI' },
  { id: 'teacher', title: 'Teacher', subtitle: 'Schedule, attendance, classes' },
  { id: 'family', title: 'Family', subtitle: 'One login — parent & student views' },
];

function stars(n) {
  return '★'.repeat(n) + '☆'.repeat(5 - n);
}

export function buildPricingWhatsAppUrl(planName) {
  const digits = String(TUTORSALA_SALES_WHATSAPP).replace(/\D/g, '');
  const text = `Hi Tutorsala team, I'm interested in the ${planName} plan. Please share platform subscription and payment details for my tuition center.`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

export function renderLandingHeader() {
  return `
    <header class="landing-header">
      <div class="landing-header-inner">
        <a href="#" class="landing-logo" data-scroll="top" aria-label="Tutorsala home">
          <span class="brand-icon"><img src="img/tutorsala-logo.webp" width="128" height="128" alt="Tutorsala logo" style="width: 100%; height: 100%; object-fit: contain; border-radius: inherit;"></span>
          <span class="landing-logo-text">
            <strong>Tutorsala</strong>
            <small>Less Chasing. More Teaching.</small>
          </span>
        </a>
        <nav class="landing-nav" aria-label="Main">
          <button type="button" class="landing-nav-link" data-scroll="features">Features</button>
          <button type="button" class="landing-nav-link" data-scroll="pricing">Pricing</button>
          <button type="button" class="landing-nav-link" data-scroll="testimonials">Testimonials</button>
          <button type="button" class="landing-nav-link" data-scroll="tuitions">Browse tuitions</button>
        </nav>
        <div class="landing-header-cta">
          <button type="button" class="btn btn-ghost btn-sm landing-install-btn hidden" data-pwa-install>Install app</button>
          <a class="btn btn-secondary btn-sm" href="${buildStartPageUrl()}">Book free demo</a>
          <button type="button" class="btn btn-primary btn-sm" data-auth-open-login>Log in</button>
        </div>
      </div>
    </header>`;
}

export function renderLandingHero() {
  return `
    <section class="landing-hero" id="top">
      <div class="landing-hero-grid">
        <div class="landing-hero-copy">
          <p class="landing-eyebrow">Tuition center management software</p>
          <h1 class="landing-headline">Run your entire tuition center<br><em>for the fee of one student.</em></h1>
          <p class="landing-lead">Tutorsala is ₹3,000 a month, about what one student pays you, for enquiries, batches, attendance, fees and parent updates across your whole center. <strong>Launch offer: 50% off, just ₹1,500 a month.</strong></p>
          <div class="landing-hero-actions">
            <a class="btn btn-primary" href="${buildStartPageUrl()}">Book free demo</a>
            <button type="button" class="btn btn-secondary" data-scroll="pricing">See pricing</button>
          </div>
          <div class="landing-stats">
            ${LANDING_STATS.map((s) => `
              <div class="landing-stat">
                <span class="landing-stat-value">${esc(s.value)}</span>
                <span class="landing-stat-label">${esc(s.label)}</span>
              </div>`).join('')}
          </div>
        </div>
        <div class="landing-hero-visual" aria-hidden="true">
          <div class="landing-hero-card landing-hero-card-1">
            <span class="landing-hero-card-label">Today's decisions</span>
            <p>3 tutors absent · 12 fee follow-ups · Open Batch B for Physics</p>
          </div>
          <div class="landing-hero-card landing-hero-card-2">
            <span class="landing-hero-card-label">Parent update sent</span>
            <p>Aarav scored 92/100 on Physics test — WhatsApp ✓</p>
          </div>
          <div class="landing-hero-card landing-hero-card-3">
            <span class="landing-hero-card-label">CRM pipeline</span>
            <p>4 demos this week · 2 ready for admission</p>
          </div>
        </div>
      </div>
    </section>`;
}

export function renderLandingFeatures() {
  return `
    <section class="landing-section" id="features">
      <div class="landing-section-head">
        <p class="landing-eyebrow">Platform capabilities</p>
        <h2>Everything your tuition center needs</h2>
        <p class="landing-section-sub">Nine integrated pillars — from first inquiry to parent satisfaction. Teaching stays on Zoom or Meet; Tutorsala runs the business around it.</p>
      </div>
      <div class="landing-features-grid">
        ${LANDING_FEATURES.map((f) => `
          <article class="landing-feature-card">
            <span class="landing-feature-icon">${esc(f.icon)}</span>
            <h3>${esc(f.title)}</h3>
            <p>${esc(f.desc)}</p>
          </article>`).join('')}
      </div>
    </section>`;
}

export function renderLandingPricing() {
  const generalUrl = buildPricingWhatsAppUrl('Tutorsala platform');
  return `
    <section class="landing-section landing-section-alt" id="pricing">
      <div class="landing-section-head">
        <p class="landing-eyebrow">Platform subscription</p>
        <h2>Simple annual plans for tuition centers</h2>
        <p class="landing-section-sub">Tutorsala platform fee is separate from what you charge students — collect tuition on your own UPI or bank. Contact us on WhatsApp for invoice, UPI, or NEFT details and to activate your center.</p>
      </div>
      <div class="landing-pricing-grid">
        ${LANDING_PRICING_TIERS.map((tier) => `
          <article class="landing-pricing-card${tier.featured ? ' landing-pricing-card-featured' : ''}">
            ${tier.featured ? '<span class="landing-pricing-badge">Most popular</span>' : ''}
            <h3>${esc(tier.name)}</h3>
            <div class="landing-pricing-price">
              ${tier.listPrice ? `<span class="landing-pricing-list"><s>${esc(tier.listPrice)}</s></span>` : ''}
              <span class="landing-pricing-amount">${esc(tier.price)}</span>
              <span class="landing-pricing-period">${esc(tier.period)}</span>
            </div>
            ${tier.discount ? `<span class="landing-pricing-discount">${esc(tier.discount)}</span>` : ''}
            <p class="landing-pricing-note">${esc(tier.note)}</p>
            <ul class="landing-pricing-features">
              ${tier.features.map((f) => `<li>${f}</li>`).join('')}
            </ul>
          </article>`).join('')}
      </div>
      <div class="landing-pricing-foot">
        <p><strong>Example:</strong> 2 branches, 120 students (60 each) → ₹18,000 + ₹12,000 = <strong>₹30,000/year</strong>. GST may apply on platform fee.</p>
        <div class="landing-pricing-contact">
          <a class="btn btn-primary" href="${buildStartPageUrl()}">Book free demo</a>
          <a class="btn btn-secondary" href="${generalUrl}" target="_blank" rel="noopener noreferrer">Contact via WhatsApp</a>
          <a class="landing-pricing-email" href="mailto:${TUTORSALA_SALES_EMAIL}?subject=Tutorsala%20platform%20subscription">${TUTORSALA_SALES_EMAIL}</a>
        </div>
      </div>
    </section>`;
}

export function renderLandingTestimonials() {
  return `
    <section class="landing-section landing-section-alt" id="testimonials">
      <div class="landing-section-head">
        <p class="landing-eyebrow">Trusted by academies & families</p>
        <h2>What our users say</h2>
        <p class="landing-section-sub">Real outcomes for center owners, tutors, and parents on Tutorsala.</p>
      </div>
      <div class="landing-testimonials-grid">
        ${LANDING_TESTIMONIALS.map((t) => `
          <blockquote class="landing-testimonial">
            <div class="landing-testimonial-stars" aria-label="${esc(t.rating)} out of 5 stars">${stars(t.rating)}</div>
            <p>"${esc(t.quote)}"</p>
            <footer>
              <strong>${esc(t.name)}</strong>
              <span>${esc(t.role)}${t.city ? ` · ${t.city}` : ''}</span>
            </footer>
          </blockquote>`).join('')}
      </div>
    </section>`;
}

export function renderLandingFooter() {
  return `
    <footer class="landing-footer">
      <div class="landing-footer-inner">
        <div class="landing-logo landing-logo-footer">
          <span class="brand-icon"><img src="img/tutorsala-logo.webp" width="128" height="128" alt="Tutorsala logo" style="width: 100%; height: 100%; object-fit: contain; border-radius: inherit;"></span>
          <strong>Tutorsala</strong>
        </div>
        <p>Operations platform for tuition centers — not course hosting.</p>
        <p class="landing-footer-links">
          <a href="${buildStartPageUrl()}">Book free demo</a>
          <span aria-hidden="true">·</span>
          <a href="/privacy">Privacy</a>
          <span aria-hidden="true">·</span>
          <a href="/terms">Terms</a>
          <span aria-hidden="true">·</span>
          <a href="/contact">Contact</a>
          <span aria-hidden="true">·</span>
          <button type="button" class="landing-footer-link" data-scroll="pricing">Pricing</button>
          <span aria-hidden="true">·</span>
          <a href="${buildPricingWhatsAppUrl('Tutorsala platform')}" target="_blank" rel="noopener noreferrer">Contact via WhatsApp</a>
          <span aria-hidden="true">·</span>
          <a href="mailto:${TUTORSALA_SALES_EMAIL}">${TUTORSALA_SALES_EMAIL}</a>
        </p>
        <p class="landing-footer-copy">© ${new Date().getFullYear()} Tutorsala</p>
      </div>
    </footer>`;
}

export function renderLandingMarketplace(marketplaceHtml) {
  return `
    <section class="landing-section landing-marketplace-wrap" id="tuitions">
      <div class="landing-section-head">
        <p class="landing-eyebrow">Tuition marketplace</p>
        <h2>Find the right tuition center</h2>
        <p class="landing-section-sub">Browse academics, dance, art, drawing, music, sports, coding, and more — send an inquiry without signing in. The center will follow up to schedule a demo and enrollment.</p>
      </div>
      <div class="auth-marketplace" id="authMarketplace">
        ${marketplaceHtml}
      </div>
    </section>`;
}

/**
 * The whole public home page. The app renders it with the live marketplace;
 * scripts/build-landing.mjs writes it into index.html with a loading note instead,
 * so the page can be read before any script runs.
 */
export function renderLandingPage(marketplaceHtml) {
  return `
    <div class="landing-page">
      ${renderLandingHeader()}
      <main>
        ${renderLandingHero()}
        ${renderLandingFeatures()}
        ${renderLandingPricing()}
        ${renderLandingTestimonials()}
        ${renderLandingMarketplace(marketplaceHtml)}
      </main>
      ${renderLandingFooter()}
    </div>`;
}

export const STATIC_MARKETPLACE_PLACEHOLDER = '<p class="landing-section-sub">Loading tuition centers…</p>';

export function bindLandingScroll() {
  document.querySelectorAll('[data-scroll]').forEach((el) => {
    el.addEventListener('click', (e) => {
      const target = el.dataset.scroll;
      if (target === 'top') {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      const section = document.getElementById(target);
      if (section) {
        e.preventDefault();
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });
}
