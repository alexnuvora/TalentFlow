#!/usr/bin/env python3
"""Patch ONLY the existing Vorlen MCP voice prompt in downloaded live function."""
import json
import pathlib
import re

source = pathlib.Path("supabase/functions/talentflow-mcp/index.ts")
prompt_file = pathlib.Path("ops/vorlen-voice-prompt.txt")
s = source.read_text(encoding="utf-8")
prompt = prompt_file.read_text(encoding="utf-8").rstrip("\n")
marker = "if(name==='get_voice_call_system_prompt')"
start = s.find(marker)
if start < 0 or s.count(marker) != 1:
    raise SystemExit("Cannot uniquely identify the live voice prompt handler; no deploy")
end = s.find("if(name===", start + len(marker))
if end < 0:
    raise SystemExit("Cannot identify end of handler; no deploy")
segment = s[start:end]
pattern = r'prompt:("(?:\\.|[^"\\])*")'
matches = list(re.finditer(pattern, segment))
if len(matches) != 1:
    raise SystemExit(f"Expected one prompt string, found {len(matches)}; no deploy")
old_prompt = json.loads(matches[0].group(1))
if "VORLEN LIVE CALL OPERATING PROMPT" not in old_prompt:
    raise SystemExit("Unexpected original prompt; no deploy")
if "Do not begin speaking until spoken to first." not in prompt:
    raise SystemExit("Expected updated speaking rule missing; no deploy")
updated = segment[:matches[0].start(1)] + json.dumps(prompt, ensure_ascii=False) + segment[matches[0].end(1):]
old_version = "version:'2026-10-08.2'"
if updated.count(old_version) != 1:
    raise SystemExit("Existing prompt version mismatch; no deploy")
updated = updated.replace(old_version, "version:'2026-10-09.1'")
patched = s[:start] + updated + s[end:]
if patched.count("name:'prepare_voice_station'") != s.count("name:'prepare_voice_station'"):
    raise SystemExit("Unexpected MCP tool modification; no deploy")
if patched.count("name:'register_voice_station'") != s.count("name:'register_voice_station'"):
    raise SystemExit("Unexpected MCP tool modification; no deploy")
source.write_text(patched, encoding="utf-8")
print(f"Voice prompt updated to 2026-10-09.1: {len(old_prompt)} -> {len(prompt)} chars. Other MCP handlers unchanged.")
