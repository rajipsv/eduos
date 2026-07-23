
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
    desc: 'KPIs, trends, and daily decisions. EduOS tells you what to do next, not just what happened.',
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
const EDUOS_SALES_WHATSAPP = '919553371972';
export const EDUOS_SALES_EMAIL = 'hello@eduos.app';

export const LANDING_PRICING_TIERS = [
  {
    id: 'starter',
    name: 'Starter',
    price: '₹18,000',
    period: '/ year',
    note: '1 branch · up to 100 active students',
    featured: true,
    features: [
      'Full EduOS workspace — CRM, academy, comms, family portal',
      'Marketplace listing & guest inquiries',
      'Best for single-location centers (~40–100 students)',
    ],
  },
  {
    id: 'branch',
    name: 'Multi-branch add-on',
    price: '+ ₹12,000',
    period: '/ branch / year',
    note: '+ ₹30 / student / year above 100 per branch',
    featured: false,
    features: [
      'Add locations as branches on one center account',
      'Branch switcher & branch-scoped CRM',
      'One academy = one EduOS center (no duplicate signups)',
    ],
  },
  {
    id: 'pilot',
    name: 'Design partner',
    price: '90-day pilot',
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
  const digits = String(EDUOS_SALES_WHATSAPP).replace(/\D/g, '');
  const text = `Hi EduOS team, I'm interested in the ${planName} plan. Please share platform subscription and payment details for my tuition center.`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

export function renderLandingHeader() {
  return `
    <header class="landing-header">
      <div class="landing-header-inner">
        <a href="#" class="landing-logo" data-scroll="top" aria-label="EduOS home">
          <span class="brand-icon">E</span>
          <span class="landing-logo-text">
            <strong>EduOS</strong>
            <small>Education Business Platform</small>
          </span>
        </a>
        <nav class="landing-nav" aria-label="Main">
          <button type="button" class="landing-nav-link" data-scroll="features">Features</button>
          <button type="button" class="landing-nav-link" data-scroll="pricing">Pricing</button>
          <button type="button" class="landing-nav-link" data-scroll="testimonials">Testimonials</button>
          <button type="button" class="landing-nav-link" data-scroll="tuitions">Browse tuitions</button>
        </nav>
        <div class="landing-header-cta">
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
          <p class="landing-eyebrow">The operating system for education businesses</p>
          <h1 class="landing-headline">Run your academy.<br>Delight every parent.<br><em>Scale with confidence.</em></h1>
          <p class="landing-lead">EduOS is not an LMS — it is the ops platform for tuition centers. Acquire students, run batches, communicate with families, and grow revenue from one place.</p>
          <div class="landing-stats">
            ${LANDING_STATS.map((s) => `
              <div class="landing-stat">
                <span class="landing-stat-value">${s.value}</span>
                <span class="landing-stat-label">${s.label}</span>
              </div>`).join('')}
          </div>
        </div>
        <div class="landing-hero-visual" aria-hidden="true">
          <div class="landing-hero-card landing-hero-card-1">
            <span class="landing-hero-card-label">Today\'s decisions</span>
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
        <p class="landing-section-sub">Nine integrated pillars — from first inquiry to parent satisfaction. Teaching stays on Zoom or Meet; EduOS runs the business around it.</p>
      </div>
      <div class="landing-features-grid">
        ${LANDING_FEATURES.map((f) => `
          <article class="landing-feature-card">
            <span class="landing-feature-icon">${f.icon}</span>
            <h3>${f.title}</h3>
            <p>${f.desc}</p>
          </article>`).join('')}
      </div>
    </section>`;
}

export function renderLandingPricing() {
  const generalUrl = buildPricingWhatsAppUrl('EduOS platform');
  return `
    <section class="landing-section landing-section-alt" id="pricing">
      <div class="landing-section-head">
        <p class="landing-eyebrow">Platform subscription</p>
        <h2>Simple annual plans for tuition centers</h2>
        <p class="landing-section-sub">EduOS platform fee is separate from what you charge students — collect tuition on your own UPI or bank. Contact us on WhatsApp for invoice, UPI, or NEFT details and to activate your center.</p>
      </div>
      <div class="landing-pricing-grid">
        ${LANDING_PRICING_TIERS.map((tier) => `
          <article class="landing-pricing-card${tier.featured ? ' landing-pricing-card-featured' : ''}">
            ${tier.featured ? '<span class="landing-pricing-badge">Most popular</span>' : ''}
            <h3>${tier.name}</h3>
            <div class="landing-pricing-price">
              <span class="landing-pricing-amount">${tier.price}</span>
              <span class="landing-pricing-period">${tier.period}</span>
            </div>
            <p class="landing-pricing-note">${tier.note}</p>
            <ul class="landing-pricing-features">
              ${tier.features.map((f) => `<li>${f}</li>`).join('')}
            </ul>
            <a
              class="btn ${tier.featured ? 'btn-primary' : 'btn-secondary'} btn-sm landing-pricing-cta"
              href="${buildPricingWhatsAppUrl(tier.name)}"
              target="_blank"
              rel="noopener noreferrer"
            >Contact via WhatsApp</a>
          </article>`).join('')}
      </div>
      <div class="landing-pricing-foot">
        <p><strong>Example:</strong> 2 branches, 120 students (60 each) → ₹18,000 + ₹12,000 = <strong>₹30,000/year</strong>. GST may apply on platform fee.</p>
        <div class="landing-pricing-contact">
          <a class="btn btn-primary" href="${generalUrl}" target="_blank" rel="noopener noreferrer">Contact via WhatsApp</a>
          <a class="landing-pricing-email" href="mailto:${EDUOS_SALES_EMAIL}?subject=EduOS%20platform%20subscription">${EDUOS_SALES_EMAIL}</a>
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
        <p class="landing-section-sub">Real outcomes for center owners, tutors, and parents on EduOS.</p>
      </div>
      <div class="landing-testimonials-grid">
        ${LANDING_TESTIMONIALS.map((t) => `
          <blockquote class="landing-testimonial">
            <div class="landing-testimonial-stars" aria-label="${t.rating} out of 5 stars">${stars(t.rating)}</div>
            <p>"${t.quote}"</p>
            <footer>
              <strong>${t.name}</strong>
              <span>${t.role}${t.city ? ` · ${t.city}` : ''}</span>
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
          <span class="brand-icon">E</span>
          <strong>EduOS</strong>
        </div>
        <p>Operations platform for tuition centers — not course hosting.</p>
        <p class="landing-footer-links">
          <button type="button" class="landing-footer-link" data-scroll="pricing">Pricing</button>
          <span aria-hidden="true">·</span>
          <a href="${buildPricingWhatsAppUrl('EduOS platform')}" target="_blank" rel="noopener noreferrer">Contact via WhatsApp</a>
          <span aria-hidden="true">·</span>
          <a href="mailto:${EDUOS_SALES_EMAIL}">${EDUOS_SALES_EMAIL}</a>
        </p>
        <p class="landing-footer-copy">© ${new Date().getFullYear()} EduOS · Tutor Hub demo</p>
      </div>
    </footer>`;
}

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
