/* =========================================================
   AZENK HR — business rules engine (pure functions)
   Every number used here comes from company settings so that
   policies can be changed without touching code. Nothing in this
   file encodes a legal rule; defaults live in the (editable) settings.
   ========================================================= */
(function (EHR) {
  "use strict";
  const U = EHR.U;
  const E = {};

  /* ---------- Calendar ---------- */
  E.holidayOn = (settings, iso) => (settings.attendance.holidays || []).find((h) => h.date === iso) || null;
  E.isWeekend = (settings, iso) => (settings.company.weekend || []).includes(U.dayOfWeek(iso));
  E.isWorkday = (settings, iso) => !E.isWeekend(settings, iso) && !E.holidayOn(settings, iso);

  // Leave days between two dates (inclusive), following the company's counting policy
  E.leaveDays = (settings, from, to) => {
    if (!from || !to || to < from) return 0;
    let n = 0;
    for (let d = from; d <= to; d = U.addDays(d, 1)) {
      if (settings.leave.countWeekends || E.isWorkday(settings, d)) n += 1;
    }
    return n;
  };

  /* ---------- Shifts ---------- */
  // Resolve the concrete shift an employee works on a date (rotating shifts alternate weekly)
  E.shiftFor = (db, emp, iso) => {
    let shift = db.shifts.find((s) => s.id === emp.shiftId);
    if (!shift) return null;
    if (shift.type === "rotating" && shift.rotation && shift.rotation.length) {
      const week = Math.floor(U.diffDays("2024-01-07", iso) / 7); // weeks since a fixed Sunday
      const id = shift.rotation[((week % shift.rotation.length) + shift.rotation.length) % shift.rotation.length];
      const base = db.shifts.find((s) => s.id === id);
      if (base) shift = { ...base, id: shift.id, name: `${shift.name} (${base.name})`, rotationOf: base.id };
    }
    return shift;
  };
  E.shiftWorksOn = (shift, iso) => !!shift && (shift.days || []).includes(U.dayOfWeek(iso));
  E.shiftWindow = (shift) => {
    const start = U.toMin(shift.start);
    let end = U.toMin(shift.end);
    if (end <= start) end += 1440; // overnight shift
    return { start, end, breakMin: shift.breakMin || 0, grace: shift.grace ?? 0, length: end - start };
  };

  /* ---------- Attendance ---------- */
  // Arrival classification: within the grace period counts as on time
  E.classifyArrival = (checkIn, shift, rules) => {
    const w = E.shiftWindow(shift);
    const grace = shift.grace ?? rules.grace;
    const ci = U.toMin(checkIn);
    const late = ci > w.start + grace;
    return { late, lateMin: late ? ci - w.start : 0, grace };
  };

  // Compute derived fields for an attendance record from its raw times
  E.calcAttendance = (rec, shift, rules) => {
    const out = { lateMin: 0, earlyMin: 0, overtimeMin: 0, workedMin: null, exceedsMax: false };
    if (!rec.checkIn || !shift) return out;
    const w = E.shiftWindow(shift);
    const a = E.classifyArrival(rec.checkIn, shift, rules);
    out.lateMin = a.lateMin;
    if (rec.checkOut) {
      const ci = U.toMin(rec.checkIn);
      let co = U.toMin(rec.checkOut);
      if (co < ci) co += 1440;
      const span = co - ci;
      out.workedMin = Math.max(0, span - (span > 300 ? w.breakMin : 0));
      out.earlyMin = co < w.end - rules.earlyCheckout ? w.end - co : 0;
      out.overtimeMin = co - w.end >= rules.overtimeAfter ? co - w.end : 0;
      out.exceedsMax = span > rules.maxDailyHours * 60;
    }
    return out;
  };
  E.attendanceStatus = (rec) => {
    if (rec.status === "absent" || rec.status === "leave" || rec.status === "holiday") return rec.status;
    if (!rec.checkIn) return "absent";
    return rec.lateMin > 0 ? "late" : "present";
  };

  /* ---------- Geofence ---------- */
  E.geofence = (point, workplace) => {
    const distance = U.haversine(point.lat, point.lng, workplace.lat, workplace.lng);
    return { distance: Math.round(distance), radius: workplace.radius, inside: distance <= workplace.radius };
  };

  /* ---------- Leave balances ---------- */
  E.leaveBalance = (db, empId, typeId, year) => {
    const row = db.leaveBalances.find((b) => b.employeeId === empId && b.typeId === typeId && b.year === year);
    const opening = row ? row.opening : 0;
    const mine = db.leaves.filter((l) => l.employeeId === empId && l.typeId === typeId && l.from.slice(0, 4) === String(year));
    const used = U.sum(mine.filter((l) => l.status === "approved"), (l) => l.days);
    const pending = U.sum(mine.filter((l) => l.status === "pending"), (l) => l.days);
    return { opening, used, pending, remaining: opening - used - pending };
  };

  /* ---------- Payroll (all rates come from settings.payroll) ---------- */
  E.monthDiff = (fromKey, toKey) => {
    const [fy, fm] = fromKey.split("-").map(Number);
    const [ty, tm] = toKey.split("-").map(Number);
    return (ty * 12 + tm) - (fy * 12 + fm);
  };
  // Installments already deducted by the given period (inclusive)
  E.advancePaidBy = (adv, period) => U.clamp(E.monthDiff(adv.startMonth, period) + 1, 0, adv.installments);

  E.payrollLine = (db, emp, period, rules) => {
    const inPeriod = (iso) => iso && iso.slice(0, 7) === period;
    const basic = emp.basicSalary || 0;
    const housing = Math.round((basic * (rules.housingPct || 0)) / 100);
    const transport = emp.transportAllowance ?? rules.transportAmount ?? 0;
    const other = emp.otherAllowance || 0;
    const hourly = basic / ((rules.daysPerMonth || 30) * (rules.hoursPerDay || 8));
    const otHours = U.sum(db.overtime.filter((o) => o.employeeId === emp.id && o.status === "approved" && inPeriod(o.date)), (o) => o.hours);
    const overtime = Math.round(otHours * hourly * (rules.overtimeMultiplier || 1));
    const bonus = U.sum(
      db.compensation.filter((c) => c.employeeId === emp.id && c.status === "approved" && ["bonus", "commission"].includes(c.kind) && inPeriod(c.effective)),
      (c) => c.next
    );
    const monthAtt = db.attendance.filter((a) => a.employeeId === emp.id && inPeriod(a.date));
    const absentDays = monthAtt.filter((a) => a.status === "absent").length;
    const lateMinutes = U.sum(monthAtt, (a) => a.lateMin || 0);
    const absence = rules.deductAbsence ? Math.round(absentDays * (basic / (rules.daysPerMonth || 30))) : 0;
    const lateDeduction = Math.round(lateMinutes * (rules.lateDeductionPerMinute || 0));
    const advance = U.sum(
      db.advances.filter((a) => a.employeeId === emp.id && ["approved", "active"].includes(a.status)),
      (a) => {
        const monthsIn = E.monthDiff(a.startMonth, period);
        return monthsIn >= 0 && monthsIn < a.installments ? Math.round(a.amount / a.installments) : 0;
      }
    );
    const disciplinary = U.sum(
      db.disciplinary.filter((d) => d.employeeId === emp.id && d.status === "decided" && d.applyToPayroll && inPeriod(d.date)),
      (d) => d.amount || 0
    );
    const extra = Math.round((basic * (rules.extraDeductionPct || 0)) / 100);
    const gross = basic + housing + transport + other + overtime + bonus;
    const deductions = absence + lateDeduction + advance + disciplinary + extra;
    return {
      employeeId: emp.id, basic, housing, transport, other, overtime, otHours, bonus,
      absence, absentDays, lateDeduction, advance, disciplinary, extra,
      gross, deductions, net: gross - deductions,
    };
  };

  EHR.engine = E;
})((window.EHR = window.EHR || {}));
