/**
 * SweetXXorn - Core Script Module (Multi-Page Architecture)
 * Handles navigation paths, custom video players, simulated checkouts, and dashboard panels.
 */

import {
  isUsingMock, subscribeToAuth, loginUser, registerUser, logoutUser,
  sendPasswordReset, changeAdminPassword, fetchVideos, addVideo, updateVideo, deleteVideo,
  incrementVideoViews, fetchCategories, addCategory, deleteCategory, fetchPlans, updatePlan,
  fetchPayments, addPaymentRecord, fetchUsers, updateUserRole, fetchSettings, updateSettings,
  fetchAnnouncements, addAnnouncement, updateAnnouncement, deleteAnnouncement, uploadFile,
  saveSupabaseConfig, clearSupabaseConfig
} from './supabase.js';

// ----------------------------------------------------
// STATE VARIABLES
// ----------------------------------------------------
let currentUser = null;
let currentVideos = [];
let currentCategories = [];
let currentPlans = [];
let currentAnnouncements = [];
let currentSettings = {};
let activeVideo = null;
let activePlan = null;
let activeCurrency = localStorage.getItem("sxx_currency") || "USD";

// Custom Player states
let isVideoFinished = false;

// Path Detector
const path = window.location.pathname.toLowerCase();
const isPlayer = path.includes("player.html");
const isDashboard = path.includes("dashboard.html");
const isAdmin = path.includes("admin.html");
const isLogin = path.includes("login.html");
const isIndex = !isPlayer && !isDashboard && !isAdmin && !isLogin;

// ----------------------------------------------------
// INITIALIZATION
// ----------------------------------------------------
function initializeCore() {
  try { initNavbarScroll(); } catch (e) { console.error("Error in initNavbarScroll:", e); }
  try { initMobileMenu(); } catch (e) { console.error("Error in initMobileMenu:", e); }
  try {
    injectGlobalSidebar();
    setupSidebarToggle();
  } catch (e) {
    console.error("Error setting up global sidebar:", e);
  }
  try { setupAuthModals(); } catch (e) { console.error("Error in setupAuthModals:", e); }
  try { setupDynamicCurrency(); } catch (e) { console.error("Error in setupDynamicCurrency:", e); }
  try { setupStaticFooterModals(); } catch (e) { console.error("Error in setupStaticFooterModals:", e); }

  // Page-specific setup
  try {
    if (isIndex) {
      setupIndexPage();
    } else if (isPlayer) {
      setupPlayerPage();
    } else if (isDashboard) {
      setupDashboardPage();
    } else if (isAdmin) {
      setupAdminPage();
    }
  } catch (e) {
    console.error("Error in page-specific setup:", e);
  }

  try {
    checkURLCategoryFilter();
  } catch (e) {
    console.error("Error checking URL category filter:", e);
  }

  // Subscribe to Authentication changes globally
  try {
    subscribeToAuth(handleAuthStateChange);
  } catch (e) {
    console.error("Error in subscribeToAuth:", e);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeCore);
} else {
  initializeCore();
}

// Scroll listener to style navbar
function initNavbarScroll() {
  const navbar = document.getElementById("main-navbar");
  if (navbar) {
    window.addEventListener("scroll", () => {
      if (window.scrollY > 50) {
        navbar.classList.add("scrolled");
      } else {
        navbar.classList.remove("scrolled");
      }
    });
  }
}

// Mobile sidebar links toggle
function initMobileMenu() {
  const mobileToggle = document.getElementById("mobile-menu-toggle");
  const navLinks = document.getElementById("navbar-links");

  if (mobileToggle && navLinks) {
    mobileToggle.addEventListener("click", () => {
      navLinks.classList.toggle("show");
      const icon = mobileToggle.querySelector("i");
      if (navLinks.classList.contains("show")) {
        icon.className = "fa-solid fa-xmark";
      } else {
        icon.className = "fa-solid fa-bars";
      }
    });
  }
}

// Setup Currency filter controls
function setupDynamicCurrency() {
  const selector = document.getElementById("currency-selector");
  if (selector) {
    selector.value = activeCurrency;
    selector.addEventListener("change", (e) => {
      activeCurrency = e.target.value;
      localStorage.setItem("sxx_currency", activeCurrency);
      // Rerender pricing if paywall modal is currently open
      const plansOverlay = document.getElementById("plans-modal-overlay");
      if (plansOverlay && plansOverlay.classList.contains("show")) {
        renderPricingPlans();
      }
    });
  }
}

// Render Navbar Links dynamically
function renderNavbarLinks() {
  const navbarLinks = document.getElementById("navbar-links");
  if (!navbarLinks) return;

  const currencySelector = document.getElementById("currency-selector");
  const currencyHTML = currencySelector ? currencySelector.outerHTML : "";

  let linksHTML = `<a href="index.html" class="${isIndex ? 'active' : ''}">Home</a>`;
  
  if (currentUser) {
    linksHTML += `<a href="dashboard.html" class="${isDashboard ? 'active' : ''}">Profile</a>`;
    if (currentUser.role === "admin") {
      linksHTML += `<a href="admin.html" class="${isAdmin ? 'active' : ''}">Admin</a>`;
    }
  } else {
    linksHTML += `<a href="login.html" class="${isDashboard ? 'active' : ''}">Profile</a>`;
  }

  navbarLinks.innerHTML = linksHTML + currencyHTML;
  setupDynamicCurrency();
}

// ----------------------------------------------------
// AUTHENTICATION STATE CHANGE HANDLING
// ----------------------------------------------------
function handleAuthStateChange(user) {
  currentUser = user;
  try { renderNavbarLinks(); } catch (e) { console.error("Error in renderNavbarLinks:", e); }
  const navAuthContainer = document.getElementById("auth-nav-container");

  // Authentication access guard for Admin page
  if (isAdmin && currentUser && currentUser.role !== "admin") {
    alert("Access Denied. Admin privilege required.");
    window.location.href = "index.html";
    return;
  }

  if (currentUser) {
    if (isLogin) {
      if (currentUser.role === "admin") {
        window.location.href = "admin.html";
      } else {
        window.location.href = "index.html";
      }
      return;
    }
    
    // Hide the Login / VIP button completely when logged in
    if (navAuthContainer) {
      navAuthContainer.innerHTML = "";
    }
    
    // Sync body class states for sidebar conditional display
    updateSidebarUserPanel();

    closeModal("auth-modal-overlay");
  } else {
    // If not logged in, set default login trigger
    if (navAuthContainer) {
      navAuthContainer.innerHTML = `<a href="login.html" class="btn btn-primary" id="navbar-login-btn">Login / VIP</a>`;
    }
    
    // Sync body class states
    updateSidebarUserPanel();

    // Redirect guest users away from protected pages
    if (isDashboard || isAdmin) {
      window.location.href = "index.html";
    }
  }

  // Load relevant page contents depending on current file
  loadPageData();
}

// ----------------------------------------------------
// PAGE ROUTERS & CORE DATA LOADERS
// ----------------------------------------------------
async function loadPageData() {
  try {
    currentVideos = await fetchVideos();
    currentCategories = await fetchCategories();
    currentAnnouncements = await fetchAnnouncements();
    currentPlans = await fetchPlans();
    currentSettings = await fetchSettings();

    renderAnnouncements();

    if (isIndex) {
      renderCategoryChips();
      renderVideoLibrary();
    } else if (isPlayer) {
      loadPlayerDetails();
    } else if (isDashboard) {
      loadUserDashboard();
    } else if (isAdmin) {
      loadAdminDashboard();
    }
  } catch (err) {
    console.error("Error loading system page data:", err);
  }
}

// Announcements pinned banner render
function renderAnnouncements() {
  const banner = document.getElementById("announcement-bar");
  const textEl = document.getElementById("announcement-text");

  if (banner && textEl) {
    const pinned = currentAnnouncements.find(a => a.pinned === true || a.pinned === "true");
    if (pinned) {
      textEl.innerHTML = `✨ <strong>${pinned.title}:</strong> ${pinned.content}`;
      banner.style.display = "block";
    } else {
      banner.style.display = "none";
    }
  }
}

// ----------------------------------------------------
// INDEX PAGE LOGIC
// ----------------------------------------------------
function setupIndexPage() {
  // Setup Search Bar
  const searchInput = document.getElementById("global-search-input");
  if (searchInput) {
    searchInput.addEventListener("input", debounce(() => {
      const activeChip = document.querySelector("#categories-carousel .category-chip.active");
      const slug = activeChip ? activeChip.dataset.slug : "all";
      renderVideoLibrary(slug, searchInput.value);
    }, 300));
  }

  setupSubscriptionPaywall();
  setupCheckoutFlow();

  // Swiper feed initializer removed
}

