// Amounts travel over the API as decimal numbers (e.g. 10.5) and are stored as
// integer minor units (e.g. 1050) so arithmetic never suffers float rounding.

const SCALE = 100;
// Largest amount accepted in a single request (in major units).
const MAX_AMOUNT = 1_000_000_000_000;

function hasAtMostTwoDecimals(value) {
  const scaled = value * SCALE;
  return Math.abs(scaled - Math.round(scaled)) < 1e-6;
}

function toMinorUnits(value) {
  return Math.round(value * SCALE);
}

function toMajorUnits(minor) {
  return minor / SCALE;
}

module.exports = { MAX_AMOUNT, hasAtMostTwoDecimals, toMinorUnits, toMajorUnits };
