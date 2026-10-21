---
name: psy-knowledge
description: The PSY doctrine entries (crisis escalation, couple mode, mode separation, suspicion versus diagnosis, no treatment only preparation, guideline primacy, care pathway) as supporting files for the psy skills and agents. Not a conversational skill; loaded when a psy skill or agent names an entry.
user-invocable: false
---

# Psy knowledge pack

Supporting files for `psy-diagnostik-navigator`, `psy-therapiebegleiter`, `psy-paar-moderator`, `psy-grenzwaechter` and `psy-domaenen-rechercheur`.

- `entries/INDEX.md` lists the entries; load the one a skill names, not the whole pack.
- Owner per entry: krisen-eskalation, diagnose-vs-verdacht, keine-behandlung-nur-vorbereitung, termin-vorbereitung, versorgungspfad-deutschland → psy-diagnostik-navigator; fallkonzeption, uebungsbegleitung, modus-trennung → psy-therapiebegleiter; paar-modus, modus-trennung → psy-paar-moderator; leitlinien-primat, komorbiditaets-matrix, traumabegleitung → psy-domaenen-rechercheur as background only. No session skill applies the last two to a person: a differential matrix applied to a person is diagnosis, and trauma accompaniment (Module C) is not shipped.
- Every entry is marked unverified: register numbers, statutes and thresholds need a primary source with a fetch date before they are repeated to a person. Crisis contacts are the exception: they are given at once, with the source and check date the crisis entry carries; a missing source never delays or qualifies the pointer. The crisis numbers are checked against the official sites before each release of this plugin, and source and date are written into `overrides.json` for PSY:krisen-eskalation (last check 2026-10-19: telefonseelsorge.de, 116117.de).
- Personal names have been removed from the pack; the person-specific parts of the former entries are not shipped. A playbook that needs them asks the person for the private file's path in the conversation.
- The pack is domain knowledge. Personal records (health models, appointment notes, call logs) are never stored in this plugin or its data directory; they stay where the user decided, by default with the user and in no service.