function renderCategoryChips() {
  const carousel = document.getElementById("categories-carousel");
  if (!carousel) return;

  carousel.innerHTML = `<div class="category-chip active" data-slug="all">All Genres</div>`;

  currentCategories.forEach(cat => {
    const chip = document.createElement("div");
    chip.className = "category-chip";
    chip.dataset.slug = cat.slug;
    chip.innerText = cat.name;
    carousel.appendChild(chip);
  });

  carousel.querySelectorAll(".category-chip").forEach(chip => {
    chip.addEventListener("click", () => {
      carousel.querySelector(".category-chip.active").classList.remove("active");
      chip.classList.add("active");
      const searchInput = document.getElementById("global-search-input");
      renderVideoLibrary(chip.dataset.slug, searchInput ? searchInput.value : "");
    });
  });
}

function renderVideoLibrary(filterCategory = "all", searchQuery = "") {
  const featuredGrid = document.getElementById("featured-grid");
  const trendingGrid = document.getElementById("trending-grid");
  const recommendedGrid = document.getElementById("recommended-grid");
  const recentGrid = document.getElementById("recent-grid");

  if (!featuredGrid) return; // Guard for index layout

  let filtered = [...currentVideos];

  if (filterCategory !== "all") {
    filtered = filtered.filter(v => v.category.toLowerCase() === filterCategory.toLowerCase());
  }

  if (searchQuery.trim() !== "") {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter(v =>
      v.title.toLowerCase().includes(q) ||
      v.description.toLowerCase().includes(q) ||
      (v.tags && v.tags.some(tag => tag.toLowerCase().includes(q)))
    );
  }

  featuredGrid.innerHTML = "";
  trendingGrid.innerHTML = "";
  recommendedGrid.innerHTML = "";
  recentGrid.innerHTML = "";

  const spotlightVideo = filtered.find(v => v.premiumOnly) || filtered[0];
  if (spotlightVideo) {
    updateHeroSpotlight(spotlightVideo);
  }

  filtered.forEach((video, index) => {
    const card = createVideoCard(video);
    if (video.premiumOnly) {
      featuredGrid.appendChild(card.cloneNode(true));
    }
    if (index % 2 === 0) {
      recommendedGrid.appendChild(card.cloneNode(true));
    }
    recentGrid.appendChild(card.cloneNode(true));
  });

  // Trending section sorted by view counts
  const trendingVideos = [...currentVideos]
    .sort((a, b) => (b.views || 0) - (a.views || 0))
    .slice(0, 4);

  trendingVideos.forEach((video, index) => {
    const container = document.createElement("div");
    container.className = "trending-card";
    const rankNum = document.createElement("div");
    rankNum.className = "trending-rank";
    rankNum.innerText = index + 1;

    const card = createVideoCard(video);
    container.appendChild(rankNum);
    container.appendChild(card);
    trendingGrid.appendChild(container);
  });

  // Set card navigation redirections using event delegation.
  const attachCardNavigation = (grid) => {
    if (!grid) return;
    grid.addEventListener("click", (event) => {
      const card = event.target.closest(".video-card");
      if (!card || !grid.contains(card)) return;
      event.preventDefault();
      const videoId = card.dataset.id || new URL(card.href, window.location.href).searchParams.get("id");
      if (videoId) {
        window.location.href = `player.html?id=${videoId}`;
      }
    });
  };

  attachCardNavigation(featuredGrid);
  attachCardNavigation(trendingGrid);
  attachCardNavigation(recommendedGrid);
  attachCardNavigation(recentGrid);

  checkEmptyGrid(featuredGrid, "No featured premium content found.");
  checkEmptyGrid(trendingGrid, "No trending content found.");
  checkEmptyGrid(recommendedGrid, "No recommendations available.");
  checkEmptyGrid(recentGrid, "No videos uploaded yet.");
}

function updateHeroSpotlight(video) {
  document.getElementById("hero-video-tag").innerText = video.premiumOnly ? "VIP EXCLUSIVE" : "FREE TRIAL";
  document.getElementById("hero-video-title").innerText = video.title;
  document.getElementById("hero-video-duration").innerText = video.premiumOnly ? `${video.previewDuration}s Preview` : "Full Free View";
  document.getElementById("hero-video-desc").innerText = video.description;

  // Dynamic customized background
  const bgUrl = currentSettings.heroBgUrl || video.thumbnailUrl;
  document.getElementById("hero-bg-img").style.backgroundImage = `url('${bgUrl}')`;

  const playBtn = document.getElementById("hero-play-btn");
  const infoBtn = document.getElementById("hero-info-btn");

  const newPlayBtn = playBtn.cloneNode(true);
  const newInfoBtn = infoBtn.cloneNode(true);

  if (newPlayBtn.tagName.toLowerCase() === "a") {
    newPlayBtn.href = `player.html?id=${video.id}`;
  }

  playBtn.replaceWith(newPlayBtn);
  infoBtn.replaceWith(newInfoBtn);

  document.getElementById("hero-play-btn").addEventListener("click", (e) => {
    e.preventDefault();
    window.location.href = `player.html?id=${video.id}`;
  });
  document.getElementById("hero-info-btn").addEventListener("click", () => {
    openModal("plans-modal-overlay");
    renderPricingPlans();
  });
}

function createVideoCard(video) {
  const card = document.createElement("a");
  card.className = "video-card";
  card.href = `player.html?id=${video.id}`;
  card.dataset.id = video.id;
  card.innerHTML = `
    <div class="video-card-thumb" style="background-image: url('${video.thumbnailUrl}');">
      <span class="video-badge ${video.premiumOnly ? 'premium' : 'free'}">${video.premiumOnly ? 'VIP' : 'FREE'}</span>
      <div class="video-play-hover"><i class="fa-solid fa-circle-play"></i></div>
    </div>
    <div class="video-card-info">
      <h4 class="video-card-title">${video.title}</h4>
      <div class="video-card-meta">
        <span><i class="fa-solid fa-eye"></i> ${video.views || 0}</span>
        <span>${video.premiumOnly ? video.previewDuration + 's Preview' : 'Full Free'}</span>
      </div>
    </div>
  `;
  return card;
}

function checkEmptyGrid(grid, msg) {
  if (grid.children.length === 0) {
    grid.innerHTML = `<p class="text-secondary" style="grid-column: 1/-1; padding: 20px 0; text-align:center;">${msg}</p>`;
  }
}

// ----------------------------------------------------
// VIDEO PLAYER PAGE LOGIC
// ----------------------------------------------------
const videoElement = document.getElementById("video-element");
const playerWrapper = document.getElementById("custom-player-wrapper");

function setupPlayerPage() {
  setupCustomPlayerControls();
  setupSubscriptionPaywall();
  setupCheckoutFlow();
}

async function loadPlayerDetails() {
  const urlParams = new URLSearchParams(window.location.search);
  const videoId = urlParams.get("id");

  if (!videoId) {
    window.location.href = "index.html";
    return;
  }

  activeVideo = currentVideos.find(v => v.id === videoId);
  if (!activeVideo) {
    window.location.href = "index.html";
    return;
  }

  // Populate Details
  document.getElementById("player-detail-title").innerText = activeVideo.title;
  document.getElementById("player-detail-desc").innerText = activeVideo.description;

  const tagsContainer = document.getElementById("player-detail-tags");
  tagsContainer.innerHTML = "";
  if (activeVideo.tags) {
    activeVideo.tags.forEach(t => {
      const el = document.createElement("span");
      el.className = "video-detail-tag";
      el.innerText = `#${t}`;
      tagsContainer.appendChild(el);
    });
  }

  // Load Source
  if (videoElement) {
    videoElement.src = activeVideo.videoUrl;
    videoElement.load();
    resetCustomPlayer();

    // Play video after short delay
    setTimeout(() => {
      videoElement.play().catch(e => console.log("Auto playback block by browser policy"));
    }, 500);

    // Increment View count
    incrementVideoViews(activeVideo.id);
  }
}

