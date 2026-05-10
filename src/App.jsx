import { useState, useEffect, useRef } from "react";
import { isConfigured, loadInventory, saveInventory, clearConfig } from "./github";
import GitHubSetup from "./GitHubSetup";

const UNITS = ["bottle", "can", "jar", "handle", "fifth", "case", "six-pack", "liter", "oz", "ml", "gallon", "keg"];
const CATEGORIES = ["Spirit", "Mixer", "Beer", "Wine", "Liqueur", "Bitters", "Syrup", "Juice", "Garnish", "Other"];

const FONTS = `@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=Barlow:wght@300;400;500;600&display=swap');`;

const globalStyles = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #0a3d2e; }
  ::-webkit-scrollbar { width: 6px; }
  ::-webkit-scrollbar-track { background: #0a3d2e; }
  ::-webkit-scrollbar-thumb { background: #4a8c7a; border-radius: 3px; }
  .tag-pill {
    display: inline-flex; align-items: center; gap: 4px;
    background: rgba(201,168,112,0.12); color: #c9a870;
    border: 1px solid rgba(201,168,112,0.25); border-radius: 20px;
    padding: 2px 10px; font-size: 12px; font-family: Barlow, sans-serif;
    font-weight: 500; letter-spacing: 0.03em; cursor: pointer;
    transition: all 0.15s ease; white-space: nowrap;
  }
  .tag-pill:hover { background: rgba(201,168,112,0.22); }
  .tag-pill.active { background: #c9a870; color: #0a3d2e; border-color: #c9a870; }
  .tag-pill.removable:hover { background: rgba(220,80,60,0.2); color: #f08070; border-color: rgba(220,80,60,0.35); }
  .item-row {
    background: #0d4a38; border: 1px solid rgba(201,168,112,0.25);
    border-radius: 10px; padding: 14px 18px;
    display: grid; grid-template-columns: 1fr auto auto;
    gap: 12px; align-items: center;
    transition: border-color 0.2s, box-shadow 0.2s;
  }
  .item-row:hover { border-color: rgba(201,168,112,0.5); box-shadow: 0 2px 16px rgba(201,168,112,0.07); }
  .item-row.low { border-left: 3px solid #e07a50; }
  .btn {
    padding: 9px 20px; border-radius: 8px; border: none;
    font-family: Barlow, sans-serif; font-weight: 600;
    font-size: 14px; cursor: pointer; transition: all 0.15s ease;
    letter-spacing: 0.04em;
  }
  .btn:disabled { opacity: 0.5; cursor: default; }
  .btn-primary { background: #c9a870; color: #0a3d2e; }
  .btn-primary:hover:not(:disabled) { background: #e2c99a; }
  .btn-ghost { background: transparent; color: #a8c4b8; border: 1px solid rgba(201,168,112,0.25); }
  .btn-ghost:hover:not(:disabled) { background: rgba(201,168,112,0.08); color: #f5f0e8; }
  .btn-danger { background: transparent; color: #e07a50; border: 1px solid rgba(224,122,80,0.3); }
  .btn-danger:hover:not(:disabled) { background: rgba(224,122,80,0.15); }
  .input {
    background: #0a3d2e; border: 1px solid rgba(201,168,112,0.25); border-radius: 8px;
    padding: 10px 14px; color: #f5f0e8; font-family: Barlow, sans-serif;
    font-size: 14px; width: 100%; outline: none;
    transition: border-color 0.15s;
  }
  .input:focus { border-color: #c9a870; }
  .input::placeholder { color: #4a8c7a; }
  .select {
    background: #0a3d2e; border: 1px solid rgba(201,168,112,0.25); border-radius: 8px;
    padding: 10px 14px; color: #f5f0e8; font-family: Barlow, sans-serif;
    font-size: 14px; outline: none; cursor: pointer;
    transition: border-color 0.15s; appearance: none;
  }
  .select:focus { border-color: #c9a870; }
  .modal-overlay {
    position: fixed; inset: 0; background: rgba(5,25,18,0.88);
    display: flex; align-items: center; justify-content: center;
    z-index: 100; backdrop-filter: blur(4px); padding: 20px;
  }
  .modal {
    background: #0d4a38; border: 1px solid rgba(201,168,112,0.25); border-radius: 16px;
    padding: 32px; width: 100%; max-width: 500px; max-height: 90vh;
    overflow-y: auto;
  }
  label { display: block; color: #a8c4b8; font-size: 12px; font-weight: 600;
    letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 6px;
    font-family: Barlow, sans-serif; }
  .qty-display {
    font-family: Barlow, sans-serif; font-size: 22px; font-weight: 600;
    color: #f5f0e8;
  }
  .qty-unit { font-size: 13px; color: #6db8a0; font-weight: 400; margin-left: 3px; }
  .qty-controls { display: flex; gap: 6px; align-items: center; }
  .qty-btn {
    width: 28px; height: 28px; border-radius: 6px; border: 1px solid rgba(201,168,112,0.25);
    background: #0a3d2e; color: #c9a870; font-size: 16px; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    transition: all 0.15s; font-weight: 600; line-height: 1;
  }
  .qty-btn:hover { background: #0d4a38; border-color: #c9a870; }
  .category-badge {
    font-size: 11px; font-family: Barlow, sans-serif; font-weight: 600;
    letter-spacing: 0.06em; text-transform: uppercase;
    padding: 3px 8px; border-radius: 4px;
    color: #6db8a0; background: rgba(74,140,122,0.15);
  }
  .empty-state {
    text-align: center; padding: 60px 20px; color: #4a8c7a;
    font-family: Barlow, sans-serif;
  }
  .search-wrap { position: relative; }
  .search-icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #4a8c7a; pointer-events: none; }
  .search-wrap .input { padding-left: 38px; }
`;

function pluralUnit(unit, qty) {
  if (qty === 1) return unit;
  const irregulars = { liter: "liters", handle: "handles", fifth: "fifths", case: "cases", gallon: "gallons" };
  if (irregulars[unit]) return irregulars[unit];
  if (unit.endsWith("s")) return unit;
  return unit + "s";
}

function SyncIndicator({ status, onRefresh, onSetup }) {
  const configured = isConfigured();
  if (!configured) {
    return (
      <button className="btn btn-ghost" onClick={onSetup} style={{ fontSize: 12, padding: "5px 12px" }}>
        ⚙ Set up sync
      </button>
    );
  }
  const dot = { loading: "#c9a870", saving: "#c9a870", synced: "#6db8a0", error: "#e07a50", pending: "#c9a870" };
  const label = { loading: "Loading…", saving: "Saving…", synced: "Synced", error: "Sync error", pending: "Pending…" };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ color: dot[status] || "#6db8a0", fontFamily: "Barlow, sans-serif", fontSize: 12 }}>
        ● {label[status] || ""}
      </span>
      {(status === "synced" || status === "error") && (
        <button className="btn btn-ghost" onClick={onRefresh} style={{ fontSize: 12, padding: "4px 10px" }} title="Refresh from GitHub">
          ↻
        </button>
      )}
      <button className="btn btn-ghost" onClick={onSetup} style={{ fontSize: 12, padding: "4px 10px" }} title="Sync settings">
        ⚙
      </button>
    </div>
  );
}

function ItemModal({ item, onSave, onClose, onDelete }) {
  const isEdit = !!item?.id;
  const [form, setForm] = useState(item || { name: "", category: "Spirit", quantity: 1, unit: "bottle", tags: [], lowThreshold: 1 });
  const [tagInput, setTagInput] = useState("");

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  function addTag() {
    const t = tagInput.trim();
    if (t && !form.tags.includes(t)) set("tags", [...form.tags, t]);
    setTagInput("");
  }

  function removeTag(t) { set("tags", form.tags.filter(x => x !== t)); }

  function handleSave() {
    if (!form.name.trim()) return;
    onSave({ ...form, name: form.name.trim(), id: form.id || Date.now().toString() });
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <h2 style={{ fontFamily: "Playfair Display, serif", color: "#f5f0e8", fontSize: 22 }}>
            {isEdit ? "Edit Item" : "Add to Bar"}
          </h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#6b7591", cursor: "pointer", fontSize: 22 }}>×</button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div>
            <label>Item Name</label>
            <input className="input" value={form.name} onChange={e => set("name", e.target.value)}
              placeholder="e.g. Bulleit Bourbon" onKeyDown={e => e.key === "Enter" && handleSave()} />
          </div>

          <div>
            <label>Category</label>
            <select className="select" style={{ width: "100%" }} value={form.category} onChange={e => set("category", e.target.value)}>
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label>Quantity</label>
              <input className="input" type="number" min="0" step="0.5" value={form.quantity}
                onChange={e => set("quantity", parseFloat(e.target.value) || 0)} />
            </div>
            <div>
              <label>Unit</label>
              <select className="select" style={{ width: "100%" }} value={form.unit} onChange={e => set("unit", e.target.value)}>
                {UNITS.map(u => <option key={u}>{u}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label>Low Stock Alert (below)</label>
            <input className="input" type="number" min="0" step="0.5" value={form.lowThreshold}
              onChange={e => set("lowThreshold", parseFloat(e.target.value) || 0)} />
          </div>

          <div>
            <label>Drink Tags</label>
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <input className="input" value={tagInput} onChange={e => setTagInput(e.target.value)}
                placeholder="e.g. Old Fashioned" onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }} />
              <button className="btn btn-ghost" onClick={addTag} style={{ whiteSpace: "nowrap", flexShrink: 0 }}>Add</button>
            </div>
            {form.tags.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {form.tags.map(t => (
                  <span key={t} className="tag-pill removable" onClick={() => removeTag(t)}>
                    {t} <span style={{ opacity: 0.6 }}>×</span>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 8, justifyContent: "space-between" }}>
            {isEdit && (
              <button className="btn btn-danger" onClick={() => onDelete(item.id)}>Delete</button>
            )}
            <div style={{ display: "flex", gap: 10, marginLeft: "auto" }}>
              <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave}>
                {isEdit ? "Save Changes" : "Add Item"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BarInventory() {
  const [items, setItems] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [modal, setModal] = useState(null); // null | "add" | item
  const [showSetup, setShowSetup] = useState(false);
  const [search, setSearch] = useState("");
  const [activeTag, setActiveTag] = useState(null);
  const [activeCategory, setActiveCategory] = useState(null);
  const [syncStatus, setSyncStatus] = useState("idle");
  const pendingItemsRef = useRef(null);
  const saveTimeoutRef = useRef(null);

  async function fetchFromGitHub() {
    setSyncStatus("loading");
    try {
      const githubItems = await loadInventory();
      setItems(githubItems);
      localStorage.setItem("bar-inventory-items", JSON.stringify(githubItems));
      setSyncStatus("synced");
    } catch {
      setSyncStatus("error");
    }
  }

  useEffect(() => {
    (async () => {
      const cached = localStorage.getItem("bar-inventory-items");
      if (cached) {
        try { setItems(JSON.parse(cached)); } catch {}
      }
      if (isConfigured()) {
        await fetchFromGitHub();
      } else {
        setSyncStatus("not-configured");
      }
      setLoaded(true);
    })();
  }, []);

  async function persist(newItems) {
    setItems(newItems);
    localStorage.setItem("bar-inventory-items", JSON.stringify(newItems));

    if (!isConfigured()) return;

    pendingItemsRef.current = newItems;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    setSyncStatus("pending");

    saveTimeoutRef.current = setTimeout(async () => {
      setSyncStatus("saving");
      try {
        await saveInventory(pendingItemsRef.current);
        setSyncStatus("synced");
      } catch {
        setSyncStatus("error");
      }
    }, 1500);
  }

  function handleSave(item) {
    const exists = items.find(i => i.id === item.id);
    persist(exists ? items.map(i => i.id === item.id ? item : i) : [...items, item]);
    setModal(null);
  }

  function handleDelete(id) {
    persist(items.filter(i => i.id !== id));
    setModal(null);
  }

  function adjustQty(id, delta) {
    persist(items.map(i => i.id === id ? { ...i, quantity: Math.max(0, +(i.quantity + delta).toFixed(1)) } : i));
  }

  function handleSetupComplete() {
    setShowSetup(false);
    fetchFromGitHub();
  }

  const allTags = [...new Set(items.flatMap(i => i.tags))].sort();
  const usedCategories = [...new Set(items.map(i => i.category))].sort();

  const filtered = items.filter(item => {
    const matchSearch = !search || item.name.toLowerCase().includes(search.toLowerCase()) || item.tags.some(t => t.toLowerCase().includes(search.toLowerCase()));
    const matchTag = !activeTag || item.tags.includes(activeTag);
    const matchCat = !activeCategory || item.category === activeCategory;
    return matchSearch && matchTag && matchCat;
  });

  const lowCount = items.filter(i => i.quantity <= i.lowThreshold).length;

  if (!loaded) return (
    <div style={{ background: "#0a3d2e", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: "#c9a870", fontFamily: "Barlow, sans-serif" }}>Loading…</div>
    </div>
  );

  return (
    <>
      <style>{FONTS}{globalStyles}</style>
      <div style={{ background: "#0a3d2e", minHeight: "100vh", color: "#f5f0e8", padding: "0 0 60px" }}>

        <div style={{ borderBottom: "1px solid rgba(201,168,112,0.15)", padding: "24px 24px 20px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontFamily: "Playfair Display, serif", fontSize: 28, fontWeight: 700, color: "#f5f0e8", letterSpacing: "-0.01em" }}>
              The Bar
            </div>
            <div style={{ fontFamily: "Barlow, sans-serif", fontSize: 13, color: "#6db8a0", marginTop: 3 }}>
              {items.length} item{items.length !== 1 ? "s" : ""}
              {lowCount > 0 && <span style={{ color: "#e07a50", marginLeft: 10 }}>⚠ {lowCount} running low</span>}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10 }}>
            <button className="btn btn-primary" onClick={() => setModal("add")}>+ Add Item</button>
            <SyncIndicator
              status={syncStatus}
              onRefresh={fetchFromGitHub}
              onSetup={() => setShowSetup(true)}
            />
          </div>
        </div>

        <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>

          <div className="search-wrap">
            <span className="search-icon" style={{ fontSize: 16 }}>⌕</span>
            <input className="input" placeholder="Search items or drinks…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>

          {usedCategories.length > 1 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {usedCategories.map(cat => (
                <span key={cat} className={`tag-pill ${activeCategory === cat ? "active" : ""}`}
                  onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
                  style={{ fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                  {cat}
                </span>
              ))}
            </div>
          )}

          {allTags.length > 0 && (
            <div>
              <div style={{ fontFamily: "Barlow, sans-serif", fontSize: 11, color: "#6db8a0", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8, fontWeight: 600 }}>
                Filter by drink
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {allTags.map(tag => (
                  <span key={tag} className={`tag-pill ${activeTag === tag ? "active" : ""}`}
                    onClick={() => setActiveTag(activeTag === tag ? null : tag)}>
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
            {filtered.length === 0 ? (
              <div className="empty-state">
                {items.length === 0
                  ? <><div style={{ fontSize: 40, marginBottom: 12 }}>🍹</div><div>Add your first bottle to get started.</div></>
                  : <><div style={{ fontSize: 32, marginBottom: 12 }}>—</div><div>No items match your filters.</div></>
                }
              </div>
            ) : filtered.map(item => (
              <div key={item.id} className={`item-row ${item.quantity <= item.lowThreshold ? "low" : ""}`}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5, flexWrap: "wrap" }}>
                    <span style={{ fontFamily: "Barlow, sans-serif", fontWeight: 600, fontSize: 15, color: "#f5f0e8" }}>{item.name}</span>
                    <span className="category-badge">{item.category}</span>
                    {item.quantity <= item.lowThreshold && (
                      <span style={{ fontSize: 11, color: "#e07a50", fontFamily: "Barlow, sans-serif", fontWeight: 600 }}>LOW</span>
                    )}
                  </div>
                  {item.tags.length > 0 && (
                    <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                      {item.tags.map(t => (
                        <span key={t} className="tag-pill" style={{ fontSize: 11 }}
                          onClick={() => setActiveTag(activeTag === t ? null : t)}>
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div style={{ textAlign: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <button className="qty-btn" onClick={() => adjustQty(item.id, -1)}>−</button>
                    <div style={{ minWidth: 52, textAlign: "center" }}>
                      <span className="qty-display">{item.quantity}</span>
                      <span className="qty-unit">{pluralUnit(item.unit, item.quantity)}</span>
                    </div>
                    <button className="qty-btn" onClick={() => adjustQty(item.id, 1)}>+</button>
                  </div>
                </div>

                <div>
                  <button className="btn btn-ghost" style={{ padding: "7px 14px", fontSize: 13 }}
                    onClick={() => setModal(item)}>Edit</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {modal && (
          <ItemModal
            item={modal === "add" ? null : modal}
            onSave={handleSave}
            onClose={() => setModal(null)}
            onDelete={handleDelete}
          />
        )}

        {showSetup && (
          <GitHubSetup
            isFirstTime={!isConfigured()}
            onComplete={handleSetupComplete}
            onClose={() => setShowSetup(false)}
          />
        )}
      </div>
    </>
  );
}
