import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeAstro, zonedToUtc } from './astro.js';
import { compatibility } from './compat.js';
import { safe } from './ai.js';

test('astro: J2000 noon UTC -> Sun Capricorn (tropical), sane Vedic fields', () => {
  const a = computeAstro({ dob: '2000-01-01', time: '17:30', lat: 28.61, lng: 77.21, tz: 'Asia/Kolkata' });
  assert.equal(a.sun, 'Capricorn');
  assert.ok(a.nakshatra >= 0 && a.nakshatra < 27);
  assert.ok(a.rising);
  assert.equal(computeAstro({ dob: '2000-01-01', time: null, tz: 'Asia/Kolkata' }).rising, null);
});

test('timezone conversion', () => {
  assert.equal(zonedToUtc('2000-01-01', '17:30', 'Asia/Kolkata').toISOString(), '2000-01-01T12:00:00.000Z');
  assert.equal(zonedToUtc('2024-07-01', '12:00', 'America/New_York').toISOString(), '2024-07-01T16:00:00.000Z');
});

test('rising sign changes through the day', () => {
  const risings = new Set(['00:00', '04:00', '08:00', '12:00', '16:00', '20:00'].map(t =>
    computeAstro({ dob: '1999-05-10', time: t, lat: 19.08, lng: 72.88, tz: 'Asia/Kolkata' }).rising));
  assert.ok(risings.size >= 5);
});

test('compatibility is symmetric-ish, bounded and gives 3+ reasons', () => {
  const a = { astro: { sun: 'Leo', moon: 'Aries', nakshatra: 0 }, interests: ['Travel', 'Music', 'Food'], personality: { social: 5, talk: 1 }, lifestyle: { diet: 'Vegetarian', sleep: 'Night owl' }, intent: 'Long-term relationship' };
  const b = { astro: { sun: 'Sagittarius', moon: 'Leo', nakshatra: 9 }, interests: ['Travel', 'Music', 'Art'], personality: { social: 5, talk: 5 }, lifestyle: { diet: 'Vegetarian', sleep: 'Night owl' }, intent: 'Long-term relationship' };
  const c = compatibility(a, b);
  assert.ok(c.overall >= 55 && c.overall <= 98, c.overall);
  assert.ok(c.reasons.length >= 3);
  assert.ok(c.reasons.some(r => r.includes('Travel')));
  assert.ok(Math.abs(c.overall - compatibility(b, a).overall) <= 2);
  assert.ok(compatibility({}, {}).reasons.length >= 3);
});

test('privacy filter blocks birth data and deterministic claims', () => {
  assert.ok(safe('You both love travel and music'));
  assert.ok(!safe('Born on 12/03/1998 you two'));
  assert.ok(!safe('Born at 10:30 pm'));
  assert.ok(!safe('You are destined soulmates'));
  assert.ok(!safe('You are unsuitable for each other'));
});
