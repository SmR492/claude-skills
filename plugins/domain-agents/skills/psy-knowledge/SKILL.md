---
name: psy-knowledge
description: The PSY doctrine entries (crisis escalation, couple mode, mode separation, suspicion versus diagnosis, no treatment only preparation, guideline primacy, care pathway) as supporting files for the psy skills and agents. Not a conversational skill; loaded when a psy skill or agent names an entry.
user-invocable: false
---

# Psy knowledge pack

Supporting files for `psy-diagnostik-navigator`, `psy-therapiebegleiter`, `psy-paar-moderator`, `psy-grenzwaechter` and `psy-domaenen-rechercheur`.

- `entries/INDEX.md` lists the entries; load the one a skill names, not the whole pack.
- Every entry is marked unverified: register numbers, statutes, thresholds and contact numbers need a primary source with a fetch date before they are repeated to a person. The crisis entry must carry its numbers with source and date; where the entry lacks them, say so and point to official directories.
- Personal names have been removed from the pack; the person-specific parts of the former entries are not shipped. A playbook that needs them reads a private file the user keeps.
- The pack is domain knowledge. Personal records (health models, appointment notes, call logs) are never stored in this plugin or its data directory; they stay where the user decided, by default with the user and in no service.
