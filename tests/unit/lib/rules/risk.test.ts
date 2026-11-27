import type { Member, NaqiCategory, RiskLevel } from '@shared/types';
import { describe, expect, it } from 'vitest';
import { computeMemberRisk } from '@/lib/rules/memberRisk';
import { purifierFacts, DEFAULT_CEILING_HEIGHT_M, TARGET_ACH } from '@/lib/rules/purifier';
import {
  isSensitive,
  MASK_FACTS,
  OUTDOOR_GUIDANCE,
  RISK_BY_CATEGORY,
  sensitivityReasons,
} from '@/lib/rules/thresholds';

const adult: Member = { id: 'a', label: 'Dad', ageBand: 'adult_18_59', conditions: [] };
const child: Member = { id: 'c', label: 'Aarav (4)', ageBand: 'child_2_5', conditions: [] };

// AQI_AND_RULES.md §6, every row.
const TABLE: [NaqiCategory, RiskLevel, RiskLevel][] = [
  ['good', 'low', 'low'],
  ['satisfactory', 'low', 'caution'],
  ['moderate', 'caution', 'high'],
  ['poor', 'high', 'very_high'],
  ['very_poor', 'very_high', 'very_high'],
  ['severe', 'very_high', 'very_high'],
];

describe('member risk table (AQI_AND_RULES.md §6)', () => {
  it('matches the table exactly', () => {
    expect(TABLE.map(([category]) => [category, RISK_BY_CATEGORY[category]])).toEqual(
      TABLE.map(([category, general, sensitive]) => [category, { general, sensitive }]),
    );
  });

  it.each(TABLE)('%s: general adult %s, sensitive member %s', (category, general, sensitive) => {
    const [adultRisk, childRisk] = computeMemberRisk([adult, child], category, 'naqi');
    expect(adultRisk?.level).toBe(general);
    expect(childRisk?.level).toBe(sensitive);
    expect(childRisk?.outdoorGuidance).toBe(OUTDOOR_GUIDANCE[sensitive]);
  });
});

describe('sensitivity', () => {
  it.each([
    ['infant_0_1', true],
    ['child_2_5', true],
    ['child_6_12', true],
    ['teen_13_17', false],
    ['adult_18_59', false],
    ['senior_60_plus', true],
  ] as const)('age band %s sensitive: %s', (ageBand, sensitive) => {
    expect(isSensitive({ ...adult, ageBand })).toBe(sensitive);
  });

  it('any condition makes a member sensitive', () => {
    const withAsthma: Member = { ...adult, conditions: ['asthma', 'allergies'] };
    expect(isSensitive(withAsthma)).toBe(true);
    expect(sensitivityReasons(withAsthma)).toEqual(['condition:asthma', 'condition:allergies']);
  });
});

describe('computeMemberRisk', () => {
  it('lists machine-readable reasons', () => {
    const member: Member = { ...child, conditions: ['asthma'] };
    expect(computeMemberRisk([member], 'poor', 'naqi')).toEqual([
      {
        memberId: 'c',
        level: 'very_high',
        reasons: ['sensitive:age_child_2_5', 'condition:asthma', 'category:poor'],
        outdoorGuidance: OUTDOOR_GUIDANCE.very_high,
      },
    ]);
  });

  it('notes when the category comes from hourly PM2.5 because NAQI is unavailable', () => {
    const [risk] = computeMemberRisk([adult], 'moderate', 'pm25_hourly');
    expect(risk?.reasons).toEqual(['category:moderate', 'basis:pm25_hourly']);
  });

  it('returns no risk without any category (no data)', () => {
    expect(computeMemberRisk([adult, child], null, 'naqi')).toEqual([]);
  });

  it('keeps the mask facts that the plan relies on', () => {
    expect(MASK_FACTS).toContain('No masks for infants or children under 2.');
  });
});

describe('purifierFacts (AQI_AND_RULES.md §7)', () => {
  it('uses a 2.8 m ceiling and a 5 ACH target', () => {
    expect(DEFAULT_CEILING_HEIGHT_M).toBe(2.8);
    expect(TARGET_ACH).toBe(5);
  });

  it('computes required CADR and achieved ACH', () => {
    // 12 m² × 2.8 m = 33.6 m³; × 5 = 168 m³/h; 300 / 33.6 = 8.93 ACH.
    expect(
      purifierFacts({ type: 'apartment', purifier: { has: true, cadrM3h: 300, roomM2: 12 } }),
    ).toEqual({
      has: true,
      roomM2: 12,
      ceilingHeightM: 2.8,
      targetAch: 5,
      requiredCadrM3h: 168,
      cadrM3h: 300,
      achievedAch: 8.9,
    });
  });

  it('says "no purifier" with the CADR a purifier would need', () => {
    expect(
      purifierFacts({ type: 'apartment', purifier: { has: false, roomM2: 10 } }),
    ).toMatchObject({
      has: false,
      requiredCadrM3h: 140,
      cadrM3h: null,
      achievedAch: null,
    });
  });

  it('cannot compute achieved ACH without the CADR', () => {
    expect(purifierFacts({ type: 'apartment', purifier: { has: true, roomM2: 12 } })).toMatchObject(
      { has: true, requiredCadrM3h: 168, cadrM3h: null, achievedAch: null },
    );
  });

  it('cannot compute ACH without the room size', () => {
    expect(purifierFacts({ type: 'hostel', purifier: { has: true, cadrM3h: 250 } })).toMatchObject({
      requiredCadrM3h: null,
      achievedAch: null,
    });
  });

  it('treats a home without purifier details as no purifier, and no home as unknown', () => {
    expect(purifierFacts({ type: 'independent' })?.has).toBe(false);
    expect(purifierFacts(undefined)).toBeNull();
  });
});
