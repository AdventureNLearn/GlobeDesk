// Bag solar kit sizing math. Pure functions, no network. Every assumption is a named input.
// Copper resistance per metre (20 C, solid copper): AWG14 8.282, AWG12 5.211, AWG10 3.277 milliohm/m.
export const OHM_PER_M = { 14: 0.008282, 12: 0.005211, 10: 0.003277 };

export const ASSUME = {
  cellV: 3.2,            // LiFePO4 nominal, BU-205
  cellAh: 6,             // 32700 example cell
  cellMassKg: 0.14,      // example cell datasheet (140 g)
  cellChargeC: 1,        // example cell standard charge 1C (supplier sheet) [check chosen cell]
  panelW: 100,           // one folding panel
  panelDerate: 0.75,     // real-world heat, dust, angle [assumption]
  mpptEff: 0.95,         // [assumption]
  chargeEff: 0.95,       // battery round-trip share on charge [assumption]
  mpptMaxA: 10,          // 75/10 class controller
  absorbV: 14.2,         // 4S LiFePO4 charge voltage example (3.55 V/cell) [check BMS/cell]
  usbcEff: 0.92,         // PD module efficiency [assumption]
  invEff: 0.88,          // small inverter efficiency [assumption]
  fuseFactor: 1.25,      // continuous-load margin
};

export const OPTIONS = [
  { id: "S", name: "Carry-on day kit", parallel: 1, usbcW: 65,  dcA: 5,  invW: 0 },
  { id: "M", name: "Weekend kit",      parallel: 2, usbcW: 100, dcA: 10, invW: 0 },
  { id: "L", name: "Base-camp kit",    parallel: 4, usbcW: 100, dcA: 10, invW: 150 },
];

const STD_FUSES = [5, 7.5, 10, 15, 20, 25, 30, 40, 50, 60];
const up = (x) => STD_FUSES.find((f) => f >= x) ?? null;
const r = (x, d = 2) => Math.round(x * 10 ** d) / 10 ** d;

export function airRule(wh) {
  if (wh <= 100) return "<=100 Wh: carry-on OK (FAA PackSafe)";
  if (wh <= 160) return "101-160 Wh: airline approval, max two spares (FAA PackSafe)";
  return ">160 Wh: above the FAA passenger limit; ground travel only";
}

export function size(opt, a = ASSUME) {
  const packV = 4 * a.cellV;                      // 4S
  const ah = a.cellAh * opt.parallel;
  const wh = packV * ah;
  const cells = 4 * opt.parallel;
  const harvestW = a.panelW * a.panelDerate * a.mpptEff;
  const chargeLimitA = Math.min(a.mpptMaxA, a.cellChargeC * ah);
  const chargeLimitW = chargeLimitA * a.absorbV;
  const intoBatteryW = Math.min(harvestW, chargeLimitW);
  const peakSunHours = wh / a.chargeEff / intoBatteryW;
  const usbcA = opt.usbcW / (packV * a.usbcEff);
  const invA = opt.invW ? opt.invW / (packV * a.invEff) : 0;
  const loadA = usbcA + opt.dcA + invA;
  const fuseA = up(loadA * a.fuseFactor);
  const perCellA = loadA / opt.parallel;
  const gauge = fuseA <= 15 ? 14 : fuseA <= 25 ? 12 : 10;
  const loopM = 0.6;                               // 0.3 m out and back inside the pack box
  const dropV = loadA * loopM * OHM_PER_M[gauge];
  return {
    id: opt.id, name: opt.name, config: `4S${opt.parallel}P`, cells,
    packV: r(packV, 1), ah, wh: r(wh, 1), cellMassKg: r(cells * a.cellMassKg, 2),
    harvestW: r(harvestW, 1), chargeLimitA: r(chargeLimitA, 1), intoBatteryW: r(intoBatteryW, 1),
    peakSunHours: r(peakSunHours, 2),
    usbcA: r(usbcA), dcA: opt.dcA, invA: r(invA), loadA: r(loadA), fuseA,
    perCellA: r(perCellA), perCellC: r(perCellA / a.cellAh), gaugeAWG: gauge,
    dropV: r(dropV, 3), dropPct: r((100 * dropV) / packV, 2), air: airRule(wh),
  };
}

// Panel lead: Vmp 18 V, Imp 5.56 A (listing), 5 m extension = 10 m loop, AWG14.
export function panelLead(impA = 5.56, vmp = 18, loopM = 10, gauge = 14) {
  const dropV = impA * loopM * OHM_PER_M[gauge];
  return { dropV: r(dropV, 3), dropPct: r((100 * dropV) / vmp, 2) };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(JSON.stringify({ options: OPTIONS.map((o) => size(o)), panelLead: panelLead() }, null, 2));
}
