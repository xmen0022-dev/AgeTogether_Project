/* Explainable, hand-authored decision tree; no model or network calls.
 * 可解释的人工规则树：无障碍需求优先，其次距离，最后兴趣。 */
(() => {
  const SELECTION_KEY = 'agetogether.activity-selections.v1';
  const needLabels = { wheelchair: 'Wheelchair access', seating: 'Seating', stepFree: 'Step-free access', hearing: 'Hearing support', other: 'Other access needs' };
  const accessRules = {
    // Match evidence for each specific need, not a generic accessibility label.
    // Unknown needs have no rule and therefore require venue confirmation.
    wheelchair: /wheelchair accessible|wheelchair access/i,
    seating: /seating provided|seated options|chairs available|seating available/i,
    stepFree: /step[- ]free|flat paths|ground level|accessible entrance.*lift/i,
    hearing: /hearing loop|hearing support|caption/i,
  };

  function distanceOf(activity) {
    // Prefer a finite, non-negative numeric distance; zero is a valid value.
    // Older sample records may encode distance in their location string.
    // Return null for missing data rather than treating it as a nearby venue.
    if (activity.distanceKm !== null && activity.distanceKm !== '' && activity.distanceKm !== undefined) {
      const value = Number(activity.distanceKm);
      if (Number.isFinite(value) && value >= 0) return value;
    }
    const match = String(activity.location || '').match(/(\d+(?:\.\d+)?)\s*km\s*away/i);
    return match ? Number(match[1]) : null;
  }

  function analyse(activity, preferences = {}) {
    // Pure, local rule evaluation: no training, API request or state mutation.
    // Access evidence is checked first, distance second and interests last.
    // Interest matches cannot override missing or unmet access information.
    const needs = Array.isArray(preferences.needs) ? preferences.needs : [];
    const interests = Array.isArray(preferences.interests) ? preferences.interests : [];
    const maxDistance = Number(preferences.maxDistance) > 0 ? Number(preferences.maxDistance) : 5;
    const access = String(activity.access || '');
    const known = Boolean(access.trim()) && !/check directly|not confirmed|unknown|contact.*venue/i.test(access);
    // A general "accessible" label never proves a specific need is met.
    // 泛泛的 accessible 标签不能证明某个具体需求已满足；否定描述也不能算匹配。
    const unmet = needs.filter((need) => !accessRules[need] || !accessRules[need].test(access) || /\b(no|not|without|unavailable|inaccessible|limited)\b/i.test(access));
    // A negative qualifier conservatively blocks a match even if the description
    // also contains a positive keyword. This is a text heuristic, not verification.
    const km = distanceOf(activity);
    const reasons = [
      // Keep all three explanations visible, even when an earlier check decides
      // the result, so users can understand why the activity needs checking.
      !known ? 'The venue has not provided confirmed access details.' : unmet.length ? `Please confirm: ${unmet.map((need) => needLabels[need] || 'Other access needs').join(', ')}.` : needs.length ? 'The listed access details appear to address your chosen needs.' : 'No specific access needs selected; venue details still need checking.',
      km === null ? 'Distance is not available.' : `${km} km from ${activity.distanceOrigin || 'the demonstration location'}; your preferred range is ${maxDistance} km.`,
      !interests.length ? 'No interest preference selected.' : interests.includes(activity.category) ? 'This category matches one of your interests.' : 'This is outside your usual interests, but you may enjoy trying it.',
    ];
    // Missing evidence takes priority over a short distance or matching interest.
    if (!known || unmet.length || km === null) return { level: 'confirmation', label: 'Needs confirmation', reasons, next: 'Contact the venue to confirm access, travel and current activity details.' };
    if (km > maxDistance) return { level: 'checking', label: 'Worth checking', reasons, next: 'Plan your transport or ask someone you trust to come along. Confirm venue details before visiting.' };
    if (interests.length && !interests.includes(activity.category)) return { level: 'checking', label: 'Worth checking', reasons, next: 'Consider trying something new. Check the venue details before visiting.' };
    return { level: 'match', label: 'Good match', reasons, next: 'Worth considering based on the listed details. Confirm access and availability with the venue.' };
  }

  function readSelections(storage) {
    // Accept only ID-keyed activity objects that still have a selected flag.
    // Invalid JSON or unavailable storage should not stop the Social page.
    try {
      const value = JSON.parse(storage.getItem(SELECTION_KEY) || '{}');
      if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
      return Object.fromEntries(Object.entries(value).filter(([id, item]) => item && String(item.id) === id && typeof item.title === 'string' && (item.saved === true || item.joined === true)));
    } catch { return {}; }
  }

  function recordSelection(records, activity) {
    // Copy instead of mutating the caller's record map. Keep the first selection
    // timestamp while either flag is true; delete only when both are false.
    const updated = { ...records };
    if (activity.saved || activity.joined) updated[String(activity.id)] = { ...activity, selectedAt: records[String(activity.id)]?.selectedAt || Date.now() };
    else delete updated[String(activity.id)];
    return updated;
  }

  function restoreSelections(activities, records) {
    // Use fresh venue details for existing IDs, but restore their saved/joined
    // flags. Append missing records as historical selections without duplicates.
    const restored = activities.map((activity) => records[String(activity.id)] ? { ...activity, saved: records[String(activity.id)].saved === true, joined: records[String(activity.id)].joined === true } : activity);
    const ids = new Set(restored.map((activity) => String(activity.id)));
    return [...restored, ...Object.values(records).filter((activity) => !ids.has(String(activity.id))).map((activity) => ({ ...activity, fromHistory: true }))];
  }

  window.ActivityCheck = { analyse, distanceOf, needLabels, readSelections, recordSelection, restoreSelections, SELECTION_KEY };
})();
