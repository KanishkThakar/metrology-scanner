import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { coffeeFixturePath } from './helpers/coffee-fixture.cjs';

test('missing or blank private-photo configuration is explicitly optional', () => {
  const previous = process.env.OCR_COFFEE_IMAGE;
  try {
    delete process.env.OCR_COFFEE_IMAGE;
    assert.equal(coffeeFixturePath(), undefined);
    assert.equal(coffeeFixturePath(''), undefined);
    assert.equal(coffeeFixturePath('   '), undefined);
  } finally {
    if (previous === undefined) delete process.env.OCR_COFFEE_IMAGE;
    else process.env.OCR_COFFEE_IMAGE = previous;
  }
});

test('a configured missing photo fails instead of silently skipping the regression', () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'metrology-fixture-'));
  try {
    assert.throws(() => coffeeFixturePath('missing.jpg', root), /OCR_COFFEE_IMAGE must point to a readable/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('a directory cannot be used as a reference photo', () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'metrology-fixture-'));
  try {
    assert.throws(() => coffeeFixturePath(root), /OCR_COFFEE_IMAGE must point to a readable/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('relative paths use the repository root and absolute paths are preserved', () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'metrology-fixture-'));
  const photo = path.join(root, 'reference photo.jpg');
  try {
    // Path validation is tested here; this is not an image decoder or OCR test.
    writeFileSync(photo, 'fixture-path-test');
    assert.equal(coffeeFixturePath('reference photo.jpg', root), photo);
    assert.equal(coffeeFixturePath(photo), photo);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
