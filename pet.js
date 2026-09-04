
/**
 * AgeTogether - photo companion.
 *
 * Turns a photo the user picks into a cut-out companion and keeps it alive with
 * CSS transforms. Everything here runs in the browser: the photo is never
 * uploaded and the server is not involved.
 *
 * Pipeline:  pick -> downscale -> cut out -> trim transparent edges -> store
 *
 * If the cut-out model cannot load (old device, no network), the photo is still
 * used - just shown in a soft circular crop instead. The companion always works.
 */

/* ------------------------------------------------------------------ */
/* Configuration                                                        */
/* ------------------------------------------------------------------ */

// Legacy single-photo storage key; migrated to the library format on load.
const STORAGE_KEY = "agetogether.companion.photo.v1";
// Stores processed companions and the currently selected image.
const LIBRARY_KEY = "agetogether.companion.library.v1";

/** Kept small on purpose: each entry is a data URL and localStorage holds ~5 MB. */
// Limit history size so large images do not quickly fill localStorage.
const MAX_COMPANIONS = 12;

/** Stored larger than it is displayed so it stays sharp, but not 768px larger. */
// Final storage size: clear enough for display while keeping the Data URL small.
const STORED_DIMENSION = 512;

/** Name, bond and start date live apart from the photo library: they are tiny,
 *  and must never be at risk from the library's quota eviction. */
// Store the companion's name, bond score, and start date separately.
const PET_KEY = "agetogether.companion.pet.v1";

/**
 * Bond only ever goes up.
 *
 * A pet that decays while you are away punishes absence, and for someone
 * living alone that reads as "I could not even look after this". Coming back
 * after a fortnight finds exactly what you left, never something worse.
 */
// Bond rewards assigned to different user interactions.
const BOND_REWARDS = { greet: 1, feed: 2, done: 1, note: 3, activity: 5 };

/** Thresholds, not a formula: early levels come quickly, later ones take time. */
// Cumulative bond thresholds; later levels require more interaction.
const BOND_LEVELS = [0, 8, 20, 40, 70, 115, 180, 280, 420];

/** Stops a held button or a fast typist from farming bond. */
// Cooldowns prevent rapid repeated clicks from farming rewards.
const BOND_COOLDOWNS = { greet: 4000, feed: 45000 };

/** Local hours the companion dozes. Also keeps it quiet at night. */
const SLEEP_FROM_HOUR = 22;
const SLEEP_UNTIL_HOUR = 6;

/** Phone photos are far larger than the companion needs on screen. */
const MAX_DIMENSION = 768;

/** Alpha below this counts as background when trimming. */
const ALPHA_THRESHOLD = 12;

/**
 * The only AI in this file. Swap this one function for a server call
 * (remove.bg, Photoroom, a self-hosted rembg) and nothing else changes -
 * the contract is: canvas in, canvas with transparency out.
 */
const CUTOUT_MODULE = "https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.7.0/+esm";

/**
 * What counts as "the user pressed something". Deliberately does not include
 * plain page background: on a touch screen a scroll also starts with a
 * pointerdown, and reacting to those would make the companion twitch while
 * the user is only reading.
 */
const INTERACTIVE = "button, a, input, textarea, select, label, summary, [role='button'], .pill, .tab";

// The floating companion element; features safely skip if it is not present.
const petButton = document.querySelector("#pet");

/* ------------------------------------------------------------------ */
/* Image pipeline                                                       */
/* ------------------------------------------------------------------ */

function readFileAsImage(file) {
  // Convert the selected local file into an Image object that Canvas can draw.
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("That file could not be opened as a photo."));
    };
    image.src = url;
  });
}

