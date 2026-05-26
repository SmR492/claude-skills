// Geteilte Input-Guards für die cdp5-gates-T1-Skills (Konzept: Input-Robustheits-Vertrag).
// Vertrag: fehlerhafte Eingabe → Exit 2 + lesbare Meldung, NIE uncaught Exception/Stacktrace.
// Nur node:-Builtins (CDP5 §32.9 Runtime-Regel).

import { existsSync, lstatSync } from 'node:fs';

/**
 * Pure Validator: gibt eine Fehlermeldung oder `null` zurück.
 * Wirft NIE, ruft NIE process.exit — testbar ohne Seiteneffekt (UC-04 AC-1).
 * @param {*} path  Pfad-Argument (string) oder abwesend (undefined/null/'')
 * @param {'file'|'dir'} kind  erwarteter Typ
 */
export function pathTypeError(path, kind) {
  if (path === undefined || path === null || path === '') return null;   // abwesend/optional → eigener Missing-Arg-Check
  if (typeof path !== 'string') return 'Argument ohne Wert (erwartet Pfad)';
  if (!existsSync(path)) return `nicht gefunden: ${path}`;
  let st;
  try { st = lstatSync(path); } catch (e) { return `nicht lesbar: ${path} (${e.code || e.message})`; }
  if (kind === 'dir' && !st.isDirectory()) return `erwartet Verzeichnis, ist keine: ${path}`;
  if (kind === 'file' && !st.isFile()) return `erwartet Datei, ist keine: ${path}`;
  return null;
}

/** Nicht pure: schreibt die Meldung nach stderr und beendet mit Exit 2 (Nutzungs-/Input-Fehler). */
export function usage(msg) { console.error(msg); process.exit(2); }

/**
 * Komfort: prüft mehrere [pfad, kind]-Paare; beim ersten Fehler → usage() (Exit 2).
 * @param {Array<[*, 'file'|'dir']>} specs
 */
export function guardPaths(specs) {
  for (const [path, kind] of specs) {
    const err = pathTypeError(path, kind);
    if (err) usage(err);
  }
}
