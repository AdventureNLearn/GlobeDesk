// Source class of a registry source (official, reference or experimental), through the same helper the validator uses.
import { createRequire } from "node:module";
const SC = createRequire(import.meta.url)("../../js/source-class.js");
export const SC_CLASS = (s) => SC.classOf(s);