/** Shrink before segmenting - much faster, and the result is only ~170px on screen. */
function downscale(image, maxDimension = MAX_DIMENSION) {
  // Shrink large images before cut-out to reduce processing time and memory use.
  const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function canvasToBlob(canvas) {
  // Convert the Canvas into a PNG Blob for the background-removal model.
  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}

/**
 * Remove the background. Returns null if the model is unavailable, which the
 * caller treats as "fall back to a circular crop" rather than as a failure.
 */
async function removeBackground(canvas) {
  // Load the cut-out model on demand; return null so the caller can use a circular fallback.
  try {
    const { removeBackground: cutOut } = await import(/* @vite-ignore */ CUTOUT_MODULE);
    const blob = await cutOut(await canvasToBlob(canvas));
    const image = await readFileAsImage(blob);
    const result = document.createElement("canvas");
    result.width = image.width;
    result.height = image.height;
    result.getContext("2d").drawImage(image, 0, 0);
    return result;
  } catch (error) {
    console.warn("[companion] cut-out unavailable, using a circular crop instead:", error?.message ?? error);
    return null;
  }
}

/**
 * Crop away fully transparent edges.
 *
 * This step is easy to skip and everything downstream then looks wrong: the
 * cut-out keeps the full original canvas, so `transform-origin: bottom` points
 * at the bottom of a mostly-empty box rather than at the companion's feet, and
 * every bounce pivots from the wrong place.
 */
function trimTransparentEdges(canvas) {
  // Scan the alpha channel, find the subject bounds, and remove transparent margins.
  const context = canvas.getContext("2d", { willReadFrequently: true });
  const { data, width, height } = context.getImageData(0, 0, canvas.width, canvas.height);

  let top = height;
  let left = width;
  let right = -1;
  let bottom = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[(y * width + x) * 4 + 3] <= ALPHA_THRESHOLD) continue;
      if (x < left) left = x;
      if (x > right) right = x;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
    }
  }

  if (right < left || bottom < top) return canvas; // nothing opaque - leave it alone

  // Clamp each edge independently. Clamping only the origin while keeping the
  // full padded size pushes the extra margin onto the opposite edge, which
  // shifts the subject off centre - and any margin left below the feet moves
  // the `transform-origin: bottom` pivot the animations rely on.
  const padding = 2;
  const sourceX = Math.max(0, left - padding);
  const sourceY = Math.max(0, top - padding);
  const sourceWidth = Math.min(width - 1, right + padding) - sourceX + 1;
  const sourceHeight = Math.min(height - 1, bottom + padding) - sourceY + 1;

  const cropped = document.createElement("canvas");
  cropped.width = sourceWidth;
  cropped.height = sourceHeight;
  cropped
    .getContext("2d")
    .drawImage(canvas, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, sourceWidth, sourceHeight);
  return cropped;
}

/** Square centre crop, used when the cut-out model is not available. */
function circularCrop(canvas) {
  // If the cut-out model is unavailable, centre-crop the image into a circular avatar.
  const size = Math.min(canvas.width, canvas.height);
  const cropped = document.createElement("canvas");
  cropped.width = size;
  cropped.height = size;
  const context = cropped.getContext("2d");
  context.beginPath();
  context.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  context.clip();
  context.drawImage(canvas, (canvas.width - size) / 2, (canvas.height - size) / 2, size, size, 0, 0, size, size);
  return cropped;
}

/* ------------------------------------------------------------------ */
/* Storage                                                              */
/* ------------------------------------------------------------------ */

/**
 * The library is `{ activeId, items: [{ id, fingerprint, dataUrl, label, createdAt }] }`.
 * Only the finished cut-out is kept - the original photo is never needed again
 * and would double what we store.
 */
function loadLibrary() {
  // Load companion history from localStorage and migrate the legacy single-photo format.
  try {
    const stored = localStorage.getItem(LIBRARY_KEY);
    if (stored) {
      const library = JSON.parse(stored);
      if (Array.isArray(library?.items)) return library;
    }

    // Migrate the single-photo format that shipped first.
    const legacy = localStorage.getItem(STORAGE_KEY);
    if (legacy) {
      const migrated = {
        activeId: "legacy",
        items: [{ id: "legacy", fingerprint: null, dataUrl: legacy, label: "Your companion", createdAt: Date.now() }],
      };
      saveLibrary(migrated);
      localStorage.removeItem(STORAGE_KEY);
      return migrated;
    }
  } catch {
    // Private browsing, blocked site data, or corrupt JSON. The drawn
    // companion still works, so fall through to an empty library.
  }
  return { activeId: null, items: [] };
}