function setupCustomPlayerControls() {
  if (!videoElement) return;

  const playBtn = document.getElementById("player-play-btn");
  const muteBtn = document.getElementById("player-mute-btn");
  const volumeSlider = document.getElementById("player-volume");
  const speedBtn = document.getElementById("player-speed-btn");
  const fullscreenBtn = document.getElementById("player-fullscreen-btn");
  const timeline = document.getElementById("player-timeline");

  const togglePlay = () => {
    if (isVideoFinished) return;
    if (videoElement.paused) {
      videoElement.play();
      playBtn.innerHTML = `<i class="fa-solid fa-pause"></i>`;
    } else {
      videoElement.pause();
      playBtn.innerHTML = `<i class="fa-solid fa-play"></i>`;
    }
  };

  playBtn.addEventListener("click", togglePlay);
  videoElement.addEventListener("click", togglePlay);
  videoElement.addEventListener("timeupdate", handlePlayerTimeUpdate);
  timeline.addEventListener("click", handlePlayerSeek);

  muteBtn.addEventListener("click", () => {
    videoElement.muted = !videoElement.muted;
    updateVolumeIcon(videoElement, muteBtn);
  });

  volumeSlider.addEventListener("input", (e) => {
    videoElement.volume = e.target.value;
    videoElement.muted = (videoElement.volume === 0);
    updateVolumeIcon(videoElement, muteBtn);
  });

  const speeds = [1.0, 1.25, 1.5, 2.0];
  let speedIdx = 0;
  speedBtn.addEventListener("click", () => {
    speedIdx = (speedIdx + 1) % speeds.length;
    videoElement.playbackRate = speeds[speedIdx];
    speedBtn.innerText = `${speeds[speedIdx]}x`;
  });

  fullscreenBtn.addEventListener("click", () => {
    if (!document.fullscreenElement) {
      playerWrapper.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  });

  document.getElementById("paywall-unlock-btn").addEventListener("click", () => {
    openModal("plans-modal-overlay");
    renderPricingPlans();
  });
}

function handlePlayerTimeUpdate() {
  if (!activeVideo || !videoElement) return;

  const current = videoElement.currentTime;
  const duration = videoElement.duration || 0;

  const timeDisplay = document.getElementById("player-time-display");
  const timelineFill = document.getElementById("player-timeline-fill");
  const countdownBadge = document.getElementById("player-countdown-badge");
  const lockOverlay = document.getElementById("paywall-lock-overlay");

  timeDisplay.innerText = `${formatTime(current)} / ${formatTime(duration)}`;
  timelineFill.style.width = `${(current / (duration || 1)) * 100}%`;

  const isPremiumUser = currentUser && currentUser.subscription && currentUser.subscription.status === "active";

  if (activeVideo.premiumOnly && !isPremiumUser) {
    const limit = Number(activeVideo.previewDuration);
    countdownBadge.style.display = "block";

    const remaining = Math.max(0, Math.ceil(limit - current));
    countdownBadge.innerText = `Preview: ${remaining}s left`;

    if (current >= limit) {
      videoElement.pause();
      document.getElementById("player-play-btn").innerHTML = `<i class="fa-solid fa-play"></i>`;
      playerWrapper.classList.add("premium-locked");
      lockOverlay.style.display = "flex";
      isVideoFinished = true;
      countdownBadge.innerText = "Premium Locked";
    }
  } else {
    countdownBadge.style.display = "none";
  }
}

function handlePlayerSeek(e) {
  if (isVideoFinished || !videoElement) return;
  const timeline = document.getElementById("player-timeline");
  const rect = timeline.getBoundingClientRect();
  const clickX = e.clientX - rect.left;
  const seekPct = clickX / rect.width;
  const seekTime = seekPct * videoElement.duration;

  const isPremiumUser = currentUser && currentUser.subscription && currentUser.subscription.status === "active";
  if (activeVideo.premiumOnly && !isPremiumUser) {
    const limit = Number(activeVideo.previewDuration);
    if (seekTime > limit) {
      videoElement.currentTime = limit;
      return;
    }
  }
  videoElement.currentTime = seekTime;
}

function resetCustomPlayer() {
  isVideoFinished = false;
  const lockOverlay = document.getElementById("paywall-lock-overlay");
  const countdownBadge = document.getElementById("player-countdown-badge");
  const timelineFill = document.getElementById("player-timeline-fill");
  const playBtn = document.getElementById("player-play-btn");

  if (playerWrapper) playerWrapper.classList.remove("premium-locked");
  if (lockOverlay) lockOverlay.style.display = "none";
  if (countdownBadge) countdownBadge.style.display = "none";
  if (timelineFill) timelineFill.style.width = "0%";
  if (playBtn) playBtn.innerHTML = `<i class="fa-solid fa-play"></i>`;
}

function updateVolumeIcon(vid, btn) {
  if (vid.muted || vid.volume === 0) {
    btn.innerHTML = `<i class="fa-solid fa-volume-xmark"></i>`;
  } else if (vid.volume < 0.5) {
    btn.innerHTML = `<i class="fa-solid fa-volume-low"></i>`;
  } else {
    btn.innerHTML = `<i class="fa-solid fa-volume-high"></i>`;
  }
}

// ----------------------------------------------------
// USER PORTAL DASHBOARD LOGIC (dashboard.html)
// ----------------------------------------------------
function setupDashboardPage() {
  setupUserDashboardTabs();
  setupSubscriptionPaywall();
  setupCheckoutFlow();
}

function setupUserDashboardTabs() {
  const sidebarButtons = document.querySelectorAll("#user-sidebar-controls .sidebar-btn");
  sidebarButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      // Toggle sidebar active states
      sidebarButtons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      // Display matching panel
      const targetId = btn.dataset.target;
      document.querySelectorAll("#user-tab-contents .dashboard-content-panel").forEach(panel => {
        panel.classList.remove("active");
      });
      document.getElementById(targetId).classList.add("active");
    });
  });

  // Password reset listener
  const passForm = document.getElementById("user-password-change-form");
  if (passForm) {
    passForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const pass = document.getElementById("user-new-password").value;
      const errorEl = document.getElementById("user-sec-error");
      const successEl = document.getElementById("user-sec-success");

      errorEl.style.display = "none";
      successEl.style.display = "none";

      try {
        await changeAdminPassword(pass);
        successEl.innerText = "Password successfully modified!";
        successEl.style.display = "block";
        passForm.reset();
      } catch (err) {
        errorEl.innerText = err.message;
        errorEl.style.display = "block";
      }
    });
  }

  // Change / Upgrade plan button
  const upgradeBtn = document.getElementById("user-dash-upgrade-btn");
  if (upgradeBtn) {
    upgradeBtn.addEventListener("click", () => {
      openModal("plans-modal-overlay");
      renderPricingPlans();
    });
  }
}

async function loadUserDashboard() {
  if (!currentUser) return;

  document.getElementById("user-dash-name").innerText = currentUser.displayName || "Account User";
  document.getElementById("user-dash-email").innerText = currentUser.email;
  document.getElementById("user-avatar-initials").innerText = (currentUser.displayName || currentUser.email).charAt(0).toUpperCase();

  const planTitle = document.getElementById("user-dash-plan-title");
  const planExpiry = document.getElementById("user-dash-plan-expiry");
  const activePlanSub = currentUser.subscription;

  if (activePlanSub && activePlanSub.status === "active") {
    const activeDetails = currentPlans.find(p => p.id === activePlanSub.planId);
    planTitle.innerHTML = `<span class="sub-status-active"><i class="fa-solid fa-crown text-gold"></i> VIP ${activeDetails ? activeDetails.name : 'Subscribed'}</span>`;
    planExpiry.innerText = `Expiration Date: ${new Date(activePlanSub.expiresAt).toLocaleDateString()}`;
  } else {
    planTitle.innerHTML = `<span class="sub-status-none">Standard Free Trial</span>`;
    planExpiry.innerText = "Locked video restrictions active.";
  }

  // Load Invoices
  const paymentsList = document.getElementById("user-payments-list");
  if (paymentsList) {
    paymentsList.innerHTML = `<tr><td colspan="6" style="text-align:center;">Retrieving invoices...</td></tr>`;

    try {
      const list = await fetchPayments();
      const userPayments = list.filter(p => p.userId === currentUser.uid);

      paymentsList.innerHTML = "";
      if (userPayments.length === 0) {
        paymentsList.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-secondary);">No past payment records found.</td></tr>`;
        return;
      }

      userPayments.forEach(p => {
        const row = document.createElement("tr");
        const symbol = p.currency === "INR" ? "₹" : "$";
        row.innerHTML = `
          <td style="font-family: monospace;">${p.transactionId}</td>
          <td>${p.gateway.toUpperCase().replace("_", " ")}</td>
          <td class="text-gold" style="font-weight:600;">${symbol}${p.amount}</td>
          <td>${p.planId}</td>
          <td><span class="sub-status-active">${p.status}</span></td>
          <td>${new Date(p.timestamp).toLocaleDateString()}</td>
        `;
        paymentsList.appendChild(row);
      });
    } catch (e) {
      paymentsList.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--danger-color);">Error fetching invoices.</td></tr>`;
    }
  }
}

