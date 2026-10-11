import { deleteE2EStore } from "./helpers";

export default async function teardown() {
  await deleteE2EStore();
}
