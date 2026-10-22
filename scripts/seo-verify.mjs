import assert from 'node:assert/strict';
import {readFile, stat} from 'node:fs/promises';
import {join} from 'node:path';

const root = new URL('../dist/', import.meta.url);
const base = 'https://www.vorlen.co.uk';
const publicRoutes = ['/', '/guides/employer-recruitment-questions', '/guides/ai-recruitment-questions', '/employers', '/contact', '/careers', '/services/permanent-recruitment',
  '/services/candidate-sourcing', '/services/recruitment-for-smes', '/sectors/technology',
  '/sectors/engineering', '/sectors/finance-accounting', '/sectors/sales-business-development',
  '/locations/manchester', '/locations/greater-manchester'];
const privateRoutes = ['/dashboard', '/login', '/client', '/review'];
const read = path => readFile(new URL(path, root), 'utf8');
const xml = await read('sitemap.xml');
const robots = await read('robots.txt');
assert.match(robots, /Sitemap:\s*https:\/\/www\.vorlen\.co\.uk\/sitemap\.xml/);
for (const privateRoute of privateRoutes) {
  assert.ok(!xml.includes('<loc>' + base + privateRoute), 'Private route included in sitemap: ' + privateRoute);
}
const urls = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map(match=>match[1]);
assert.equal(urls.length, new Set(urls).size, 'Duplicate sitemap URL');
for (const route of publicRoutes) {
  const canonical = base + route;
  assert.ok(urls.includes(canonical), 'Missing sitemap URL: '+canonical);
  const html = await read(route === '/' ? 'index.html' : route.slice(1) + '/index.html');
  assert.ok(html.includes('<link rel="canonical" href="' + canonical + '"'), 'Missing canonical: ' + route);
  assert.match(html, /<h1[^>]*>[^<]+<\/h1>/, 'Missing crawlable H1: ' + route);
  assert.match(html, /<main>/, 'Missing crawlable main: ' + route);
  assert.ok(html.includes('application/ld+json'), 'Missing structured data: '+route);
  assert.ok(!/<meta name="robots" content="noindex/i.test(html), 'Public route noindexed: ' + route);
}
for (const url of urls) {
  assert.ok(url.startsWith(base + '/'), 'External URL in sitemap: ' + url);
  const path = new URL(url).pathname;
  const file = path === '/' ? 'index.html' : path.slice(1) + '/index.html';
  await stat(new URL(file, root));
}
console.log('SEO production safety checks passed for ' + publicRoutes.length + ' critical routes and ' + urls.length + ' sitemap URLs');
