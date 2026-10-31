// Which centers parents see on the public "Find tuitions" list.
import test from 'node:test';
import assert from 'node:assert/strict';
import { isListingReady } from '../server/services/public.js';

test('a center is listed only with a city and something to show', () => {
  assert.equal(isListingReady({}), false, 'empty profile');
  assert.equal(isListingReady({ city: 'Hyderabad' }), false, 'city only');
  assert.equal(isListingReady({ publicSubjects: ['Maths'] }), false, 'no city');
  assert.equal(isListingReady({ city: '  ', publicTagline: 'Best maths' }), false, 'blank city');
  assert.equal(isListingReady({ city: 'Hyderabad', publicSubjects: ['Maths'] }), true);
  assert.equal(isListingReady({ city: 'Pune', categories: ['music'] }), true);
  assert.equal(isListingReady({ city: 'Pune', publicTagline: 'Carnatic vocal for kids' }), true);
  assert.equal(isListingReady({ city: 'Pune', categories: [] }), false, 'empty list');
});

test('a center that turned its listing off stays hidden', () => {
  assert.equal(isListingReady({ city: 'Pune', publicTagline: 'x', listingEnabled: false }), false);
  assert.equal(isListingReady({ city: 'Pune', publicTagline: 'x', listingEnabled: 'false' }), false);
});
