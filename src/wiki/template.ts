export function generateAppShell(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>FPF Specification Wiki</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet" />
<style>
${getStyles()}
</style>
</head>
<body>
<div id="app">
  <nav id="sidebar">
    <div class="sidebar-header">
      <a href="#/" class="logo">FPF Wiki</a>
      <button id="sidebar-close" class="sidebar-toggle" aria-label="Close sidebar">&times;</button>
    </div>
    <div class="sidebar-search">
      <input type="text" id="search-input" placeholder="Search patterns\u2026" autocomplete="off" />
    </div>
    <div id="search-results" class="search-results" style="display:none"></div>
    <div id="tree" class="tree"></div>
  </nav>
  <main id="content">
    <button id="sidebar-open" class="sidebar-toggle mobile-only" aria-label="Open sidebar">
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
    </button>
    <div id="breadcrumbs" class="breadcrumbs"></div>
    <div id="main-content" class="main-content">
      <div class="welcome">
        <h1>First Principles Framework</h1>
        <p class="subtitle">Core Conceptual Specification — Interactive Wiki Reader</p>
        <p>Select a pattern from the sidebar to start reading, or explore one of the guided routes below.</p>
        <div id="routes-home"></div>
      </div>
    </div>
  </main>
</div>
<script>
${getScript()}
</script>
</body>
</html>`;
}

function getStyles(): string {
  return `
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}

:root {
  --bg: #ffffff;
  --text: #0d0d0d;
  --text-secondary: #333333;
  --text-muted: #666666;
  --text-faint: #888888;
  --border: rgba(0,0,0,0.05);
  --border-medium: rgba(0,0,0,0.08);
  --surface: #fafafa;
  --brand: #18E299;
  --brand-light: #d4fae8;
  --brand-deep: #0fa76e;
  --sidebar-width: 300px;
  --content-max: 820px;
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 16px;
  --radius-pill: 9999px;
  --font: 'Inter', system-ui, -apple-system, sans-serif;
  --mono: ui-monospace, SFMono-Regular, 'Cascadia Code', monospace;
}

html { font-size: 16px; }
body {
  font-family: var(--font);
  color: var(--text);
  background: var(--bg);
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
}

#app {
  display: flex;
  min-height: 100vh;
}

/* Sidebar */
#sidebar {
  position: fixed;
  top: 0; left: 0; bottom: 0;
  width: var(--sidebar-width);
  background: var(--bg);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  z-index: 100;
  overflow: hidden;
}

.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.logo {
  font-size: 18px;
  font-weight: 600;
  color: var(--text);
  text-decoration: none;
  letter-spacing: -0.36px;
}

.sidebar-toggle {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--text-muted);
  font-size: 22px;
  padding: 4px;
  border-radius: var(--radius-md);
  line-height: 1;
}
.sidebar-toggle:hover { color: var(--text); background: var(--surface); }

#sidebar-close { display: none; }

.sidebar-search {
  padding: 12px 16px;
  flex-shrink: 0;
}

.sidebar-search input {
  width: 100%;
  padding: 8px 14px;
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-pill);
  font-family: var(--font);
  font-size: 14px;
  outline: none;
  background: var(--bg);
  color: var(--text);
}
.sidebar-search input:focus {
  border-color: var(--brand);
  box-shadow: 0 0 0 1px var(--brand);
}
.sidebar-search input::placeholder { color: var(--text-faint); }

.search-results {
  padding: 0 12px 12px;
  max-height: 300px;
  overflow-y: auto;
  flex-shrink: 0;
}
.search-results a {
  display: block;
  padding: 8px 12px;
  font-size: 14px;
  color: var(--text-secondary);
  text-decoration: none;
  border-radius: var(--radius-md);
  line-height: 1.4;
}
.search-results a:hover { background: var(--surface); color: var(--text); }
.search-results a .sr-part { font-size: 12px; color: var(--text-faint); display: block; }
.search-results .sr-empty { padding: 8px 12px; font-size: 13px; color: var(--text-faint); }