/**
 * Saves, dropping the oldest inactive companion whenever the browser refuses
 * on quota. Data URLs are large and localStorage is only about 5 MB, so this
 * has to degrade by forgetting rather than by failing.
 */
function saveLibrary(library) {
  // Save the library; if storage is full, remove the oldest inactive item and retry.
  const working = { ...library, items: [...library.items] };

  for (let attempt = 0; attempt < MAX_COMPANIONS + 1; attempt += 1) {
    try {
      localStorage.setItem(LIBRARY_KEY, JSON.stringify(working));
      return { saved: true, evicted: library.items.length - working.items.length };
    } catch {
      const oldest = working.items
        .filter((item) => item.id !== working.activeId)
        .sort((a, b) => a.createdAt - b.createdAt)[0];
      if (!oldest) return { saved: false, evicted: library.items.length - working.items.length };
      working.items = working.items.filter((item) => item !== oldest);
    }
  }
  return { saved: false, evicted: 0 };
}

function activeDataUrl(library) {
  // Resolve the current companion's image data from activeId.
  return library.items.find((item) => item.id === library.activeId)?.dataUrl ?? null;
}

/* ------------------------------------------------------------------ */
/* Name, bond and daily rhythm                                          */
/* ------------------------------------------------------------------ */

function loadPet() {
  // Load name, bond, and dates; use safe defaults if storage is unavailable or corrupt.
  const fallback = { name: null, bond: 0, firstSeen: Date.now(), lastFedAt: 0 };
  try {
    const stored = JSON.parse(localStorage.getItem(PET_KEY) ?? "null");
    if (stored && typeof stored === "object") return { ...fallback, ...stored };
    savePet(fallback); // first ever run - start counting the days from today
  } catch {
    // Blocked or corrupt storage: the companion still works, it just forgets.
  }
  return fallback;
}

function savePet(pet) {
  // Serialize and save the companion state in the browser.
  try {
    localStorage.setItem(PET_KEY, JSON.stringify(pet));
  } catch {
    // Nothing to do - a companion that cannot be saved is still a companion.
  }
}

/** Day one is the day you met, not the day after. */
function daysTogether(pet) {
  // Calculate days together from the first-seen timestamp, including day one.
  return Math.floor((Date.now() - pet.firstSeen) / 86400000) + 1;
}

function bondProgress(bond) {
  // Convert total bond into the current level and progress-bar percentage.
  let level = 1;
  while (level < BOND_LEVELS.length && bond >= BOND_LEVELS[level]) level += 1;
  const floorValue = BOND_LEVELS[level - 1];
  const ceilingValue = BOND_LEVELS[level] ?? floorValue;
  const span = ceilingValue - floorValue;
  return {
    level,
    max: BOND_LEVELS.length,
    percent: span ? Math.round(((bond - floorValue) / span) * 100) : 100,
  };
}

const lastAwardAt = {};

/** Adds bond and never subtracts. Returns false when the cooldown swallowed it. */
function addBond(source) {
  // Award bond for an interaction while cooldowns prevent repeated farming.
  const amount = BOND_REWARDS[source];
  if (!amount) return false;

  const cooldown = BOND_COOLDOWNS[source] ?? 0;
  const now = Date.now();
  if (cooldown && now - (lastAwardAt[source] ?? 0) < cooldown) return false;
  lastAwardAt[source] = now;

  const pet = loadPet();
  pet.bond += amount;
  if (source === "feed") pet.lastFedAt = now;
  savePet(pet);
  refreshStatusCard();
  return true;
}

function isSleepingHour() {
  // Use the device's local time to determine whether it is the sleep window.
  const hour = new Date().getHours();
  return hour >= SLEEP_FROM_HOUR || hour < SLEEP_UNTIL_HOUR;
}

let wakeUntil = 0;

/** Asleep unless the user just prodded it - being poked wakes anyone briefly. */
function isAsleep() {
  return isSleepingHour() && Date.now() > wakeUntil;
}

