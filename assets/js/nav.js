/**
 * Universal nav bar for FieldKIT.
 * Import this module in any page <head> and call injectNav().
 * Active link is determined by matching the current filename.
 */

const NAV_LINKS = [
  { href: 'index.html',            label: '🏠 Home' },
  { href: 'project-catalog.html',  label: '📁 Projects' },
  { href: 'sample-entry.html',     label: '📝 Sample Entry' },
  { href: 'sample-manager.html',   label: '🗂 Sample Manager' },
  { href: 'standards-library.html',label: '📚 Standards' },
  { href: 'metadata-manager.html', label: '⚙️ Metadata' },
  { href: 'import-export.html',    label: '📤 Import / Export' },
];

export function injectNav() {
  const currentFile = location.pathname.split('/').pop() || 'index.html';

  const nav = document.createElement('nav');
  nav.className = 'fk-nav';
  nav.setAttribute('aria-label', 'Primary');

  for (const { href, label } of NAV_LINKS) {
    const a = document.createElement('a');
    a.href = href;
    a.textContent = label;
    if (href === currentFile) {
      a.classList.add('active');
      a.setAttribute('aria-current', 'page');
    }
    nav.appendChild(a);
  }

  // Insert into existing .fk-header-top, or append to .fk-header, or prepend to <body>
  const headerTop = document.querySelector('.fk-header-top');
  const header    = document.querySelector('.fk-header, .bee-header, header');

  if (headerTop) {
    headerTop.appendChild(nav);
  } else if (header) {
    header.appendChild(nav);
  } else {
    // No header yet — create one and prepend to body
    const wrapper = document.createElement('header');
    wrapper.className = 'fk-header';
    wrapper.appendChild(nav);
    document.body.prepend(wrapper);
  }
}

// Auto-run once DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', injectNav);
} else {
  injectNav();
}
