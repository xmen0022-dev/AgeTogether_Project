/* Explainable, hand-authored decision tree; no model or network calls.
 * 可解释的人工规则树：无障碍需求优先，其次距离，最后兴趣。 */
(() => {
  const SELECTION_KEY = 'agetogether.activity-selections.v1';
  const needLabels = { wheelchair: 'Wheelchair access', seating: 'Seating', stepFree: 'Step-free access', hearing: 'Hearing support', other: 'Other access needs' };
  const accessRules = {
    wheelchair: /wheelchair accessible|wheelchair access/i,
    seating: /seating provided|seated options|chairs available|seating available/i,
    stepFree: /step[- ]free|flat paths|ground level|accessible entrance.*lift/i,
    hearing: /hearing loop|hearing support|caption/i,
  };

  function distanceOf(activity) {
    if (activity.distanceKm !== null && activity.distanceKm !== '' && activity.distanceKm !== undefined) {
      const value = Number(activity.distanceKm);
      if (Number.isFinite(value) && value >= 0) return value;
    }
    const match = String(activity.location || '').match(/(\d+(?:\.\d+)?)\s*km\s*away/i);
    return match ? Number(match[1]) : null;
  }

  function analyse(activity, preferences = {}) {
    const needs = Array.isArray(preferences.needs) ? preferences.needs : [];
    const interests = Array.isArray(preferences.interests) ? preferences.interests : [];
    const maxDistance = Number(preferences.maxDistance) > 0 ? Number(preferences.maxDistance) : 5;
    const access = String(activity.access || '');
    const known = Boolean(access.trim()) && !/check directly|not confirmed|unknown|contact.*venue/i.test(access);
    // A general "accessible" label never proves a specific need is met.
    // 泛泛的 accessible 标签不能证明某个具体需求已满足；否定描述也不能算匹配。
    const unmet = needs.filter((need) => !accessRules[need] || !accessRules[need].test(access) || /\b(no|not|without|unavailable|inaccessible|limited)\b/i.test(access));
    const km = distanceOf(activity);
    const reasons = [
      !known ? 'The venue has not provided confirmed access details.' : unmet.length ? `Please confirm: ${unmet.map((need) => needLabels[need] || 'Other access needs').join(', ')}.` : needs.length ? 'The listed access details appear to address your chosen needs.' : 'No specific access needs selected; venue details still need checking.',
      km === null ? 'Distance is not available.' : `${km} km from the demonstration location; your preferred range is ${maxDistance} km.`,
      !interests.length ? 'No interest preference selected.' : interests.includes(activity.category) ? 'This category matches one of your interests.' : 'This is outside your usual interests, but you may enjoy trying it.',
    ];
    if (!known || unmet.length || km === null) return { level: 'confirmation', label: 'Needs confirmation', reasons, next: 'Contact the venue to confirm access, travel and current activity details.' };
    if (km > maxDistance) return { level: 'checking', label: 'Worth checking', reasons, next: 'Plan your transport or ask someone you trust to come along. Confirm venue details before visiting.' };
    if (interests.length && !interests.includes(activity.category)) return { level: 'checking', label: 'Worth checking', reasons, next: 'Consider trying something new. Check the venue details before visiting.' };
    return { level: 'match', label: 'Good match', reasons, next: 'Worth considering based on the listed details. Confirm access and availability with the venue.' };
  }

  function readSelections(storage) {
    try {
      const value = JSON.parse(storage.getItem(SELECTION_KEY) || '{}');
      if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
      return Object.fromEntries(Object.entries(value).filter(([id, item]) => item && String(item.id) === id && typeof item.title === 'string' && (item.saved === true || item.joined === true)));
    } catch { return {}; }
  }

  function recordSelection(records, activity) {
    const updated = { ...records };
    if (activity.saved || activity.joined) updated[String(activity.id)] = { ...activity, selectedAt: records[String(activity.id)]?.selectedAt || Date.now() };
    else delete updated[String(activity.id)];
    return updated;
  }

  function restoreSelections(activities, records) {
    const restored = activities.map((activity) => records[String(activity.id)] ? { ...activity, saved: records[String(activity.id)].saved === true, joined: records[String(activity.id)].joined === true } : activity);
    const ids = new Set(restored.map((activity) => String(activity.id)));
    return [...restored, ...Object.values(records).filter((activity) => !ids.has(String(activity.id))).map((activity) => ({ ...activity, fromHistory: true }))];
  }

  window.ActivityCheck = { analyse, distanceOf, needLabels, readSelections, recordSelection, restoreSelections, SELECTION_KEY };
})();