function applySleepState() {
  // Add or remove the sleep style according to the current time.
  petButton?.classList.toggle("is-asleep", isAsleep());
}

/** A drowsy Z now and then, so the sleeping state reads as sleeping. */
function scheduleSnore() {
  // Periodically check sleep state and emit an occasional ZZZ particle.
  setTimeout(() => {
    if (!document.hidden && isAsleep() && !petButton?.classList.contains("hidden")) {
      emitParticles(1, "zzz");
    }
    applySleepState();
    scheduleSnore();
  }, 7000 + Math.random() * 6000);
}

/**
 * Identifies a photo so the same one is never cut out twice - that is the slow
 * step, and on a first run it also pulls down the model.
 *
 * Hashing the bytes catches the same picture under a different filename.
 * `crypto.subtle` needs a secure context, which `file://` is not, so fall back
 * to the file's own metadata there rather than losing de-duplication entirely.
 */
async function fingerprintFile(file) {
  try {
    const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    return `meta:${file.name}:${file.size}:${file.lastModified}`;
  }
}

/* ------------------------------------------------------------------ */
/* Applying the companion                                               */
/* ------------------------------------------------------------------ */

function applyPhoto(dataUrl) {
  // Mount the photo companion into #pet; remove it to restore the drawn companion.
  if (!petButton) return;

  let photo = petButton.querySelector(".pet-photo");

  if (!dataUrl) {
    photo?.remove();
    petButton.classList.remove("has-photo");
    petButton.setAttribute("aria-label", "Pet your companion");
    return;
  }

  if (!photo) {
    photo = document.createElement("img");
    photo.className = "pet-photo";
    photo.alt = "";
    petButton.append(photo);
  }
  photo.src = dataUrl;
  petButton.classList.add("has-photo");
  petButton.setAttribute("aria-label", "Pet your companion");
}

/* ------------------------------------------------------------------ */
/* Being alive                                                          */
/* ------------------------------------------------------------------ */

/**
 * Reactions mirror something the user just did. Because every one of them is
 * caused by the user, the companion never has to guess what they meant - which
 * is the whole difference between a companion and an office assistant.
 *
 * Each pose snaps to its extreme immediately and eases back out (see the
 * keyframes). Easing *into* a reaction makes it feel sluggish no matter how
 * short it is.
 */
const REACTIONS = {
  // Each reaction maps to a CSS class, duration, and optional particle count.
  hop: { className: "is-hopping", durationMs: 680, particles: 1 },
  happy: { className: "is-hopping", durationMs: 680, particles: 3 },
  tap: { className: "is-tapping", durationMs: 240 },
  perk: { className: "is-perked", durationMs: 900 },
};

let reactionTimer = null;
let motionAllowed = true;

function react(pose) {
  // Clear the previous reaction, apply the new animation state, and emit particles when needed.
  const reaction = REACTIONS[pose];
  if (!reaction || !motionAllowed) return;
  if (!petButton || petButton.classList.contains("hidden")) return;

  for (const other of Object.values(REACTIONS)) petButton.classList.remove(other.className);
  void petButton.offsetWidth; // restart the animation even if the same pose is already running
  petButton.classList.add(reaction.className);

  clearTimeout(reactionTimer);
  reactionTimer = setTimeout(() => petButton.classList.remove(reaction.className), reaction.durationMs);

  if (reaction.particles) emitParticles(reaction.particles);
}

/**
 * Pixel-art particles, drawn as SVG squares rather than shipped as images:
 * they stay crisp at any size, need no asset file, and carry no licence.
 * `shadeFrom` is the first row painted in the darker tone, which is what gives
 * the shapes their bit of depth.
 */
