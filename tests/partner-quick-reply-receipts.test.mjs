import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../src/components/PartnerChatQuickReply.tsx',import.meta.url),'utf8');
test('quick reply records a receipt only on successful send',()=>{
 const inserted=source.indexOf("partner_messages').insert"),failed=source.indexOf('if(e2)',inserted),receipt=source.indexOf("partner_message_receipts').upsert",failed);
 assert.ok(inserted>=0&&failed>inserted&&receipt>failed);
 assert.match(source,/message_id:latest\.id,conversation_id:conversation,user_id:me,delivered_at:now,read_at:now/);
});
test('quick reply notifies nav and closes after a successful send',()=>{
 assert.match(source,/window\.dispatchEvent\(new Event\('partner-chat-read'\)\)/);
 assert.match(source,/suppressedUntilNewMessage\.current=true;setReply\(''\);setOpen\(false\)/);
});
test('emoji reaction acknowledges incoming message and closes quick reply after success',()=>{
 assert.match(source,/if\(existing\?\.emoji!==emoji&&message\.sender_id!==me\)/);
 assert.match(source,/suppressedUntilNewMessage\.current=true;setOpen\(false\)/);
});
