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

const STORAGE_KEY = "agetogether.companion.photo.v1";

/** Phone photos are far larger than a 88px companion needs. */
const MAX_DIMENSION = 768;

/** Alpha below this counts as background when trimming. */
const ALPHA_THRESHOLD = 12;

/**
 * The only AI in this file. Swap this one function for a server call
 * (remove.bg, Photoroom, a self-hosted rembg) and nothing else changes -
 * the contract is: canvas in, canvas with transparency out.
 */
const CUTOUT_MODULE = "https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.7.0/+esm";

const petButton = document.querySelector("#pet");

/* ------------------------------------------------------------------ */
/* Image pipeline                                                       */
/* ------------------------------------------------------------------ */

function readFileAsImage(file) {
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

/** Shrink before segmenting - it is much faster and the result is only 88px on screen. */
function downscale(image, maxDimension = MAX_DIMENSION) {
  const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function canvasToBlob(canvas) {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}

/**
 * Remove the background. Returns null if the model is unavailable, which the
 * caller treats as "fall back to a circular crop" rather than as a failure.
 */
async function removeBackground(canvas) {
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

  // Clamp the source rectangle to the canvas, otherwise a subject touching an
  // edge makes drawImage read past it and pads the result with transparency -
  // which is exactly what this function exists to remove.
  // Clamp each edge independently. Clamping only the origin and keeping the
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

function loadStoredPhoto() {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null; // private browsing, blocked site data - the default companion still works
  }
}

function storePhoto(dataUrl) {
  try {
    if (dataUrl) localStorage.setItem(STORAGE_KEY, dataUrl);
    else localStorage.removeItem(STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* Applying the companion                                               */
/* ------------------------------------------------------------------ */

function applyPhoto(dataUrl) {
  if (!petButton) return;

  let photo = petButton.querySelector(".pet-photo");

  if (!dataUrl) {
    photo?.remove();
    petButton.classList.remove("has-photo");
    petButton.setAttribute("aria-label", "Open AI Companion");
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
  petButton.setAttribute("aria-label", "Open your companion");
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
  hop: { className: "is-hopping", durationMs: 680 },
  happy: { className: "is-hopping", durationMs: 680, heart: true },
  tap: { className: "is-tapping", durationMs: 240 },
  perk: { className: "is-perked", durationMs: 900 },
};

let reactionTimer = null;
let motionAllowed = true;

function react(pose) {
  const reaction = REACTIONS[pose];
  if (!reaction || !motionAllowed) return;
  if (!petButton || petButton.classList.contains("hidden")) return;

  for (const other of Object.values(REACTIONS)) petButton.classList.remove(other.className);
  void petButton.offsetWidth; // restart the animation even if the same pose is already running
  petButton.classList.add(reaction.className);

  clearTimeout(reactionTimer);
  reactionTimer = setTimeout(() => petButton.classList.remove(reaction.className), reaction.durationMs);

  if (reaction.heart) floatHeart();
}

function floatHeart() {
  const heart = document.createElement("span");
  heart.className = "pet-heart";
  heart.textContent = "♥";
  heart.setAttribute("aria-hidden", "true");
  petButton.append(heart);
  setTimeout(() => heart.remove(), 900);
}

/**
 * Idle hops at an irregular interval. A fixed interval reads as clockwork;
 * the whole point is that you cannot predict it.
 */
function scheduleIdleHop() {
  const delay = 12000 + Math.random() * 14000;
  setTimeout(() => {
    if (!document.hidden) react("hop");
    scheduleIdleHop();
  }, delay);
}

/**
 * Watch what the user does, from the document, so these survive the full
 * re-render script.js performs on every action.
 */
function watchTheUser() {
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
      const target = event.target.closest?.("[data-action], [data-toggle-family-note], [data-route]");
      if (!target) return;

      const action = target.dataset.action;
      if (action === "add-family-note" || action === "post-friend-note") react("happy");
      else if (action === "mark-all-family-done" || target.hasAttribute("data-toggle-family-note")) react("perk");
      else if (target.dataset.route === "family" || target.dataset.route === "friends") react("perk");
    },
    true,
  );
}

function startLife() {
  if (!petButton) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    motionAllowed = false;
    return;
  }

  // Desynchronise the blink from the breathing so the two never line up.
  petButton.style.setProperty("--blink-period", `${(5 + Math.random() * 3).toFixed(2)}s`);

  // Hop on press, but let the existing click handler still open the AI page.
  petButton.addEventListener("pointerdown", () => react("hop"));
  watchTheUser();
  scheduleIdleHop();
}

/* ------------------------------------------------------------------ */
/* Setup panel (mounted by renderAI)                                    */
/* ------------------------------------------------------------------ */

function mountSetup() {
  const host = document.querySelector("#pet-setup");
  if (!host) return;

  const hasPhoto = Boolean(loadStoredPhoto());

  host.innerHTML = `
    <h2>Give your companion a face</h2>
    <p class="muted">Choose a photo of a pet or an animal you like. We will cut it out so it can
    sit on your screen and keep you company. Your photo stays on this device.</p>
    <div class="pet-setup-row">
      <label class="primary pet-file-label">
        &#x1F4F7; Choose a photo
        <input type="file" id="pet-file" accept="image/*" hidden />
      </label>
      ${hasPhoto ? `<button class="outline-btn" id="pet-remove">Use the default companion</button>` : ""}
    </div>
    <p class="muted small" id="pet-status" role="status"></p>
    <div class="pet-preview" id="pet-preview" hidden></div>
  `;

  host.querySelector("#pet-file").addEventListener("change", onPhotoChosen);
  host.querySelector("#pet-remove")?.addEventListener("click", () => {
    storePhoto(null);
    applyPhoto(null);
    mountSetup();
  });
}

function setStatus(message) {
  const status = document.querySelector("#pet-status");
  if (status) status.textContent = message;
}

async function onPhotoChosen(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  setStatus("Getting your photo ready. This can take a few moments...");

  try {
    const image = await readFileAsImage(file);
    const small = downscale(image);

    const cutOut = await removeBackground(small);
    const finished = cutOut ? trimTransparentEdges(cutOut) : circularCrop(small);
    const dataUrl = finished.toDataURL("image/png");

    applyPhoto(dataUrl);
    const saved = storePhoto(dataUrl);

    // Rebuild the panel first so it picks up the new "remove" button, then
    // fill in the parts that describe what just happened.
    mountSetup();

    const preview = document.querySelector("#pet-preview");
    if (preview) {
      preview.hidden = false;
      preview.innerHTML = `<img src="${dataUrl}" alt="Your companion" />`;
    }

    if (!saved) setStatus("Your companion is ready, but this device could not save it for next time.");
    else if (cutOut) setStatus("All done - your companion is on the screen.");
    else setStatus("All done. We could not remove the background, so the photo is shown in a circle.");
  } catch (error) {
    console.error("[companion]", error);
    setStatus("Sorry, that photo could not be used. Please try a different one.");
  }
}

/* ------------------------------------------------------------------ */
/* Start                                                                */
/* ------------------------------------------------------------------ */

applyPhoto(loadStoredPhoto());
startLife();

// renderAI() calls this after it rebuilds the AI Companion page.
window.AgePet = { mountSetup };