const PIXEL_ART = {
  // Character grids that pixelSvg() converts into SVG artwork.
  heart: {
    tones: ["#e8336e", "#c81f57"],
    shadeFrom: 4,
    grid: [
      ".XX..XX.",
      "XXXXXXXX",
      "XXXXXXXX",
      "XXXXXXXX",
      ".XXXXXX.",
      "..XXXX..",
      "...XX...",
    ],
  },
  apple: {
    tones: ["#e5442e", "#b8301f"],
    shadeFrom: 3,
    grid: [".XXXXX.", "XXXXXXX", "XXXXXXX", "XXXXXXX", ".XXXXX.", "..XXX.."],
  },
  biscuit: {
    tones: ["#d9a05b", "#b87f3e"],
    shadeFrom: 3,
    grid: [".XXXXX.", "XXXXXXX", "XXXXXXX", "XXXXXXX", ".XXXXX."],
  },
  bone: {
    tones: ["#f4e8d2", "#d8c3a0"],
    shadeFrom: 2,
    grid: ["XX...XX", "XXXXXXX", "XX...XX"],
  },
  zzz: {
    tones: ["#9db8cc", "#7d99ad"],
    shadeFrom: 3,
    grid: ["XXXXX", "...X.", "..X..", ".X...", "XXXXX"],
  },
  star: {
    tones: ["#ffc21f", "#f39200"],
    shadeFrom: 4,
    grid: [
      "....X....",
      "...XXX...",
      "...XXX...",
      "XXXXXXXXX",
      ".XXXXXXX.",
      "..XXXXX..",
      "..XXXXX..",
      ".XX...XX.",
      ".X.....X.",
    ],
  },
};

function pixelSvg(name) {
  // Convert each X in a pixel grid into an SVG rectangle.
  const { grid, tones, shadeFrom } = PIXEL_ART[name];
  const width = grid[0].length;
  const height = grid.length;

  let squares = "";
  grid.forEach((row, y) => {
    [...row].forEach((cell, x) => {
      if (cell !== "X") return;
      // Slightly oversized squares: exactly 1 unit leaves hairline seams
      // between neighbours once the SVG is scaled up.
      squares += `<rect x="${x}" y="${y}" width="1.02" height="1.02" fill="${y >= shadeFrom ? tones[1] : tones[0]}"/>`;
    });
  });

  return `<svg viewBox="0 0 ${width} ${height}" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg">${squares}</svg>`;
}

/**
 * Hearts and stars strictly take turns, and the rota carries on across
 * emissions - so pressing the companion repeatedly alternates heart, star,
 * heart, rather than picking at random and repeating itself.
 */
const PARTICLE_ROTA = ["heart", "star"];
let particleTurn = 0;

// Rotate particle types in order so random output does not repeat constantly.
const nextParticleKind = () => PARTICLE_ROTA[particleTurn++ % PARTICLE_ROTA.length];

/** Throws a small burst above the companion. Each particle drifts and spins
 *  differently, so a burst never looks like one shape stamped three times. */
function emitParticles(count, forcedKind) {
  // Create temporary SVG pixel particles with individual drift and rotation.
  Array.from({ length: count }, () => forcedKind ?? nextParticleKind()).forEach((kind, index) => {
    const particle = document.createElement("span");
    particle.className = "pet-particle";
    particle.setAttribute("aria-hidden", "true");
    particle.innerHTML = pixelSvg(kind);

    // Drift is a fraction of --pet-h so the spread scales with the companion.
    particle.style.setProperty("--drift", ((Math.random() * 2 - 1) * 0.22).toFixed(3));
    particle.style.setProperty("--spin", `${Math.round(Math.random() * 60 - 30)}deg`);
    particle.style.animationDelay = `${index * 90}ms`;

    petButton.append(particle);
    setTimeout(() => particle.remove(), 900 + index * 90 + 80);
  });
}

/**
 * Idle hops at an irregular interval. A fixed interval reads as clockwork;
 * the whole point is that you cannot predict it.
 */
function scheduleIdleHop() {
  // Schedule the next irregular idle hop so the companion feels less mechanical.
  const delay = 12000 + Math.random() * 14000;
  setTimeout(() => {
    if (!document.hidden && !isAsleep()) react("hop");
    scheduleIdleHop();
  }, delay);
}

/**
 * Watch what the user does, from the document, so these survive the full
 * re-render script.js performs on every action.
 */
