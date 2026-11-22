// Small Draft 2020-12 subset used to exercise the sidecar JSON Schema files in tests.
// Supports: type, const, enum, required, additionalProperties:false, properties,
// items, minItems, maxItems, minLength, maxLength, minimum, pattern, $ref into $defs,
// allOf, not, if/then/else, and dependentRequired.

const KNOWN_KEYWORDS = new Set([
  "$schema", "$id", "$ref", "$defs", "title", "description",
  "type", "const", "enum", "required", "additionalProperties", "properties",
  "items", "minItems", "maxItems", "minLength", "maxLength", "minimum",
  "pattern", "allOf", "not", "if", "then", "else", "dependentRequired"
]);

export function validateSchema(schema, data) {
  const errs = [];
  check(schema, data, "", errs, schema);
  return errs;
}

function assertKnownKeywords(sch, path) {
  if (!sch || typeof sch !== "object" || Array.isArray(sch)) return;
  Object.keys(sch).forEach((k) => {
    if (!KNOWN_KEYWORDS.has(k)) {
      throw new Error("unsupported JSON Schema keyword: " + k + " at " + (path || "root"));
    }
  });
  if (Array.isArray(sch.type)) {
    throw new Error("unsupported type array at " + (path || "root"));
  }
}

function resolveRef(ref, root) {
  if (typeof ref !== "string" || !ref.startsWith("#/$defs/")) {
    throw new Error("unsupported $ref: " + ref);
  }
  const name = ref.slice("#/$defs/".length);
  const out = root && root.$defs && root.$defs[name];
  if (!out) throw new Error("unknown $ref: " + ref);
  return out;
}

function check(sch, data, path, errs, root) {
  if (!sch || typeof sch !== "object" || Array.isArray(sch)) return;
  assertKnownKeywords(sch, path);
  if (sch.$defs) {
    Object.keys(sch.$defs).forEach((name) => {
      const def = sch.$defs[name];
      if (def && typeof def === "object") assertKnownKeywords(def, (path || "root") + ".$defs." + name);
    });
  }
  if (sch.$ref) {
    check(resolveRef(sch.$ref, root), data, path, errs, root);
    return;
  }
  if (Array.isArray(sch.allOf)) sch.allOf.forEach((s) => check(s, data, path, errs, root));
  if (sch.not) {
    const inner = [];
    check(sch.not, data, path, inner, root);
    if (!inner.length) errs.push((path || "value") + " matches a forbidden schema");
  }
  const objectKeywords = sch.required || sch.properties || sch.additionalProperties === false || sch.dependentRequired;
  if (sch.type === "object" || (objectKeywords && sch.type == null)) {
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      if (sch.type === "object") errs.push((path || "value") + " must be an object");
      else if (sch.required) (sch.required || []).forEach((k) => errs.push((path || "object") + " missing " + k));
      // if/required on a non-object just fails those required keys
    } else {
      const props = sch.properties || {};
      (sch.required || []).forEach((k) => {
        if (!Object.prototype.hasOwnProperty.call(data, k)) errs.push((path || "object") + " missing " + k);
      });
      if (sch.additionalProperties === false) {
        Object.keys(data).forEach((k) => {
          if (!Object.prototype.hasOwnProperty.call(props, k)) errs.push((path || "object") + ": unknown key " + k);
        });
      }
      Object.keys(props).forEach((k) => {
        if (Object.prototype.hasOwnProperty.call(data, k)) check(props[k], data[k], path ? path + "." + k : k, errs, root);
      });
      const dep = sch.dependentRequired || {};
      Object.keys(dep).forEach((k) => {
        if (!Object.prototype.hasOwnProperty.call(data, k)) return;
        (dep[k] || []).forEach((need) => {
          if (!Object.prototype.hasOwnProperty.call(data, need)) {
            errs.push((path || "object") + " missing " + need);
          }
        });
      });
    }
  }
  const arrayKeywords = sch.minItems != null || sch.maxItems != null || sch.items;
  if (sch.type === "array" || (arrayKeywords && sch.type == null)) {
    if (!Array.isArray(data)) {
      if (sch.type === "array") errs.push((path || "value") + " must be an array");
    } else {
      if (sch.minItems != null && data.length < sch.minItems) errs.push((path || "array") + " has too few items");
      if (sch.maxItems != null && data.length > sch.maxItems) errs.push((path || "array") + " has too many items");
      if (sch.items) data.forEach((item, i) => check(sch.items, item, (path || "array") + "[" + i + "]", errs, root));
    }
  }
  if (sch.type === "string") {
    if (typeof data !== "string") {
      errs.push((path || "value") + " must be a string");
      return;
    }
    if (sch.minLength != null && data.length < sch.minLength) errs.push((path || "string") + " is too short");
    if (sch.maxLength != null && data.length > sch.maxLength) errs.push((path || "string") + " is too long");
    if (sch.pattern && !(new RegExp(sch.pattern)).test(data)) errs.push((path || "string") + " does not match pattern");
  } else if (sch.type === "integer") {
    if (typeof data !== "number" || !Number.isInteger(data)) {
      errs.push((path || "value") + " must be an integer");
      return;
    }
    if (sch.minimum != null && data < sch.minimum) errs.push((path || "integer") + " is below minimum");
  } else if (sch.type === "boolean") {
    if (typeof data !== "boolean") errs.push((path || "value") + " must be a boolean");
  } else if (sch.type === "number") {
    if (typeof data !== "number" || !Number.isFinite(data)) errs.push((path || "value") + " must be a number");
  }
  if (Object.prototype.hasOwnProperty.call(sch, "const") && data !== sch.const) {
    errs.push((path || "value") + " must be the required constant");
  }
  if (sch.enum && sch.enum.indexOf(data) < 0) {
    errs.push((path || "value") + " is not an allowed value");
  }
  if (sch.pattern && sch.type !== "string" && typeof data === "string") {
    if (!(new RegExp(sch.pattern)).test(data)) errs.push((path || "string") + " does not match pattern");
  }
  if (sch.if) {
    const probe = [];
    check(sch.if, data, path, probe, root);
    if (!probe.length) {
      if (sch.then) check(sch.then, data, path, errs, root);
    } else if (sch.else) {
      check(sch.else, data, path, errs, root);
    }
  }
}
