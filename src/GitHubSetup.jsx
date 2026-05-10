import { useState } from "react";
import { setConfig, testConnection } from "./github";

export default function GitHubSetup({ onComplete, onClose, isFirstTime }) {
  const [form, setForm] = useState({ token: "", owner: "", repo: "bar-inventory", branch: "main" });
  const [status, setStatus] = useState(null); // null | 'testing' | 'success' | 'error'
  const [error, setError] = useState("");

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  async function handleSave() {
    if (!form.token || !form.owner || !form.repo) return;
    setStatus("testing");
    setError("");
    try {
      await testConnection(form);
      setConfig(form);
      setStatus("success");
      setTimeout(onComplete, 600);
    } catch (e) {
      setStatus("error");
      setError(e.message);
    }
  }

  return (
    <div className="modal-overlay" onClick={e => !isFirstTime && e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 520 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <h2 style={{ fontFamily: "Playfair Display, serif", color: "#f5f0e8", fontSize: 22 }}>
            {isFirstTime ? "Connect to GitHub" : "GitHub Sync Settings"}
          </h2>
          {!isFirstTime && (
            <button onClick={onClose} style={{ background: "none", border: "none", color: "#6b7591", cursor: "pointer", fontSize: 22 }}>×</button>
          )}
        </div>

        <p style={{ fontFamily: "Barlow, sans-serif", fontSize: 13, color: "#6db8a0", marginBottom: 24, lineHeight: 1.6 }}>
          Your inventory will be saved as <code style={{ color: "#c9a870" }}>inventory.json</code> in your GitHub repo and synced automatically. You'll need a Personal Access Token with <strong style={{ color: "#f5f0e8" }}>Contents: Read and Write</strong> permission.
        </p>

        <div style={{ background: "rgba(201,168,112,0.06)", border: "1px solid rgba(201,168,112,0.2)", borderRadius: 8, padding: "12px 16px", marginBottom: 24 }}>
          <p style={{ fontFamily: "Barlow, sans-serif", fontSize: 12, color: "#a8c4b8", lineHeight: 1.7, margin: 0 }}>
            To create a token: GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token → select your repo → Repository permissions → Contents → Read and write.
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label>GitHub Personal Access Token</label>
            <input
              className="input"
              type="password"
              value={form.token}
              onChange={e => set("token", e.target.value)}
              placeholder="github_pat_..."
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label>GitHub Username</label>
              <input className="input" value={form.owner} onChange={e => set("owner", e.target.value)} placeholder="your-username" />
            </div>
            <div>
              <label>Repository Name</label>
              <input className="input" value={form.repo} onChange={e => set("repo", e.target.value)} placeholder="bar-inventory" />
            </div>
          </div>

          <div>
            <label>Branch</label>
            <input className="input" value={form.branch} onChange={e => set("branch", e.target.value)} placeholder="main" />
          </div>

          {status === "error" && (
            <div style={{ color: "#e07a50", fontFamily: "Barlow, sans-serif", fontSize: 13, padding: "10px 14px", background: "rgba(224,122,80,0.08)", borderRadius: 8, border: "1px solid rgba(224,122,80,0.25)" }}>
              {error}
            </div>
          )}

          {status === "success" && (
            <div style={{ color: "#6db8a0", fontFamily: "Barlow, sans-serif", fontSize: 13, padding: "10px 14px", background: "rgba(74,140,122,0.08)", borderRadius: 8, border: "1px solid rgba(74,140,122,0.25)" }}>
              Connected! Loading your inventory…
            </div>
          )}

          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 4 }}>
            {!isFirstTime && (
              <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
            )}
            <button
              className="btn btn-primary"
              onClick={handleSave}
              disabled={status === "testing" || status === "success" || !form.token || !form.owner || !form.repo}
            >
              {status === "testing" ? "Connecting…" : "Connect & Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
