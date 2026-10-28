// Adds the signed-in app's frame (sidebar, top bar, modal, toasts) to the page.
// It lives here rather than in index.html so the served HTML holds only the public
// landing page. app.js imports this first, before anything looks these elements up.

document.body.insertAdjacentHTML('beforeend', `
  <div class="app hidden" id="appShell">
    <aside class="sidebar" id="sidebar">
      <div class="brand">
        <div class="brand-icon"><img src="img/tutorsala-logo.webp" width="128" height="128" alt="Tutorsala logo" style="width: 100%; height: 100%; object-fit: contain; border-radius: inherit;"></div>
        <div>
          <p class="brand-title">Tutorsala</p>
          <p id="brandSubtitle">Less Chasing. More Teaching.</p>
        </div>
      </div>
      <nav class="nav" id="mainNav"></nav>
      <div class="sidebar-footer">
        <div class="sidebar-user" id="sessionLabel"></div>
        <p class="sidebar-footer-tagline">Tutoring operations platform</p>
      </div>
    </aside>
    <main class="main">
      <header class="topbar">
        <button class="menu-toggle" id="menuToggle" aria-label="Toggle menu">☰</button>
        <div class="topbar-title">
          <h2 id="pageTitle">Dashboard</h2>
          <p id="pageSubtitle">Overview of your education business</p>
        </div>
        <div class="topbar-actions">
          <select id="branchSelect" class="branch-select hidden" aria-label="Filter by branch"></select>
          <select id="familyViewSelect" class="family-view-select hidden" aria-label="Switch family view">
            <option value="parent">Parent view</option>
            <option value="student">Student view</option>
          </select>
          <button class="btn btn-ghost" id="exportBtn">Export Data</button>
          <button class="btn btn-ghost" id="logoutBtn">Logout</button>
          <button class="btn btn-primary" id="quickNotifyBtn">Quick Message</button>
        </div>
      </header>
      <div class="content" id="content"></div>
    </main>
  </div>
  <div class="modal-overlay hidden" id="modalOverlay">
    <div class="modal" id="modalRoot">
      <div class="modal-header">
        <h3 id="modalTitle"></h3>
        <button class="modal-close" id="modalClose" aria-label="Close">&times;</button>
      </div>
      <div class="modal-body" id="modalBody"></div>
      <div class="modal-footer" id="modalFooter"></div>
    </div>
  </div>
  <div class="toast-container" id="toastContainer"></div>`);
