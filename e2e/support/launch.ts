// Every browser the suite launches is muted: several tests press "Play it",
// and nothing may reach the machine's speakers. Muting silences the output
// device only; the media element still plays and its time still advances.
// A spec that sets its own launchOptions replaces the project's, so it
// spreads these args too. playwright.config.ts keeps its own copy: the
// holding build type checks the config without e2e/.
export const MUTED_ARGS = ["--mute-audio"];
