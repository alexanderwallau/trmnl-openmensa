// node test_worker.mjs — exercise the HTTP boundary and actual XML parsing.
import assert from 'node:assert/strict';
import worker from './worker.mjs';

const today = new Date().toISOString().slice(0, 10);
const env = { FEED_URL: 'https://feed.example/menu' };
const request = (path = '/', method = 'GET') => worker.fetch(new Request(`https://worker.example${path}`, { method }), env);
const originalFetch = globalThis.fetch;
let upstream;
let calls = 0;
globalThis.fetch = async (url, options) => {
  calls++;
  assert.equal(String(url), env.FEED_URL);
  assert.ok(options.signal instanceof AbortSignal);
  return upstream();
};

try {
  assert.equal((await request('/missing')).status, 404);
  assert.equal((await request('/', 'POST')).headers.get('Allow'), 'GET');
  for (const FEED_URL of [undefined, 'invalid', 'file:///etc/passwd', 'https://user:pass@example.com']) {
    assert.equal((await worker.fetch(new Request('https://worker.example/'), { FEED_URL })).status, 500);
  }
  assert.equal(calls, 0);

  const meal = { name: 'Pommes', category: 'Vegan', prices: { students: 1 }, notes: [] };
  for (const data of [[{ date: today, closed: false, meals: [meal] }], [meal]]) {
    upstream = () => Response.json(data);
    const response = await request('/?feed_url=https://untrusted.example/');
    assert.equal(response.status, 200);
    assert.match(response.headers.get('Content-Type'), /application\/json/);
    const menu = await response.json();
    assert.equal(menu.closed, false);
    assert.equal(menu.meals[0].prices.student, '1.00');
  }

  upstream = () => new Response(`<?xml version="1.0"?>
    <openmensa version="2.1"><canteen><day date="${today}">
      <category name="Vegan"><meal><name>Reis &amp; Gemüse</name><note>mit Soja</note>
        <price role="student">2,20</price><price role="employee">3.20</price><price role="other">4.20</price>
      </meal></category></day></canteen></openmensa>`);
  const menu = await (await request()).json();
  assert.equal(menu.count, 1);
  assert.equal(menu.closed, false);
  assert.equal(menu.meals[0].name, 'Reis & Gemüse');
  assert.equal(menu.meals[0].category, 'Vegan');
  assert.deepEqual(menu.meals[0].prices, { student: '2.20', staff: '3.20', guest: '4.20' });

  for (const body of ['[]', `<openmensa><canteen><day date="${today}"><closed/></day></canteen></openmensa>`]) {
    upstream = () => new Response(body);
    assert.equal((await (await request()).json()).closed, true);
  }

  for (const body of ['invalid json', 'null', '{}', '<html>Oops</html>', '<openmensa>', '<!DOCTYPE openmensa><openmensa/>']) {
    upstream = () => new Response(body);
    assert.equal((await request()).status, 502, body);
  }
  upstream = () => new Response('Unavailable', { status: 503 });
  assert.equal((await request()).status, 502);
  upstream = () => { throw new Error('Network failure'); };
  assert.equal((await request()).status, 502);
  console.log('worker ok');
} finally {
  globalThis.fetch = originalFetch;
}
