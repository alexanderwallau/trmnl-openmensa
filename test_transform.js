// node test_transform.js  — one check for the shape-walking + diet heuristics.
const assert = require('assert');
eval(require('fs').readFileSync(__dirname + '/transform.js', 'utf8'));

const today = new Date().toISOString().slice(0, 10);

// openmensa.org API v2: /canteens/<id>/meals
const api = transform([
  { date: '1999-01-01', closed: true, meals: [] },
  { date: today, closed: false, meals: [
    { name: 'Kürbiskernschnitzel vom Hähnchen', category: 'Geflügel',
      prices: { students: 4.39, employees: 5.59, pupils: null, others: 8.78 },
      notes: ['mit Weizen', 'mit Eier', '9 mit Farbstoff'] },
    { name: 'Chinagemüse mit Kichererbsen', category: 'Vegan',
      prices: { students: 2.56, employees: 4.57, pupils: null, others: 5.12 },
      notes: ['mit Soja'] }
  ] }
]);
assert.strictEqual(api.closed, false);
assert.strictEqual(api.count, 2);
assert.deepStrictEqual(api.meals[0].prices, { student: '4.39', staff: '5.59', guest: '8.78' });
assert.strictEqual(api.meals[0].vegetarian, false, 'Hähnchen is not vegetarian');
assert.strictEqual(api.meals[0].glutenfree, false, 'Weizen is not gluten free');
assert.deepStrictEqual(api.meals[0].additives, ['9 mit Farbstoff']);
assert.deepStrictEqual(api.meals[0].key_allergens, ['mit Eier'], 'wheat is not vegan-relevant');
assert.strictEqual(api.meals[1].vegan, true);
assert.strictEqual(api.meals[1].glutenfree, true);

// OpenMensa Feed v2 XML, as an XML->hash parser would deliver it
const xml = transform({ openmensa: { canteen: { day: [
  { date: today, category: { name: 'Hauptgericht', meal: [
    { name: 'Linseneintopf', note: 'mit Sellerie, 1', price: [
      { role: 'student', __content__: '2,20' },
      { role: 'employee', __content__: '3,20' },
      { role: 'other', __content__: '4,20' }
    ] }
  ] } }
] } } });
assert.strictEqual(xml.count, 1);
assert.strictEqual(xml.meals[0].name, 'Linseneintopf');
assert.strictEqual(xml.meals[0].category, 'Hauptgericht');
assert.deepStrictEqual(xml.meals[0].prices, { student: '2.20', staff: '3.20', guest: '4.20' });
assert.deepStrictEqual(xml.meals[0].allergens, ['mit Sellerie']);
assert.deepStrictEqual(xml.meals[0].additives, ['1']);
assert.strictEqual(xml.meals[0].vegan, true);

// closed: explicit flag, missing day, and empty feed all mean "skip"
assert.strictEqual(transform([{ date: today, closed: true, meals: [] }]).closed, true);
assert.strictEqual(transform({ openmensa: { canteen: { day: { date: today, closed: null } } } }).closed, true);
assert.strictEqual(transform([{ date: '1999-01-01', closed: false, meals: [{ name: 'x', prices: {} }] }]).closed, true);
assert.strictEqual(transform({}).closed, true);

// bare meals array (…/days/<date>/meals)
assert.strictEqual(transform([{ name: 'Pommes', category: 'Beilage', prices: { students: 1 }, notes: [] }]).count, 1);

console.log('ok');
