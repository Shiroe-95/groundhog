---
name: unstick
description: What to do when groundhog says you hit the same error again or reverted your own edit. Use it as soon as a groundhog notice appears, before making another attempt.
---

# Unstick

A groundhog notice means your last attempts were variations on one idea, and the error did not move. Another variation is unlikely to work. Change the approach instead.

## Same error again

1. **Stop retrying.** Do not run another command aimed at the same error yet.
2. **Read the error in full.** Read the file and line it points to. Do not stop at the summary line.
3. **Name the cause.** Write one sentence: "This fails because ...". If you cannot write it, you do not know the cause yet. Gather facts. Do not change code.
4. **Explain every attempt.** Your hypothesis must explain why each previous attempt failed, not just the last one.
5. **Pick a check that could prove you wrong.** Run that check before the fix.
6. If you still have no hypothesis, use one of these:
   - Hand the problem to a fresh subagent. Give it only the goal, the exact error and the list of attempts. Do not pass on your theory.
   - Ask the user one specific question that would unblock you.

## Your edit was reverted

You are going back and forth between two versions of the same code.

1. Stop editing that spot.
2. Write down what each version was trying to fix.
3. Find evidence that settles it: a test, the caller, the docs or the error message. Choose one version based on that evidence.
4. If both versions break something, the real problem is somewhere else. Look one level up.

## When the notice is wrong

Sometimes the repeats are deliberate, for example polling a server that is still starting. Say so in one line and carry on. If it keeps happening, the user can raise `GROUNDHOG_WARN_AT` or turn the plugin off with `GROUNDHOG_DISABLE=1`.
