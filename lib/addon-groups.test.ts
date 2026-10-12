import { test, expect } from "vitest";
import { groupAddons, priceOf, validateChoice, type AddonGroupRow, type AddonRow } from "./addon-groups";

const a = (id: string, group_id: string | null, cents = 100): AddonRow =>
  ({ id, name: id, price_cents: cents, group_id, active: true });
const g = (id: string, required = false, max: number | null = null): AddonGroupRow =>
  ({ id, name: id, required, max_choices: max, sort_order: 0 });

test("adicionais sem group_id viram o grupo implicito 'Adicionais'", () => {
  const out = groupAddons([a("bacon", null), a("cheddar", null)], []);
  expect(out).toHaveLength(1);
  expect(out[0]).toMatchObject({ id: null, name: "Adicionais", required: false, maxChoices: null });
  expect(out[0].addons.map((x) => x.id)).toEqual(["bacon", "cheddar"]);
});

test("grupos explicitos vem ordenados e com seus adicionais", () => {
  const out = groupAddons(
    [a("catupiry", "borda"), a("cheddar", "borda"), a("bacon", "extras")],
    [{ id: "borda", name: "Borda", required: true, max_choices: 1, sort_order: 0 },
     { id: "extras", name: "Extras", required: false, max_choices: null, sort_order: 1 }]
  );
  expect(out.map((x) => x.name)).toEqual(["Borda", "Extras"]);
  expect(out[0]).toMatchObject({ required: true, maxChoices: 1 });
});

test("grupo explicito sem adicional ativo nao aparece", () => {
  const out = groupAddons([a("bacon", null)], [g("borda", true, 1)]);
  expect(out.map((x) => x.name)).toEqual(["Adicionais"]);
});

test("validateChoice: grupo obrigatorio exige ao menos uma escolha", () => {
  const groups = groupAddons([a("catupiry", "borda")], [g("borda", true, 1)]);
  expect(validateChoice(groups, []).ok).toBe(false);
  expect(validateChoice(groups, ["catupiry"]).ok).toBe(true);
});

test("validateChoice: respeita o maximo de escolhas", () => {
  const groups = groupAddons([a("c1", "extras"), a("c2", "extras")], [g("extras", false, 1)]);
  const bad = validateChoice(groups, ["c1", "c2"]);
  expect(bad.ok).toBe(false);
  expect(bad.ok === false && bad.error).toContain("1");
  expect(validateChoice(groups, ["c1"]).ok).toBe(true);
});

test("validateChoice: grupo obrigatorio sem opcao aplicavel NAO trava a venda", () => {
  // grupo obrigatorio, mas nenhum adicional ativo dele chega a este produto
  const groups = groupAddons([a("bacon", null)], [g("borda", true, 1)]);
  expect(validateChoice(groups, []).ok).toBe(true);   // Review Focus #3
  expect(validateChoice(groups, ["bacon"]).ok).toBe(true);
});

test("priceOf soma so os escolhidos", () => {
  expect(priceOf([a("bacon", null, 600), a("cheddar", null, 450)], ["bacon"])).toBe(600);
  expect(priceOf([a("bacon", null, 600)], [])).toBe(0);
});
