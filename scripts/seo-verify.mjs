import assert from 'node:assert/strict';
import {readFile, stat} from 'node:fs/promises';
import {join} from 'node:path';

const root = new URL('../dist/', import.meta.url);
const base = 'https://www.vorlen.co.uk';
const publicRoutes = ['/', '/our-approach', '/guides/employer-recruitment-questions', '/guides/choosing-a-recruitment-agency', '/employers', '/contact', '/careers', '/services/permanent-recruitment',
  '/services/candidate-sourcing', '/services/recruitment-for-smes', '/sectors/technology',
  '/sectors/engineering', '/sectors/finance-accounting', '/sectors/sales-business-development',
  '/locations/manchester', '/locations/greater-manchester'];
const privateRoutes = ['/dashboard', '/login', '/client', '/review'];
const read = path => readFile(new URL(path, root), 'utf8');
const xml = await read('sitemap.xml');
const llms = await read('llms.txt');
assert.match(llms,/Candidate assessment methodology/);
assert.match(llms,/17387520/);
assert.match(llms,/linkedin.com\/company\/vorlen/);
const robots = await read('robots.txt');
assert.match(robots, /Sitemap:\s*https:\/\/www\.vorlen\.co\.uk\/sitemap\.xml/);
for (const privateRoute of privateRoutes) {
  assert.ok(!xml.includes('<loc>' + base + privateRoute), 'Private route included in sitemap: ' + privateRoute);
}
const urls = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map(match=>match[1]);
const vercel = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
const legacyGuideRedirect = (vercel.redirects || []).find(item => item.source === '/guides/ai-recruitment-questions');
assert.ok(legacyGuideRedirect, 'Missing legacy guide redirect');
assert.equal(legacyGuideRedirect.destination, '/guides/choosing-a-recruitment-agency', 'Legacy guide must redirect to the renamed guide');
assert.equal(legacyGuideRedirect.permanent, true, 'Legacy guide redirect must be permanent');
assert.ok(!urls.includes(base + '/guides/ai-recruitment-questions'), 'Legacy guide URL must not appear in the sitemap');
assert.equal(urls.length, new Set(urls).size, 'Duplicate sitemap URL');
for (const route of publicRoutes) {
  const canonical = base + route;
  assert.ok(urls.includes(canonical), 'Missing sitemap URL: '+canonical);
  const html = await read(route === '/' ? 'index.html' : route.slice(1) + '/index.html');
  assert.ok(html.includes('<link rel="canonical" href="' + canonical + '"'), 'Missing canonical: ' + route);
  assert.match(html, /<h1[^>]*>[^<]+<\/h1>/, 'Missing crawlable H1: ' + route);
  assert.equal((html.match(/property="og:url"/g) || []).length, 1, 'Expected exactly one Open Graph URL: ' + route);
  assert.ok(html.includes('property="og:url" content="' + canonical + '"'), 'Incorrect Open Graph URL: ' + route);
  assert.equal((html.match(/name="twitter:title"/g) || []).length, 1, 'Expected exactly one Twitter title: ' + route);
  assert.ok(html.includes('<title>' + (route === '/' ? 'Vorlen | UK Permanent Recruitment Agency for Employers' : html.match(/<title>(.*?)<\/title>/)?.[1]) + '</title>'), 'Missing route title: ' + route);
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
assert.ok(urls.includes(base + '/our-approach'), 'Missing methodology page in sitemap');
const homeHtml = await read('index.html');
const serviceHtml = await read('services/permanent-recruitment/index.html');
const articleHtml = await read('guides/choosing-a-recruitment-agency/index.html');
assert.match(homeHtml, /"@type":\["Organization","EmploymentAgency"\]/, 'Homepage must describe the agency entity');
assert.match(serviceHtml, /"@type":"Service"/, 'Permanent recruitment page must expose Service schema');
assert.match(articleHtml, /"@type":"Article"/, 'Recruitment guide must expose Article schema');
const methodologyHtml = await read('our-approach/index.html');
assert.match(methodologyHtml, /automated score/, 'Methodology page must explain human decision-making');
assert.match(methodologyHtml, /protected characteristics/, 'Methodology page must explain fair, job-related assessment');
assert.match(methodologyHtml, /lawful basis/, 'Methodology page must explain candidate information sharing');
for (const url of urls.filter(x=>x.includes('/careers/'))) {
  const jobHtml = await read(new URL(url).pathname.slice(1) + '/index.html');
  if (jobHtml.includes('"@type":"JobPosting"')) {
    assert.match(jobHtml, /"hiringOrganization"/, 'JobPosting must identify the hiring organization: ' + url);
    assert.match(jobHtml, /"datePosted"/, 'JobPosting must include its publication date: ' + url);
    assert.match(jobHtml, /"directApply":true/, 'JobPosting must expose the direct application route: ' + url);
  } else {
    assert.match(jobHtml, /"@type":"WebPage"/, 'Register-interest pages must not be labelled as live JobPosting: ' + url);
  }
}

await stat(new URL('llms.txt', root));
console.log('SEO production safety checks passed for ' + publicRoutes.length + ' critical routes and ' + urls.length + ' sitemap URLs');
