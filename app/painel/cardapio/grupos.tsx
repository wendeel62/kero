"use client";

// Editor de grupos de opção (migration 012 / design D4). O grupo é o único
// conceito novo: as OPÇÕES são os adicionais globais com group_id preenchido.
// O grupo "Adicionais" (group_id null) é derivado — aparece como leitura, sem
// nome editável, para o lojista ver onde caem os adicionais sem grupo.
import { useState } from "react";
import { Layers, Plus, Trash2, Pencil } from "lucide-react";
import { IMPLICIT_GROUP_NAME, type AddonGroupRow } from "@/lib/addon-groups";
import { saveAddonGroup, deleteAddonGroup, setAddonGroup, updateAddon } from "@/lib/painel-actions";

type Addon = { id: string; name: string; price_cents: number; active: boolean; group_id: string | null; is_removal: boolean; is_separate: boolean };

const brl = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function Grupos({
  groups, addons, onChange,
}: {
  groups: AddonGroupRow[]; addons: Addon[]; onChange: () => void;
}) {
  const [novo, setNovo] = useState(false);
  const [editando, setEditando] = useState<string | null>(null);
  const [erro, setErro] = useState("");

  const porGrupo = (id: string | null) => addons.filter((a) => a.group_id === id);

  async function excluir(g: AddonGroupRow) {
    const n = porGrupo(g.id).length;
    if (!confirm(`Isso apaga as ${n} opções deste grupo. Continuar?`)) return;
    const r = await deleteAddonGroup(g.id);
    if (!r.ok) setErro(r.error ?? "Erro ao excluir.");
    else onChange();
  }

  async function mover(addonId: string, groupId: string | null) {
    const r = await setAddonGroup(addonId, groupId);
    if (!r.ok) setErro(r.error ?? "Erro ao mover.");
    else onChange();
  }

  async function toggleFlag(addonId: string, field: "is_removal" | "is_separate", value: boolean) {
    const a = addons.find((x) => x.id === addonId);
    if (!a) return;
    const r = await updateAddon(addonId, {
      name: a.name, price_cents: a.price_cents, active: a.active,
      is_removal: field === "is_removal" ? value : a.is_removal,
      is_separate: field === "is_separate" ? value : a.is_separate,
    });
    if (!r.ok) setErro(r.error ?? "Erro ao atualizar.");
    else onChange();
  }

  const soltos = porGrupo(null);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {erro && <p className="alert-banner" role="alert">{erro}</p>}

      {groups.length === 0 && !novo && (
        <div className="menu-empty"><Layers size={20} strokeWidth={1.7} /> Nenhum grupo cadastrado — todos os adicionais estão em “{IMPLICIT_GROUP_NAME}”.</div>
      )}

      {groups.map((g) => {
        const ops = porGrupo(g.id);
        const semGrupo = addons.filter((a) => a.group_id !== g.id);
        return (
          <div key={g.id} className="menu-comp-group" style={{ border: "1px solid var(--border)", borderRadius: 14, padding: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <b>{g.name}</b>
              {g.required && <span className="pill" title="O cliente precisa escolher">obrigatório</span>}
              {g.max_choices !== null && <span className="pill">máx {g.max_choices}</span>}
              {g.min_choices !== null && <span className="pill">mín {g.min_choices}</span>}
              <span className="pill">{g.price_rule === "sum" ? "soma" : g.price_rule === "max" ? "máx" : "média"}</span>
              {g.free_addons !== null && g.free_addons > 0 && <span className="pill">{g.free_addons} grátis</span>}
              {g.is_preparation && <span className="pill">preparo</span>}
              <span style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
                <button type="button" aria-label={`Editar ${g.name}`} onClick={() => { setEditando(g.id); setNovo(false); }}><Pencil size={15} /></button>
                <button type="button" aria-label={`Excluir ${g.name}`} onClick={() => excluir(g)}><Trash2 size={15} /></button>
              </span>
            </div>

            {editando === g.id && (
              <FormGrupo
                grupo={g}
                onDone={() => { setEditando(null); onChange(); }}
                onCancel={() => setEditando(null)}
              />
            )}

            <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
              {ops.length === 0 && <p className="cfg-panel-desc">Nenhuma opção neste grupo.</p>}
              {ops.map((a) => (
                <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span>{a.name}</span>
                  <span style={{ color: "var(--muted)" }}>{brl(a.price_cents)}</span>
                  <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12 }}>
                    <input type="checkbox" checked={a.is_removal} onChange={(e) => toggleFlag(a.id, "is_removal", e.target.checked)} />
                    remoção
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12 }}>
                    <input type="checkbox" checked={a.is_separate} onChange={(e) => toggleFlag(a.id, "is_separate", e.target.checked)} />
                    separado
                  </label>
                  <button type="button" style={{ marginLeft: "auto" }} onClick={() => mover(a.id, null)}>remover do grupo</button>
                </div>
              ))}
              {semGrupo.length > 0 && (
                <select
                  aria-label={`Adicionar opção em ${g.name}`}
                  defaultValue=""
                  onChange={(e) => { if (e.target.value) { mover(e.target.value, g.id); e.target.value = ""; } }}
                >
                  <option value="">+ adicionar opção…</option>
                  {semGrupo.map((a) => <option key={a.id} value={a.id}>{a.name} — {brl(a.price_cents)}</option>)}
                </select>
              )}
            </div>
          </div>
        );
      })}

      {novo ? (
        <FormGrupo onDone={() => { setNovo(false); onChange(); }} onCancel={() => setNovo(false)} />
      ) : (
        <button type="button" onClick={() => { setNovo(true); setEditando(null); }}>
          <Plus size={15} /> Novo grupo
        </button>
      )}

      {soltos.length > 0 && (
        <div className="menu-comp-group" style={{ border: "1px dashed var(--border)", borderRadius: 14, padding: 10 }}>
          <b>{IMPLICIT_GROUP_NAME}</b> <span className="cfg-panel-desc">— adicionais sem grupo</span>
          <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 4 }}>
            {soltos.map((a) => (
              <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span>{a.name}</span>
                <span style={{ color: "var(--muted)" }}>{brl(a.price_cents)}</span>
                {groups.length > 0 && (
                  <select
                    aria-label={`Mover ${a.name} para um grupo`}
                    defaultValue=""
                    style={{ marginLeft: "auto" }}
                    onChange={(e) => { if (e.target.value) { mover(a.id, e.target.value); e.target.value = ""; } }}
                  >
                    <option value="">mover para…</option>
                    {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function FormGrupo({
  grupo, onDone, onCancel,
}: {
  grupo?: AddonGroupRow; onDone: () => void; onCancel: () => void;
}) {
  const [name, setName] = useState(grupo?.name ?? "");
  const [required, setRequired] = useState(grupo?.required ?? false);
  const [max, setMax] = useState(grupo?.max_choices === null || grupo?.max_choices === undefined ? "" : String(grupo.max_choices));
  const [priceRule, setPriceRule] = useState(grupo?.price_rule ?? "sum");
  const [freeAddons, setFreeAddons] = useState(grupo?.free_addons === null || grupo?.free_addons === undefined ? "" : String(grupo.free_addons));
  const [minChoices, setMinChoices] = useState(grupo?.min_choices === null || grupo?.min_choices === undefined ? "" : String(grupo.min_choices));
  const [isPreparation, setIsPreparation] = useState(grupo?.is_preparation ?? false);
  const [isRemoval, setIsRemoval] = useState(grupo?.is_removal ?? false);
  const [isSeparate, setIsSeparate] = useState(grupo?.is_separate ?? false);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    setSalvando(true); setErro("");
    const r = await saveAddonGroup({
      id: grupo?.id,
      name,
      required,
      maxChoices: max.trim() === "" ? null : Number(max),
      sortOrder: grupo?.sort_order ?? 0,
      priceRule,
      freeAddons: freeAddons.trim() === "" ? null : Number(freeAddons),
      minChoices: minChoices.trim() === "" ? null : Number(minChoices),
      isPreparation,
      isRemoval,
      isSeparate,
    });
    setSalvando(false);
    if (!r.ok) setErro(r.error ?? "Erro ao salvar.");
    else onDone();
  }

  return (
    <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
      <input aria-label="Nome do grupo" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Borda, Tamanho" maxLength={40} />
      <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} /> obrigatório
      </label>
      <input aria-label="Máximo de escolhas" type="number" min="1" value={max} onChange={(e) => setMax(e.target.value)} placeholder="máx. de escolhas (vazio = sem limite)" />
      <input aria-label="Mínimo de escolhas" type="number" min="0" value={minChoices} onChange={(e) => setMinChoices(e.target.value)} placeholder="mín. de escolhas (vazio = sem mínimo)" />
      <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
        Regra de preço:
        <select value={priceRule} onChange={(e) => setPriceRule(e.target.value)}>
          <option value="sum">Soma</option>
          <option value="max">Máximo</option>
          <option value="avg">Média</option>
        </select>
      </label>
      <input aria-label="Complementos grátis" type="number" min="0" value={freeAddons} onChange={(e) => setFreeAddons(e.target.value)} placeholder="quantidade grátis (vazio = nenhuma)" />
      <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <input type="checkbox" checked={isPreparation} onChange={(e) => setIsPreparation(e.target.checked)} /> tempo de preparo
      </label>
      <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <input type="checkbox" checked={isRemoval} onChange={(e) => setIsRemoval(e.target.checked)} /> é remoção
      </label>
      <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <input type="checkbox" checked={isSeparate} onChange={(e) => setIsSeparate(e.target.checked)} /> enviar separado
      </label>
      {erro && <p style={{ color: "var(--red)" }}>{erro}</p>}
      <div style={{ display: "flex", gap: 6 }}>
        <button type="button" disabled={salvando} onClick={salvar}>{grupo ? "Salvar" : "Criar"}</button>
        <button type="button" onClick={onCancel}>Cancelar</button>
      </div>
    </div>
  );
}
