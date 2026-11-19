---
name: groundhog-report
description: Scan your past Claude Code sessions on this machine and show where the agent kept hitting the same error, and how often it undid its own edits. Run it when you want numbers on wasted retries.
disable-model-invocation: true
---

# groundhog report

Run the bundled scanner and summarize what it prints.

1. Pick the language. If the user writes in Spanish, add `--lang es`. Otherwise leave it out.
2. Run:

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/report.js"
   ```

   If the user named a different transcripts folder, pass it with `--dir "<folder>"`. For raw numbers, add `--json`.
3. Reply in the user's language with:
   - how many sessions were scanned and how many hit a wall
   - how many walls had changing commands versus identical retries (the changing ones are what plain loop detectors miss)
   - the top three walls, quoted as printed
   - one concrete habit or project fix that would remove the biggest wall
4. Say once that the scan ran locally and nothing left the machine.

Do not open or quote the transcript files yourself. The report already strips paths, numbers and hashes; keep it that way.
