import React, { useEffect, useRef } from 'react'

export default function HelpModal({ onClose }) {
  const panelRef = useRef()

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div style={s.backdrop} onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div ref={panelRef} style={s.panel}>

        <div style={s.header}>
          <span style={s.headerTitle}>help</span>
          <button style={s.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div style={s.body}>

          <Section title="getting started">
            <P>Graphic Board is a local first reference board manager for visual designers where folders full of images can be displayed as infinite canvas reference boards. It reads folders directly from your own drives. No files are uploaded anywhere.</P>
            <P>On first launch, click <Kw>choose folder</Kw> to pick your main reference library folder. You can add additional root folders in the settings as well.</P>
            <Tip>If the app asks for permission when you reopen it, just click <Kw>grant access</Kw>. This is a browser security requirement for reading local files.</Tip>
          </Section>

          <Section title="recommended folder structure">
            <P>Your root folder is the top level of your library. Organise it however suits your workflow — here's one approach that works well:</P>
            <div style={s.tree}>
              <TreeRow depth={0} label="📁 My References" note="← your root folder" />
              <TreeRow depth={1} label="📁 Characters" />
              <TreeRow depth={2} label="📁 Faces" />
              <TreeRow depth={2} label="📁 Hands &amp; Anatomy" />
              <TreeRow depth={1} label="📁 Environments" />
              <TreeRow depth={2} label="📁 Urban" />
              <TreeRow depth={2} label="📁 Nature" />
              <TreeRow depth={1} label="📁 Mood &amp; Lighting" />
              <TreeRow depth={1} label="📁 Style Refs" />
            </div>
            <P>Folders can be nested as deeply as you like. Images inside any folder are automatically shown when you open it. A folder containing both subfolders and images shows both simultaneously.</P>
            <Tip>Your settings (colours, tags, sort order, favourites) are stored in a <Code>graphic_board.json</Code> file inside your root folder, so everything can travel with the folder between devices if you move or sync it via cloud.</Tip>
          </Section>

          <Section title="navigating">
            <Row icon="📁" label="open a folder" desc="Double-click any folder card" />
            <Row icon="←" label="go back / forward" desc="Click the ← → buttons in the header, use mouse side-buttons (buttons 3 & 4), or click any segment of the breadcrumb trail" />
            <Row icon="⌂" label="go home" desc="Click the logo or the root name in the sidebar" />
            <Row icon="▸" label="sidebar" desc="Shows your root folder's top-level subfolders for quick jumping" />
          </Section>

          <Section title="board mode (infinite canvas)">
            <P>Any folder can be set to Board mode. When you open it, it launches an infinite canvas in a new window — similar to PureRef.</P>
            <Row icon="⊞" label="enable" desc="Right-click a folder → board mode. A ⊞ badge appears on the card." />
            <Row icon="⤢" label="open" desc="Double-click the folder — it opens in a separate window." />
            <P>On the canvas you can freely reposition and resize your reference images. Positions are saved automatically.</P>
          </Section>

          <Section title="folder cards">
            <Row icon="↖" label="select" desc="Single-click to select a card. Shift-click or drag a marquee to select multiple." />
            <Row icon="⤢" label="open" desc="Double-click to navigate into the folder." />
            <Row icon="✦" label="right-click menu" desc="Colour label · Tags · Favourites · Board mode · Sort name alias · Thumbnail · Link · Copy / Cut / Paste · Send to · Copy to · Show in Explorer · Delete" />
            <Row icon="⇥" label="drag to move" desc="Select one or more cards, then drag them onto another folder (or onto a sidebar item) to move them there. Ctrl+Z undoes the last move." />
            <Row icon="★" label="favourites" desc="Right-click → add to favorites. Filter by favourites using the Group menu." />
            <Tip>Selecting multiple cards and right-clicking gives you batch operations: set colour, add tags, cut/copy/move all at once.</Tip>
          </Section>

          <Section title="images">
            <Row icon="↖" label="select" desc="Single-click to select. Shift-click or marquee to select multiple." />
            <Row icon="⤢" label="open fullscreen" desc="Double-click any image to open it in the lightbox." />
            <Row icon="← →" label="lightbox navigation" desc="Arrow keys or the ← → buttons. Esc to close." />
            <Row icon="★" label="favourite" desc="Click the star icon that appears on hover, or use the star button in the lightbox toolbar." />
            <Row icon="✦" label="right-click menu" desc="Tags · Links · Rename · Copy / Cut / Paste · Send to · Copy to · Copy filename · Delete" />
          </Section>

          <Section title="sorting & grouping">
            <P>Use the controls in the view header to change how cards are sorted and grouped.</P>
            <Row icon="⇅" label="sort by" desc="Alphabetical · Recently opened · Favourites first · Colour label · File size · Custom (drag-to-reorder)" />
            <Row icon="⊞" label="group by" desc="None · Favourites · Colour · Tag · Type — collapses into labelled sections you can expand/collapse" />
            <Row icon="⠿" label="custom order" desc="Switch sort to Custom, then toggle Reorder mode (the drag icon in the header). Drag cards to rearrange. Your order is saved automatically." />
            <Row icon="▣" label="icon size" desc="Small / Medium / Large — toggle with the size buttons in the header." />
          </Section>

          <Section title="clipboard & moving files">
            <Row icon="⎘" label="copy" desc="Right-click → copy folder / copy file — puts it on the clipboard." />
            <Row icon="✂" label="cut" desc="Right-click → cut — will move the item on paste." />
            <Row icon="⎘" label="paste" desc="Right-click anywhere (on a card or the background) → paste. Pastes into the folder you're currently viewing." />
            <Row icon="→" label="send to…" desc="Right-click → send to… — pick a destination folder from your library. Moves the item there." />
            <Row icon="⎘" label="copy to…" desc="Right-click → copy to… — same but copies instead of moving." />
            <Row icon="↺" label="undo move" desc="Ctrl+Z undoes the last drag-and-drop or cut-paste move." />
          </Section>

          <Section title="colour labels & tags">
            <P>Two complementary ways to organise folders and images:</P>
            <Row icon="●" label="colour label" desc="A bold accent colour on the card border and info bar. Good for quick visual scanning. Right-click → colour." />
            <Row icon="◈" label="tags" desc="Free-form text labels. A folder or image can have multiple tags. Right-click → tags. Manage all tags (rename, merge, delete) in Settings → tag manager." />
            <Tip>Use Group by → Colour or Group by → Tag to automatically sort cards into collapsible sections by their colour or first tag.</Tip>
          </Section>

          <Section title="settings">
            <Row icon="⚙" label="open" desc="Click the gear icon in the top-right corner." />
            <Row icon="◑" label="theme" desc="16 themes: 8 dark (charcoal, graphite, sunset, retro, midnight, slate, moss, ember) and 8 light (paper, latte, flashbang, girlypop, cream, dusk, peach, mint). Plus a fully custom theme where you pick any bg / accent / text colours." />
            <Row icon="⊞" label="ui scale" desc="Zoom the entire interface in or out if the default size doesn't fit your display." />
            <Row icon="📁" label="root folders" desc="Add, remove, or switch between multiple root folders. Each root keeps its own settings file." />
            <Row icon="✦" label="tag manager" desc="Rename, merge, or delete tags globally across your whole library." />
            <Row icon="↗" label="explorer path" desc="Set the absolute OS path for your root folder to enable the Show in Explorer right-click option." />
          </Section>

          <Section title="keyboard shortcuts" last>
            <table style={s.table}>
              <tbody>
                <KbRow keys="Ctrl + A" action="Select all cards in the current view" />
                <KbRow keys="Ctrl + Z" action="Undo last move (drag or cut-paste)" />
                <KbRow keys="← → (lightbox)" action="Previous / next image" />
                <KbRow keys="Esc" action="Close lightbox, context menu, or modal" />
                <KbRow keys="Mouse button 3" action="Navigate back" />
                <KbRow keys="Mouse button 4" action="Navigate forward" />
                <KbRow keys="Shift + click" action="Add / remove from selection" />
                <KbRow keys="Drag on empty area" action="Marquee-select multiple cards" />
              </tbody>
            </table>
          </Section>

        </div>
      </div>
    </div>
  )
}

