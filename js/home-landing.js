
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

export const LOGIN_PORTALS = [
  { id: 'platform', title: 'Platform owner', subtitle: 'All centers · monitor · support' },
  { id: 'center', title: 'Center admin', subtitle: 'CRM, batches, staff, BI' },
  { id: 'teacher', title: 'Teacher', subtitle: 'Schedule, attendance, classes' },
  { id: 'family', title: 'Family', subtitle: 'One login — parent & student views' },
];

function stars(n) {
  return '★'.repeat(n) + '☆'.repeat(5 - n);
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
          <button type="button" class="landing-nav-link" data-scroll="testimonials">Testimonials</button>
          <button type="button" class="landing-nav-link" data-scroll="tuitions">Find tuitions</button>
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
          <div class="landing-hero-actions">
            <button type="button" class="btn btn-primary" data-scroll="tuitions">Browse tuitions</button>
            <button type="button" class="btn btn-secondary" data-auth-open-login>Log in</button>
          </div>
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