// ----------------------------------------------------
// ADMINISTRATIVE DASHBOARD LOGIC (admin.html)
// ----------------------------------------------------
function setupAdminPage() {
  setupAdminDashboardTabs();
}

function setupAdminDashboardTabs() {
  const sidebarButtons = document.querySelectorAll("#admin-sidebar-controls .sidebar-btn");
  sidebarButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      sidebarButtons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      const targetId = btn.dataset.target;
      document.querySelectorAll("#admin-tab-contents .dashboard-content-panel").forEach(panel => {
        panel.classList.remove("active");
      });
      document.getElementById(targetId).classList.add("active");
    });
  });

  // Logout admin
  document.getElementById("admin-logout-btn").addEventListener("click", async () => {
    await logoutUser();
    window.location.href = "index.html";
  });

  // Video Upload Modals
  document.getElementById("admin-add-video-btn").addEventListener("click", () => {
    document.getElementById("video-upload-modal-title").innerText = "Upload Video Stream";
    document.getElementById("admin-upload-video-form").reset();
    document.getElementById("upload-video-id").value = "";
    document.getElementById("upload-progress-box").style.display = "none";
    populateCategoryDropdown();
    openModal("upload-video-modal-overlay");
  });

  document.getElementById("upload-close-btn").addEventListener("click", () => closeModal("upload-video-modal-overlay"));
  document.getElementById("admin-upload-video-form").addEventListener("submit", handleVideoPublishSubmit);

  // Category Add CRUD
  document.getElementById("admin-add-category-form").addEventListener("submit", handleCategoryAddSubmit);

  // Announcements
  document.getElementById("admin-create-ann-btn").addEventListener("click", () => {
    document.getElementById("ann-modal-title").innerText = "Publish System Announcement";
    document.getElementById("admin-announcement-form").reset();
    document.getElementById("ann-id").value = "";
    openModal("ann-modal-overlay");
  });

  document.getElementById("ann-close-btn").addEventListener("click", () => closeModal("ann-modal-overlay"));
  document.getElementById("admin-announcement-form").addEventListener("submit", handleAnnouncementSubmit);

  // Keys forms
  document.getElementById("admin-sb-keys-form").addEventListener("submit", handleSupabaseKeySubmit);
  document.getElementById("admin-sb-reset-btn").addEventListener("click", () => {
    clearSupabaseConfig();
    alert("Supabase reset. Page will reload to run in LocalStorage Mock Mode.");
    window.location.reload();
  });

  document.getElementById("admin-payment-gateways-form").addEventListener("submit", handleGatewaySettingsSubmit);

  document.getElementById("admin-password-change-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const newPass = document.getElementById("admin-new-pass").value;
    try {
      await changeAdminPassword(newPass);
      alert("Administrative password changed successfully!");
      document.getElementById("admin-password-change-form").reset();
    } catch (err) {
      alert("Error: " + err.message);
    }
  });
}

async function loadAdminDashboard() {
  let totalViews = 0;
  currentVideos.forEach(v => totalViews += (v.views || 0));
  document.getElementById("stat-total-views").innerText = totalViews;

  const usersList = await fetchUsers();
  document.getElementById("stat-total-users").innerText = usersList.length;

  const vipCount = usersList.filter(u => u.subscription && u.subscription.status === "active").length;
  document.getElementById("stat-active-subs").innerText = vipCount;

  const paymentsList = await fetchPayments();
  let revUsd = 0;
  paymentsList.forEach(p => {
    if (p.status === "completed") {
      const amt = Number(p.amount);
      revUsd += p.currency === "INR" ? (amt / 83) : amt;
    }
  });
  document.getElementById("stat-total-revenue").innerText = `$${revUsd.toFixed(2)}`;

  renderAdminVideosList();
  renderAdminCategoriesList();
  renderAdminPlansList();
  renderAdminPaymentsList();
  renderAdminAnnouncementsList();
  populateSettingsForm();
}

function renderAdminVideosList() {
  const container = document.getElementById("admin-videos-list");
  container.innerHTML = "";

  currentVideos.forEach(v => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><img src="${v.thumbnailUrl}" style="width:60px; height:34px; object-fit:cover; border: 1px solid var(--glass-border); border-radius:3px;"></td>
      <td style="font-weight:600;">${v.title}</td>
      <td>${v.category}</td>
      <td><span class="video-badge ${v.premiumOnly ? 'premium' : 'free'}" style="position:static;">${v.premiumOnly ? 'VIP' : 'FREE'}</span></td>
      <td>${v.previewDuration}s</td>
      <td>${v.views || 0}</td>
      <td>
        <button class="table-action-btn edit" data-id="${v.id}"><i class="fa-solid fa-pen-to-square"></i></button>
        <button class="table-action-btn delete" data-id="${v.id}"><i class="fa-solid fa-trash-can"></i></button>
      </td>
    `;
    container.appendChild(tr);
  });

  container.querySelectorAll(".edit").forEach(btn => {
    btn.addEventListener("click", () => loadVideoToEdit(btn.dataset.id));
  });

  container.querySelectorAll(".delete").forEach(btn => {
    btn.addEventListener("click", () => handleDeleteVideo(btn.dataset.id));
  });
}

function populateCategoryDropdown() {
  const select = document.getElementById("upload-category");
  if (!select) return;
  select.innerHTML = "";
  currentCategories.forEach(c => {
    select.innerHTML += `<option value="${c.name}">${c.name}</option>`;
  });
}

async function loadVideoToEdit(id) {
  const v = currentVideos.find(video => video.id === id);
  if (!v) return;

  document.getElementById("video-upload-modal-title").innerText = "Edit Video Details";
  document.getElementById("upload-video-id").value = v.id;
  document.getElementById("upload-title").value = v.title;
  document.getElementById("upload-desc").value = v.description;

  populateCategoryDropdown();
  document.getElementById("upload-category").value = v.category;
  document.getElementById("upload-premiumOnly").value = v.premiumOnly ? "true" : "false";
  document.getElementById("upload-previewDuration").value = v.previewDuration;
  document.getElementById("upload-tags").value = v.tags ? v.tags.join(", ") : "";
  document.getElementById("upload-thumbnail-url").value = v.thumbnailUrl;
  document.getElementById("upload-video-url").value = v.videoUrl;

  document.getElementById("upload-progress-box").style.display = "none";
  openModal("upload-video-modal-overlay");
}

async function handleDeleteVideo(id) {
  if (confirm("Are you sure you want to permanently delete this video file from streaming?")) {
    try {
      await deleteVideo(id);
      alert("Video file removed successfully.");
      loadCatalogData().then(loadAdminDashboard);
    } catch (err) {
      alert("Error removing video: " + err.message);
    }
  }
}

async function handleVideoPublishSubmit(e) {
  e.preventDefault();
  const errorEl = document.getElementById("upload-error");
  errorEl.style.display = "none";

  const videoId = document.getElementById("upload-video-id").value;
  const title = document.getElementById("upload-title").value;
  const desc = document.getElementById("upload-desc").value;
  const category = document.getElementById("upload-category").value;
  const premiumOnly = document.getElementById("upload-premiumOnly").value === "true";
  const previewDuration = Number(document.getElementById("upload-previewDuration").value);
  const tags = document.getElementById("upload-tags").value.split(",").map(t => t.trim()).filter(t => t !== "");

  const thumbFile = document.getElementById("upload-thumbnail-file").files[0];
  const videoFile = document.getElementById("upload-video-file").files[0];

  const progressBox = document.getElementById("upload-progress-box");
  const progressFill = document.getElementById("upload-progress-bar-fill");
  const progressPct = document.getElementById("upload-progress-pct");
  const progressStatus = document.getElementById("upload-progress-status");

  let thumbnailUrl = document.getElementById("upload-thumbnail-url").value;
  let videoUrl = document.getElementById("upload-video-url").value;

  try {
    if (thumbFile || videoFile) {
      progressBox.style.display = "block";
      progressFill.style.width = "0%";
      progressPct.innerText = "0%";

      if (thumbFile) {
        progressStatus.innerText = "Uploading thumbnail image...";
        thumbnailUrl = await uploadFile(thumbFile, "thumbnails", (p) => {
          progressFill.style.width = `${p / 2}%`;
          progressPct.innerText = `${Math.ceil(p / 2)}%`;
        });
      }

      if (videoFile) {
        progressStatus.innerText = "Uploading cinematic stream file...";
        videoUrl = await uploadFile(videoFile, "videos", (p) => {
          const finalPct = Math.ceil(50 + (p / 2));
          progressFill.style.width = `${finalPct}%`;
          progressPct.innerText = `${finalPct}%`;
        });
      }
    }

    if (!thumbnailUrl || !videoUrl) {
      throw new Error("Missing visual elements. Paste URLs or select upload files.");
    }

    const payload = {
      title, description: desc, category, premiumOnly, previewDuration, tags, thumbnailUrl, videoUrl
    };

    if (videoId) {
      await updateVideo(videoId, payload);
      alert("Streaming catalog entry updated!");
    } else {
      await addVideo(payload);
      alert("Published new streaming title!");
    }

    closeModal("upload-video-modal-overlay");
    loadCatalogData().then(loadAdminDashboard);
  } catch (err) {
    errorEl.innerText = err.message || "Failed saving catalog entry.";
    errorEl.style.display = "block";
  }
}

function renderAdminCategoriesList() {
  const container = document.getElementById("admin-categories-list");
  container.innerHTML = "";

  currentCategories.forEach(cat => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td style="font-family: monospace;">${cat.id}</td>
      <td style="font-weight:600;">${cat.name}</td>
      <td>${cat.slug}</td>
      <td>
        <button class="table-action-btn delete" data-id="${cat.id}"><i class="fa-solid fa-trash-can"></i></button>
      </td>
    `;
    container.appendChild(tr);
  });

  container.querySelectorAll(".delete").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (confirm(`Do you wish to delete the category "${currentCategories.find(c => c.id === btn.dataset.id).name}"?`)) {
        await deleteCategory(btn.dataset.id);
        loadCatalogData().then(loadAdminDashboard);
      }
    });
  });
}

