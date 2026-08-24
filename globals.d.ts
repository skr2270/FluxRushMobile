// Ambient declarations for JS runtime globals that React Native provides at
// runtime but that are missing from the generated type definitions.
declare const performance: {
  now(): number;
};
