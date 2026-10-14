import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const s=readFileSync(new URL('../src/components/PartnerChatQuickReply.tsx',import.meta.url),'utf8');
test('quick reply opens for unread incoming messages, not as an empty launcher',()=>{
 assert.match(s,/if\(\(previous===null\|\|unreadCount>previous\)&&!suppressedUntilNewMessage\.current\)\{setOpen\(true\)\}/);
 assert.match(s,/inert=\{!open\}/);
});
test('panel closes at zero unread and stays suppressed after a reply until a new message',()=>{
 assert.match(s,/if\(unreadCount===0\)\{suppressedUntilNewMessage\.current=false;setOpen\(false\);return\}/);
 assert.match(s,/suppressedUntilNewMessage\.current=true;setReply\(''\);setOpen\(false\)/);
 assert.match(s,/if\(previous!==null&&unreadCount>previous\)\{suppressedUntilNewMessage\.current=false;setOpen\(true\)\}/);
});