async function handleCategoryAddSubmit(e) {
  e.preventDefault();
  const input = document.getElementById("admin-new-cat-input");
  const name = input.value;
  try {
    await addCategory(name);
    input.value = "";
    loadCatalogData().then(loadAdminDashboard);
  } catch (err) {
    alert("Error: " + err.message);
  }
}

function renderAdminPlansList() {
  const container = document.getElementById("admin-plans-list");
  container.innerHTML = "";

  currentPlans.forEach(plan => {
    const tr = document.createElement("tr");
    const symbol = plan.currency === "INR" ? "₹" : "$";
    tr.innerHTML = `
      <td style="font-family:monospace;">${plan.id}</td>
      <td style="font-weight:600;">${plan.name}</td>
      <td><input type="number" class="plan-price-edit" data-id="${plan.id}" value="${plan.price}" step="0.01" style="width:70px; padding:4px; border-radius:3px; border:1px solid var(--glass-border); color:white; background:none;"></td>
      <td>${plan.currency}</td>
      <td>${plan.durationDays}</td>
      <td>
        <select class="plan-status-edit" data-id="${plan.id}" style="padding:4px; border-radius:3px; border:1px solid var(--glass-border); color:white; background:#111;">
          <option value="true" ${plan.enabled ? 'selected' : ''}>Active</option>
          <option value="false" ${!plan.enabled ? 'selected' : ''}>Disabled</option>
        </select>
      </td>
      <td>
        <button class="btn btn-secondary save-plan-row-btn" data-id="${plan.id}" style="padding: 6px 14px; font-size:0.75rem;">Save</button>
      </td>
    `;
    container.appendChild(tr);
  });

  container.querySelectorAll(".save-plan-row-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const planId = btn.dataset.id;
      const priceInput = container.querySelector(`.plan-price-edit[data-id="${planId}"]`);
      const statusSelect = container.querySelector(`.plan-status-edit[data-id="${planId}"]`);

      const price = Number(priceInput.value);
      const enabled = statusSelect.value === "true";

      try {
        await updatePlan(planId, { price, enabled });
        alert("Package config saved!");
        loadCatalogData();
      } catch (err) {
        alert("Error saving: " + err.message);
      }
    });
  });
}

function renderAdminPaymentsList() {
  const container = document.getElementById("admin-payments-list");
  container.innerHTML = `<tr><td colspan="7" style="text-align:center;">Loading ledger...</td></tr>`;

  fetchPayments().then(list => {
    container.innerHTML = "";
    if (list.length === 0) {
      container.innerHTML = `<tr><td colspan="7" style="text-align:center; color:var(--text-secondary);">No global records registered.</td></tr>`;
      return;
    }
    list.forEach(p => {
      const tr = document.createElement("tr");
      const symbol = p.currency === "INR" ? "₹" : "$";
      tr.innerHTML = `
        <td style="font-family: monospace;">${p.transactionId}</td>
        <td>${p.userEmail}</td>
        <td class="text-gold" style="font-weight:600;">${symbol}${p.amount}</td>
        <td>${p.gateway.toUpperCase().replace("_", " ")}</td>
        <td>${p.planId}</td>
        <td>${new Date(p.timestamp).toLocaleString()}</td>
        <td><span class="sub-status-active">${p.status}</span></td>
      `;
      container.appendChild(tr);
    });
  });
}

