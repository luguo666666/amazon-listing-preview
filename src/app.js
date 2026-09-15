import { classifyImage, groupAppImages, groupAplusImages, sortImages } from './catalog.js';

const elements = {
  input: document.querySelector('#file-input'),
  folder: document.querySelector('#folder-input'),
  dropzone: document.querySelector('#dropzone'),
  clear: document.querySelector('#clear-button'),
  count: document.querySelector('#image-count'),
  thumbs: document.querySelector('#listing-thumbs'),
  hero: document.querySelector('#listing-hero'),
  kv: document.querySelector('#kv-preview'),
  aplus: document.querySelector('#aplus-groups'),
  mobile: document.querySelector('#mobile-preview'),
  page: document.querySelector('#listing-page'),
  download: document.querySelector('#download-button'),
};

let images = [];
let selectedId = null;
const aplusSelections = new Map();

function readImage(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const meta = classifyImage({ name: file.name, width: image.naturalWidth, height: image.naturalHeight });
      resolve({ id: `${file.name}-${file.lastModified}`, file, name: file.name, url, width: image.naturalWidth, height: image.naturalHeight, meta });
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    image.src = url;
  });
}

function imageNode(item, className = '') {
  const image = document.createElement('img');
  image.src = item.url;
  image.alt = '';
  image.className = className;
  image.loading = 'lazy';
  return image;
}

function setFrame(frame, item, className = '') {
  frame.hidden = !item;
  frame.style.display = item ? '' : 'none';
  frame.replaceChildren();
  if (item) frame.append(imageNode(item, className));
}

function renderCarousel(group, variant = 'desktop') {
  const isMobile = variant === 'mobile';
  const selectionKey = isMobile ? `mobile:${group.key}` : group.key;
  const current = Math.min(aplusSelections.get(selectionKey) ?? 0, group.slides.length - 1);
  aplusSelections.set(selectionKey, current);
  const block = document.createElement('section');
  block.className = isMobile ? 'mobile-carousel-group' : 'aplus-group';

  const window = document.createElement('div');
  window.className = isMobile ? 'mobile-carousel-window' : 'carousel-window';
  window.append(imageNode(group.slides[current], isMobile ? 'mobile-carousel-image' : 'aplus-image'));

  if (group.slides.length > 1) {
    const previous = document.createElement('button');
    previous.type = 'button';
    previous.className = 'carousel-arrow previous';
    previous.setAttribute('aria-label', '上一张');
    previous.textContent = '‹';
    previous.addEventListener('click', () => {
      aplusSelections.set(selectionKey, (current - 1 + group.slides.length) % group.slides.length);
      render();
    });
    const next = document.createElement('button');
    next.type = 'button';
    next.className = 'carousel-arrow next';
    next.setAttribute('aria-label', '下一张');
    next.textContent = '›';
    next.addEventListener('click', () => {
      aplusSelections.set(selectionKey, (current + 1) % group.slides.length);
      render();
    });
    window.append(previous, next);
  }

  if (group.slides.length > 1) {
    const dots = document.createElement('div');
    dots.className = isMobile ? 'mobile-carousel-dots' : 'carousel-dots';
    group.slides.forEach((slide, index) => {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.className = `carousel-dot ${index === current ? 'is-active' : ''}`;
      dot.setAttribute('aria-label', `第 ${index + 1} 张`);
      dot.title = slide.name;
      dot.addEventListener('click', () => {
        aplusSelections.set(selectionKey, index);
        render();
      });
      dots.append(dot);
    });
    if (isMobile) {
      window.append(dots);
      block.append(window);
    } else {
      block.append(window, dots);
    }
  } else {
    block.append(window);
  }
  return block;
}

function renderMobile() {
  const sorted = sortImages(images);
  const kv = sorted.find((item) => item.meta.bucket === 'app-kv');
  const groups = groupAppImages(sorted);
  elements.mobile.replaceChildren();
  if (!kv && !groups.length) {
    elements.mobile.innerHTML = '<div class="mobile-empty">等待 APP 图片</div>';
    return;
  }
  if (kv) elements.mobile.append(imageNode(kv, 'mobile-kv-image'));
  groups.forEach((group) => elements.mobile.append(renderCarousel(group, 'mobile')));
}

