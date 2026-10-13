/**
 * FBDock - Global Scripts
 * Includes Floating Pro Scroll-to-Top Button for all content pages (excluding Home page).
 */
(function () {
  'use strict';

  function initScrollToTop() {
    // 1. Check if current page is the Home Page
    // "home page e dorker nai but other page e jekhone scroll korar dorker ache sekahne ekta button add kor top / upore jawer jonno"
    var path = window.location.pathname.toLowerCase().replace(/\\/g, '/');
    var fileName = path.substring(path.lastIndexOf('/') + 1);

    var isHomeFile = (fileName === '' || fileName === 'index.html' || fileName === 'index-2.html' || fileName === 'index' || fileName === 'index-2');
    var hasHomeElements = !!document.getElementById('home-view') || (!!document.getElementById('url') && !!document.getElementById('search-form'));

    if (isHomeFile || hasHomeElements) {
      return; // Do not add on home page as requested
    }

    // 2. Prevent duplicate button injection
    if (document.getElementById('fbdock-scroll-top')) {
      return;
    }

    // 3. Create the Floating Back-to-Top Button
    var btn = document.createElement('button');
    btn.id = 'fbdock-scroll-top';
    btn.className = 'fbdock-scroll-top-btn';
    btn.setAttribute('type', 'button');
    btn.setAttribute('title', 'Scroll to top');
    btn.setAttribute('aria-label', 'Scroll to top');
    btn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 15l-6-6-6 6"></path></svg>';

    document.body.appendChild(btn);

    // 4. Toggle visibility on scroll (reveals when scrolled down > 240px)
    var scrollThreshold = 240;
    var ticking = false;

    function handleScroll() {
      var scrollY = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
      if (scrollY > scrollThreshold) {
        if (!btn.classList.contains('is-visible')) {
          btn.classList.add('is-visible');
        }
      } else {
        if (btn.classList.contains('is-visible')) {
          btn.classList.remove('is-visible');
        }
      }
      ticking = false;
    }

    window.addEventListener('scroll', function () {
      if (!ticking) {
        window.requestAnimationFrame(handleScroll);
        ticking = true;
      }
    }, { passive: true });

    // Initial check
    handleScroll();

    // 5. Smooth scroll to top on click
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      try {
        window.scrollTo({
          top: 0,
          behavior: 'smooth'
        });
      } catch (err) {
        window.scrollTo(0, 0);
      }

      if (window.jQuery) {
        window.jQuery('html, body').animate({ scrollTop: 0 }, 300);
      }
    });
  }

  // Initialize once DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initScrollToTop);
  } else {
    initScrollToTop();
  }
})();