function renderAdminAnnouncementsList() {
  const container = document.getElementById("admin-announcements-list");
  container.innerHTML = "";

  currentAnnouncements.forEach(ann => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td style="font-weight:600;">${ann.title}</td>
      <td><span class="video-badge ${ann.pinned ? 'premium' : 'free'}" style="position:static;">${ann.pinned ? 'Pinned' : 'Muted'}</span></td>
      <td>${new Date(ann.createdAt).toLocaleDateString()}</td>
      <td>
        <button class="table-action-btn edit" data-id="${ann.id}"><i class="fa-solid fa-pen-to-square"></i></button>
        <button class="table-action-btn delete" data-id="${ann.id}"><i class="fa-solid fa-trash-can"></i></button>
      </td>
    `;
    container.appendChild(tr);
  });

  container.querySelectorAll(".edit").forEach(btn => {
    btn.addEventListener("click", () => {
      const ann = currentAnnouncements.find(a => a.id === btn.dataset.id);
      if (ann) {
        document.getElementById("ann-modal-title").innerText = "Edit System Announcement";
        document.getElementById("ann-id").value = ann.id;
        document.getElementById("ann-title").value = ann.title;
        document.getElementById("ann-content").value = ann.content;
        document.getElementById("ann-pinned").value = ann.pinned ? "true" : "false";
        openModal("ann-modal-overlay");
      }
    });
  });

  container.querySelectorAll(".delete").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (confirm("Delete this notification banner?")) {
        await deleteAnnouncement(btn.dataset.id);
        loadCatalogData().then(loadAdminDashboard);
      }
    });
  });
}

async function handleAnnouncementSubmit(e) {
  e.preventDefault();
  const annId = document.getElementById("ann-id").value;
  const title = document.getElementById("ann-title").value;
  const content = document.getElementById("ann-content").value;
  const pinned = document.getElementById("ann-pinned").value === "true";

  try {
    if (annId) {
      await updateAnnouncement(annId, { title, content, pinned });
      alert("Notification updated!");
    } else {
      await addAnnouncement({ title, content, pinned });
      alert("Notification published!");
    }
    closeModal("ann-modal-overlay");
    loadCatalogData().then(loadAdminDashboard);
  } catch (err) {
    alert("Error: " + err.message);
  }
}

function populateSettingsForm() {
  const config = JSON.parse(localStorage.getItem("sweetxxorn_supabase_config") || "{}");
  document.getElementById("sb-url").value = config.supabaseUrl || "";
  document.getElementById("sb-anonKey").value = config.supabaseKey || "";

  document.getElementById("api-stripeKey").value = currentSettings.stripeKey || "";
  document.getElementById("api-razorpayKey").value = currentSettings.razorpayKey || "";
  document.getElementById("api-paypalKey").value = currentSettings.paypalKey || "";
  document.getElementById("api-defaultGateway").value = currentSettings.defaultGateway || "stripe";
  document.getElementById("api-taxPercentage").value = currentSettings.taxPercentage || 0;
  document.getElementById("api-heroBgUrl").value = currentSettings.heroBgUrl || "";
  document.getElementById("api-heroBgFile").value = "";
}

async function handleSupabaseKeySubmit(e) {
  e.preventDefault();
  const supabaseUrl = document.getElementById("sb-url").value.trim();
  const supabaseKey = document.getElementById("sb-anonKey").value.trim();

  const config = { supabaseUrl, supabaseKey };

  const success = saveSupabaseConfig(config);
  if (success) {
    alert("Real Supabase credentials successfully stored in browser state. Page will reload to initialize.");
    window.location.reload();
  } else {
    document.getElementById("admin-sett-error").innerText = "Invalid credentials template format. Ensure URL and Anon Key are correct.";
    document.getElementById("admin-sett-error").style.display = "block";
  }
}

async function handleGatewaySettingsSubmit(e) {
  e.preventDefault();
  const stripeKey = document.getElementById("api-stripeKey").value.trim();
  const razorpayKey = document.getElementById("api-razorpayKey").value.trim();
  const paypalKey = document.getElementById("api-paypalKey").value.trim();
  const defaultGateway = document.getElementById("api-defaultGateway").value;
  const taxPercentage = Number(document.getElementById("api-taxPercentage").value);
  const heroBgFile = document.getElementById("api-heroBgFile").files[0];
  let heroBgUrl = document.getElementById("api-heroBgUrl").value.trim();

  document.getElementById("admin-sett-success").style.display = "none";
  document.getElementById("admin-sett-error").style.display = "none";

  try {
    if (heroBgFile) {
      document.getElementById("admin-sett-success").innerText = "Uploading custom background image...";
      document.getElementById("admin-sett-success").style.display = "block";
      heroBgUrl = await uploadFile(heroBgFile, "backgrounds", (p) => {
        document.getElementById("admin-sett-success").innerText = `Uploading custom background image... ${Math.ceil(p)}%`;
      });
    }

    const enabledGateways = ["upi", "card"];
    if (stripeKey) enabledGateways.push("stripe");
    if (razorpayKey) enabledGateways.push("razorpay");
    if (paypalKey) enabledGateways.push("paypal");

    const newSettings = {
      stripeKey, razorpayKey, paypalKey, defaultGateway, taxPercentage, enabledGateways, heroBgUrl
    };

    await updateSettings(newSettings);
    document.getElementById("admin-sett-success").innerText = "Settings & Customizations saved successfully!";
    document.getElementById("admin-sett-success").style.display = "block";

    document.getElementById("api-heroBgFile").value = "";

    await loadPageData();
  } catch (err) {
    document.getElementById("admin-sett-error").innerText = err.message;
    document.getElementById("admin-sett-error").style.display = "block";
  }
}

// ----------------------------------------------------
// SUBSCRIPTIONS & SECURE SIMULATED CHECKOUTS
// ----------------------------------------------------
function setupSubscriptionPaywall() {
  const closeBtn = document.getElementById("plans-close-btn");
  if (closeBtn) closeBtn.addEventListener("click", () => closeModal("plans-modal-overlay"));
}

function renderPricingPlans() {
  const container = document.getElementById("plans-cards-container");
  if (!container) return;

  container.innerHTML = "";

  const filteredPlans = currentPlans.filter(p => p.enabled && p.currency === activeCurrency);

  if (filteredPlans.length === 0) {
    container.innerHTML = `<p class="text-secondary" style="grid-column: 1/-1; text-align:center;">No active packages available for currency ${activeCurrency}.</p>`;
    return;
  }

  filteredPlans.forEach((plan, index) => {
    const card = document.createElement("div");
    card.className = `plan-card ${index === 1 ? 'recommended' : ''}`;
    const symbol = plan.currency === "INR" ? "₹" : "$";

    card.innerHTML = `
      <div>
        <h4 class="plan-title">${plan.name}</h4>
        <div class="plan-price">
          <span class="plan-currency">${symbol}</span>${plan.price}
          <span class="plan-period">/ ${plan.durationDays} Days</span>
        </div>
        <ul class="plan-features">
          <li><i class="fa-solid fa-check"></i> Unlimited UHD Streams</li>
          <li><i class="fa-solid fa-check"></i> No Preview Locks</li>
          <li><i class="fa-solid fa-check"></i> VIP Catalog Access</li>
          <li><i class="fa-solid fa-check"></i> Cancel Anytime</li>
        </ul>
      </div>
      <button class="btn btn-primary buy-plan-btn" data-id="${plan.id}" style="width:100%;">Select Package</button>
    `;
    container.appendChild(card);
  });

  container.querySelectorAll(".buy-plan-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const planId = btn.dataset.id;
      activePlan = currentPlans.find(p => p.id === planId);
      if (activePlan) {
        closeModal("plans-modal-overlay");
        openCheckoutModal();
      }
    });
  });
}

function setupCheckoutFlow() {
  const closeBtn = document.getElementById("checkout-close-btn");
  if (!closeBtn) return;

  closeBtn.addEventListener("click", () => closeModal("checkout-modal-overlay"));

  const tabs = document.querySelectorAll("#payment-gateways-tabs .payment-tab");
  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      tabs.forEach(t => t.classList.remove("active"));
      tab.classList.add("active");

      const gw = tab.dataset.gateway;
      document.querySelectorAll(".payment-tab-content").forEach(el => el.classList.remove("active"));

      if (gw === "card") document.getElementById("pay-card-panel").classList.add("active");
      if (gw === "upi") {
        document.getElementById("pay-upi-panel").classList.add("active");
        renderUPIQRCode();
      }
      if (gw === "paypal") document.getElementById("pay-paypal-panel").classList.add("active");
    });
  });

  // Sync Input fields
  const cardNum = document.getElementById("card-num");
  const cardName = document.getElementById("card-name");
  const cardExpiry = document.getElementById("card-expiry");

  cardNum.addEventListener("input", (e) => {
    let val = e.target.value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    let matches = val.match(/\d{4,16}/g);
    let match = matches && matches[0] || '';
    let parts = [];
    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }
    e.target.value = parts.length > 0 ? parts.join(' ') : val;
    document.getElementById("card-preview-number").innerText = e.target.value || "•••• •••• •••• ••••";
  });

  cardName.addEventListener("input", (e) => {
    document.getElementById("card-preview-holder").innerText = e.target.value.toUpperCase() || "YOUR NAME";
  });

  cardExpiry.addEventListener("input", (e) => {
    let val = e.target.value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    if (val.length >= 2) {
      e.target.value = val.substring(0, 2) + '/' + val.substring(2, 4);
    } else {
      e.target.value = val;
    }
    document.getElementById("card-preview-expiry").innerText = e.target.value || "MM/YY";
  });

  document.getElementById("card-checkout-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    await processSimulatedCheckout("credit_card");
  });

  document.getElementById("upi-confirm-btn").addEventListener("click", async () => {
    await processSimulatedCheckout("upi");
  });

  document.getElementById("paypal-confirm-btn").addEventListener("click", async () => {
    await processSimulatedCheckout("paypal");
  });
}

function openCheckoutModal() {
  if (!currentUser) {
    window.location.href = "login.html";
    alert("Please sign in or register to purchase an elite package!");
    return;
  }

  const taxRate = Number(currentSettings.taxPercentage || 0);
  const subtotal = Number(activePlan.price);
  const total = (subtotal + (subtotal * (taxRate / 100))).toFixed(2);
  const symbol = activePlan.currency === "INR" ? "₹" : "$";

  document.getElementById("checkout-plan-name").innerText = activePlan.name;
  document.getElementById("checkout-plan-days").innerText = activePlan.durationDays;
  document.getElementById("checkout-plan-price").innerText = `${symbol}${total}`;
  document.getElementById("checkout-tax-rate").innerText = taxRate;

  document.getElementById("checkout-error").style.display = "none";
  document.getElementById("card-checkout-form").reset();
  document.getElementById("card-preview-number").innerText = "•••• •••• •••• ••••";
  document.getElementById("card-preview-holder").innerText = "YOUR NAME";
  document.getElementById("card-preview-expiry").innerText = "MM/YY";

  const activeTabs = currentSettings.enabledGateways || ["stripe", "paypal", "upi", "card"];
  const tabCard = document.querySelector('[data-gateway="card"]');
  const tabUpi = document.querySelector('[data-gateway="upi"]');
  const tabPaypal = document.querySelector('[data-gateway="paypal"]');

  tabCard.style.display = activeTabs.includes("stripe") || activeTabs.includes("card") ? "block" : "none";
  tabUpi.style.display = activeTabs.includes("upi") ? "block" : "none";
  tabPaypal.style.display = activeTabs.includes("paypal") ? "block" : "none";

  let firstTab = tabCard;
  if (tabCard.style.display === "none") {
    firstTab = tabUpi.style.display === "none" ? tabPaypal : tabUpi;
  }
  firstTab.click();

  openModal("checkout-modal-overlay");
}

function renderUPIQRCode() {
  const container = document.getElementById("upi-qr-container");
  const upiAmount = document.getElementById("upi-amount-display");

  let valInr = activePlan.price;
  if (activePlan.currency === "USD") {
    valInr = (activePlan.price * 83).toFixed(0);
  }

  const taxRate = Number(currentSettings.taxPercentage || 0);
  const totalInr = (valInr * (1 + taxRate / 100)).toFixed(0);

  upiAmount.innerText = `₹${totalInr}`;

  const upiLink = `upi://pay?pa=sxxornpay@upi&pn=SweetXXorn&am=${totalInr}&cu=INR`;
  container.innerHTML = `<img src="https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(upiLink)}" alt="Scan UPI QR" style="width:160px; height:160px;">`;
}

async function processSimulatedCheckout(gatewayName) {
  const errorEl = document.getElementById("checkout-error");
  errorEl.style.display = "none";

  const cardBtn = document.getElementById("card-submit-btn");
  const upiBtn = document.getElementById("upi-confirm-btn");
  const paypalBtn = document.getElementById("paypal-confirm-btn");

  const toggleButtons = (disabled) => {
    cardBtn.disabled = disabled;
    upiBtn.disabled = disabled;
    paypalBtn.disabled = disabled;
    if (disabled) {
      cardBtn.innerText = "Authorizing transaction...";
      upiBtn.innerText = "Verifying transfer...";
      paypalBtn.innerText = "Redirecting authorization...";
    } else {
      cardBtn.innerText = "Verify and Authorize Payment";
      upiBtn.innerText = "Confirm Payment After Scanning";
      paypalBtn.innerText = "Proceed to PayPal Window";
    }
  };

  toggleButtons(true);

  try {
    await new Promise(r => setTimeout(r, 1500));
    const totalCost = (activePlan.price * (1 + (currentSettings.taxPercentage || 0) / 100)).toFixed(2);

    const transaction = {
      userId: currentUser.uid,
      userEmail: currentUser.email,
      amount: totalCost,
      currency: activePlan.currency,
      planId: activePlan.id,
      durationDays: activePlan.durationDays,
      gateway: gatewayName,
      status: "completed"
    };

    await addPaymentRecord(transaction);

    alert(`🎉 Purchase successful! You are now a SweetXXorn ${activePlan.name} VIP member!`);

    // Unlock player locks if on player page
    if (isPlayer && isVideoFinished) {
      resetCustomPlayer();
      if (videoElement) videoElement.play().catch(e => console.log(e));
    }

    closeModal("checkout-modal-overlay");

    // Reload database state
    await loadPageData();
  } catch (err) {
    errorEl.innerText = err.message || "Authorization failed.";
    errorEl.style.display = "block";
  } finally {
    toggleButtons(false);
  }
}

// ----------------------------------------------------
// AUTH MODALS PIPELINE (MODAL CONTROLLER)
// ----------------------------------------------------
function setupAuthModals() {
  const overlay = document.getElementById("auth-modal-overlay");
  if (!overlay) return;

  const loginClose = document.getElementById("login-close-btn");
  const registerClose = document.getElementById("register-close-btn");
  const forgotClose = document.getElementById("forgot-close-btn");

  const toSignup = document.getElementById("auth-signup-trigger");
  const toLogin = document.getElementById("auth-login-trigger");
  const toForgot = document.getElementById("auth-forgot-trigger");
  const forgotBack = document.getElementById("forgot-back-login-trigger");

  const closeAuth = () => closeModal("auth-modal-overlay");

  if (loginClose) loginClose.addEventListener("click", closeAuth);
  if (registerClose) registerClose.addEventListener("click", closeAuth);
  if (forgotClose) forgotClose.addEventListener("click", closeAuth);

  if (toSignup) toSignup.addEventListener("click", (e) => { e.preventDefault(); showAuthCard("register-modal-container"); });
  if (toLogin) toLogin.addEventListener("click", (e) => { e.preventDefault(); showAuthCard("login-modal-container"); });
  if (toForgot) toForgot.addEventListener("click", (e) => { e.preventDefault(); showAuthCard("forgot-modal-container"); });
  if (forgotBack) forgotBack.addEventListener("click", (e) => { e.preventDefault(); showAuthCard("login-modal-container"); });

  // Redirect to login.html handled natively via href attribute

  document.querySelectorAll(".password-toggle-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const input = btn.previousElementSibling;
      const icon = btn.querySelector("i");
      if (input && input.type === "password") {
        input.type = "text";
        if (icon) icon.className = "fa-solid fa-eye-slash";
      } else if (input) {
        input.type = "password";
        if (icon) icon.className = "fa-solid fa-eye";
      }
    });
  });

  const loginForm = document.getElementById("login-form");
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const emailEl = document.getElementById("login-email");
      const passEl = document.getElementById("login-password");
      const errorEl = document.getElementById("login-error-msg");
      if (errorEl) errorEl.style.display = "none";

      try {
        const email = emailEl ? emailEl.value : "";
        const pass = passEl ? passEl.value : "";
        console.log("Attempting login for:", email);
        const user = await loginUser(email, pass);
        console.log("Login user response:", user);

        if (user) {
          if (user.role === "admin") {
            console.log("Redirecting admin to admin.html");
            window.location.href = "admin.html";
          } else {
            console.log("Redirecting user to index.html");
            window.location.href = "index.html";
          }
        } else {
          // If loginUser returns null (e.g. user profile not in database yet but auth succeeded), redirect to index
          console.log("Authentication succeeded but profile row not found. Redirecting to index.html");
          window.location.href = "index.html";
        }
      } catch (err) {
        console.error("Login submission error:", err);
        if (errorEl) {
          errorEl.innerText = err.message || "Invalid credentials.";
          errorEl.style.display = "block";
        }
      }
    });
  }

  const registerForm = document.getElementById("register-form");
  if (registerForm) {
    registerForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const nameEl = document.getElementById("register-name");
      const emailEl = document.getElementById("register-email");
      const passEl = document.getElementById("register-password");
      const errorEl = document.getElementById("register-error-msg");
      if (errorEl) errorEl.style.display = "none";

      try {
        const name = nameEl ? nameEl.value : "";
        const email = emailEl ? emailEl.value : "";
        const pass = passEl ? passEl.value : "";
        console.log("Attempting registration for:", email);
        const user = await registerUser(email, pass, name);
        console.log("Registration response:", user);
        
        alert("🎉 Registration successful! Welcome to SweetXXorn.");
        window.location.href = "index.html";
      } catch (err) {
        console.error("Registration submission error:", err);
        if (errorEl) {
          errorEl.innerText = err.message || "Registration failed.";
          errorEl.style.display = "block";
        }
      }
    });
  }

  const forgotForm = document.getElementById("forgot-form");
  if (forgotForm) {
    forgotForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const emailEl = document.getElementById("forgot-email");
      const errorEl = document.getElementById("forgot-error-msg");
      const successEl = document.getElementById("forgot-success-msg");
      if (errorEl) errorEl.style.display = "none";
      if (successEl) successEl.style.display = "none";

      try {
        const email = emailEl ? emailEl.value : "";
        await sendPasswordReset(email);
        if (successEl) {
          successEl.innerText = "Check your inbox! Reset link has been sent.";
          successEl.style.display = "block";
        }
      } catch (err) {
        if (errorEl) {
          errorEl.innerText = err.message;
          errorEl.style.display = "block";
        }
      }
    });
  }
}

