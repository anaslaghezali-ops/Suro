/* SURO UI — Navigation, FAQ, sticky CTA */

(function () {
  const HEADER_SCROLL_OFFSET = 80;

  function scrollToSection(hash, behavior) {
    if (!hash || hash === '#') return;
    const id = hash.replace(/^#/, '');
    const el = document.getElementById(id);
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - HEADER_SCROLL_OFFSET;
    window.scrollTo({ top: Math.max(0, top), behavior: behavior || 'smooth' });
  }

  // Mobile nav
  const toggle = document.getElementById('nav-toggle');
  const mobileNav = document.getElementById('nav-mobile');

  function setMobileNavOpen(open) {
    if (!mobileNav || !toggle) return;
    mobileNav.classList.toggle('open', open);
    toggle.setAttribute('aria-expanded', open);
    mobileNav.setAttribute('aria-hidden', !open);
    document.body.classList.toggle('nav-open', open);
  }

  if (toggle && mobileNav) {
    toggle.addEventListener('click', () => {
      setMobileNavOpen(!mobileNav.classList.contains('open'));
    });

    mobileNav.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => setMobileNavOpen(false));
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && mobileNav.classList.contains('open')) {
        setMobileNavOpen(false);
        toggle.focus();
      }
    });
  }

  // Ancres internes (menu + footer)
  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener('click', (e) => {
      const hash = link.getAttribute('href');
      if (!hash || hash === '#') return;
      const target = document.getElementById(hash.slice(1));
      if (!target) return;
      e.preventDefault();
      setMobileNavOpen(false);
      scrollToSection(hash, 'smooth');
      history.pushState(null, '', hash);
    });
  });

  if (location.hash) {
    requestAnimationFrame(() => scrollToSection(location.hash, 'auto'));
  }

  window.addEventListener('hashchange', () => {
    if (location.hash) scrollToSection(location.hash, 'smooth');
  });

  // FAQ accordion (WAI-ARIA pattern)
  document.querySelectorAll('.faq-item').forEach((item, index) => {
    const btn = item.querySelector('.faq-question');
    const answer = item.querySelector('.faq-answer');
    if (!btn || !answer) return;

    const answerId = `faq-answer-${index + 1}`;
    answer.id = answerId;
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-controls', answerId);
    answer.setAttribute('role', 'region');
    answer.setAttribute('aria-labelledby', answerId + '-label');
    btn.id = answerId + '-label';

    btn.addEventListener('click', () => {
      const isOpen = item.classList.contains('open');
      document.querySelectorAll('.faq-item.open').forEach((el) => {
        el.classList.remove('open');
        const q = el.querySelector('.faq-question');
        if (q) q.setAttribute('aria-expanded', 'false');
      });
      if (!isOpen) {
        item.classList.add('open');
        btn.setAttribute('aria-expanded', 'true');
      }
    });
  });

  // Sticky CTA — scroll to tunnel
  const cta = document.getElementById('sticky-cta');
  const ctaBtn = document.getElementById('sticky-cta-btn');
  const tunnel = document.querySelector('.tunnel-card');

  function scrollToTunnel() {
    if (window.SURO_API) window.SURO_API.track('cta_sticky_click');
    scrollToSection('#souscrire', 'smooth');
    if (window.SURO_FORM && window.SURO_FORM.openFocusMode && window.matchMedia('(max-width: 768px)').matches) {
      window.SURO_FORM.openFocusMode();
    }
    const firstInput = document.querySelector('.tunnel-wrapper input, .tunnel-wrapper textarea');
    if (firstInput) setTimeout(() => firstInput.focus(), 400);
  }

  if (ctaBtn) ctaBtn.addEventListener('click', scrollToTunnel);

  if (cta && tunnel && 'IntersectionObserver' in window) {
    new IntersectionObserver(
      (entries) => cta.classList.toggle('hidden', entries[0].isIntersecting),
      { threshold: 0.2 }
    ).observe(tunnel);
  } else if (cta) {
    cta.classList.remove('hidden');
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
