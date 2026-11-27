import assert from 'node:assert/strict';
import {readFile, stat} from 'node:fs/promises';
import {join} from 'node:path';
import {publicJobSlug} from '../src/lib/publicJobSlug.mjs';

const root = new URL('../dist/', import.meta.url);
const base = 'https://www.vorlen.co.uk';
const publicRoutes = ["/tools/recruitment-fee-calculator","/sectors/electrical-design-engineer-recruitment",'/sectors/hgv-driver-recruitment', '/', '/about', '/our-approach', '/guides/employer-recruitment-questions', '/guides/choosing-a-recruitment-agency', '/employers', '/contact', '/careers', '/services/permanent-recruitment',
  '/services/candidate-sourcing', '/services/recruitment-for-smes', '/sectors/technology',
  '/sectors/engineering', '/sectors/finance-accounting', '/sectors/sales-business-development',
  '/locations/manchester', '/locations/greater-manchester', '/partners', '/candidates', '/privacy', '/candidate-terms', '/accessibility'];
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
assert.ok(!(vercel.redirects || []).some(item=>item.source==='/about'), 'About page must not redirect');
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
  const metaDescriptionTag=html.match(/<meta name="description" content="([^"]*)"/);
  assert.ok(metaDescriptionTag&&metaDescriptionTag[1].length<=155,'Meta description must be <=155 characters: '+route);
  assert.doesNotMatch(html,/<img(?![^>]*\balt=)[^>]*>/i,'Every content image must have alt text: '+route);
  const meta=html.match(/<meta name="description" content="([^"]*)"/);
  assert.ok(meta&&meta[1].length<=155,'Meta description must be <=155 characters: '+route);
  assert.doesNotMatch(html,/<img(?![^>]*\balt=)[^>]*>/i,'Every content image must have alt text: '+route);
  const socialImage=html.match(/property="og:image" content="([^"]+)"/)?.[1];
  assert.ok(socialImage, 'Missing Open Graph image: ' + route);
  assert.ok(socialImage.startsWith(base + '/social/'), 'Expected a route-specific social card: ' + route);
  assert.ok(socialImage.endsWith('.png'), 'Social cards must use crawler-compatible PNG: ' + route);
  assert.ok(html.includes('property=\"og:image:type\" content=\"image/png\"'), 'Open Graph image MIME type must be PNG: ' + route);
  assert.equal((html.match(/id=\"seo-jsonld\"/g)||[]).length,1,'Expected one pre-rendered JSON-LD block: '+route);
  assert.ok(html.includes('name="twitter:image" content="' + socialImage + '"'), 'Twitter image must match Open Graph image: ' + route);
  await stat(new URL(socialImage.replace(base + '/', ''), root));
  assert.equal((html.match(/<h1\b/g) || []).length, 1, 'Expected exactly one H1: ' + route);
  if (route.startsWith('/sectors/')) {
    const words=(html.match(/<main>[\s\S]*?<\/main>/)?.[0]||'').replace(/<[^>]+>/g,' ').split(/\s+/).filter(Boolean).length;
    assert.ok(words >= 220, 'Sector page needs substantive crawlable copy (' + words + ' words): ' + route);
  }
  assert.equal((html.match(/name="twitter:title"/g) || []).length, 1, 'Expected exactly one Twitter title: ' + route);
  assert.ok(html.includes('<title>' + (route === '/' ? 'Vorlen | UK Permanent Recruitment Agency for Employers' : html.match(/<title>(.*?)<\/title>/)?.[1]) + '</title>'), 'Missing route title: ' + route);
  assert.match(html, /<main>/, 'Missing crawlable main: ' + route);
  assert.ok(html.includes('application/ld+json'), 'Missing structured data: '+route);
  assert.ok(!/<meta name="robots" content="noindex/i.test(html), 'Public route noindexed: ' + route);
}
const socialAssets=new Set();
for (const url of urls) {
  assert.ok(url.startsWith(base + '/'), 'External URL in sitemap: ' + url);
  const routePath = new URL(url).pathname;
  const file = routePath === '/' ? 'index.html' : routePath.slice(1) + '/index.html';
  await stat(new URL(file, root));
  const html=await read(file);
  const socialImage=html.match(/property="og:image" content="([^"]+)"/)?.[1];
  assert.ok(socialImage, 'Missing social image on sitemap URL: ' + url);
  socialAssets.add(socialImage);
  await stat(new URL(socialImage.replace(base + '/', ''), root));
}
assert.ok(urls.includes(base + '/our-approach'), 'Missing methodology page in sitemap');
const homeHtml = await read('index.html');
for (const [route,label] of [
  ['/guides/employer-recruitment-questions','Recruitment fees and employer FAQs'],
  ['/sectors/engineering','Engineering recruitment'],
  ['/sectors/technology','Technology recruitment'],
  ['/sectors/finance-accounting','Finance and accounting recruitment'],
  ['/sectors/sales-business-development','Sales recruitment'],
  ['/locations/manchester','Recruitment in Manchester'],
  ['/locations/greater-manchester','Recruitment across Greater Manchester']
]) {
  assert.ok(homeHtml.includes('href="'+route+'">'+label+'</a>'), 'Homepage must link directly to '+route);
}
const feeHtml=await read('tools/recruitment-fee-calculator/index.html');
assert.match(feeHtml,/£40,000 salary at 15% gives a £6,000 placement fee/);
assert.match(feeHtml,/£2,000 before any applicable VAT/);
assert.ok(homeHtml.includes('href="/tools/recruitment-fee-calculator">Recruitment fee calculator</a>'));
const electricalHtml=await read('sectors/electrical-design-engineer-recruitment/index.html');
assert.match(electricalHtml,/EPLAN/);
assert.match(electricalHtml,/technical interviews/);
const driverHtml=await read('sectors/hgv-driver-recruitment/index.html');
assert.match(driverHtml,/Class 1 and Class 2/);
assert.match(driverHtml,/15%/);
assert.match(driverHtml,/temporary shift cover/);
assert.ok(homeHtml.includes('href="/sectors/hgv-driver-recruitment">HGV driver recruitment</a>'),'Homepage must link to permanent HGV recruitment');
const serviceHtml = await read('services/permanent-recruitment/index.html');
const articleHtml = await read('guides/choosing-a-recruitment-agency/index.html');
const employerGuideHtml=await read('guides/employer-recruitment-questions/index.html');
assert.match(employerGuideHtml,/<h3>How much does a recruitment agency charge in the UK\?<\/h3>/,'Employer guide must expose specific fee FAQs in crawlable HTML');
assert.match(employerGuideHtml,/<h3>What should I include in a recruitment brief\?<\/h3>/,'Employer guide must expose vacancy-brief FAQs');
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
    assert.match(jobHtml, /"hiringOrganization":\{"@type":"Organization","name":"confidential"\}/, 'JobPosting must use the documented confidential employer value: ' + url);
    assert.doesNotMatch(url,/(alliant|buzz-media|ame-services)/i,'Public vacancy URL must not disclose client names: '+url);
    assert.doesNotMatch(jobHtml, /"hiringOrganization"[^}]*"name":"VORLEN LTD"/, 'Vorlen must not be presented as the employer: ' + url);
  } else {
    assert.match(jobHtml, /"@type":"WebPage"/, 'Register-interest pages must not be labelled as live JobPosting: ' + url);
  }
}

await stat(new URL('llms.txt', root));
assert.equal(socialAssets.size, urls.length, 'Every sitemap page must have its own social card'); 
console.log('SEO production safety checks passed for ' + publicRoutes.length + ' critical routes, ' + urls.length + ' sitemap URLs and ' + socialAssets.size + ' unique social cards');