.tree {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0 24px;
}

/* Tree nodes */
.tree-group { margin-bottom: 2px; }
.tree-group-label {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-faint);
  text-transform: uppercase;
  letter-spacing: 0.6px;
  cursor: pointer;
  user-select: none;
  border-radius: 0;
  background: none;
  border: none;
  width: 100%;
  text-align: left;
  font-family: var(--font);
}
.tree-group-label:hover { color: var(--text-muted); }
.tree-group-label .chevron {
  display: inline-block;
  transition: transform 0.15s ease;
  font-size: 10px;
  color: var(--text-faint);
}
.tree-group.collapsed .chevron { transform: rotate(-90deg); }
.tree-group.collapsed .tree-children { display: none; }

.tree-children { padding: 0; }

.tree-item {
  display: block;
  padding: 5px 16px 5px 28px;
  font-size: 14px;
  font-weight: 400;
  color: var(--text-secondary);
  text-decoration: none;
  line-height: 1.4;
  cursor: pointer;
  border-left: 2px solid transparent;
  transition: background 0.1s, border-color 0.1s;
}
.tree-item:hover { background: var(--surface); color: var(--text); }
.tree-item.active {
  color: var(--brand-deep);
  background: var(--brand-light);
  border-left-color: var(--brand);
  font-weight: 500;
}
.tree-item .status-dot {
  display: inline-block;
  width: 6px; height: 6px;
  border-radius: 50%;
  margin-right: 6px;
  vertical-align: middle;
}
.status-stable { background: var(--brand); }
.status-draft { background: #f59e0b; }
.status-proposed { background: #3b82f6; }
.status-other { background: var(--text-faint); }

/* Main content */
main {
  margin-left: var(--sidebar-width);
  flex: 1;
  min-width: 0;
  padding: 32px 48px 80px;
}

.breadcrumbs {
  font-size: 13px;
  color: var(--text-faint);
  margin-bottom: 24px;
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  align-items: center;
}
.breadcrumbs a {
  color: var(--text-muted);
  text-decoration: none;
}
.breadcrumbs a:hover { color: var(--brand-deep); }
.breadcrumbs .sep { color: var(--text-faint); margin: 0 2px; }

.main-content {
  max-width: var(--content-max);
}

/* Welcome page */
.welcome h1 {
  font-size: 40px;
  font-weight: 600;
  letter-spacing: -0.8px;
  line-height: 1.1;
  margin-bottom: 12px;
}
.welcome .subtitle {
  font-size: 18px;
  color: var(--text-muted);
  margin-bottom: 16px;
  line-height: 1.5;
}
.welcome p { color: var(--text-secondary); line-height: 1.6; margin-bottom: 24px; }

.route-card {
  display: block;
  padding: 16px 20px;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  margin-bottom: 10px;
  text-decoration: none;
  color: var(--text);
  transition: border-color 0.15s, box-shadow 0.15s;
}
.route-card:hover {
  border-color: var(--border-medium);
  box-shadow: 0 2px 4px rgba(0,0,0,0.03);
}
.route-card .route-name {
  font-weight: 500;
  font-size: 15px;
  margin-bottom: 4px;
}
.route-card .route-desc {
  font-size: 13px;
  color: var(--text-muted);
}

/* Pattern page */
.pattern-header {
  margin-bottom: 32px;
  padding-bottom: 24px;
  border-bottom: 1px solid var(--border);
}
.pattern-header h1 {
  font-size: 32px;
  font-weight: 600;
  letter-spacing: -0.64px;
  line-height: 1.15;
  margin-bottom: 12px;
}
.pattern-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}
.badge {
  display: inline-flex;
  align-items: center;
  padding: 3px 10px;
  border-radius: var(--radius-pill);
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.3px;
}
.badge-status {
  background: var(--brand-light);
  color: var(--brand-deep);
}
.badge-part {
  background: var(--surface);
  color: var(--text-muted);
  border: 1px solid var(--border);
}
.badge-type {
  background: #eff6ff;
  color: #1d4ed8;
}

.pattern-keywords {
  font-size: 13px;
  color: var(--text-muted);
  line-height: 1.5;
}
.pattern-keywords strong { color: var(--text-secondary); font-weight: 500; }

/* Section content */
.section-block { margin-bottom: 32px; }
.section-block h2 {
  font-size: 22px;
  font-weight: 600;
  letter-spacing: -0.22px;
  margin-bottom: 12px;
  padding-top: 8px;
  color: var(--text);
}
.section-block h3 {
  font-size: 18px;
  font-weight: 600;
  letter-spacing: -0.18px;
  margin-bottom: 8px;
  margin-top: 20px;
  color: var(--text);
}
.section-block h4,
.section-block h5,
.section-block h6 {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 8px;
  margin-top: 16px;
  color: var(--text);
}

.section-content p {
  margin-bottom: 12px;
  color: var(--text-secondary);
  line-height: 1.7;
}
.section-content ul,
.section-content ol {
  margin-bottom: 12px;
  padding-left: 24px;
  color: var(--text-secondary);
  line-height: 1.7;
}
.section-content li { margin-bottom: 4px; }
.section-content strong { color: var(--text); font-weight: 600; }
.section-content em { font-style: italic; }

.section-content a:not(.pattern-ref) {
  color: var(--brand-deep);
  text-decoration: underline;
  text-decoration-color: rgba(15,167,110,0.3);
  text-underline-offset: 2px;
}
.section-content a:not(.pattern-ref):hover {
  color: var(--text);
  text-decoration-color: var(--text);
}

.pattern-ref {
  color: var(--brand-deep);
  text-decoration: none;
  font-weight: 500;
  padding: 1px 4px;
  border-radius: var(--radius-sm);
  background: var(--brand-light);
  transition: background 0.1s;
}
.pattern-ref:hover {
  background: var(--brand);
  color: #fff;
}

.section-content code {
  font-family: var(--mono);
  font-size: 0.9em;
  background: var(--surface);
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
}
.section-content pre {
  background: #1a1a2e;
  color: #e5e5e5;
  padding: 16px 20px;
  border-radius: var(--radius-md);
  overflow-x: auto;
  margin-bottom: 16px;
  font-size: 14px;
  line-height: 1.5;
}
.section-content pre code {
  background: none;
  border: none;
  padding: 0;
  color: inherit;
  font-size: inherit;
}

.section-content table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 16px;
  font-size: 14px;
}
.section-content th {
  text-align: left;
  padding: 8px 12px;
  border-bottom: 2px solid var(--border-medium);
  font-weight: 600;
  color: var(--text);
  background: var(--surface);
}
.section-content td {
  padding: 8px 12px;
  border-bottom: 1px solid var(--border);
  color: var(--text-secondary);
  vertical-align: top;
}
.section-content tr:hover td { background: var(--surface); }

