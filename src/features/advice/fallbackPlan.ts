// Rules-based plan with the AdvicePlan shape (AQI_AND_RULES.md §9). Shown when
// the AI is unavailable. Template copy only; every number comes from FACTS.
import type { AdviceAction, AdvicePlan } from '@shared/advice/planSchema';
import type { FactsSnapshot, Member, RiskLevel, TimeWindow } from '@shared/types';
import { CATEGORY_LABELS } from '@/lib/aqi/categories';

export const FALLBACK_NOTICE =
  'Personalised AI plan unavailable — showing standard guidance based on live data.';

const RISK_ORDER: readonly RiskLevel[] = ['low', 'caution', 'high', 'very_high'];
const OPEN_MODES = ['walk', 'cycle', 'two_wheeler', 'auto_rickshaw'];

/** What every section of the fallback plan needs, derived once from the snapshot. */
interface PlanContext {
  snapshot: FactsSnapshot;
  tz: string;
  w1: TimeWindow | undefined;
  v1: TimeWindow | undefined;
  riskOf: (m: Member) => RiskLevel;
  highest: RiskLevel;
  levelText: string;
  sensitive: Member[];
}

function windowText(window: TimeWindow, timeZone: string): string {
  const fmt = new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit', timeZone });
  return `${window.label}, ${fmt.format(new Date(window.start))}–${fmt.format(new Date(window.end))}`;
}

const clip = (text: string, max: number) =>
  text.length <= max ? text : `${text.slice(0, max - 1)}…`;

function action(partial: Omit<AdviceAction, 'id'> & { id: string }): AdviceAction {
  return {
    ...partial,
    title: clip(partial.title, 90),
    why: clip(partial.why, 280),
    impact: clip(partial.impact, 200),
    ...(partial.when ? { when: clip(partial.when, 60) } : {}),
  };
}

const joinLabels = (members: Member[], fallback: string) =>
  members.length > 0 ? members.map((m) => m.label).join(' and ') : fallback;

function planContext(snapshot: FactsSnapshot): PlanContext {
  const { profile, memberRisk, windows, naqi, pm25Band, location } = snapshot;
  const riskOf = (m: Member): RiskLevel =>
    memberRisk.find((r) => r.memberId === m.id)?.level ?? 'caution';
  const highest = memberRisk.reduce<RiskLevel>(
    (top, r) => (RISK_ORDER.indexOf(r.level) > RISK_ORDER.indexOf(top) ? r.level : top),
    'low',
  );
  const category = naqi?.category ?? pm25Band;
  return {
    snapshot,
    tz: location.timezone,
    w1: windows.bestOutdoor[0],
    v1: windows.ventilate[0],
    riskOf,
    highest,
    levelText: category ? CATEGORY_LABELS[category] : 'uncertain',
    sensitive: profile.members.filter((m) => riskOf(m) === 'high' || riskOf(m) === 'very_high'),
  };
}

function activityAction(member: Member, kind: string, ctx: PlanContext): AdviceAction {
  const { w1, tz, levelText } = ctx;
  const level = ctx.riskOf(member);
  if (level === 'very_high' || !w1) {
    return action({
      id: `activity-${member.id}`.slice(0, 40),
      title: `Move ${member.label}'s ${kind} indoors today`,
      forMembers: [member.id],
      category: 'activity',
      priority: 'high',
      why: `Air is ${levelText} and ${member.label} is at very high risk today, so outdoor exertion is best avoided.`,
      impact: `Keeps ${member.label}'s breathing load down; choose a short indoor alternative.`,
    });
  }
  return action({
    id: `activity-${member.id}`.slice(0, 40),
    title: `Move ${member.label}'s ${kind} to ${w1.label}`,
    when: windowText(w1, tz),
    windowRef: w1.label,
    forMembers: [member.id],
    category: 'activity',
    priority: level === 'low' ? 'low' : level === 'caution' ? 'medium' : 'high',
    why: `${w1.label} has the lowest PM2.5 of the next 24 waking hours, so the same time outdoors means less smoke breathed in.`,
    impact: `Less fine-particle exposure for ${member.label}.`,
  });
}

function maskAction(ctx: PlanContext, hasActivities: boolean): AdviceAction | undefined {
  const { profile } = ctx.snapshot;
  const masks = profile.masks;
  if (ctx.highest === 'low' || !(profile.commute || hasActivities || masks.length > 0)) {
    return undefined;
  }
  const weak = masks.filter((m) => m === 'surgical' || m === 'cloth');
  return action({
    id: 'mask',
    title: masks.includes('n95_ffp2')
      ? 'Wear a well-fitted N95/FFP2 outdoors (adults)'
      : 'Get N95/FFP2 masks for adults going outdoors',
    forMembers: ['all'],
    category: 'mask',
    priority: ctx.highest === 'very_high' || ctx.highest === 'high' ? 'high' : 'medium',
    why:
      weak.length > 0
        ? 'Surgical and cloth masks give limited protection against fine particles; a well-fitted N95/FFP2 filters them far better.'
        : 'A well-fitted N95/FFP2 is the effective option against PM2.5. Masks are not for children under 2.',
    impact: 'Cuts the fine particles adults breathe in during unavoidable trips.',
  });
}

