const { accessSync, constants, statSync } = require('node:fs');
const path = require('node:path');

const repositoryRoot = path.resolve(__dirname, '../..');

// This private reference photo is not distributed with the repository. Never
// substitute a synthetic label for its specific ₹99 / REVIEW regression.
exports.coffeeFixturePath = function coffeeFixturePath(value = process.env.OCR_COFFEE_IMAGE, root = repositoryRoot) {
  if (!value?.trim()) return undefined;
  const imagePath = path.resolve(root, value.trim());
  try {
    if (!statSync(imagePath).isFile()) throw new Error('not a regular file');
    accessSync(imagePath, constants.R_OK);
  } catch (error) {
    throw new Error(
      'OCR_COFFEE_IMAGE must point to a readable reference coffee-label photo. ' +
      'Relative paths are resolved from the repository root. ' +
      'Unset it to skip the private-photo regression.',
      { cause: error },
    );
  }
  return imagePath;
};
