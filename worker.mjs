import { XMLParser, XMLValidator } from 'fast-xml-parser';
import transform from './transform.js';

const xml = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@',
  textNodeName: '__content__',
  parseTagValue: false,
});

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== '/') {
      return new Response('Not found', { status: 404 });
    }
    if (request.method !== 'GET') {
      return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET' } });
    }

    const selectedFeed = url.searchParams.get('feed_url');
    let feed;
    try {
      feed = new URL(selectedFeed ?? env.FEED_URL);
      if (!['http:', 'https:'].includes(feed.protocol) || feed.username || feed.password) {
        throw new Error('Invalid feed URL');
      }
    } catch {
      return Response.json({
        error: selectedFeed !== null
          ? 'Provide feed_url as an HTTP(S) feed URL without credentials.'
          : 'Configure FEED_URL with an HTTP(S) feed URL.',
      }, { status: selectedFeed !== null ? 400 : 500 });
    }

    try {
      const response = await fetch(feed, {
        headers: { Accept: 'application/json, application/xml, text/xml' },
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) throw new Error('Upstream request failed');
      const body = (await response.text()).trim();
      let input;
      if (body.startsWith('<')) {
        if (/<!DOCTYPE/i.test(body) || XMLValidator.validate(body) !== true) {
          throw new Error('Invalid XML feed');
        }
        input = xml.parse(body);
      } else {
        input = JSON.parse(body);
      }
      if (!input || (!Array.isArray(input) && !input.openmensa && !input.canteen && !input.day && !input.days)) {
        throw new Error('Unsupported feed shape');
      }
      return Response.json(transform(input));
    } catch {
      return Response.json({ error: 'Could not load the OpenMensa feed.' }, { status: 502 });
    }
  },
};