function render() {
  const sorted = sortImages(images);
  const listing = sorted.filter((item) => item.meta.bucket === 'listing');
  const kv = sorted.find((item) => item.meta.bucket === 'kv');
  const aplusGroups = groupAplusImages(sorted);
  const selected = listing.find((item) => item.id === selectedId) ?? listing[0];
  selectedId = selected?.id ?? null;
  elements.count.textContent = String(images.length);

  elements.thumbs.replaceChildren();
  listing.forEach((item, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `thumb ${item.id === selectedId ? 'is-selected' : ''}`;
    button.title = item.name;
    button.append(imageNode(item));
    button.addEventListener('click', () => { selectedId = item.id; render(); });
    elements.thumbs.append(button);
    if (index === listing.length - 1) button.setAttribute('aria-current', item.id === selectedId);
  });
  setFrame(elements.hero, selected, 'hero-image');
  setFrame(elements.kv, kv, 'kv-image');
  elements.aplus.replaceChildren(...aplusGroups.map(renderCarousel));
  renderMobile();
}

function loadExportImage(item) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = item.url;
  });
}

function getSkuFromListing(listing) {
  const first = listing.find((item) => /(?:-|_)1(?:[-_].*)?\.[^.]+$/i.test(item.name));
  if (!first) return '';
  return first.name.replace(/(?:-|_)1(?:[-_].*)?\.[^.]+$/i, '');
}

function drawSkuInBlankArea(ctx, sku, x, top, width, bottom) {
  if (!sku || bottom <= top) return;
  const padding = 20;
  const maxWidth = Math.max(0, width - padding * 2);
  const maxHeight = Math.max(0, bottom - top - padding * 2);
  if (!maxWidth || !maxHeight) return;

  let fontSize = Math.min(120, maxHeight);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  while (fontSize > 12) {
    ctx.font = `700 ${fontSize}px Arial, sans-serif`;
    if (ctx.measureText(sku).width <= maxWidth) break;
    fontSize -= 2;
  }
  if (ctx.measureText(sku).width > maxWidth) return;
  ctx.fillText(sku, x + width / 2, top + (bottom - top) / 2);
}

