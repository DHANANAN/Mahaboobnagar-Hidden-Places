diff --git a/js/app.js b/js/app.js
index 00d7abb0c6ada1125550e9a6ff3ba10c086e0324..331defd428e70f45ef7d6836bf448fa350b76921 100644
--- a/js/app.js
+++ b/js/app.js
@@ -1,267 +1,326 @@
 const state = {
   places: [],
+  routes: [],
   filtered: [],
   activeType: 'all',
+  activeMood: 'all',
+  activeRoute: 'all',
   activeSort: 'az',
-  query: ''
+  query: '',
+  lightboxImages: [],
+  lightboxIndex: 0
 };
 
 const statusEl = document.querySelector('#status');
 const cardsEl = document.querySelector('#cards');
 const searchEl = document.querySelector('#search-input');
 const sortEl = document.querySelector('#sort-select');
 const typeEl = document.querySelector('#type-filter');
+const moodEl = document.querySelector('#mood-filter');
+const routeEl = document.querySelector('#route-filter');
+const featuredStripEl = document.querySelector('#featured-strip');
+const galleryEl = document.querySelector('#masonry-gallery');
 const imageFilterEl = document.querySelector('#image-place-filter');
 const imageListEl = document.querySelector('#image-library-list');
+
 const modal = document.querySelector('#place-modal');
 const modalClose = document.querySelector('#modal-close');
+const lightbox = document.querySelector('#lightbox');
+const lightboxClose = document.querySelector('#lightbox-close');
+const lightboxPrev = document.querySelector('#lightbox-prev');
+const lightboxNext = document.querySelector('#lightbox-next');
 let modalLastFocus = null;
+let lightboxLastFocus = null;
 
