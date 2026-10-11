import { createE2EStore } from "./helpers";

export default async function setup() {
  if (!process.env.E2E_SUPABASE_URL || !process.env.E2E_SERVICE_ROLE_KEY) {
    throw new Error("E2E exige E2E_SUPABASE_URL + E2E_SERVICE_ROLE_KEY.");
  }
  await createE2EStore();
}