async function downloadPreview() {
  elements.download.disabled = true;
  elements.download.classList.add('is-loading');
  try {
    const sorted = sortImages(images);
    const listing = sorted.filter((item) => item.meta.bucket === 'listing');
    const kv = sorted.find((item) => item.meta.bucket === 'kv');
    const aplusGroups = groupAplusImages(sorted);
    const appKv = sorted.find((item) => item.meta.bucket === 'app-kv');
    const appGroups = groupAppImages(sorted);
    const sku = getSkuFromListing(listing);
    if (!listing.length && !kv && !aplusGroups.length && !appKv && !appGroups.length) return;

    const showcaseGap = 50;
    const aplusGap = 20;
    const appGap = 20;
    const canvasWidth = 1500;
    const aplusWidth = Math.max(1464, ...aplusGroups.map((group) => (
      group.slides.reduce((total, item) => total + item.width, 0) + aplusGap * Math.max(0, group.slides.length - 1)
    )));
    const aplusX = canvasWidth + showcaseGap;
    const showcaseHeight = listing.reduce((total, item) => total + item.height, 0) + showcaseGap * Math.max(0, listing.length - 1);
    const aplusHeight = (kv?.height ?? 0) + aplusGroups.reduce((total, group) => total + Math.max(...group.slides.map((item) => item.height)), 0);
    const appWidth = Math.max(1200, ...appGroups.map((group) => (
      group.slides.reduce((total, item) => total + item.width, 0) + appGap * Math.max(0, group.slides.length - 1)
    )));
    const appHeight = (appKv?.height ?? 0)
      + appGroups.reduce((total, group) => total + Math.max(...group.slides.map((item) => item.height)), 0);
    const skuWidth = sku && (appKv || appGroups.length) ? 2400 : 0;
    const pcHeight = Math.max(showcaseHeight, aplusHeight);
    const pcAplusEnd = aplusHeight;
    const appTop = appKv || appGroups.length ? pcAplusEnd + 50 : 0;
    const appEnd = appTop + appHeight;
    const canvasHeight = Math.max(pcHeight, appEnd, appEnd + (skuWidth ? 220 : 0));
    const totalWidth = Math.max(aplusX + aplusWidth, appWidth, aplusX + skuWidth);
    const canvas = document.createElement('canvas');
    canvas.width = totalWidth;
    canvas.height = canvasHeight;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#6F6F6F';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const allItems = [...listing, ...(kv ? [kv] : []), ...aplusGroups.flatMap((group) => group.slides), ...(appKv ? [appKv] : []), ...appGroups.flatMap((group) => group.slides)];
    const loadedImages = new Map(await Promise.all(allItems.map(async (item) => [item.id, await loadExportImage(item)])));

    let showcaseY = 0;
    listing.forEach((item) => {
      ctx.drawImage(loadedImages.get(item.id), 0, showcaseY, item.width, item.height);
      showcaseY += item.height + showcaseGap;
    });

    let aplusY = 0;
    if (kv) {
      ctx.drawImage(loadedImages.get(kv.id), aplusX, aplusY, kv.width, kv.height);
      aplusY += kv.height;
    }
    aplusGroups.forEach((group) => {
      let slideX = aplusX;
      const rowHeight = Math.max(...group.slides.map((item) => item.height));
      group.slides.forEach((item) => {
        ctx.drawImage(loadedImages.get(item.id), slideX, aplusY, item.width, item.height);
        slideX += item.width + aplusGap;
      });
      aplusY += rowHeight;
    });

    let appY = appTop;
    const appX = aplusX;
    if (appKv) {
      ctx.drawImage(loadedImages.get(appKv.id), appX, appY, appKv.width, appKv.height);
      appY += appKv.height;
    }
    appGroups.forEach((group) => {
      let slideX = appX;
      const rowHeight = Math.max(...group.slides.map((item) => item.height));
      group.slides.forEach((item) => {
        ctx.drawImage(loadedImages.get(item.id), slideX, appY, item.width, item.height);
        slideX += item.width + appGap;
      });
      appY += rowHeight;
    });

    if (sku && (appKv || appGroups.length)) {
      const skuTop = appEnd;
      drawSkuInBlankArea(ctx, sku, appX, skuTop, skuWidth, canvasHeight);
    }
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.94));
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'amazon-listing-preview.jpg';
    link.click();
    URL.revokeObjectURL(url);
  } finally {
    elements.download.disabled = false;
    elements.download.classList.remove('is-loading');
  }
}


async function addFiles(fileList) {
  const incoming = [...fileList].filter((file) => file.type.startsWith('image/'));
  const loaded = (await Promise.all(incoming.map(readImage))).filter(Boolean);
  const oldUrls = images.map((item) => item.url);
  oldUrls.forEach((url) => URL.revokeObjectURL(url));
  images = loaded;
  selectedId = null;
  render();
}

elements.input.addEventListener('change', (event) => addFiles(event.target.files));
elements.folder.addEventListener('change', (event) => addFiles(event.target.files));
elements.dropzone.addEventListener('dragover', (event) => {
  event.preventDefault();
  elements.dropzone.classList.add('is-dragging');
});
elements.dropzone.addEventListener('dragleave', () => elements.dropzone.classList.remove('is-dragging'));
elements.dropzone.addEventListener('drop', (event) => {
  event.preventDefault();
  elements.dropzone.classList.remove('is-dragging');
  addFiles(event.dataTransfer.files);
});
elements.clear.addEventListener('click', () => {
  images.forEach((item) => URL.revokeObjectURL(item.url));
  images = [];
  selectedId = null;
  aplusSelections.clear();
  elements.input.value = '';
  render();
});
elements.download.addEventListener('click', downloadPreview);

render();
