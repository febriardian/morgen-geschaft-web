const DEFAULT_LOYALTY_RULES = Object.freeze({
  spendPerPoint: 10_000,
  pointValue: 100,
  minimumRedemptionPoints: 10,
  maximumPointDiscountRate: 0.2,
  referralReward: 10_000,
  referralMinimumSpend: 100_000,
});

function normalizedRules(rules = {}) {
  return {
    ...DEFAULT_LOYALTY_RULES,
    ...rules,
  };
}

function maximumRedeemablePoints(subtotal, availablePoints, rules = {}) {
  const activeRules = normalizedRules(rules);
  const normalizedSubtotal = Math.max(0, Math.floor(Number(subtotal) || 0));
  const normalizedAvailable = Math.max(0, Math.floor(Number(availablePoints) || 0));
  const maximumDiscount = Math.floor(normalizedSubtotal * activeRules.maximumPointDiscountRate);
  return Math.max(0, Math.min(
    normalizedAvailable,
    Math.floor(maximumDiscount / activeRules.pointValue),
  ));
}

function pointRedemptionValue(points, rules = {}) {
  const activeRules = normalizedRules(rules);
  const normalized = Math.max(0, Math.floor(Number(points) || 0));
  if (normalized === 0) return 0;
  if (normalized < activeRules.minimumRedemptionPoints) return 0;
  return normalized * activeRules.pointValue;
}

function estimatedPointsEarned({ subtotal, couponDiscount = 0, pointDiscount = 0, referralDiscount = 0 }, rules = {}) {
  const activeRules = normalizedRules(rules);
  const rewardableSpend = Math.max(
    0,
    Math.floor(Number(subtotal) || 0)
      - Math.floor(Number(couponDiscount) || 0)
      - Math.floor(Number(pointDiscount) || 0)
      - Math.floor(Number(referralDiscount) || 0),
  );
  return Math.floor(rewardableSpend / activeRules.spendPerPoint);
}

export {
  DEFAULT_LOYALTY_RULES,
  estimatedPointsEarned,
  maximumRedeemablePoints,
  normalizedRules,
  pointRedemptionValue,
};
