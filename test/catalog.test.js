import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyImage, groupAplusImages, groupAppImages, sortImages } from '../src/catalog.js';

test('classifies the three supported dimensions', () => {
  assert.equal(classifyImage({ name: 'hero-1.jpg', width: 1500, height: 1500 }).bucket, 'listing');
  assert.equal(classifyImage({ name: 'A+1-1.jpg', width: 1464, height: 1200 }).bucket, 'kv');
  assert.equal(classifyImage({ name: 'A+3-2.jpg', width: 1464, height: 600 }).bucket, 'aplus');
});

test('sorts listing suffixes and A+ group/carousel suffixes naturally', () => {
  const images = [
    { name: 'A+3-10.jpg', width: 1464, height: 600 },
    { name: 'A+3-2.jpg', width: 1464, height: 600 },
    { name: 'product-10.jpg', width: 1500, height: 1500 },
    { name: 'product-2.jpg', width: 1500, height: 1500 },
  ];
  assert.deepEqual(sortImages(images).map((image) => image.name), [
    'product-2.jpg', 'product-10.jpg', 'A+3-2.jpg', 'A+3-10.jpg',
  ]);
});

test('puts numbered listing images before unnumbered listing images', () => {
  const images = [
    { name: 'white-background.jpg', width: 1500, height: 1500 },
    { name: 'product-2.jpg', width: 1500, height: 1500 },
    { name: 'product-1.jpg', width: 1500, height: 1500 },
  ];
  assert.deepEqual(sortImages(images).map((image) => image.name), [
    'product-1.jpg', 'product-2.jpg', 'white-background.jpg',
  ]);
});

test('flags unsupported dimensions while preserving filenames', () => {
  const meta = classifyImage({ name: 'unknown.jpg', width: 800, height: 800 });
  assert.equal(meta.bucket, 'other');
  assert.equal(meta.valid, false);
});

test('groups 1464x600 images into ordered carousel blocks', () => {
  const images = [
    { name: 'A+3-2.jpg', width: 1464, height: 600 },
    { name: 'A+2-1.jpg', width: 1464, height: 600 },
    { name: 'A+3-1.jpg', width: 1464, height: 600 },
  ];
  const groups = groupAplusImages(sortImages(images));
  assert.deepEqual(groups.map((group) => group.key), ['A+2', 'A+3']);
  assert.deepEqual(groups[1].slides.map((image) => image.name), ['A+3-1.jpg', 'A+3-2.jpg']);
});

test('puts suffix-only 1464x600 images into one default carousel', () => {
  const images = [
    { name: 'banner-3.jpg', width: 1464, height: 600 },
    { name: 'banner-1.jpg', width: 1464, height: 600 },
  ];
  const groups = groupAplusImages(sortImages(images));
  assert.equal(groups.length, 1);
  assert.equal(groups[0].key, 'A+DEFAULT');
  assert.deepEqual(groups[0].slides.map((image) => image.name), ['banner-1.jpg', 'banner-3.jpg']);
});

test('classifies APP KV and APP A+ dimensions separately', () => {
  assert.equal(classifyImage({ name: 'A+1.jpg', width: 1200, height: 1800 }).bucket, 'app-kv');
  assert.equal(classifyImage({ name: 'A+3-1.jpg', width: 1200, height: 900 }).bucket, 'app-aplus');
});

test('groups APP A+ carousel images by A+ group and sequence', () => {
  const images = [
    { name: 'A+3-2.jpg', width: 1200, height: 900 },
    { name: 'A+3-1.jpg', width: 1200, height: 900 },
  ];
  const groups = groupAppImages(sortImages(images));
  assert.deepEqual(groups[0].slides.map((image) => image.name), ['A+3-1.jpg', 'A+3-2.jpg']);
});