function watchTheUser() {
  // Observe typing and pointer input so the companion responds to real user actions.
  // Every single keystroke. Never debounce this - the per-key response *is*
  // the effect, and debouncing removes exactly the part that feels alive.
  document.addEventListener(
    "input",
    (event) => {
      if (event.target.matches("textarea, input[type='text'], input:not([type])")) react("tap");
    },
    true,
  );

  // pointerdown, not click: waiting for the release costs about 100ms and it shows.
  document.addEventListener(
    "pointerdown",
    (event) => {
      // The companion has its own, larger hop - do not also tap for it.
      if (event.target.closest?.("#pet")) return;

      const meaningful = event.target.closest?.("[data-action], [data-toggle-family-note], [data-join-activity], [data-route]");
      const action = meaningful?.dataset.action;

      if (action === "add-family-note" || action === "post-friend-note") {
        addBond("note");
        react("happy");
      } else if (action === "mark-all-family-done" || meaningful?.hasAttribute("data-toggle-family-note")) {
        addBond("done");
        react("perk");
      } else if (meaningful?.hasAttribute("data-join-activity")) {
        addBond("activity");
        react("happy");
      } else if (meaningful?.dataset.route === "family" || meaningful?.dataset.route === "friends") {
        react("perk");
      }
      // Anything else the user presses still gets acknowledged. Bongo Cat's
      // whole trick is that *every* input produces a response; a control that
      // does nothing is what makes a character feel switched off.
      else if (event.target.closest?.(INTERACTIVE)) react("tap");
    },
    true,
  );
}

function startLife() {
  // Start blinking, idle hops, sleep-state updates, and user interaction listeners.
  if (!petButton) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    motionAllowed = false;
    return;
  }

  // Desynchronise the blink from the breathing so the two never line up.
  petButton.style.setProperty("--blink-period", `${(5 + Math.random() * 3).toFixed(2)}s`);

  // Hop on press, but let the existing click handler still open the AI page.
  petButton.addEventListener("pointerdown", () => {
    wakeUntil = Date.now() + 6000; // prodded awake, then back to dozing
    applySleepState();
    addBond("greet");
    react("hop");
  });
  watchTheUser();
  scheduleIdleHop();
  applySleepState();
  scheduleSnore();
}

/* ------------------------------------------------------------------ */
/* Setup panel (mounted by renderAI)                                    */
/* ------------------------------------------------------------------ */

function mountSetup() {
  // Mount the companion setup UI into the #pet-setup container created by renderAI().
  const host = document.querySelector("#pet-setup");
  if (!host) return;

  const library = loadLibrary();

  host.innerHTML = `
    ${statusCardMarkup()}
    <h2>Give your companion a face</h2>
    <p class="muted">Choose a photo of a pet or an animal you like. We will cut it out so it can
    sit on your screen and keep you company. Your photo stays on this device.</p>
    <div class="pet-setup-row">
      <label class="primary pet-file-label">
        &#x1F4F7; Choose a photo
        <input type="file" id="pet-file" accept="image/*" hidden />
      </label>
      ${library.activeId ? `<button class="outline-btn" id="pet-remove">Use the drawn companion</button>` : ""}
    </div>
    <p class="muted small" id="pet-status" role="status"></p>
    ${historyMarkup(library)}
  `;

  host.querySelector("#pet-file").addEventListener("change", onPhotoChosen);

  host.querySelector("#pet-remove")?.addEventListener("click", () => {
    const current = loadLibrary();
    current.activeId = null;
    saveLibrary(current);
    applyPhoto(null);
    mountSetup();
  });

  host.querySelector("#pet-history")?.addEventListener("click", onHistoryClick);
  bindStatusCard(host);
}

/* ------------------------------------------------------------------ */
/* Status card: name, days together, bond, snacks                       */
/* ------------------------------------------------------------------ */

// Fixed snack choices and their pixel-art types.
const SNACKS = [
  { kind: "apple", label: "an apple" },
  { kind: "biscuit", label: "a biscuit" },
  { kind: "bone", label: "a treat" },
];