-const requiredFields = ['id', 'name', 'summary', 'tags', 'type', 'rating'];
-
-function safePlace(place) {
-  const fallback = {
-    id: crypto.randomUUID(),
-    name: 'Unknown place',
-    summary: 'Summary unavailable.',
-    tags: [],
-    type: 'Other',
-    rating: 0,
-    coordinates: null,
-    images: []
-  };
-
-  for (const key of requiredFields) {
-    if (!(key in place)) {
-      return { ...fallback, ...place };
-    }
-  }
+function commonsFilePageToDirect(filePageUrl, width = 1600) {
+  const match = filePageUrl?.match(/\/wiki\/File:(.+)$/);
+  if (!match) return '';
+  const filename = decodeURIComponent(match[1]);
+  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(filename)}?width=${width}`;
+}
 
-  return {
-    ...fallback,
-    ...place,
-    tags: Array.isArray(place.tags) ? place.tags : [String(place.tags)],
-    images: Array.isArray(place.images) ? place.images : []
-  };
+function imageDirectUrl(image, width = 1400) {
+  if (image.directUrl) return image.directUrl;
+  if (image.commonsFilePage) return commonsFilePageToDirect(image.commonsFilePage, width);
+  return '';
+}
+
+function mapPlaceImages(places) {
+  return places.flatMap((place) =>
+    (place.images || []).map((image) => ({
+      placeId: place.id,
+      placeName: place.name,
+      ...image,
+      src: imageDirectUrl(image)
+    }))
+  );
 }
 
 async function loadData() {
   statusEl.textContent = 'Loading places…';
-
   try {
     const response = await fetch('./data/data.json');
-    if (!response.ok) {
-      throw new Error(`Unable to load data: ${response.status}`);
-    }
-
+    if (!response.ok) throw new Error(`Unable to load data: ${response.status}`);
     const raw = await response.json();
-    const places = Array.isArray(raw.places) ? raw.places : [];
-    state.places = places.map(safePlace);
-    fillTypeFilter();
-    fillImageFilter();
+    state.places = Array.isArray(raw.places) ? raw.places : [];
+    state.routes = Array.isArray(raw.routes) ? raw.routes : [];
+    fillFilters();
     applyFilters();
-    statusEl.textContent = `${state.filtered.length} places found.`;
   } catch (error) {
-    statusEl.textContent = 'Could not load place data. Please refresh or check data.json.';
-    cardsEl.innerHTML = '';
+    statusEl.textContent = 'Could not load place data.';
     console.error(error);
   }
 }
 
-function fillTypeFilter() {
-  const types = [...new Set(state.places.map((p) => p.type).filter(Boolean))].sort();
-  for (const type of types) {
-    const option = document.createElement('option');
-    option.value = type;
-    option.textContent = type;
-    typeEl.append(option);
-  }
-}
+function fillFilters() {
+  const typeSet = new Set();
+  const moodSet = new Set();
 
-function fillImageFilter() {
   for (const place of state.places) {
-    const option = document.createElement('option');
-    option.value = place.id;
-    option.textContent = place.name;
-    imageFilterEl.append(option);
+    if (place.type) typeSet.add(place.type);
+    (place.moods || []).forEach((mood) => moodSet.add(mood));
+
+    const imageOption = document.createElement('option');
+    imageOption.value = place.id;
+    imageOption.textContent = place.name;
+    imageFilterEl.append(imageOption);
   }
+
+  [...typeSet].sort().forEach((type) => typeEl.append(new Option(type, type)));
+  [...moodSet].sort().forEach((mood) => moodEl.append(new Option(mood, mood)));
+  state.routes.forEach((route) => routeEl.append(new Option(route.name, route.id)));
 }
 
 function applyFilters() {
   const q = state.query.toLowerCase().trim();
+  const routePlaces = state.activeRoute === 'all'
+    ? null
+    : new Set((state.routes.find((route) => route.id === state.activeRoute)?.placeIds || []));
 
   const filtered = state.places.filter((place) => {
-    const textBlob = `${place.name} ${place.summary} ${place.tags.join(' ')}`.toLowerCase();
+    const textBlob = `${place.name} ${place.summary} ${(place.tags || []).join(' ')}`.toLowerCase();
     const textMatch = textBlob.includes(q);
     const typeMatch = state.activeType === 'all' || place.type === state.activeType;
-    return textMatch && typeMatch;
+    const moodMatch = state.activeMood === 'all' || (place.moods || []).includes(state.activeMood);
+    const routeMatch = !routePlaces || routePlaces.has(place.id);
+    return textMatch && typeMatch && moodMatch && routeMatch;
   });
 
   filtered.sort((a, b) => {
-    if (state.activeSort === 'rating') {
-      return b.rating - a.rating;
-    }
-    if (state.activeSort === 'type') {
-      return a.type.localeCompare(b.type) || a.name.localeCompare(b.name);
-    }
+    if (state.activeSort === 'rating') return b.rating - a.rating;
+    if (state.activeSort === 'type') return a.type.localeCompare(b.type) || a.name.localeCompare(b.name);
     return a.name.localeCompare(b.name);
   });
 
   state.filtered = filtered;
+  statusEl.textContent = `${filtered.length} places found.`;
+  renderFeaturedStrip();
   renderCards();
+  renderGallery();
   renderImageLibrary();
-  statusEl.textContent = `${filtered.length} places found.`;
+}
+
+function renderFeaturedStrip() {
+  featuredStripEl.innerHTML = '';
+  const featured = state.filtered.filter((place) => place.featured && place.images?.length);
+  for (const place of featured) {
+    const src = imageDirectUrl(place.images[0], 900);
+    if (!src) continue;
+    const tile = document.createElement('button');
+    tile.className = 'feature-tile';
+    tile.type = 'button';
+    tile.innerHTML = `
+      <img src="${src}" alt="${place.images[0].title || place.name}" loading="lazy" />
+      <div class="feature-copy">
+        <strong>${place.name}</strong>
+        <p>${place.hook || place.summary}</p>
+      </div>
+    `;
+    tile.addEventListener('click', () => openModal(place, tile));
+    featuredStripEl.append(tile);
+  }
 }
 
 function renderCards() {
   cardsEl.innerHTML = '';
-
   if (!state.filtered.length) {
     cardsEl.innerHTML = '<p>No places matched your filters.</p>';
     return;
   }
 
   for (const place of state.filtered) {
     const button = document.createElement('button');
     button.className = 'card';
     button.type = 'button';
     button.innerHTML = `
       <h3>${place.name}</h3>
       <p class="meta">Type: ${place.type} · Rating: ${Number(place.rating).toFixed(1)}</p>
       <p>${place.summary}</p>
-      <div class="tags">${place.tags.map((tag) => `<span class="tag">${tag}</span>`).join('')}</div>
+      <div class="tags">${(place.moods || []).map((mood) => `<span class="tag">${mood}</span>`).join('')}</div>
     `;
-
     button.addEventListener('click', () => openModal(place, button));
     cardsEl.append(button);
   }
 }
 
+function renderGallery() {
+  galleryEl.innerHTML = '';
+  const images = mapPlaceImages(state.filtered);
+  state.lightboxImages = images;
+
+  if (!images.length) {
+    galleryEl.innerHTML = '<p>No gallery images for this filter set.</p>';
+    return;
+  }
+
+  images.forEach((img, index) => {
+    const figure = document.createElement('figure');
+    figure.innerHTML = `
+      <img src="${img.src}" alt="${img.title || img.placeName}" loading="lazy" />
+      <figcaption>
+        <strong>${img.title || img.placeName}</strong><br>
+        ${img.placeName} · ${img.license || 'License pending'}
+        ${img.author ? ` · ${img.author}` : ''}<br>
+        <a href="${img.commonsFilePage || '#'}" target="_blank" rel="noopener noreferrer">Source link</a>
+      </figcaption>
+    `;
+    figure.querySelector('img').addEventListener('click', () => openLightbox(index, figure));
+    galleryEl.append(figure);
+  });
+}
+
+function renderImageLibrary() {
+  const selectedPlace = imageFilterEl.value;
+  const basePlaces = selectedPlace === 'all' ? state.places : state.places.filter((p) => p.id === selectedPlace);
+  const images = mapPlaceImages(basePlaces);
+
+  imageListEl.innerHTML = '';
+  if (!images.length) {
+    imageListEl.innerHTML = '<p>No images available for the selected place.</p>';
+    return;
+  }
+
+  for (const image of images) {
+    const card = document.createElement('article');
+    card.className = 'image-card';
+    card.innerHTML = `
+      <h3>${image.title || 'Untitled image'}</h3>
+      <p><strong>Place:</strong> ${image.placeName}</p>
+      <p><strong>License:</strong> ${image.license || 'Not specified'}</p>
+      <p><strong>Author:</strong> ${image.author || 'Not specified'}</p>
+      <p><strong>Attribution:</strong> ${image.attribution || 'Not specified'}</p>
+      <p><a href="${image.commonsFilePage || '#'}" target="_blank" rel="noopener noreferrer">Source link (Commons file page)</a></p>
+    `;
+    imageListEl.append(card);
+  }
+}
+
 function mapsUrl(place) {
   if (place.coordinates?.lat && place.coordinates?.lng) {
     return `https://www.google.com/maps?q=${place.coordinates.lat},${place.coordinates.lng}`;
   }
   return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.name)}`;
 }
 
+function renderList(items = []) {
+  return items.map((item) => `<li>${item}</li>`).join('') || '<li>Check official updates before visiting.</li>';
+}
+
 function openModal(place, triggerEl) {
   modalLastFocus = triggerEl;
   modal.querySelector('#modal-title').textContent = place.name;
+  modal.querySelector('#modal-hook').textContent = place.hook || '';
   modal.querySelector('#modal-summary').textContent = place.summary;
   modal.querySelector('#modal-rating').textContent = `Rating: ${Number(place.rating).toFixed(1)} / 5`;
-  modal.querySelector('#modal-tags').innerHTML = place.tags.map((tag) => `<li>${tag}</li>`).join('');
+  modal.querySelector('#modal-see').innerHTML = renderList(place.whatToSee);
+  modal.querySelector('#modal-shots').innerHTML = renderList(place.bestShots);
+  modal.querySelector('#modal-respect').innerHTML = renderList(place.respectNotes);
+  modal.querySelector('#modal-tags').innerHTML = (place.tags || []).map((tag) => `<li>${tag}</li>`).join('');
   modal.querySelector('#modal-map-link').href = mapsUrl(place);
+  modal.querySelector('#modal-sources').innerHTML = (place.sourceLinks || [])
+    .map((source) => `<li><a href="${source.url}" target="_blank" rel="noopener noreferrer">${source.label}</a></li>`)
+    .join('');
   modal.showModal();
-  activateFocusTrap(modal);
 }
 
 function closeModal() {
   modal.close();
-  removeFocusTrap();
   modalLastFocus?.focus();
 }
 
-function activateFocusTrap(container) {
-  const selector = 'a[href], button, textarea, input, select, [tabindex]:not([tabindex="-1"])';
-  const focusable = [...container.querySelectorAll(selector)].filter((el) => !el.disabled);
-  const first = focusable[0];
-  const last = focusable[focusable.length - 1];
-
-  function trapTab(event) {
-    if (event.key !== 'Tab') {
-      return;
-    }
-    if (event.shiftKey && document.activeElement === first) {
-      event.preventDefault();
-      last.focus();
-    } else if (!event.shiftKey && document.activeElement === last) {
-      event.preventDefault();
-      first.focus();
-    }
-  }
-
-  container.__trapHandler = trapTab;
-  container.addEventListener('keydown', trapTab);
-  first?.focus();
+function openLightbox(index, triggerEl) {
+  lightboxLastFocus = triggerEl;
+  state.lightboxIndex = index;
+  updateLightbox();
+  lightbox.showModal();
 }
 
-function removeFocusTrap() {
-  if (modal.__trapHandler) {
-    modal.removeEventListener('keydown', modal.__trapHandler);
-    delete modal.__trapHandler;
-  }
+function closeLightbox() {
+  lightbox.close();
+  lightboxLastFocus?.focus();
 }
 
-function renderImageLibrary() {
-  const selectedPlace = imageFilterEl.value;
-  const places = selectedPlace === 'all' ? state.filtered : state.places.filter((place) => place.id === selectedPlace);
-  const images = places.flatMap((place) =>
-    place.images.map((image) => ({
-      placeName: place.name,
-      ...image
-    }))
-  );
-
-  imageListEl.innerHTML = '';
-
-  if (!images.length) {
-    imageListEl.innerHTML = '<p>No images available for the selected place.</p>';
-    return;
-  }
+function updateLightbox() {
+  const image = state.lightboxImages[state.lightboxIndex];
+  if (!image) return;
+  document.querySelector('#lightbox-image').src = image.src;
+  document.querySelector('#lightbox-image').alt = image.title || image.placeName;
+  document.querySelector('#lightbox-caption').innerHTML = `
+    <strong id="lightbox-title">${image.title || image.placeName}</strong><br>
+    ${image.placeName} · ${image.license || 'License pending'}${image.author ? ` · ${image.author}` : ''}<br>
+    ${image.attribution || 'Attribution pending'} ·
+    <a href="${image.commonsFilePage || '#'}" target="_blank" rel="noopener noreferrer">Source link</a>
+  `;
+}
 
-  for (const image of images) {
-    const card = document.createElement('article');
-    card.className = 'image-card';
-    card.innerHTML = `
-      <h3>${image.title || 'Untitled image'}</h3>
-      <p><strong>Place:</strong> ${image.placeName}</p>
-      <p><strong>License:</strong> ${image.license || 'Not specified'}</p>
-      <p><strong>Attribution:</strong> ${image.attribution || 'Not specified'}</p>
-      <p><a href="${image.source || '#'}" target="_blank" rel="noopener noreferrer">Source link</a></p>
-    `;
-    imageListEl.append(card);
-  }
+function lightboxStep(direction) {
+  if (!state.lightboxImages.length) return;
+  state.lightboxIndex = (state.lightboxIndex + direction + state.lightboxImages.length) % state.lightboxImages.length;
+  updateLightbox();
 }
 
 searchEl.addEventListener('input', (event) => {
   state.query = event.target.value;
   applyFilters();
 });
-
 sortEl.addEventListener('change', (event) => {
   state.activeSort = event.target.value;
   applyFilters();
 });
-
 typeEl.addEventListener('change', (event) => {
   state.activeType = event.target.value;
   applyFilters();
 });
-
+moodEl.addEventListener('change', (event) => {
+  state.activeMood = event.target.value;
+  applyFilters();
+});
+routeEl.addEventListener('change', (event) => {
+  state.activeRoute = event.target.value;
+  applyFilters();
+});
 imageFilterEl.addEventListener('change', renderImageLibrary);
 
 modalClose.addEventListener('click', closeModal);
-modal.addEventListener('click', (event) => {
-  const rect = modal.getBoundingClientRect();
-  const clickedOutside =
-    event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom;
-  if (clickedOutside) {
-    closeModal();
-  }
-});
+lightboxClose.addEventListener('click', closeLightbox);
+lightboxPrev.addEventListener('click', () => lightboxStep(-1));
+lightboxNext.addEventListener('click', () => lightboxStep(1));
 
 document.addEventListener('keydown', (event) => {
-  if (event.key === 'Escape' && modal.open) {
-    closeModal();
+  if (event.key === 'Escape') {
+    if (lightbox.open) closeLightbox();
+    if (modal.open) closeModal();
   }
+  if (lightbox.open && event.key === 'ArrowLeft') lightboxStep(-1);
+  if (lightbox.open && event.key === 'ArrowRight') lightboxStep(1);
 });
 
 if ('serviceWorker' in navigator) {
   window.addEventListener('load', () => {
     navigator.serviceWorker.register('./service-worker.js').catch((error) => {
       console.error('Service worker registration failed', error);
     });
   });
 }
 
 loadData();
