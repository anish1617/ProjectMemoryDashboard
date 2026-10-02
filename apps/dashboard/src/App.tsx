import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  ArrowUpRight,
  ArrowLeft,
  FolderOpen,
  GitBranch,
  Search,
  Plus,
  Clock3,
  LayoutGrid,
  Settings,
  ShieldCheck,
  ChevronRight,
  RefreshCw,
  Copy,
  Check,
  Sun,
  Moon,
  Layers,
  Command,
  FileText,
  AlertCircle,
  Link2,
  Database,
  X,
} from "lucide-react";
import type { ProjectView, Claim } from "@project-memory/core";
import { mockProjects, capsule, api } from "./data.js";
type Page = "portfolio" | "project" | "timeline" | "settings";
const label = (value: string) =>
  value === "mvp_ready"
    ? "MVP ready"
    : value.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
const freshnessLabel = (value: string) =>
  value === "fresh"
    ? "Up to date"
    : value === "needs_analysis"
      ? "Needs a checkpoint"
      : "Changes since analysis";
const date = (value: string) =>
  new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
export function App() {
  const [mode, setMode] = useState<"sample" | "live">("sample");
  const [projects, setProjects] = useState<ProjectView[]>(mockProjects);
  const [page, setPage] = useState<Page>("portfolio");
  const [selected, setSelected] = useState("atlas");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [dark, setDark] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [adding, setAdding] = useState(false);
  const [repo, setRepo] = useState("");
  const [allowed, setAllowed] = useState<string[]>([]);
  const [checkpoint, setCheckpoint] = useState(false);
  const [checkpointText, setCheckpointText] = useState("");
  const [checkpointNext, setCheckpointNext] = useState("");
  const [tab, setTab] = useState<"resume" | "evidence" | "history">("resume");
  const current = projects.find((p) => p.id === selected) ?? projects[0];
  const filtered = projects.filter(
    (p) =>
      (filter === "all" ||
        (filter === "attention"
          ? p.freshness !== "fresh"
          : p.stage === filter)) &&
      `${p.name} ${p.state.purpose.map((c) => c.text).join(" ")}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const history = useMemo(
    () =>
      projects
        .flatMap((p) =>
          p.history.map((h) => ({ ...h, project: p.name, projectId: p.id })),
        )
        .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)),
    [projects],
  );
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
  }, [dark]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 4000);
    return () => clearTimeout(timer);
  }, [notice]);
  async function loadLive() {
    setBusy(true);
    setError("");
    try {
      const [result, config] = await Promise.all([
        api<{ projects: ProjectView[] }>("/projects"),
        api<{ allowedRoots: string[] }>("/settings"),
      ]);
      setProjects(result.projects);
      setAllowed(config.allowedRoots);
      setMode("live");
      setSelected(result.projects[0]?.id ?? "");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function open(project: ProjectView) {
    setSelected(project.id);
    setPage("project");
    setTab("resume");
    setError("");
    setCheckpoint(false);
  }
  async function refresh() {
    if (!current) return;
    setBusy(true);
    setError("");
    try {
      if (mode === "sample") {
        setNotice("Sample data refreshed. No repository was scanned.");
        return;
      }
      const p = await api<ProjectView>(`/projects/${current.id}/refresh`, {});
      setProjects((list) => list.map((item) => (item.id === p.id ? p : item)));
      setNotice(
        "Repository evidence refreshed. Semantic state stays separate.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function add(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (mode === "sample") {
        setNotice(
          "Switch to Local projects to register a repository. Sample data stays separate.",
        );
        return;
      }
      const project = await api<ProjectView>("/projects", { path: repo });
      setProjects((list) => [
        project,
        ...list.filter((p) => p.id !== project.id),
      ]);
      setAdding(false);
      setRepo("");
      open(project);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function saveCheckpoint(event: FormEvent) {
    event.preventDefault();
    if (!current) return;
    setBusy(true);
    setError("");
    try {
      if (mode === "sample") {
        setNotice("Sample checkpoint preview only; nothing was saved.");
        setCheckpoint(false);
        return;
      }
      const project = await api<ProjectView>(
        `/projects/${current.id}/checkpoints`,
        {
          title: "Development checkpoint",
          summary: checkpointText,
          evidenceRefs: [],
          nextActions: checkpointNext.trim()
            ? [checkpointNext.trim()]
            : undefined,
        },
      );
      setProjects((list) =>
        list.map((p) => (p.id === project.id ? project : p)),
      );
      setCheckpoint(false);
      setCheckpointText("");
      setCheckpointNext("");
      setNotice("Checkpoint saved as an explicit statement.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function copy() {
    if (!current) return;
    try {
      await navigator.clipboard.writeText(
        (mode === "sample" ? "SAMPLE DATA — illustrative context\n\n" : "") +
          capsule(current),
      );
      setNotice("Resume context copied.");
    } catch {
      setError(
        "Clipboard access was denied. Select and copy the resume text instead.",
      );
    }
  }
  return (
    <div className="app-shell">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <aside className="sidebar">
        <button
          className="brand"
          onClick={() => setPage("portfolio")}
          aria-label="Project Memory home"
        >
          <span className="brand-mark">
            <Layers size={21} />
          </span>
          <span>
            project memory
            <span className="brand-sub">A place to pick things up.</span>
          </span>
        </button>
        <div className="workspace-label">
          <span className="workspace-avatar">P</span>
          <span>
            Personal workspace<small>On this device</small>
          </span>
          <ShieldCheck size={15} />
        </div>
        <nav aria-label="Main navigation">
          {(
            [
              { id: "portfolio", name: "Projects", icon: LayoutGrid },
              { id: "timeline", name: "Activity", icon: Clock3 },
              { id: "settings", name: "Settings", icon: Settings },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              aria-current={
                page === item.id ||
                (item.id === "portfolio" && page === "project")
                  ? "page"
                  : undefined
              }
              className={`nav-item ${page === item.id || (item.id === "portfolio" && page === "project") ? "active" : ""}`}
              onClick={() => {
                setPage(item.id);
                setError("");
              }}
            >
              <item.icon size={18} />
              {item.name}
              {item.id === "portfolio" && (
                <span className="nav-count">{projects.length}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-projects">
          <h2>YOUR PROJECTS</h2>
          {projects.slice(0, 5).map((p, i) => (
            <button
              onClick={() => open(p)}
              key={p.id}
              className={
                page === "project" && current?.id === p.id
                  ? "selected-project"
                  : ""
              }
            >
              <span className={`project-dot color-${i % 4}`} />
              <span>{p.name}</span>
            </button>
          ))}
        </div>
        <div className="sidebar-bottom">
          <div className="local-note">
            <ShieldCheck size={17} />
            <span>
              Local by default<small>Your context, on your device.</small>
            </span>
          </div>
          <button className="theme-toggle" onClick={() => setDark(!dark)}>
            {dark ? <Sun size={16} /> : <Moon size={16} />}{" "}
            {dark ? "Light appearance" : "Dark appearance"}
          </button>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            Workspace <ChevronRight size={14} />{" "}
            {page === "project"
              ? (current?.name ?? "Project")
              : label(page === "portfolio" ? "projects" : page)}
          </div>
          <div className="topbar-right">
            <span className={`connection ${mode === "sample" ? "sample" : ""}`}>
              <span />
              {mode === "sample" ? "Sample workspace" : "Local projects"}
            </span>
            <button
              className="icon-button mobile-theme"
              aria-label="Toggle appearance"
              onClick={() => setDark(!dark)}
            >
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <span className="user-avatar" aria-label="Personal workspace">
              P
            </span>
          </div>
        </header>
        <main id="main" tabIndex={-1}>
          <div className="sample-banner">
            <span>
              <Database size={16} />
              {mode === "sample" ? (
                <>
                  <strong>You’re exploring sample data.</strong> Try the flows,
                  then connect your own projects.
                </>
              ) : (
                <>
                  <strong>Connected to your local workspace.</strong> Repository
                  evidence is stored on this device.
                </>
              )}
            </span>
            <button
              disabled={busy}
              onClick={() => {
                if (mode === "sample") void loadLive();
                else {
                  setMode("sample");
                  setProjects(mockProjects);
                  setSelected("atlas");
                  setPage("portfolio");
                  setError("");
                }
              }}
            >
              {mode === "sample" ? "Use local projects" : "Explore sample data"}
              <ArrowUpRight size={14} />
            </button>
          </div>
          {error && (
            <div role="alert" className="error-message">
              <AlertCircle size={18} />
              <span>{error}</span>
              <button
                className="icon-button"
                aria-label="Dismiss error"
                onClick={() => setError("")}
              >
                <X size={16} />
              </button>
            </div>
          )}
          {page === "portfolio" && (
            <>
              <div className="page-heading">
                <div>
                  <h1>Pick up where you left off.</h1>
                  <p>Your projects, their context, and a clear next step.</p>
                </div>
                <button
                  className="button primary"
                  onClick={() => setAdding(!adding)}
                >
                  <Plus size={17} />
                  Add project
                </button>
              </div>
              {adding && (
                <form onSubmit={add} className="inline-form">
                  <div>
                    <h2>Add an existing repository</h2>
                    <p>
                      {mode === "sample"
                        ? "Use local projects first to register a real repository."
                        : "Enter a Git repository inside an allowed folder. Source files are read only."}
                    </p>
                  </div>
                  <label>
                    Repository path
                    <input
                      required
                      value={repo}
                      onChange={(e) => setRepo(e.target.value)}
                      placeholder="D:/Projects/my-project"
                    />
                  </label>
                  <div className="form-actions">
                    <button
                      className="button"
                      type="button"
                      onClick={() => setAdding(false)}
                    >
                      Cancel
                    </button>
                    <button
                      className="button primary"
                      disabled={busy || mode === "sample"}
                    >
                      {busy ? "Scanning…" : "Scan and add"}
                    </button>
                  </div>
                </form>
              )}
              {current && (
                <section
                  className="continue-panel"
                  aria-labelledby="continue-heading"
                >
                  <div className="continue-main">
                    <div className="continue-title">
                      <span className="project-symbol">
                        <FolderOpen size={23} />
                      </span>
                      <div>
                        <h2 id="continue-heading">Continue {current.name}</h2>
                        <span className="muted">
                          {mode === "sample"
                            ? "Illustrative last session"
                            : `Observed ${date(current.observedAt)}`}
                          <span className="separator">·</span>
                          <GitBranch size={13} />
                          {current.branch}
                        </span>
                      </div>
                    </div>
                    <p>
                      {current.state.nextActions[0]?.text ??
                        "Review the observed repository and record your next step."}
                    </p>
                    <button
                      className="text-button"
                      onClick={() => open(current)}
                    >
                      Open resume
                      <ArrowUpRight size={17} />
                    </button>
                  </div>
                  <div className="continue-context">
                    <span>
                      <Clock3 size={16} /> Where you stopped
                    </span>
                    <p>
                      {current.state.inProgress[0]?.text ??
                        "No work-in-progress checkpoint yet. Add one to capture where you stopped."}
                    </p>
                    <span
                      className={`status ${current.freshness === "fresh" ? "good" : "attention"}`}
                    >
                      {freshnessLabel(current.freshness)}
                    </span>
                  </div>
                </section>
              )}
              <div className="portfolio-toolbar">
                <h2>
                  All projects <span>{projects.length}</span>
                </h2>
                <label className="search-box">
                  <Search size={17} />
                  <input
                    aria-label="Search projects"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search projects…"
                  />
                </label>
              </div>
              <div className="filter-row" aria-label="Project filters">
                {[
                  ["all", "All projects"],
                  ["attention", "Needs attention"],
                  ["building", "Building"],
                  ["paused", "Paused"],
                  ["mvp_ready", "MVP ready"],
                ].map(([value, text]) => (
                  <button
                    key={value}
                    aria-pressed={filter === value}
                    className={filter === value ? "active" : ""}
                    onClick={() => setFilter(value!)}
                  >
                    {text}
                  </button>
                ))}
                <span>
                  {filtered.length} project{filtered.length === 1 ? "" : "s"}
                </span>
              </div>
              <div className="project-grid">
                {filtered.map((p, i) => (
                  <button
                    className="project-card"
                    key={p.id}
                    onClick={() => open(p)}
                  >
                    <div className="card-heading">
                      <span className={`project-icon color-${i % 4}`}>
                        <FolderOpen size={21} />
                      </span>
                      <span className={`stage ${p.stage}`}>
                        {p.stageConfidence === 0
                          ? "Stage unknown"
                          : label(p.stage)}
                      </span>
                      <ArrowUpRight className="card-arrow" size={18} />
                    </div>
                    <h3>{p.name}</h3>
                    <p className="project-purpose">
                      {p.state.purpose[0]?.text ??
                        "Repository registered. Add a checkpoint to describe its purpose."}
                    </p>
                    <div className="next-step">
                      <span>Next step</span>
                      <p>
                        {p.state.nextActions[0]?.text ??
                          "Review current repository evidence."}
                      </p>
                    </div>
                    <div className="card-footer">
                      <span>
                        <GitBranch size={13} />
                        {p.branch}
                      </span>
                      <span
                        className={`freshness-dot ${p.freshness === "fresh" ? "good" : "attention"}`}
                        title={freshnessLabel(p.freshness)}
                      >
                        {p.freshness === "fresh" ? (
                          <Check size={13} />
                        ) : (
                          <Clock3 size={13} />
                        )}
                        <span>
                          {p.freshness === "fresh" ? "Current" : "Review"}
                        </span>
                      </span>
                    </div>
                  </button>
                ))}
              </div>
              {!filtered.length && (
                <div className="empty-state">
                  <FolderOpen size={30} />
                  <h2>
                    {projects.length
                      ? "No matching projects"
                      : "Your next session starts here."}
                  </h2>
                  <p>
                    {projects.length
                      ? "Try a different search or filter."
                      : "Add an existing Git repository to create its first evidence-backed resume."}
                  </p>
                  <button
                    className="button"
                    onClick={() => {
                      if (projects.length) {
                        setQuery("");
                        setFilter("all");
                      } else setAdding(true);
                    }}
                  >
                    {projects.length
                      ? "Clear filters"
                      : "Add your first project"}
                  </button>
                </div>
              )}
              <footer className="page-footer">
                <ShieldCheck size={14} />
                Continuity comes from evidence, not a completion percentage.
                <span>
                  {mode === "sample"
                    ? "Sample data · not real project status"
                    : "Local storage · no telemetry"}
                </span>
              </footer>
            </>
          )}
          {page === "project" && current && (
            <>
              <button
                className="text-button back-button"
                onClick={() => setPage("portfolio")}
              >
                <ArrowLeft size={15} />
                All projects
              </button>
              <div className="page-heading">
                <div>
                  <h1>{current.name}</h1>
                  <p>
                    {current.state.purpose[0]?.text ??
                      "An existing repository, ready for its first checkpoint."}
                  </p>
                </div>
                <button className="button primary" onClick={() => void copy()}>
                  <Copy size={16} />
                  Copy resume
                </button>
              </div>
              <div className="project-meta">
                <span>
                  <GitBranch size={15} />
                  {current.branch}
                </span>
                <span
                  className={`status ${current.dirty ? "attention" : "good"}`}
                >
                  {current.dirty ? "Uncommitted changes" : "Clean worktree"}
                </span>
                <span className="status">
                  {freshnessLabel(current.freshness)}
                </span>
                <span className="project-path" title={current.path}>
                  {current.path}
                </span>
              </div>
              <div className="detail-toolbar">
                <div aria-label="Project details">
                  {(["resume", "evidence", "history"] as const).map((t) => (
                    <button
                      aria-pressed={tab === t}
                      className={tab === t ? "active" : ""}
                      key={t}
                      onClick={() => setTab(t)}
                    >
                      {label(t)}
                    </button>
                  ))}
                </div>
                <button
                  className="text-button"
                  disabled={busy}
                  onClick={() => void refresh()}
                >
                  <RefreshCw size={15} className={busy ? "spinning" : ""} />
                  Refresh evidence
                </button>
                <button
                  className="button"
                  onClick={() => setCheckpoint(!checkpoint)}
                >
                  <Plus size={15} />
                  Checkpoint
                </button>
              </div>
              {checkpoint && (
                <form className="inline-form" onSubmit={saveCheckpoint}>
                  <h2>Where did you stop?</h2>
                  <p>
                    Capture what changed, what was tested, and the next action.
                    This is an explicit statement, not automatic verification.
                  </p>
                  <label>
                    Checkpoint summary
                    <textarea
                      required
                      maxLength={4000}
                      rows={4}
                      value={checkpointText}
                      onChange={(e) => setCheckpointText(e.target.value)}
                      placeholder="What changed? What passed? What comes next?"
                    />
                  </label>
                  <label>
                    Next action (optional)
                    <input
                      value={checkpointNext}
                      maxLength={2000}
                      onChange={(e) => setCheckpointNext(e.target.value)}
                      placeholder="One concrete step for your next session"
                    />
                  </label>
                  <div className="form-actions">
                    <button
                      type="button"
                      className="button"
                      onClick={() => setCheckpoint(false)}
                    >
                      Cancel
                    </button>
                    <button className="button primary" disabled={busy}>
                      Save checkpoint
                    </button>
                  </div>
                </form>
              )}
              {tab === "resume" && (
                <div className="resume-layout">
                  <div className="resume-content">
                    <section>
                      <h2>Where things stand</h2>
                      <Claims
                        claims={current.state.inProgress}
                        empty="No active-work checkpoint has been recorded."
                      />
                    </section>
                    <section>
                      <h2>Implemented</h2>
                      <Claims
                        claims={current.state.implemented}
                        empty="No implementation claims verified yet. Repository presence alone doesn’t prove feature completion."
                      />
                    </section>
                    <section>
                      <h2>Architecture & context</h2>
                      <Claims claims={current.state.architecture} />
                    </section>
                    <section>
                      <h2>Blockers & known issues</h2>
                      <Claims
                        claims={[
                          ...current.state.blockers,
                          ...current.state.knownIssues,
                        ]}
                        empty="No issues recorded. This does not mean the project is issue-free."
                      />
                    </section>
                    <section>
                      <h2>Important decisions</h2>
                      <Claims
                        claims={current.state.decisions}
                        empty="No decisions recorded yet."
                      />
                    </section>
                  </div>
                  <aside className="resume-aside">
                    <section className="next-actions">
                      <h2>Your next steps</h2>
                      <ol>
                        {current.state.nextActions.map((c, i) => (
                          <li key={i}>
                            <span>{i + 1}</span>
                            <p>{c.text}</p>
                          </li>
                        ))}
                      </ol>
                    </section>
                    <section>
                      <h2>Relevant files</h2>
                      {current.state.relevantFiles.map((f) => (
                        <div className="file-row" key={f.path}>
                          <FileText size={15} />
                          <span title={f.path}>
                            {f.path}
                            <small>{f.reason}</small>
                          </span>
                        </div>
                      ))}
                      {!current.state.relevantFiles.length && (
                        <p>No file references yet.</p>
                      )}
                    </section>
                    <section>
                      <h2>Evidence & freshness</h2>
                      <dl>
                        <dt>Repository</dt>
                        <dd>
                          {current.analyzer === "sample"
                            ? "Illustrative"
                            : current.evidence.some((e) => e.type === "file")
                              ? "Observed"
                              : "No file evidence"}
                        </dd>
                        <dt>Git</dt>
                        <dd>
                          {current.analyzer === "sample"
                            ? "Illustrative"
                            : "Observed"}
                        </dd>
                        <dt>Agent history</dt>
                        <dd>
                          {current.history.some((h) => h.type === "import")
                            ? "Imported"
                            : "Not imported"}
                        </dd>
                        <dt>Analysis</dt>
                        <dd>
                          {current.analyzer === "deterministic"
                            ? "Factual baseline"
                            : label(current.analyzer)}
                        </dd>
                      </dl>
                      <p className="muted">
                        {current.generatedAt
                          ? `Generated ${date(current.generatedAt)}`
                          : "No semantic analysis yet"}
                      </p>
                    </section>
                  </aside>
                </div>
              )}
              {tab === "evidence" && (
                <section className="evidence-list">
                  <h2>Evidence behind the context</h2>
                  <p className="muted">
                    References preserve where a claim came from. Interpretation
                    is labeled separately.
                  </p>
                  {current.evidence.map((e) => (
                    <details key={e.id}>
                      <summary>
                        <FileText size={17} />
                        <span>{e.source}</span>
                        <span className="provenance">{e.type}</span>
                      </summary>
                      <pre>{e.content}</pre>
                      <small>Reference: {e.id}</small>
                    </details>
                  ))}
                </section>
              )}
              {tab === "history" && (
                <Timeline
                  items={current.history.map((h) => ({
                    ...h,
                    project: current.name,
                  }))}
                />
              )}
            </>
          )}
          {page === "project" && !current && (
            <div className="empty-state">
              <h1>No project selected</h1>
              <button className="button" onClick={() => setPage("portfolio")}>
                Go to projects
              </button>
            </div>
          )}
          {page === "timeline" && (
            <>
              <div className="page-heading">
                <div>
                  <h1>Every project has a thread.</h1>
                  <p>
                    Scans, checkpoints, and decisions, in the order they
                    happened.
                  </p>
                </div>
              </div>
              <Timeline items={history} />
            </>
          )}
          {page === "settings" && (
            <>
              <div className="page-heading">
                <div>
                  <h1>Your workspace, your rules.</h1>
                  <p>
                    Keep project continuity local and make integrations
                    deliberate.
                  </p>
                </div>
              </div>
              <div className="settings-list">
                <section>
                  <div>
                    <Database size={22} />
                    <h2>Data source</h2>
                    <p>
                      Explore sample projects or connect to the local database.
                      Sample records are never saved as real evidence.
                    </p>
                  </div>
                  <button
                    className="button"
                    disabled={busy}
                    onClick={() => void loadLive()}
                  >
                    Connect local workspace
                    <ArrowUpRight size={15} />
                  </button>
                </section>
                <section>
                  <div>
                    <ShieldCheck size={22} />
                    <h2>Privacy</h2>
                    <p>
                      Local storage. No telemetry. Secret filtering before
                      persistence. External analysis requires explicit CLI
                      selection.
                    </p>
                  </div>
                  <span className="status good">Local by default</span>
                </section>
                <section>
                  <div>
                    <FolderOpen size={22} />
                    <h2>Allowed project folders</h2>
                    <p>
                      Configure folders when starting the local service.
                      Repositories outside them cannot be scanned from this
                      dashboard.
                    </p>
                    {allowed.map((path) => (
                      <code key={path}>{path}</code>
                    ))}
                    {!allowed.length && (
                      <p className="muted">
                        No connected folder configuration.
                      </p>
                    )}
                  </div>
                </section>
                <section>
                  <div>
                    <Link2 size={22} />
                    <h2>Agent integrations</h2>
                    <p>
                      The local MCP server shares the same project state.
                      Provider setup is explicit; an installed integration does
                      not prove event capture.
                    </p>
                    <code>pnpm pm mcp --db &lt;database&gt;</code>
                  </div>
                </section>
              </div>
            </>
          )}
          {busy && (
            <span role="status" className="busy-note">
              <RefreshCw size={15} className="spinning" />
              Working with your local workspace…
            </span>
          )}
        </main>
      </div>
      {notice && (
        <div className="toast" role="status">
          <Check size={17} />
          {notice}
        </div>
      )}
    </div>
  );
}
function Claims({
  claims,
  empty = "No context recorded yet.",
}: {
  claims: Claim[];
  empty?: string;
}) {
  return claims.length ? (
    <ul className="claims">
      {claims.map((c, i) => (
        <li key={i}>
          <p>{c.text}</p>
          <span className={`provenance ${c.provenance}`}>{c.provenance}</span>
        </li>
      ))}
    </ul>
  ) : (
    <p className="muted">{empty}</p>
  );
}
function Timeline({
  items,
}: {
  items: Array<{
    id: string;
    title: string;
    summary: string;
    occurredAt: string;
    source: string;
    project: string;
  }>;
}) {
  return (
    <section className="timeline">
      {items.map((item, i) => (
        <article key={item.id + "-" + i}>
          <span className="timeline-marker">
            <Clock3 size={16} />
          </span>
          <div>
            <div className="timeline-heading">
              <h2>{item.title}</h2>
              <time dateTime={item.occurredAt}>{date(item.occurredAt)}</time>
            </div>
            <p>{item.summary}</p>
            <span className="muted">
              {item.project}
              <span className="separator">·</span>
              {item.source}
            </span>
          </div>
        </article>
      ))}
      {!items.length && (
        <div className="empty-state">
          <Clock3 size={30} />
          <h2>No activity yet</h2>
          <p>
            Register a repository or save a checkpoint to start its history.
          </p>
        </div>
      )}
    </section>
  );
}