.section-content blockquote {
  border-left: 3px solid var(--brand);
  padding: 8px 16px;
  margin: 0 0 16px;
  color: var(--text-muted);
  background: var(--surface);
  border-radius: 0 var(--radius-md) var(--radius-md) 0;
}

/* Relations */
.relations-panel {
  margin-top: 40px;
  padding-top: 24px;
  border-top: 1px solid var(--border);
}
.relations-panel h3 {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 12px;
}
.relation-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.relation-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius-pill);
  font-size: 13px;
  color: var(--text-secondary);
  text-decoration: none;
  transition: border-color 0.1s, background 0.1s;
}
.relation-chip:hover {
  border-color: var(--brand);
  background: var(--brand-light);
  color: var(--brand-deep);
}
.relation-chip .rel-kind {
  font-size: 11px;
  color: var(--text-faint);
  font-weight: 500;
}

/* Route page */
.route-header { margin-bottom: 24px; }
.route-header h1 {
  font-size: 28px;
  font-weight: 600;
  letter-spacing: -0.56px;
  margin-bottom: 8px;
}
.route-steps {
  list-style: none;
  padding: 0;
  counter-reset: step;
}
.route-step {
  counter-increment: step;
  display: flex;
  gap: 16px;
  align-items: flex-start;
  padding: 16px 0;
  border-bottom: 1px solid var(--border);
}
.route-step::before {
  content: counter(step);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px; height: 28px;
  border-radius: 50%;
  background: var(--brand-light);
  color: var(--brand-deep);
  font-size: 13px;
  font-weight: 600;
  flex-shrink: 0;
}
.route-step a {
  font-weight: 500;
  color: var(--text);
  text-decoration: none;
}
.route-step a:hover { color: var(--brand-deep); }
.route-step .step-desc { font-size: 14px; color: var(--text-muted); margin-top: 2px; }

