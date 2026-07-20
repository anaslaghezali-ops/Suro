/* SURO UI — Navigation, FAQ, sticky CTA */

(function () {
  // Mobile nav
  const toggle = document.getElementById('nav-toggle');
  const mobileNav = document.getElementById('nav-mobile');

  if (toggle && mobileNav) {
    toggle.addEventListener('click', () => {
      const open = mobileNav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open);
      mobileNav.setAttribute('aria-hidden', !open);
    });

    mobileNav.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => {
        mobileNav.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
        mobileNav.setAttribute('aria-hidden', 'true');
      });
    });
  }

  // FAQ accordion
  document.querySelectorAll('.faq-item').forEach((item) => {
    const btn = item.querySelector('.faq-question');
    if (!btn) return;
    btn.addEventListener('click', () => {
      const isOpen = item.classList.contains('open');
      document.querySelectorAll('.faq-item.open').forEach((el) => el.classList.remove('open'));
      if (!isOpen) item.classList.add('open');
    });
  });

  // Sticky CTA — scroll to tunnel
  const cta = document.getElementById('sticky-cta');
  const ctaBtn = document.getElementById('sticky-cta-btn');
  const tunnel = document.querySelector('.tunnel-card');

  function scrollToTunnel() {
    if (window.SURO_API) window.SURO_API.track('cta_sticky_click');
    const target = document.querySelector('.hero-form') || tunnel;
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const firstInput = document.querySelector('.tunnel-wrapper input');
    if (firstInput) setTimeout(() => firstInput.focus(), 400);
  }

  if (ctaBtn) ctaBtn.addEventListener('click', scrollToTunnel);

  if (cta && tunnel && 'IntersectionObserver' in window) {
    new IntersectionObserver(
      (entries) => cta.classList.toggle('hidden', entries[0].isIntersecting),
      { threshold: 0.2 }
    ).observe(tunnel);
  }

  // Enter key on form inputs → next step
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || e.shiftKey) return;
    const inTunnel = e.target.closest('.tunnel-wrapper');
    if (!inTunnel) return;
    if (e.target.tagName === 'TEXTAREA') return;
    e.preventDefault();
    if (window.SURO_FORM && window.SURO_FORM.nextStep) {
      window.SURO_FORM.nextStep();
    }
  });
})();