function showAuthCard(containerId) {
  const loginCard = document.getElementById("login-modal-container");
  const registerCard = document.getElementById("register-modal-container");
  const forgotCard = document.getElementById("forgot-modal-container");
  const targetCard = document.getElementById(containerId);

  if (loginCard) loginCard.style.display = "none";
  if (registerCard) registerCard.style.display = "none";
  if (forgotCard) forgotCard.style.display = "none";
  if (targetCard) targetCard.style.display = "block";
  document.querySelectorAll(".error-message, .success-message").forEach(el => el.style.display = "none");
}

function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.add("show");
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove("show");
    if (modalId === "upload-video-modal-overlay") {
      const uploadForm = document.getElementById("admin-upload-video-form");
      if (uploadForm) uploadForm.reset();
      const progressBox = document.getElementById("upload-progress-box");
      if (progressBox) progressBox.style.display = "none";
    }
  }
}

// ----------------------------------------------------
// VALIDATION & UTILITIES
// ----------------------------------------------------
function setupStaticFooterModals() {
  const termsBtn = document.getElementById("footer-terms-btn");
  const privacyBtn = document.getElementById("footer-privacy-btn");
  const supportBtn = document.getElementById("footer-support-btn");

  if (termsBtn) {
    termsBtn.addEventListener("click", (e) => {
      e.preventDefault();
      alert("⚖️ SweetXXorn Terms & Conditions:\n\nBy accessing our premium catalog, you agree to watch preview trailers for personal use. Unauthorized scraping or file extraction of locked elements is strictly prohibited.");
    });
  }

  if (privacyBtn) {
    privacyBtn.addEventListener("click", (e) => {
      e.preventDefault();
      alert("🔒 SweetXXorn Privacy Policy:\n\nWe store your email securely in Supabase Auth. In accordance with luxury standard practices, transaction details are completely masked, and credentials will never be shared with third parties.");
    });
  }

  if (supportBtn) {
    supportBtn.addEventListener("click", (e) => {
      e.preventDefault();
      alert("✉️ Support Hotline:\n\nFor elite membership issues or pricing discrepancies, contact administrative support at musicophilepanda@gmail.com.");
    });
  }
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

function formatTime(secs) {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

// ====================================================
// GLOBAL SIDEBAR MENU LOGIC
// ====================================================
// Global sidebar initialization is now handled in the unified initializeCore function.

function injectGlobalSidebar() {
  if (document.getElementById("global-sidebar")) return;

  // Insert sidebar structure
  const sidebarHTML = `
    <div class="site-sidebar" id="global-sidebar">
      <div class="sidebar-header">
        <h3 class="font-luxury text-gold-gradient">SweetXXorn</h3>
        <button class="sidebar-close-btn" id="sidebar-close-trigger">&times;</button>
      </div>
      <div class="sidebar-body">
        <!-- User Quick Profile Info -->
        <div class="sidebar-user-section" id="sidebar-user-panel">
          <div class="sidebar-user-name">Guest Identity</div>
          <div class="sidebar-user-email">Please log in to upgrade</div>
        </div>
        
        <!-- Navigation links -->
        <div class="sidebar-menu-links">
          <h4 class="sidebar-section-title">Navigation</h4>
          <a href="index.html" class="${isIndex ? 'active' : ''}"><i class="fa-solid fa-house"></i> Home</a>
          <a href="dashboard.html" class="logged-in-only ${isDashboard ? 'active' : ''}"><i class="fa-solid fa-user"></i> My Profile</a>
          <a href="admin.html" class="admin-only ${isAdmin ? 'active' : ''}"><i class="fa-solid fa-crown"></i> Admin Console</a>
        </div>

        <!-- Categories List -->
        <div class="sidebar-categories-section">
          <h4 class="sidebar-section-title">Categories</h4>
          <div class="sidebar-categories-list" id="sidebar-categories-list">
            <div style="font-size:0.8rem; color:var(--text-secondary); padding: 5px 12px;">Loading categories...</div>
          </div>
        </div>
      </div>
      <div class="sidebar-footer">
        <button id="sidebar-logout-btn" class="btn btn-secondary logged-in-only" style="width: 100%;">
          <i class="fa-solid fa-right-from-bracket"></i> Log Out
        </button>
      </div>
    </div>
    <div class="sidebar-overlay" id="global-sidebar-overlay"></div>
  `;

  document.body.insertAdjacentHTML("beforeend", sidebarHTML);
}

function setupSidebarToggle() {
  const toggleBtn = document.getElementById("sidebar-toggle-btn");
  const sidebar = document.getElementById("global-sidebar");
  const overlay = document.getElementById("global-sidebar-overlay");
  const closeBtn = document.getElementById("sidebar-close-trigger");
  const logoutBtn = document.getElementById("sidebar-logout-btn");

  if (toggleBtn && sidebar && overlay) {
    toggleBtn.addEventListener("click", () => {
      sidebar.classList.add("show");
      overlay.classList.add("show");
      renderSidebarCategories();
      updateSidebarUserPanel();
    });
  }

  const closeSidebar = () => {
    if (sidebar && overlay) {
      sidebar.classList.remove("show");
      overlay.classList.remove("show");
    }
  };

  if (closeBtn) closeBtn.addEventListener("click", closeSidebar);
  if (overlay) overlay.addEventListener("click", closeSidebar);

  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      closeSidebar();
      await logoutUser();
      window.location.href = "index.html";
    });
  }
}