function statusCardMarkup() {
  // Render the status card containing the name, days, bond level, and snacks.
  const pet = loadPet();
  const progress = bondProgress(pet.bond);
  const days = daysTogether(pet);
  const name = pet.name;

  return `
    <section class="pet-status" id="pet-status-card">
      <div class="pet-status-head">
        <h2>${name ? escapeHtml(name) : "Your companion"}</h2>
        <button class="outline-btn small" id="pet-rename">${name ? "Change name" : "Give a name"}</button>
      </div>
      <p class="muted">${
        days === 1
          ? "Today is your first day together."
          : `${name ? escapeHtml(name) : "Your companion"} has been with you for ${days} days.`
      }</p>

      <div class="pet-bond">
        <div class="pet-bond-label"><span>Friendship</span><strong>Level ${progress.level} of ${progress.max}</strong></div>
        <div class="pet-bond-track"><span style="width:${progress.percent}%"></span></div>
        <p class="muted small">This only ever grows. It never falls, however long you are away.</p>
      </div>

      <div class="pet-snacks">
        <span class="muted"><strong>Share a snack:</strong></span>
        ${SNACKS.map(
          (snack) => `<button class="pet-snack" data-snack="${snack.kind}" aria-label="Share ${snack.label}">${pixelSvg(snack.kind)}</button>`,
        ).join("")}
      </div>
      <p class="muted small" id="pet-snack-note"></p>
    </section>
  `;
}

function refreshStatusCard() {
  // Replace only the status card after a state change instead of rebuilding the page.
  const card = document.querySelector("#pet-status-card");
  if (!card) return; // not on the AI page - nothing to update
  card.outerHTML = statusCardMarkup();
  bindStatusCard(document.querySelector("#pet-setup"));
}

function bindStatusCard(host) {
  // Bind rename and snack events inside the status card.
  host?.querySelector("#pet-rename")?.addEventListener("click", onRename);
  host?.querySelector(".pet-snacks")?.addEventListener("click", onSnack);
}

function onRename() {
  // Rename the companion through a browser prompt and limit the name length.
  const pet = loadPet();
  const answer = window.prompt("What would you like to call your companion?", pet.name ?? "");
  if (answer === null) return;

  pet.name = answer.trim().slice(0, 24) || null;
  savePet(pet);
  refreshStatusCard();
  applyNameToLabel();
  if (pet.name) react("happy");
}

function applyNameToLabel() {
  // Keep the floating button's aria-label in sync for screen-reader users.
  const { name } = loadPet();
  petButton?.setAttribute("aria-label", name ? `Pet ${name}` : "Pet your companion");
}

function onSnack(event) {
  // Handle a snack click: award bond, wake the companion, emit particles, and show feedback.
  const button = event.target.closest("[data-snack]");
  if (!button) return;

  const name = loadPet().name ?? "Your companion";

  // A refusal here is never a telling-off: it is the companion being content.
  const accepted = addBond("feed");

  if (accepted) {
    wakeUntil = Date.now() + 6000;
    applySleepState();
    emitParticles(2, button.dataset.snack);
    react("happy");
  } else {
    emitParticles(1, "heart");
    react("perk");
  }

  // Query the note last: a successful feed rebuilds the card inside addBond,
  // so anything looked up earlier now points at a detached element.
  const note = document.querySelector("#pet-snack-note");
  if (note) {
    note.textContent = accepted
      ? `${name} enjoyed that.`
      : `${name} is still enjoying the last one. Try again in a little while.`;
  }
}