// ── small sub-components ────────────────────────────────────────────────────

function Section({ title, children, last }) {
  return (
    <div style={{ ...s.section, ...(last ? { borderBottom: 'none', marginBottom: 0, paddingBottom: 0 } : {}) }}>
      <div style={s.sectionTitle}>{title}</div>
      {children}
    </div>
  )
}

function P({ children }) {
  return <p style={s.p}>{children}</p>
}

function Kw({ children }) {
  return <span style={s.kw}>{children}</span>
}

function Code({ children }) {
  return <span style={s.code}>{children}</span>
}

function Tip({ children }) {
  return (
    <div style={s.tip}>
      <span style={s.tipIcon}>💡</span>
      <span style={s.tipText}>{children}</span>
    </div>
  )
}

function Row({ icon, label, desc }) {
  return (
    <div style={s.row}>
      <span style={s.rowIcon}>{icon}</span>
      <span style={s.rowLabel}>{label}</span>
      <span style={s.rowDesc}>{desc}</span>
    </div>
  )
}

function TreeRow({ depth, label, note }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, padding: '2px 0' }}>
      {depth > 0 && (
        <span style={{ display: 'inline-block', width: depth * 20, flexShrink: 0 }} aria-hidden />
      )}
      <span style={{ fontSize: 'var(--fs-11)', fontFamily: 'var(--font-mono)', color: depth === 0 ? 'var(--text-primary)' : 'var(--text-secondary)', letterSpacing: '0.03em' }}>
        {label}
      </span>
      {note && <span style={{ fontSize: 'var(--fs-10)', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', letterSpacing: '0.04em' }}>{note}</span>}
    </div>
  )
}

function KbRow({ keys, action }) {
  return (
    <tr>
      <td style={s.kbKey}><span style={s.kbd}>{keys}</span></td>
      <td style={s.kbAction}>{action}</td>
    </tr>
  )
}

// ── styles ──────────────────────────────────────────────────────────────────

const s = {
  backdrop: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)',
    zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  panel: {
    width: 580, maxHeight: '86vh',
    background: 'var(--bg-surface)', border: '0.5px solid var(--border-mid)',
    borderRadius: 'var(--radius-lg)', overflow: 'hidden',
    boxShadow: '0 16px 60px rgba(0,0,0,0.65)',
    display: 'flex', flexDirection: 'column',
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '14px 20px', borderBottom: '0.5px solid var(--border-subtle)',
    background: 'var(--bg-deep)', flexShrink: 0,
  },
  headerTitle: {
    fontSize: 'var(--fs-13)', color: 'var(--accent)', letterSpacing: '0.12em',
    fontWeight: 700, fontFamily: 'var(--font-mono)', textTransform: 'uppercase',
  },
  closeBtn: {
    fontSize: 'var(--fs-12)', color: 'var(--text-muted)', background: 'transparent',
    border: '0.5px solid var(--border-mid)', borderRadius: 3,
    padding: '3px 8px', cursor: 'pointer', fontFamily: 'var(--font-mono)',
  },
  body: { flex: 1, overflowY: 'auto', padding: '6px 0 10px' },

  section: {
    padding: '18px 24px 16px',
    borderBottom: '0.5px solid var(--border-subtle)',
    marginBottom: 0,
  },
  sectionTitle: {
    fontSize: 'var(--fs-10)', color: 'var(--accent)', letterSpacing: '0.14em',
    fontWeight: 700, fontFamily: 'var(--font-mono)', textTransform: 'uppercase',
    marginBottom: 12,
  },
  p: {
    margin: '0 0 9px', fontSize: 'var(--fs-12)', color: 'var(--text-secondary)',
    lineHeight: 1.65, letterSpacing: '0.02em', fontFamily: 'var(--font-mono)',
  },
  kw: {
    color: 'var(--accent)', fontWeight: 700,
  },
  code: {
    fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-11)',
    color: 'var(--text-muted)', letterSpacing: '0.04em',
  },
  tip: {
    display: 'flex', gap: 9, alignItems: 'flex-start',
    background: 'var(--accent-faint)', border: '0.5px solid var(--accent-dim)',
    borderRadius: 'var(--radius-sm)', padding: '8px 12px', marginTop: 10,
  },
  tipIcon: { fontSize: 'var(--fs-12)', flexShrink: 0, lineHeight: 1.65 },
  tipText: {
    fontSize: 'var(--fs-11)', color: 'var(--text-secondary)', lineHeight: 1.65,
    fontFamily: 'var(--font-mono)', letterSpacing: '0.02em',
  },

  row: {
    display: 'grid', gridTemplateColumns: '22px 140px 1fr',
    gap: 8, alignItems: 'baseline',
    padding: '5px 0',
    borderBottom: '0.5px solid var(--border-subtle)',
  },
  rowIcon: {
    fontSize: 'var(--fs-11)', color: 'var(--accent)', textAlign: 'center',
    fontFamily: 'var(--font-mono)',
  },
  rowLabel: {
    fontSize: 'var(--fs-11)', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)',
    letterSpacing: '0.04em', fontWeight: 700,
  },
  rowDesc: {
    fontSize: 'var(--fs-11)', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)',
    letterSpacing: '0.02em', lineHeight: 1.55,
  },

  tree: {
    background: 'var(--bg-deep)', border: '0.5px solid var(--border-subtle)',
    borderRadius: 'var(--radius-sm)', padding: '10px 14px', margin: '4px 0 10px',
  },
  list: { margin: '4px 0 8px 10px', padding: 0, listStyle: 'none' },
  li: {
    fontSize: 'var(--fs-11)', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)',
    letterSpacing: '0.04em', lineHeight: 1.8,
  },

  table: { width: '100%', borderCollapse: 'collapse', marginTop: 4 },
  kbKey: { paddingBottom: 8, paddingRight: 14, verticalAlign: 'middle', width: 180 },
  kbAction: {
    fontSize: 'var(--fs-11)', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)',
    letterSpacing: '0.02em', paddingBottom: 8, lineHeight: 1.5,
  },
  kbd: {
    display: 'inline-block',
    fontSize: 'var(--fs-10)', fontFamily: 'var(--font-mono)', letterSpacing: '0.05em',
    color: 'var(--text-primary)',
    background: 'var(--bg-raised)', border: '0.5px solid var(--border-mid)',
    borderRadius: 3, padding: '2px 7px',
  },
}
