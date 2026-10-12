import { test, expect } from "vitest";
import { sanitizeTrackingId, trackingEnabled } from "./tracking";

test("sanitizeTrackingId: pixel FB só aceita dígitos 10-20", () => {
  expect(sanitizeTrackingId("pixel", "1234567890123")).toBe("1234567890123");
  expect(sanitizeTrackingId("pixel", "123")).toBeNull();
  expect(sanitizeTrackingId("pixel", "abc12345678901")).toBeNull();
  expect(sanitizeTrackingId("pixel", "")).toBeNull();
});

test("sanitizeTrackingId: GA4 só aceita G- + alfanumérico", () => {
  expect(sanitizeTrackingId("ga4", "G-ABC123")).toBe("G-ABC123");
  expect(sanitizeTrackingId("ga4", "UA-123")).toBeNull();
  expect(sanitizeTrackingId("ga4", "G-")).toBeNull();
});

test("trackingEnabled: só com algum id válido", () => {
  expect(trackingEnabled("1234567890123", null)).toBe(true);
  expect(trackingEnabled(null, "G-ABC")).toBe(true);
  expect(trackingEnabled(null, null)).toBe(false);
});
