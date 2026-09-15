const BUCKET_ORDER = { listing: 0, kv: 1, aplus: 2, 'app-kv': 3, 'app-aplus': 4, other: 5 };

function listingSequence(name) {
  const match = name.match(/(?:-|_)(\d+)(?:[-_].*)?(?:\.[^.]+)$/);
  return match ? Number(match[1]) : Number.POSITIVE_INFINITY;
}

export function classifyImage({ name, width, height }) {
  const aplus = name.match(/A\+\s*(\d+)(?:[-_](\d+))?/i);
  const suffix = name.match(/(?:-|_)(\d+)(?:\.[^.]+)?$/);
  const dimensions = `${width}x${height}`;
  const bucket = dimensions === '1500x1500' ? 'listing'
    : dimensions === '1464x1200' ? 'kv'
    : dimensions === '1464x600' ? 'aplus'
    : dimensions === '1200x1800' ? 'app-kv'
    : dimensions === '1200x900' ? 'app-aplus' : 'other';

  return {
    bucket,
    group: aplus ? Number(aplus[1]) : 0,
    index: aplus?.[2] ? Number(aplus[2]) : suffix ? Number(suffix[1]) : 0,
    groupKey: ['aplus', 'app-aplus'].includes(bucket) ? (aplus ? `A+${Number(aplus[1])}` : 'A+DEFAULT') : null,
    valid: bucket !== 'other',
  };
}

export function sortImages(images) {
  return [...images].sort((a, b) => {
    const left = a.meta ?? classifyImage(a);
    const right = b.meta ?? classifyImage(b);
    if (left.bucket === 'listing' && right.bucket === 'listing') {
      return listingSequence(a.name) - listingSequence(b.name)
        || a.name.localeCompare(b.name, undefined, { numeric: true });
    }
    return BUCKET_ORDER[left.bucket] - BUCKET_ORDER[right.bucket]
      || left.group - right.group
      || left.index - right.index
      || a.name.localeCompare(b.name, undefined, { numeric: true });
  });
}

export function groupAplusImages(images) {
  const groups = new Map();
  sortImages(images.filter((image) => (image.meta ?? classifyImage(image)).bucket === 'aplus'))
    .forEach((image) => {
      const meta = image.meta ?? classifyImage(image);
      const key = meta.groupKey;
      if (!groups.has(key)) groups.set(key, { key, slides: [] });
      groups.get(key).slides.push(image);
    });
  return [...groups.values()];
}

export function groupAppImages(images) {
  const groups = new Map();
  sortImages(images.filter((image) => (image.meta ?? classifyImage(image)).bucket === 'app-aplus'))
    .forEach((image) => {
      const meta = image.meta ?? classifyImage(image);
      if (!groups.has(meta.groupKey)) groups.set(meta.groupKey, { key: meta.groupKey, slides: [] });
      groups.get(meta.groupKey).slides.push(image);
    });
  return [...groups.values()];
}
