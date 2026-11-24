// Builds data/atlas/objects/bag-solar-kit.json from tools/atlas/sizing.mjs so every derived number has one source.
import { writeFileSync } from "node:fs";
import { ASSUME, OPTIONS, size, panelLead } from "./sizing.mjs";

const C = (id, title, url, checked, note) => ({ id, title, url, checked, ...(note ? { note } : {}) });
const sized = OPTIONS.map((o) => size(o));
const by = (k) => Object.fromEntries(sized.map((s) => [s.id, s[k]]));

const rec = {
  schema: "globedesk.object/1",
  id: "bag-solar-kit",
  kind: "energy-kit",
  name: "Bag solar kit (folding panel + LiFePO4 pack)",
  summary: "A personal solar array and battery pack that packs into one bag, built from common parts: a folding 100 W panel, an MPPT charge controller, a 4S LiFePO4 pack with BMS and fuses, and USB-C PD and 12 V outputs. Three sizes. DRAFT: not built or tested.",
  status: "draft",
  license: "CC BY 4.0 (record text). Linked sources keep their own terms.",
  checked: "2026-11-24",
  confidence_level: "low",
  assumptions: ASSUME,
  options: sized.map((s) => ({
    id: s.id, name: s.name, config: s.config, wh: s.wh,
    outputs: { usbc_w: OPTIONS.find((o) => o.id === s.id).usbcW, dc_a: s.dcA, inverter_w: OPTIONS.find((o) => o.id === s.id).invW },
    derived: { cells: s.cells, cell_mass_kg: s.cellMassKg, peak_sun_hours_to_full: s.peakSunHours, load_a: s.loadA, main_fuse_a: s.fuseA, wire_awg: s.gaugeAWG, per_cell_c: s.perCellC, charge_limit_a: s.chargeLimitA, drop_pct: s.dropPct },
    air_rule: s.air,
  })),
  blocks: [
    { id: "panel", label: "Folding panel 100 W", to: ["pv-fuse"], parts: ["panel", "pv-cable"] },
    { id: "pv-fuse", label: "PV fuse 10 A (optional, one string)", to: ["mppt"], parts: ["pv-fuse"] },
    { id: "mppt", label: "MPPT 75 V / 10 A", to: ["main-fuse"], parts: ["mppt"] },
    { id: "main-fuse", label: "Main fuse at battery +", to: ["bms"], parts: ["main-fuse", "switch"] },
    { id: "bms", label: "4S BMS", to: ["cells", "usbc", "dc", "inverter"], parts: ["bms"] },
    { id: "cells", label: "4S LiFePO4 cells", to: [], parts: ["cell", "busbar", "holder", "enclosure"] },
    { id: "usbc", label: "USB-C PD out", to: [], parts: ["usbc-pd"] },
    { id: "dc", label: "12 V DC out", to: [], parts: ["dc-out"] },
    { id: "inverter", label: "Small inverter (L only)", to: [], parts: ["inverter"] }
  ],
  parts: [
    { id: "cell", class: "LiFePO4 cylindrical cell, 32700", role: "Energy storage, 4 in series per group", spec: { nominal_v: 3.2, ah: 6, max_charge_v: 3.65, min_discharge_v: 2.8, mass_g: 140, size_mm: "32 x 70", std_charge: "1C (supplier sheet)", max_cont_discharge: "3C (supplier sheet)" }, qty: by("cells"), ease: "online-common", model_node: "cells", notes: "Buy one lot; match cell voltages before assembly (match window [UNKNOWN]).", citations: ["bu-205", "cell-fullbattery", "cell-sheet-blivex"] },
    { id: "bms", class: "4S LiFePO4 BMS with temperature sensor", role: "Per-cell over/under voltage, over-current, short circuit, low-temperature charge cut-off", spec: { series: 4, continuous_a: { S: ">=15", M: ">=30", L: ">=50" }, low_temp_charge_cutoff_c: 0 }, qty: { S: 1, M: 1, L: 1 }, ease: "online-common", model_node: "bms", citations: ["cell-sheet-dtp"] },
    { id: "busbar", class: "Pure nickel strip or screw busbar", role: "Joins cells; sized for pack current", spec: { material: "pure nickel (not nickel-plated steel)", size: "[UNKNOWN] - size from current per cell" }, qty: { S: "[UNKNOWN]", M: "[UNKNOWN]", L: "[UNKNOWN]" }, ease: "online-common", model_node: "busbar", citations: [] },
    { id: "holder", class: "32 mm cell holder brackets", role: "Spacing and airflow between cells", spec: { cell_diameter_mm: 32 }, qty: by("cells"), ease: "online-common", model_node: "holders", citations: [] },
    { id: "enclosure", class: "Rigid vented pack box (ABS or aluminium) + insulating sheet", role: "Protects cells inside the bag", spec: { inner_size_mm: "derived by model generator from cell grid" }, qty: { S: 1, M: 1, L: 1 }, ease: "hardware-store", model_node: "pack_box", citations: [] },
    { id: "main-fuse", class: "Blade fuse (ATO/ATC) + inline holder, at battery +", role: "Protects wiring from a short", spec: { rating_a: by("fuseA") }, qty: { S: 1, M: 1, L: 1 }, ease: "hardware-store", model_node: "fuse", citations: [] },
    { id: "switch", class: "Battery disconnect switch", role: "Turns the whole pack off for storage and travel", spec: { rating_a: "at least the main fuse rating" }, qty: { S: 1, M: 1, L: 1 }, ease: "hardware-store", model_node: "switch", citations: [] },
    { id: "mppt", class: "MPPT solar charge controller, 75 V PV / 10 A, LiFePO4 profile, adjustable max current", role: "Turns panel power into safe charge current", spec: { pv_max_v: 75, charge_a: 10, max_panel_w_12v: 145, charge_limit_a: by("chargeLimitA") }, qty: { S: 1, M: 1, L: 1 }, ease: "electronics-retail", example_items: ["Victron SmartSolar MPPT 75/10"], model_node: "mppt", citations: ["mppt-vpp"] },
    { id: "panel", class: "Folding ETFE solar panel, 100 W, about 18 V", role: "Charging source", spec: { w: 100, vmp_v: 18, imp_a: 5.56, isc_a: "[UNKNOWN] - read the panel label" }, qty: { S: 1, M: 1, L: 1 }, ease: "online-common", model_node: "panel", citations: ["panel-listing"] },
    { id: "pv-fuse", class: "MC4 inline fuse, 10 A", role: "Optional with one panel; needed if panels are paralleled", spec: { rating_a: 10 }, qty: { S: 1, M: 1, L: 1 }, ease: "online-common", model_node: "pv_fuse", citations: [] },
    { id: "pv-cable", class: "PV extension cable, MC4, 14 AWG, 5 m", role: "Lets the panel sit in sun while the pack stays shaded", spec: { awg: 14, length_m: 5, drop_pct_at_imp: panelLead().dropPct }, qty: { S: 1, M: 1, L: 1 }, ease: "online-common", model_node: "pv_cable", citations: [] },
    { id: "wire", class: "Fine-strand copper wire, silicone or marine insulation", role: "Pack and output wiring", spec: { awg: by("gaugeAWG"), drop_pct_at_full_load: by("dropPct") }, qty: { S: "[UNKNOWN]", M: "[UNKNOWN]", L: "[UNKNOWN]" }, ease: "hardware-store", citations: [] },
    { id: "connectors", class: "XT60 or Anderson Powerpole pair", role: "Keyed, polarised plug between pack and controller", spec: { rating: "[UNKNOWN] - check maker rating against main fuse" }, qty: { S: 2, M: 2, L: 2 }, ease: "online-common", model_node: "connectors", citations: [] },
    { id: "usbc-pd", class: "USB-C PD module, 12-24 V input", role: "Phone and laptop charging", spec: { w: { S: 65, M: 100, L: 100 }, draw_a_at_12v8: by("usbcA") }, qty: { S: 1, M: 1, L: 1 }, ease: "online-common", model_node: "usbc", citations: [] },
    { id: "dc-out", class: "12 V socket or DC5521 jack with switch", role: "12 V gear (fridge, fan, lights)", spec: { a: by("dcA") }, qty: { S: 1, M: 1, L: 1 }, ease: "hardware-store", model_node: "dc_out", citations: [] },
    { id: "inverter", class: "Pure sine inverter, 12 V in, about 150 W", role: "Small AC loads (L only)", spec: { w: 150, draw_a_at_12v8: by("invA") }, qty: { S: 0, M: 0, L: 1 }, ease: "electronics-retail", model_node: "inverter", citations: [] },
    { id: "bag", class: "Padded bag or backpack with a rigid pack box", role: "Carries panel, pack and cables", spec: { fit: "[UNKNOWN] - set after the model gives box size" }, qty: { S: 1, M: 1, L: 1 }, ease: "hardware-store", model_node: "bag", citations: [] }
  ],
  safety: [
    { id: "s-fuse", topic: "fusing", rule: "Put the main fuse on battery + as close to the cell stack as practical. Fuse at least 1.25x the continuous load and no higher than the wire can carry.", citations: [] },
    { id: "s-bms", topic: "bms", rule: "Every series group goes through the BMS. No bypass. Use a BMS that blocks charging below 0 C.", citations: ["cell-sheet-dtp"] },
    { id: "s-charge", topic: "charging", rule: "Set the MPPT max current at or below the cells' standard charge current (S kit: 6 A).", citations: ["cell-sheet-blivex"] },
    { id: "s-thermal", topic: "thermal", rule: "LiFePO4 is chosen for thermal margin, but any lithium pack can run away. Keep it out of hot cars and direct sun; the panel goes in sun, the pack in shade.", citations: ["bu-205", "faa-packsafe"] },
    { id: "s-air", topic: "transport", rule: "Spare lithium batteries go in carry-on only, terminals protected. 100 Wh or less is fine; 101-160 Wh needs airline approval, max two; the L kit is above that.", citations: ["faa-packsafe"] },
    { id: "s-assembly", topic: "assembly", rule: "Weld or clamp cell joints; do not solder directly to cells. Insulate every bare metal edge. Build with the switch off and the fuse out.", citations: [] }
  ],
  chemistry: ["lifepo4-vs-nmc"],
  model: { kind: "parametric", generator: "js/atlas/models/bag-solar-kit.js", units: "mm", note: "Built in code from this record (cell grid, box, controller, folded panel, bag), so the model changes with the S/M/L option. Exportable as glTF later." },
  facts: { "Pack voltage": "12.8 V nominal (4S LiFePO4)", "Built and tested": "No", "Peak sun hours": "From region table (PVGIS), not bundled yet [UNKNOWN]" },
  citations: [
    C("bu-205", "Battery University BU-205: Types of Lithium-ion", "https://batteryuniversity.com/article/bu-205-types-of-lithium-ion", "2026-11-24"),
    C("faa-packsafe", "FAA PackSafe: Lithium Batteries", "https://www.faa.gov/hazmat/packsafe/lithium-batteries", "2026-11-24"),
    C("cell-fullbattery", "Full Battery: LiFePO4 32700 6000 mAh cell (retail listing)", "https://fullbattery.com/products/32700", "2026-11-24", "140 g, 3.65 V max charge, 2.8 V min"),
    C("cell-sheet-blivex", "Blivex 32700 6.0Ah listing (supplier sheet)", "https://www.alibaba.com/product-detail/Blivex-Electric-Car-Battery-Cell-32700_1601267023888.html", "2026-11-24", "Supplier claim: 1C standard charge, 3C continuous discharge. Price is factory bulk; not used."),
    C("cell-sheet-dtp", "DTP 32700 LiFePO4 cell listing (supplier sheet)", "https://dtpbattery.en.made-in-china.com/product/zNImKXovwbhs/China-Un38-3-Approved-32700-LiFePO4-Battery-Cell-3-2V-6ah-6000mAh.html", "2026-11-24", "Supplier claim: charging 0-60 C."),
    C("mppt-vpp", "VanPartPicker: Victron SmartSolar MPPT 75/10", "https://vanpartpicker.co.uk/part/victron-smartsolar-mppt-75-10", "2026-11-24", "10 A, up to about 145 W of panels on 12 V."),
    C("panel-listing", "100 W folding panel listing (example)", "https://www.amazon.com/SOKIOVOLA-Portable-Waterproof-Lightweight-Activities/dp/B0CRB3DFRV", "2026-11-24", "Listing shows 18 V and 5.56 A.")
  ]
};
writeFileSync(new URL("../../data/atlas/objects/bag-solar-kit.json", import.meta.url), JSON.stringify(rec, null, 2) + "\n");
console.log("wrote bag-solar-kit.json", rec.parts.length, "parts");
