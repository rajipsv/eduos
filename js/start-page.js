const EDUOS_SALES_WHATSAPP = '919553371972';

const UTM_KEYS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
  'utm_id',
  'fbclid',
];

function readUtmParams() {
  const params = new URLSearchParams(window.location.search);
  const utm = {};
  UTM_KEYS.forEach((key) => {
    const value = params.get(key);
    if (value) utm[key] = value;
  });
  return utm;
}

function scrollToForm(event) {
  if (event) event.preventDefault();
  const el = document.getElementById('lead-form');
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function buildWhatsAppUrl(data, utm = {}, leadId = null) {
  const digits = String(EDUOS_SALES_WHATSAPP).replace(/\D/g, '');
  const lines = [
    'Hi EduOS team — I filled out the start page form and want to book a free demo.',
    '',
    `Name: ${data.first_name} ${data.last_name}`,
    `Center: ${data.center_name}`,
    `City: ${data.city}`,
    `Phone: ${data.phone}`,
    `Email: ${data.email}`,
    `Active students: ${data.students || 'Not specified'}`,
    `Center type: ${data.center_type || 'Not specified'}`,
    `Biggest pain: ${data.pain || 'Not specified'}`,
    `Plan interest: ${data.plan || 'Not specified'}`,
  ];
  if (leadId) lines.push('', `CRM ref: ${leadId}`);
  const utmParts = Object.entries(utm).map(([key, value]) => `${key}=${value}`);
  if (utmParts.length) lines.push('', `Campaign: ${utmParts.join(' | ')}`);
  if (data.notes) lines.push('', `Notes: ${data.notes}`);
  return `https://wa.me/${digits}?text=${encodeURIComponent(lines.join('\n'))}`;
}

async function saveLeadToCrm(data) {
  const payload = { ...data, ...readUtmParams() };
  const res = await fetch('/api/leads', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(body.error || 'save_failed');
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body;
}

function showFormError(message) {
  const el = document.querySelector('.form__error');
  if (!el) return;
  el.textContent = message;
  el.hidden = !message;
}

async function handleFormSubmit(event) {
  event.preventDefault();
  showFormError('');

  const form = event.currentTarget;
  const submitBtn = form.querySelector('.form__submit');
  const data = Object.fromEntries(new FormData(form).entries());
  const utm = readUtmParams();

  submitBtn.disabled = true;
  const originalLabel = submitBtn.querySelector('span')?.textContent;
  if (submitBtn.querySelector('span')) {
    submitBtn.querySelector('span').textContent = 'Saving…';
  }

  let leadId = null;
  try {
    const saved = await saveLeadToCrm(data);
    leadId = saved.id || saved.lead?.id || null;
  } catch (err) {
    console.warn('CRM save failed, continuing to WhatsApp:', err);
    if (err.status === 429) {
      showFormError(`Please wait ${err.body?.retryAfterSec || 45}s before submitting again.`);
      submitBtn.disabled = false;
      if (submitBtn.querySelector('span') && originalLabel) {
        submitBtn.querySelector('span').textContent = originalLabel;
      }
      return;
    }
    showFormError('Could not save to CRM right now — you can still continue on WhatsApp.');
  }

  const url = buildWhatsAppUrl(data, utm, leadId);
  form.classList.add('is-submitted');
  const success = form.querySelector('.form__success');
  if (success) {
    success.classList.add('is-visible');
    if (leadId) {
      success.querySelector('[data-lead-ref]')?.replaceChildren(document.createTextNode(leadId));
    }
  }

  window.open(url, '_blank', 'noopener,noreferrer');
  submitBtn.disabled = false;
  if (submitBtn.querySelector('span') && originalLabel) {
    submitBtn.querySelector('span').textContent = originalLabel;
  }
}

function bindUtmFields() {
  const utm = readUtmParams();
  Object.entries(utm).forEach(([key, value]) => {
    const input = document.querySelector(`input[name="${key}"]`);
    if (input) input.value = value;
  });
}

document.addEventListener('DOMContentLoaded', () => {
  bindUtmFields();

  document.querySelectorAll('[data-scroll-form]').forEach((el) => {
    el.addEventListener('click', scrollToForm);
  });

  const form = document.getElementById('eduos-form');
  if (form) form.addEventListener('submit', handleFormSubmit);
});

window.scrollToForm = scrollToForm;
