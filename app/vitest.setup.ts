import '@testing-library/jest-dom/vitest';

// jsdom does not implement scrollIntoView (used by the Hermes auto-scroll effect).
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}
