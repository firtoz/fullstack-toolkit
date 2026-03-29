export const DEFAULT_PAGE_LIMIT = 50;
export const DEFAULT_SEEK_ROW_GAP = 80;
export const DEFAULT_SEEK_COOLDOWN_MS = 200;

/** Default quiet period before coalesced predicate `rangeQuery` after viewport motion. */
export const DEFAULT_VIEWPORT_RANGE_QUIET_MS = 72;
/**
 * Default max time between predicate `rangeQuery` calls while the viewport keeps changing
 * (still issues a fetch even during continuous motion).
 */
export const DEFAULT_VIEWPORT_RANGE_MAX_WAIT_MS = 200;