.mobile-only { display: none; }

/* Responsive */
@media (max-width: 768px) {
  :root { --sidebar-width: 280px; }

  #sidebar {
    transform: translateX(-100%);
    transition: transform 0.25s ease;
    box-shadow: none;
  }
  #sidebar.open {
    transform: translateX(0);
    box-shadow: 4px 0 24px rgba(0,0,0,0.1);
  }
  #sidebar-close { display: block; }
  .mobile-only { display: flex; }
  main {
    margin-left: 0;
    padding: 16px 20px 60px;
  }
  .welcome h1 { font-size: 28px; }
  .pattern-header h1 { font-size: 24px; }
}
`;
}

function getScript(): string {
  return `
(function() {
  let treeData = [];
  let searchIndex = [];
  let routesData = [];
  let patternCache = {};

  async function fetchJson(url) {
    const r = await fetch(url);
    if (!r.ok) throw new Error('Failed to load ' + url);
    return r.json();
  }

  // --- Tree ---
  function renderTree(nodes) {
    const tree = document.getElementById('tree');
    tree.innerHTML = '';
    for (const group of nodes) {
      const el = document.createElement('div');
      el.className = 'tree-group';
      el.innerHTML =
        '<button class="tree-group-label"><span class="chevron">\u25BC</span> ' + esc(group.title) + '</button>' +
        '<div class="tree-children">' +
        group.children.map(function(c) {
          var dot = statusDot(c.status);
          return '<a class="tree-item" href="#/pattern/' + enc(c.id) + '" data-id="' + esc(c.id) + '">' +
            dot + esc(c.title) + '</a>';
        }).join('') +
        '</div>';
      el.querySelector('.tree-group-label').onclick = function() {
        el.classList.toggle('collapsed');
      };
      tree.appendChild(el);
    }
  }

  function statusDot(status) {
    if (!status) return '';
    var s = status.toLowerCase();
    var cls = s === 'stable' ? 'status-stable' : s === 'draft' ? 'status-draft' : s.includes('propos') ? 'status-proposed' : 'status-other';
    return '<span class="status-dot ' + cls + '" title="' + esc(status) + '"></span>';
  }

  function highlightActive(id) {
    document.querySelectorAll('.tree-item.active').forEach(function(el) { el.classList.remove('active'); });
    var el = document.querySelector('.tree-item[data-id="' + CSS.escape(id) + '"]');
    if (el) {
      el.classList.add('active');
      // expand parent group
      var group = el.closest('.tree-group');
      if (group) group.classList.remove('collapsed');
      el.scrollIntoView({ block: 'nearest' });
    }
  }

  // --- Search ---
  function initSearch() {
    var input = document.getElementById('search-input');
    var results = document.getElementById('search-results');
    input.addEventListener('input', function() {
      var q = input.value.trim().toLowerCase();
      if (q.length < 2) { results.style.display = 'none'; return; }
      var matches = searchIndex.filter(function(e) {
        return e.title.toLowerCase().includes(q) ||
          e.id.toLowerCase().includes(q) ||
          (e.keywords || []).some(function(k) { return k.toLowerCase().includes(q); }) ||
          (e.aliases || []).some(function(a) { return a.toLowerCase().includes(q); });
      }).slice(0, 20);
      if (matches.length === 0) {
        results.innerHTML = '<div class="sr-empty">No results</div>';
      } else {
        results.innerHTML = matches.map(function(m) {
          return '<a href="#/pattern/' + enc(m.id) + '">' + esc(m.title) +
            (m.part ? '<span class="sr-part">' + esc(m.part) + '</span>' : '') + '</a>';
        }).join('');
      }
      results.style.display = 'block';
    });
    document.addEventListener('click', function(e) {
      if (!results.contains(e.target) && e.target !== input) {
        results.style.display = 'none';
      }
    });
  }

  // --- Router ---
  function onHashChange() {
    var hash = location.hash || '#/';
    var m;
    if ((m = hash.match(/^#\\/pattern\\/(.+)$/))) {
      loadPattern(decodeURIComponent(m[1]));
    } else if (hash === '#/routes') {
      showRoutes();
    } else if ((m = hash.match(/^#\\/route\\/(.+)$/))) {
      showRoute(decodeURIComponent(m[1]));
    } else {
      showHome();
    }
    // close sidebar on mobile
    document.getElementById('sidebar').classList.remove('open');
  }

  // --- Pattern page ---
  async function loadPattern(id) {
    try {
      var safeId = id.replace(/[^A-Za-z0-9._:-]/g, '');
      if (!patternCache[safeId]) {
        patternCache[safeId] = await fetchJson('data/patterns/' + encodeURIComponent(safeId) + '.json');
      }
      var p = patternCache[safeId];
      renderPatternPage(p);
      highlightActive(id);
    } catch(e) {
      document.getElementById('main-content').innerHTML =
        '<div class="welcome"><h1>Not Found</h1><p>Pattern "' + esc(id) + '" was not found.</p></div>';
    }
  }

  function renderPatternPage(p) {
    var content = document.getElementById('main-content');
    var breadcrumbs = document.getElementById('breadcrumbs');

    // Breadcrumbs
    var crumbs = '<a href="#/">Home</a>';
    if (p.part) crumbs += '<span class="sep">/</span><span>' + esc(p.part) + '</span>';
    crumbs += '<span class="sep">/</span><span>' + esc(p.id) + '</span>';
    breadcrumbs.innerHTML = crumbs;

    // Header
    var html = '<div class="pattern-header">';
    html += '<h1>' + esc(p.title) + '</h1>';
    html += '<div class="pattern-meta">';
    if (p.status) html += '<span class="badge badge-status">' + esc(p.status) + '</span>';
    if (p.part) html += '<span class="badge badge-part">' + esc(p.part) + '</span>';
    if (p.type) html += '<span class="badge badge-type">' + esc(p.type) + '</span>';
    html += '</div>';
    if (p.keywords && p.keywords.length > 0) {
      html += '<div class="pattern-keywords"><strong>Keywords:</strong> ' + p.keywords.map(esc).join(', ') + '</div>';
    }
    html += '</div>';

    // Sections
    for (var i = 0; i < (p.sections || []).length; i++) {
      var s = p.sections[i];
      html += '<div class="section-block">';
      html += '<h2>' + esc(s.heading) + '</h2>';
      html += '<div class="section-content">' + s.html + '</div>';
      html += '</div>';
    }

    // Relations
    if (p.relations && p.relations.length > 0) {
      html += '<div class="relations-panel">';
      html += '<h3>Relations</h3>';
      html += '<div class="relation-list">';
      var seen = {};
      for (var j = 0; j < p.relations.length; j++) {
        var r = p.relations[j];
        var targetId = r.from === p.id ? r.to : r.from;
        var key = targetId + ':' + r.relation;
        if (seen[key]) continue;
        seen[key] = true;
        html += '<a class="relation-chip" href="#/pattern/' + enc(targetId) + '">' +
          '<span class="rel-kind">' + esc(r.relation.replace(/_/g, ' ')) + '</span> ' + esc(targetId) + '</a>';
      }
      html += '</div></div>';
    }

    content.innerHTML = html;
    window.scrollTo(0, 0);
  }

  // --- Home ---
  function showHome() {
    document.getElementById('breadcrumbs').innerHTML = '';
    document.getElementById('main-content').innerHTML =
      '<div class="welcome">' +
      '<h1>First Principles Framework</h1>' +
      '<p class="subtitle">Core Conceptual Specification \u2014 Interactive Wiki Reader</p>' +
      '<p>Select a pattern from the sidebar to start reading, or explore one of the guided routes below.</p>' +
      '<div id="routes-home"></div>' +
      '</div>';
    renderRoutesHome();
    highlightActive('');
  }

  function renderRoutesHome() {
    var el = document.getElementById('routes-home');
    if (!el || routesData.length === 0) return;
    el.innerHTML = '<h3 style="font-size:14px;font-weight:500;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:12px">Where to start</h3>' +
      routesData.map(function(r) {
        return '<a class="route-card" href="#/route/' + enc(r.id) + '">' +
          '<div class="route-name">' + esc(r.name) + '</div>' +
          '<div class="route-desc">' + esc(r.description) + '</div>' +
          '</a>';
      }).join('');
  }

  // --- Routes ---
  function showRoutes() {
    document.getElementById('breadcrumbs').innerHTML = '<a href="#/">Home</a><span class="sep">/</span><span>Routes</span>';
    var html = '<div class="route-header"><h1>Navigation Routes</h1><p style="color:var(--text-muted)">Guided paths through the FPF specification.</p></div>';
    html += routesData.map(function(r) {
      return '<a class="route-card" href="#/route/' + enc(r.id) + '">' +
        '<div class="route-name">' + esc(r.name) + '</div>' +
        '<div class="route-desc">' + esc(r.description) + '</div></a>';
    }).join('');
    document.getElementById('main-content').innerHTML = html;
    window.scrollTo(0, 0);
  }

  function showRoute(id) {
    var route = routesData.find(function(r) { return r.id === id; });
    if (!route) { showRoutes(); return; }
    document.getElementById('breadcrumbs').innerHTML =
      '<a href="#/">Home</a><span class="sep">/</span><a href="#/routes">Routes</a><span class="sep">/</span><span>' + esc(route.name) + '</span>';
    var html = '<div class="route-header"><h1>' + esc(route.name) + '</h1>';
    if (route.description) html += '<p style="color:var(--text-muted);margin-top:4px">' + esc(route.description) + '</p>';
    html += '</div>';
    html += '<ol class="route-steps">';
    for (var i = 0; i < route.steps.length; i++) {
      var step = route.steps[i];
      html += '<li class="route-step"><div><a href="#/pattern/' + enc(step.id) + '">' + esc(step.id) + ' \u2014 ' + esc(step.title) + '</a></div></li>';
    }
    html += '</ol>';
    document.getElementById('main-content').innerHTML = html;
    window.scrollTo(0, 0);
  }

  // --- Mobile sidebar ---
  document.getElementById('sidebar-open').onclick = function() {
    document.getElementById('sidebar').classList.add('open');
  };
  document.getElementById('sidebar-close').onclick = function() {
    document.getElementById('sidebar').classList.remove('open');
  };

  // --- Helpers ---
  function esc(s) { if (!s) return ''; var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
  function enc(s) { return encodeURIComponent(s); }

  // --- Init ---
  async function init() {
    try {
      var [tree, search, routes] = await Promise.all([
        fetchJson('data/tree.json'),
        fetchJson('data/search.json'),
        fetchJson('data/routes.json')
      ]);
      treeData = tree;
      searchIndex = search;
      routesData = routes;
      renderTree(treeData);
      initSearch();
      window.addEventListener('hashchange', onHashChange);
      onHashChange();
    } catch(e) {
      document.getElementById('main-content').innerHTML =
        '<div class="welcome"><h1>Loading Error</h1><p>Could not load wiki data. Make sure the data/ folder is present.</p><p style="color:var(--text-faint);font-size:13px">' + esc(String(e)) + '</p></div>';
    }
  }

  init();
})();
`;
}