function commuteAction(ctx: PlanContext): AdviceAction | undefined {
  const { w1, tz } = ctx;
  const commute = ctx.snapshot.profile.commute;
  if (!commute || commute.mode === 'wfh' || !OPEN_MODES.includes(commute.mode)) return undefined;
  if (ctx.highest === 'low') return undefined;
  return action({
    id: 'commute',
    title: w1 ? `Shift errands and flexible trips towards ${w1.label}` : 'Keep trips short today',
    ...(w1 ? { when: windowText(w1, tz), windowRef: w1.label } : {}),
    forMembers: ['all'],
    category: 'commute',
    priority: 'medium',
    why: 'Open-air travel such as walking, cycling, two-wheelers and autos puts you close to traffic smoke.',
    impact: 'Less time in the worst air on the road.',
  });
}

function generalOutdoorAction(ctx: PlanContext): AdviceAction {
  const { w1, tz } = ctx;
  return action({
    id: 'outdoor',
    title: w1 ? `Plan outdoor time around ${w1.label}` : 'Keep outdoor time light today',
    ...(w1 ? { when: windowText(w1, tz), windowRef: w1.label } : {}),
    forMembers: ['all'],
    category: 'errand',
    priority: ctx.highest === 'low' ? 'low' : 'medium',
    why: w1
      ? `${w1.label} has the lowest PM2.5 in waking hours over the next day.`
      : 'There is no clearly cleaner window in waking hours.',
    impact: 'Lower exposure for the whole household.',
  });
}

function routineActions(ctx: PlanContext): AdviceAction[] {
  const routine: AdviceAction[] = [];
  for (const member of ctx.snapshot.profile.members) {
    if (member.outdoorActivity) {
      routine.push(activityAction(member, member.outdoorActivity.kind, ctx));
    }
  }
  const mask = maskAction(ctx, routine.length > 0);
  if (mask) routine.push(mask);
  const commute = commuteAction(ctx);
  if (commute) routine.push(commute);
  if (routine.length === 0) routine.push(generalOutdoorAction(ctx));
  return routine;
}

function cleanAirAction(ctx: PlanContext): AdviceAction {
  const { purifier } = ctx.snapshot;
  const priority = ctx.highest === 'low' ? 'low' : 'high';
  if (purifier?.has) {
    const ach = purifier.achievedAch;
    return action({
      id: 'purifier',
      title: 'Run the purifier in the main room with the door closed',
      forMembers: ['all'],
      category: 'purifier',
      priority,
      why:
        ach === null
          ? `Aim for about ${String(purifier.targetAch)} air changes an hour; that needs a CADR of about ${String(purifier.requiredCadrM3h ?? 'the room size times')} m³/h for this room.`
          : `Your purifier gives about ${String(Math.round(ach))} air changes an hour in this room; ${String(purifier.targetAch)} is a good target.`,
      impact: 'Cleaner air where the household spends most time.',
    });
  }
  return action({
    id: 'clean-room',
    title: 'Make one clean room: close windows, seal gaps, keep the door shut',
    forMembers: ['all'],
    category: 'sealing',
    priority,
    why: 'Without a purifier, keeping outdoor air out of one room is the simplest way to lower indoor PM2.5. A box fan with a filter taped to it is a low-cost option.',
    impact: `A cleaner room for ${joinLabels(ctx.sensitive, 'the household')} to rest and sleep in.`,
  });
}

function ventilateAction(ctx: PlanContext): AdviceAction {
  const { v1, tz } = ctx;
  if (v1) {
    return action({
      id: 'ventilate',
      title: `Air the house in ${v1.label} for 15–30 minutes`,
      when: windowText(v1, tz),
      windowRef: v1.label,
      forMembers: ['all'],
      category: 'ventilation',
      priority: 'medium',
      why: `${v1.label} is one of the cleanest outdoor hours today, so fresh air brings in the least smoke.`,
      impact: 'Clears stale indoor air and cooking fumes without letting in the worst outdoor air.',
    });
  }
  return action({
    id: 'ventilate',
    title: 'Keep windows closed today',
    forMembers: ['all'],
    category: 'ventilation',
    priority: 'high',
    why: 'Every waking hour is Very Poor or Severe outdoors, so opening windows would bring smoke in.',
    impact: 'Rely on a purifier if you have one; run the kitchen exhaust only while cooking.',
  });
}

