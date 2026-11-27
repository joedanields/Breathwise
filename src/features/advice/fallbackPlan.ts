// Rules-based plan with the AdvicePlan shape (AQI_AND_RULES.md §9). Shown when
// the AI is unavailable. Template copy only; every number comes from FACTS.
import type { AdviceAction, AdvicePlan } from '@shared/advice/planSchema';
import type { FactsSnapshot, Member, RiskLevel, TimeWindow } from '@shared/types';
import { CATEGORY_LABELS } from '@/lib/aqi/categories';

export const FALLBACK_NOTICE =
  'Personalised AI plan unavailable — showing standard guidance based on live data.';

const RISK_ORDER: readonly RiskLevel[] = ['low', 'caution', 'high', 'very_high'];
const OPEN_MODES = ['walk', 'cycle', 'two_wheeler', 'auto_rickshaw'];

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

export function buildFallbackPlan(snapshot: FactsSnapshot): AdvicePlan {
  const { profile, memberRisk, windows, naqi, pm25Band, purifier, impactFacts, location } =
    snapshot;
  const tz = location.timezone;
  const w1 = windows.bestOutdoor[0];
  const v1 = windows.ventilate[0];
  const riskOf = (m: Member): RiskLevel =>
    memberRisk.find((r) => r.memberId === m.id)?.level ?? 'caution';
  const highest = memberRisk.reduce<RiskLevel>(
    (top, r) => (RISK_ORDER.indexOf(r.level) > RISK_ORDER.indexOf(top) ? r.level : top),
    'low',
  );
  const category = naqi?.category ?? pm25Band;
  const levelText = category ? CATEGORY_LABELS[category] : 'uncertain';
  const sensitive = profile.members.filter(
    (m) => riskOf(m) === 'high' || riskOf(m) === 'very_high',
  );

  // Routine
  const routine: AdviceAction[] = [];
  for (const member of profile.members) {
    const activity = member.outdoorActivity;
    if (!activity) continue;
    const level = riskOf(member);
    if (level === 'very_high' || !w1) {
      routine.push(
        action({
          id: `activity-${member.id}`.slice(0, 40),
          title: `Move ${member.label}'s ${activity.kind} indoors today`,
          forMembers: [member.id],
          category: 'activity',
          priority: 'high',
          why: `Air is ${levelText} and ${member.label} is at very high risk today, so outdoor exertion is best avoided.`,
          impact: `Keeps ${member.label}'s breathing load down; choose a short indoor alternative.`,
        }),
      );
    } else {
      routine.push(
        action({
          id: `activity-${member.id}`.slice(0, 40),
          title: `Move ${member.label}'s ${activity.kind} to ${w1.label}`,
          when: windowText(w1, tz),
          windowRef: w1.label,
          forMembers: [member.id],
          category: 'activity',
          priority: level === 'low' ? 'low' : level === 'caution' ? 'medium' : 'high',
          why: `${w1.label} has the lowest PM2.5 of the next 24 waking hours, so the same time outdoors means less smoke breathed in.`,
          impact: `Less fine-particle exposure for ${member.label}.`,
        }),
      );
    }
  }

  const masks = profile.masks;
  const hasN95 = masks.includes('n95_ffp2');
  if (highest !== 'low' && (profile.commute || routine.length > 0 || masks.length > 0)) {
    const weak = masks.filter((m) => m === 'surgical' || m === 'cloth');
    routine.push(
      action({
        id: 'mask',
        title: hasN95
          ? 'Wear a well-fitted N95/FFP2 outdoors (adults)'
          : 'Get N95/FFP2 masks for adults going outdoors',
        forMembers: ['all'],
        category: 'mask',
        priority: highest === 'very_high' || highest === 'high' ? 'high' : 'medium',
        why:
          weak.length > 0
            ? 'Surgical and cloth masks give limited protection against fine particles; a well-fitted N95/FFP2 filters them far better.'
            : 'A well-fitted N95/FFP2 is the effective option against PM2.5. Masks are not for children under 2.',
        impact: 'Cuts the fine particles adults breathe in during unavoidable trips.',
      }),
    );
  }

  const commute = profile.commute;
  if (commute && commute.mode !== 'wfh' && OPEN_MODES.includes(commute.mode) && highest !== 'low') {
    routine.push(
      action({
        id: 'commute',
        title: w1
          ? `Shift errands and flexible trips towards ${w1.label}`
          : 'Keep trips short today',
        ...(w1 ? { when: windowText(w1, tz), windowRef: w1.label } : {}),
        forMembers: ['all'],
        category: 'commute',
        priority: 'medium',
        why: 'Open-air travel such as walking, cycling, two-wheelers and autos puts you close to traffic smoke.',
        impact: 'Less time in the worst air on the road.',
      }),
    );
  }

  if (routine.length === 0) {
    routine.push(
      action({
        id: 'outdoor',
        title: w1 ? `Plan outdoor time around ${w1.label}` : 'Keep outdoor time light today',
        ...(w1 ? { when: windowText(w1, tz), windowRef: w1.label } : {}),
        forMembers: ['all'],
        category: 'errand',
        priority: highest === 'low' ? 'low' : 'medium',
        why: w1
          ? `${w1.label} has the lowest PM2.5 in waking hours over the next day.`
          : 'There is no clearly cleaner window in waking hours.',
        impact: 'Lower exposure for the whole household.',
      }),
    );
  }

  // Indoor
  const indoor: AdviceAction[] = [];
  if (purifier?.has) {
    const ach = purifier.achievedAch;
    indoor.push(
      action({
        id: 'purifier',
        title: 'Run the purifier in the main room with the door closed',
        forMembers: ['all'],
        category: 'purifier',
        priority: highest === 'low' ? 'low' : 'high',
        why:
          ach === null
            ? `Aim for about ${String(purifier.targetAch)} air changes an hour; that needs a CADR of about ${String(purifier.requiredCadrM3h ?? 'the room size times')} m³/h for this room.`
            : `Your purifier gives about ${String(Math.round(ach))} air changes an hour in this room; ${String(purifier.targetAch)} is a good target.`,
        impact: 'Cleaner air where the household spends most time.',
      }),
    );
  } else {
    indoor.push(
      action({
        id: 'clean-room',
        title: 'Make one clean room: close windows, seal gaps, keep the door shut',
        forMembers: ['all'],
        category: 'sealing',
        priority: highest === 'low' ? 'low' : 'high',
        why: 'Without a purifier, keeping outdoor air out of one room is the simplest way to lower indoor PM2.5. A box fan with a filter taped to it is a low-cost option.',
        impact: `A cleaner room for ${sensitive.length > 0 ? sensitive.map((m) => m.label).join(' and ') : 'the household'} to rest and sleep in.`,
      }),
    );
  }

  indoor.push(
    v1
      ? action({
          id: 'ventilate',
          title: `Air the house in ${v1.label} for 15–30 minutes`,
          when: windowText(v1, tz),
          windowRef: v1.label,
          forMembers: ['all'],
          category: 'ventilation',
          priority: 'medium',
          why: `${v1.label} is one of the cleanest outdoor hours today, so fresh air brings in the least smoke.`,
          impact:
            'Clears stale indoor air and cooking fumes without letting in the worst outdoor air.',
        })
      : action({
          id: 'ventilate',
          title: 'Keep windows closed today',
          forMembers: ['all'],
          category: 'ventilation',
          priority: 'high',
          why: 'Every waking hour is Very Poor or Severe outdoors, so opening windows would bring smoke in.',
          impact: 'Rely on a purifier if you have one; run the kitchen exhaust only while cooking.',
        }),
  );

  const fuel = profile.home?.cookingFuel;
  if (fuel === 'biomass' || fuel === 'kerosene') {
    const vulnerable = profile.members.filter(
      (m) =>
        m.ageBand === 'infant_0_1' ||
        m.ageBand === 'child_2_5' ||
        m.ageBand === 'senior_60_plus' ||
        m.conditions.length > 0,
    );
    indoor.push(
      action({
        id: 'cooking',
        title: 'Ventilate the kitchen while cooking and keep others away',
        forMembers: vulnerable.length > 0 ? vulnerable.map((m) => m.id) : ['all'],
        category: 'cooking',
        priority: 'high',
        why: `Cooking with ${fuel === 'biomass' ? 'wood, dung or crop waste' : 'kerosene'} fills the home with smoke on top of today's outdoor air.`,
        impact: `Protects ${vulnerable.length > 0 ? vulnerable.map((m) => m.label).join(' and ') : 'the household'} from the heaviest smoke.`,
      }),
    );
  }

  // Impact
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
        sensitive.length > 0
          ? `${sensitive.map((m) => m.label).join(' and ')} benefit most from the steps above today.`
          : 'Small changes in timing and indoor air add up for everyone.',
    });
  }

  // Member notes
  const memberNotes: AdvicePlan['memberNotes'] = [];
  for (const member of profile.members) {
    let note: string | undefined;
    if (member.ageBand === 'infant_0_1')
      note = `No mask for ${member.label}; keep them in the cleanest room.`;
    else if (member.conditions.includes('asthma') || member.conditions.includes('copd')) {
      note = `Keep ${member.label}'s reliever inhaler at hand and follow their action plan.`;
    } else if (member.conditions.includes('heart_disease'))
      note = `${member.label} should avoid exertion outdoors today.`;
    else if (member.conditions.includes('pregnancy'))
      note = `${member.label} should limit time outdoors and rest in the clean room.`;
    if (note) memberNotes.push({ memberId: member.id, note: clip(note, 200) });
  }

  const conditions = new Set(profile.members.flatMap((m) => m.conditions));
  const seekCareIf =
    conditions.has('asthma') || conditions.has('copd')
      ? 'Wheezing or breathlessness that does not ease with the reliever, or lips turning blue.'
      : conditions.has('heart_disease')
        ? 'Chest pain, unusual breathlessness, dizziness or a racing heartbeat.'
        : 'Breathlessness, chest tightness or a cough that keeps getting worse.';

  return {
    headline: clip(
      w1
        ? `Air is ${levelText} today: plan outdoor time around ${w1.label}`
        : `Air is ${levelText} today: keep outdoor time light`,
      120,
    ),
    summary: clip(
      `${naqi ? `India AQI is ${String(naqi.value)} (${CATEGORY_LABELS[naqi.category]}).` : 'India AQI is unavailable right now; this uses hourly PM2.5.'} ${
        w1
          ? `The cleanest waking hours are ${windowText(w1, tz)}.`
          : 'No clearly cleaner hours are expected.'
      } This is standard guidance from live data; general guidance, not medical advice.`,
      400,
    ),
    routine: routine.slice(0, 6),
    indoor: indoor.slice(0, 6),
    impact: impact.slice(0, 5),
    memberNotes: memberNotes.slice(0, 8),
    seekCareIf,
  };
}