/** Past cut-outs, newest first. Choosing one is instant: the slow work is done. */
function historyMarkup(library) {
  // Render companion history from the local library and mark the active item.
  if (!library.items.length) return "";

  const cards = [...library.items]
    .sort((a, b) => b.createdAt - a.createdAt)
    .map((item) => {
      const active = item.id === library.activeId;
      return `
        <li class="pet-history-item ${active ? "active" : ""}">
          <button class="pet-history-pick" data-pick="${item.id}"
                  aria-label="Use ${escapeHtml(item.label)}"${active ? ' aria-current="true"' : ""}>
            <img src="${item.dataUrl}" alt="" />
          </button>
          <button class="pet-history-delete" data-delete="${item.id}"
                  aria-label="Delete ${escapeHtml(item.label)}">&times;</button>
          ${active ? `<span class="pet-history-badge">In use</span>` : ""}
        </li>
      `;
    })
    .join("");

  return `
    <h3 class="pet-history-title">Companions you have made</h3>
    <p class="muted small">Tap one to bring it back. They are already cut out, so it happens straight away.</p>
    <ul class="pet-history" id="pet-history">${cards}</ul>
  `;
}

function escapeHtml(text) {
  // Escape HTML characters in user-provided filenames before inserting them into templates.
  return String(text).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

function onHistoryClick(event) {
  // Use event delegation to handle history selection and deletion.
  const pick = event.target.closest("[data-pick]");
  const remove = event.target.closest("[data-delete]");
  if (!pick && !remove) return;

  const library = loadLibrary();

  if (pick) {
    library.activeId = pick.dataset.pick;
    saveLibrary(library);
    applyPhoto(activeDataUrl(library));
    mountSetup();
    setStatus("Welcome back!");
    react("happy");
    return;
  }

  library.items = library.items.filter((item) => item.id !== remove.dataset.delete);
  if (library.activeId === remove.dataset.delete) library.activeId = null;
  saveLibrary(library);
  applyPhoto(activeDataUrl(library));
  mountSetup();
}

function setStatus(message) {
  // Update the asynchronous processing status shown in the setup panel.
  const status = document.querySelector("#pet-status");
  if (status) status.textContent = message;
}

async function onPhotoChosen(event) {
  // Run the full photo flow: deduplicate, resize, cut out, save, and update the UI.
  const file = event.target.files?.[0];
  event.target.value = ""; // let the same file be chosen again later
  if (!file) return;

  try {
    // De-duplicate before doing any work: cutting out is the slow step, and on
    // a first run it also downloads the model.
    const fingerprint = await fingerprintFile(file);
    const library = loadLibrary();
    const existing = library.items.find((item) => item.fingerprint === fingerprint);

    if (existing) {
      library.activeId = existing.id;
      saveLibrary(library);
      applyPhoto(existing.dataUrl);
      mountSetup();
      setStatus("You have used this photo before, so we brought that one back straight away.");
      react("happy");
      return;
    }

    setStatus("Getting your photo ready. This can take a few moments...");

    const image = await readFileAsImage(file);
    const working = downscale(image);
    const cutOut = await removeBackground(working);
    const finished = downscale(cutOut ? trimTransparentEdges(cutOut) : circularCrop(working), STORED_DIMENSION);
    const dataUrl = finished.toDataURL("image/png");

    applyPhoto(dataUrl);

    const entry = {
      id: `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      fingerprint,
      dataUrl,
      label: file.name.replace(/\.[^.]+$/, "") || "Your companion",
      createdAt: Date.now(),
    };

    const updated = loadLibrary();
    updated.items = [...updated.items, entry].slice(-MAX_COMPANIONS);
    updated.activeId = entry.id;
    const { saved, evicted } = saveLibrary(updated);

    mountSetup();

    if (!saved) setStatus("Your companion is on the screen, but this device could not save it for next time.");
    else if (evicted > 0) setStatus("All done. There was no room left, so the oldest companion was removed.");
    else if (cutOut) setStatus("All done - your companion is on the screen.");
    else setStatus("All done. We could not remove the background, so the photo is shown in a circle.");
    react("happy");
  } catch (error) {
    console.error("[companion]", error);
    setStatus("Sorry, that photo could not be used. Please try a different one.");
  }
}

/* ------------------------------------------------------------------ */
/* Start                                                                */
/* ------------------------------------------------------------------ */

applyPhoto(activeDataUrl(loadLibrary()));
applyNameToLabel();
startLife();

// renderAI() calls this after it rebuilds the AI Companion page.
window.AgePet = { mountSetup };