function cookingAction(ctx: PlanContext): AdviceAction | undefined {
  const { profile } = ctx.snapshot;
  const fuel = profile.home?.cookingFuel;
  if (fuel !== 'biomass' && fuel !== 'kerosene') return undefined;
  const vulnerable = profile.members.filter(
    (m) =>
      m.ageBand === 'infant_0_1' ||
      m.ageBand === 'child_2_5' ||
      m.ageBand === 'senior_60_plus' ||
      m.conditions.length > 0,
  );
  return action({
    id: 'cooking',
    title: 'Ventilate the kitchen while cooking and keep others away',
    forMembers: vulnerable.length > 0 ? vulnerable.map((m) => m.id) : ['all'],
    category: 'cooking',
    priority: 'high',
    why: `Cooking with ${fuel === 'biomass' ? 'wood, dung or crop waste' : 'kerosene'} fills the home with smoke on top of today's outdoor air.`,
    impact: `Protects ${joinLabels(vulnerable, 'the household')} from the heaviest smoke.`,
  });
}

function indoorActions(ctx: PlanContext): AdviceAction[] {
  const indoor = [cleanAirAction(ctx), ventilateAction(ctx)];
  const cooking = cookingAction(ctx);
  if (cooking) indoor.push(cooking);
  return indoor;
}

function impactItems(ctx: PlanContext): AdvicePlan['impact'] {
  const { impactFacts } = ctx.snapshot;
  const impact: AdvicePlan['impact'] = [];
  const saving = impactFacts
    .filter((f) => f.category === 'co2' && f.kgCo2PerWeekDelta < 0)
    .sort((a, b) =>
      a.category === 'co2' && b.category === 'co2' ? a.kgCo2PerWeekDelta - b.kgCo2PerWeekDelta : 0,
    )[0];
  if (saving) {
    impact.push({
      title: 'Cut commute emissions',
      health: 'Less traffic also means a little less smoke for everyone on your route.',
      emissions: clip(saving.description, 200),
      impactFactId: saving.id,
    });
  }
  const exposure = impactFacts.find((f) => f.category === 'exposureBenefit');
  if (exposure) {
    impact.push({
      title: 'Breathe less smoke on the way',
      health: clip(exposure.description, 240),
      impactFactId: exposure.id,
    });
  }
  if (impact.length === 0) {
    impact.push({
      title: 'Protect the most sensitive first',
      health:
        ctx.sensitive.length > 0
          ? `${joinLabels(ctx.sensitive, '')} benefit most from the steps above today.`
          : 'Small changes in timing and indoor air add up for everyone.',
    });
  }
  return impact;
}

function memberNoteText(member: Member): string | undefined {
  if (member.ageBand === 'infant_0_1') {
    return `No mask for ${member.label}; keep them in the cleanest room.`;
  }
  if (member.conditions.includes('asthma') || member.conditions.includes('copd')) {
    return `Keep ${member.label}'s reliever inhaler at hand and follow their action plan.`;
  }
  if (member.conditions.includes('heart_disease')) {
    return `${member.label} should avoid exertion outdoors today.`;
  }
  if (member.conditions.includes('pregnancy')) {
    return `${member.label} should limit time outdoors and rest in the clean room.`;
  }
  return undefined;
}

function memberNotes(members: Member[]): AdvicePlan['memberNotes'] {
  const notes: AdvicePlan['memberNotes'] = [];
  for (const member of members) {
    const note = memberNoteText(member);
    if (note) notes.push({ memberId: member.id, note: clip(note, 200) });
  }
  return notes;
}

function seekCareText(members: Member[]): string {
  const conditions = new Set(members.flatMap((m) => m.conditions));
  if (conditions.has('asthma') || conditions.has('copd')) {
    return 'Wheezing or breathlessness that does not ease with the reliever, or lips turning blue.';
  }
  if (conditions.has('heart_disease')) {
    return 'Chest pain, unusual breathlessness, dizziness or a racing heartbeat.';
  }
  return 'Breathlessness, chest tightness or a cough that keeps getting worse.';
}

function headlineText({ w1, levelText }: PlanContext): string {
  return clip(
    w1
      ? `Air is ${levelText} today: plan outdoor time around ${w1.label}`
      : `Air is ${levelText} today: keep outdoor time light`,
    120,
  );
}

function summaryText({ snapshot: { naqi }, w1, tz }: PlanContext): string {
  const aqi = naqi
    ? `India AQI is ${String(naqi.value)} (${CATEGORY_LABELS[naqi.category]}).`
    : 'India AQI is unavailable right now; this uses hourly PM2.5.';
  const hours = w1
    ? `The cleanest waking hours are ${windowText(w1, tz)}.`
    : 'No clearly cleaner hours are expected.';
  return clip(
    `${aqi} ${hours} This is standard guidance from live data; general guidance, not medical advice.`,
    400,
  );
}

/** Builds the rules-based plan shown when the AI plan is unavailable. */
export function buildFallbackPlan(snapshot: FactsSnapshot): AdvicePlan {
  const ctx = planContext(snapshot);
  return {
    headline: headlineText(ctx),
    summary: summaryText(ctx),
    routine: routineActions(ctx).slice(0, 6),
    indoor: indoorActions(ctx).slice(0, 6),
    impact: impactItems(ctx).slice(0, 5),
    memberNotes: memberNotes(snapshot.profile.members).slice(0, 8),
    seekCareIf: seekCareText(snapshot.profile.members),
  };
}