async function renderSidebarCategories() {
  const listContainer = document.getElementById("sidebar-categories-list");
  if (!listContainer) return;

  try {
    const categories = await fetchCategories();
    listContainer.innerHTML = "";

    // Add 'All Genres' item
    const allItem = document.createElement("div");
    allItem.className = "sidebar-cat-item";
    allItem.dataset.slug = "all";
    allItem.innerHTML = `<span>All Genres</span> <i class="fa-solid fa-chevron-right" style="font-size:0.7rem; opacity:0.5;"></i>`;
    listContainer.appendChild(allItem);

    categories.forEach(cat => {
      const item = document.createElement("div");
      item.className = "sidebar-cat-item";
      item.dataset.slug = cat.slug;
      item.innerHTML = `<span>${cat.name}</span> <i class="fa-solid fa-chevron-right" style="font-size:0.7rem; opacity:0.5;"></i>`;
      listContainer.appendChild(item);
    });

    // Mark current active category
    let activeSlug = "all";
    if (isIndex) {
      const activeChip = document.querySelector("#categories-carousel .category-chip.active");
      if (activeChip) activeSlug = activeChip.dataset.slug;
    } else {
      const urlParams = new URLSearchParams(window.location.search);
      activeSlug = urlParams.get("category") || "all";
    }

    listContainer.querySelectorAll(".sidebar-cat-item").forEach(item => {
      if (item.dataset.slug === activeSlug) {
        item.classList.add("active");
      }

      item.addEventListener("click", () => {
        const slug = item.dataset.slug;
        if (isIndex) {
          // Trigger filter on Index page directly
          const matchingChip = document.querySelector(`#categories-carousel .category-chip[data-slug="${slug}"]`);
          if (matchingChip) {
            matchingChip.click();
          } else {
            renderVideoLibrary(slug);
          }
          // Close sidebar
          document.getElementById("global-sidebar").classList.remove("show");
          document.getElementById("global-sidebar-overlay").classList.remove("show");
        } else {
          // Redirect to Index page with parameter
          window.location.href = `index.html?category=${slug}`;
        }
      });
    });
  } catch (err) {
    listContainer.innerHTML = `<div style="font-size:0.8rem; color:var(--danger-color); padding: 5px 12px;">Failed to load genres</div>`;
  }
}

function updateSidebarUserPanel() {
  const userPanel = document.getElementById("sidebar-user-panel");
  if (!userPanel) return;

  if (currentUser) {
    document.body.classList.add("logged-in");
    if (currentUser.role === "admin") {
      document.body.classList.add("is-admin");
    } else {
      document.body.classList.remove("is-admin");
    }

    userPanel.innerHTML = `
      <div class="sidebar-user-name">${currentUser.displayName || 'VIP Member'}</div>
      <div class="sidebar-user-email">${currentUser.email}</div>
      <div class="text-gold" style="font-size: 0.75rem; margin-top:5px; font-weight:600;">
        <i class="fa-solid fa-crown"></i> ${currentUser.role === 'admin' ? 'Administrator' : 'Premium VIP'}
      </div>
    `;
  } else {
    document.body.classList.remove("logged-in");
    document.body.classList.remove("is-admin");
    userPanel.innerHTML = `
      <div class="sidebar-user-name">Guest Identity</div>
      <div class="sidebar-user-email">Please log in to upgrade</div>
      <a href="login.html" class="btn btn-primary btn-sm" style="margin-top:10px; display:inline-block; font-size:0.75rem; padding: 4px 10px;">Sign In / VIP</a>
    `;
  }
}

// Check category parameter in URL and filter index page accordingly
function checkURLCategoryFilter() {
  if (!isIndex) return;
  const urlParams = new URLSearchParams(window.location.search);
  const categorySlug = urlParams.get("category");
  if (categorySlug) {
    setTimeout(() => {
      const chips = document.querySelectorAll("#categories-carousel .category-chip");
      chips.forEach(chip => {
        if (chip.dataset.slug === categorySlug) {
          chip.click();
        }
      });
    }, 400);
  }
}

// Ensure the dots toggle opens the global sidebar even if setupSidebarToggle
// didn't attach (defensive event delegation).
document.addEventListener("click", (e) => {
  const btn = e.target.closest && e.target.closest('.dots-toggle-btn, #sidebar-toggle-btn');
  if (!btn) return;
  e.preventDefault();

  // Inject sidebar if missing (defensive)
  if (!document.getElementById('global-sidebar')) {
    try { injectGlobalSidebar(); } catch (err) { console.error('Failed to inject sidebar:', err); }
  }

  const sidebar = document.getElementById('global-sidebar');
  const overlay = document.getElementById('global-sidebar-overlay');
  if (!sidebar || !overlay) return;

  sidebar.classList.add('show');
  overlay.classList.add('show');
  try { renderSidebarCategories(); } catch (err) { /* ignore */ }
  try { updateSidebarUserPanel(); } catch (err) { /* ignore */ }
});
