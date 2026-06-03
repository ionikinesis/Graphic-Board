import React, { useState, useEffect, useRef } from 'react'
import { themes } from '../utils/themes.js'
import { PRESET_COLORS } from '../utils/color.js'

const darkThemes  = Object.entries(themes).filter(([, t]) => t.mode === 'dark')
const lightThemes = Object.entries(themes).filter(([, t]) => t.mode === 'light')

export default function SettingsModal({ roots, activeRootId, onAddRoot, onRemoveRoot, onSwitchRoot, onClose, scale, onSetScale, textScale, onSetTextScale, currentTheme, onSetTheme, customColors, onSetCustomColors, tagManager, onSetRootAbsPath, highContrast, onSetHighContrast }) {
  return (
    <div style={s.backdrop} onClick={onClose}>
      <div style={s.panel} onClick={e => e.stopPropagation()}>
        <div style={s.header}>
          <span style={s.title}>settings</span>
          <button style={s.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div style={s.body}>
          {/* Library folders */}
          <div style={s.sectionLabel}>library folders</div>
          <div style={s.rootList}>
            {roots.length === 0 && (
              <div style={s.rootEmpty}>no folders — add one below</div>
            )}
            {roots.map(root => (
              <RootRow
                key={root.id}
                root={root}
                isActive={root.id === activeRootId}
                onSwitch={() => onSwitchRoot(root.id)}
                onRemove={() => onRemoveRoot(root.id)}
                onSetAbsPath={path => onSetRootAbsPath(root.id, path)}
              />
            ))}
          </div>
          <button style={s.addFolderBtn} onClick={onAddRoot}>+ add folder</button>

          <div style={s.rule} />

          {/* Theme */}
          <div style={s.sectionLabel}>theme</div>
          <div style={s.themeColumns}>
            <div style={s.themeCol}>
              <div style={s.themeColLabel}>dark</div>
              {darkThemes.map(([key, theme]) => (
                <ThemeChip key={key} theme={theme} isActive={currentTheme === key} onSelect={() => onSetTheme(key)} />
              ))}
            </div>
            <div style={s.themeCol}>
              <div style={s.themeColLabel}>light</div>
              {lightThemes.map(([key, theme]) => (
                <ThemeChip key={key} theme={theme} isActive={currentTheme === key} onSelect={() => onSetTheme(key)} />
              ))}
            </div>
          </div>

          {/* Custom theme */}
          <CustomThemeSection
            isActive={currentTheme === 'custom'}
            onSelect={() => onSetTheme('custom')}
            colors={customColors}
            onChange={onSetCustomColors}
          />

          <div style={s.rule} />

          {/* UI scale */}
          <div style={s.sectionLabel}>ui scale</div>
          <div style={s.scaleRow}>
            <input
              type="range" min="0.7" max="1.5" step="0.05" value={scale}
              onChange={e => onSetScale(parseFloat(e.target.value))}
              style={s.slider}
            />
            <span style={s.scaleValue}>{Math.round(scale * 100)}%</span>
            {scale !== 1.0 && (
              <button style={s.resetBtn} onClick={() => onSetScale(1.0)}>reset</button>
            )}
          </div>

          {/* Text scale */}
          <div style={s.sectionLabel}>text scale</div>
          <div style={s.scaleRow}>
            <input
              type="range" min="0.8" max="1.3" step="0.05" value={textScale ?? 1.0}
              onChange={e => onSetTextScale(parseFloat(e.target.value))}
              style={s.slider}
            />
            <span style={s.scaleValue}>{Math.round((textScale ?? 1.0) * 100)}%</span>
            {(textScale ?? 1.0) !== 1.0 && (
              <button style={s.resetBtn} onClick={() => onSetTextScale(1.0)}>reset</button>
            )}
          </div>

          <div style={s.rule} />

          {/* Accessibility */}
          <div style={s.sectionLabel}>accessibility</div>
          <div style={s.hcRow}>
            <div style={s.hcInfo}>
              <span style={s.hcLabel}>high contrast mode</span>
              <span style={s.hcSub}>boosts text and border contrast; replaces accent with yellow (dark) or blue (light) for colorblind visibility</span>
            </div>
            <button
              style={{ ...s.hcToggle, background: highContrast ? 'var(--accent)' : 'var(--bg-deep)', color: highContrast ? 'var(--accent-text)' : 'var(--text-muted)', borderColor: highContrast ? 'var(--accent)' : 'var(--border-mid)' }}
              onClick={() => onSetHighContrast(!highContrast)}
            >
              {highContrast ? 'on' : 'off'}
            </button>
          </div>

          <div style={s.rule} />

          {/* Tag manager */}
          {tagManager && (
            <>
              <div style={s.sectionLabel}>tags</div>
              <TagManager tagManager={tagManager} />
            </>
          )}

          <p style={s.hint}>
            access is re-granted each browser session — this is a browser security requirement.
          </p>
        </div>
      </div>
    </div>
  )
}

// ── Root row ───────────────────────────────────────────────────────────────

function RootRow({ root, isActive, onSwitch, onRemove, onSetAbsPath }) {
  const canSwitch = root.status !== 'missing' && !isActive
  const [pathDraft, setPathDraft] = useState(root.absPath || '')
  useEffect(() => { setPathDraft(root.absPath || '') }, [root.absPath])

  function commitPath() { onSetAbsPath(pathDraft.trim() || null) }

  return (
    <div>
      <div
        style={{
          ...s.rootRow,
          borderColor: isActive ? 'var(--accent)' : 'var(--border-subtle)',
          cursor: canSwitch ? 'pointer' : 'default',
          opacity: root.status === 'missing' ? 0.45 : 1,
        }}
        onClick={canSwitch ? onSwitch : undefined}
      >
        <span style={{ ...s.folderIcon, color: isActive ? 'var(--accent)' : 'var(--text-muted)' }}>⌂</span>
        <span style={s.rootName}>{root.name}</span>
        {root.status === 'needs-permission' && <span style={s.permBadge}>needs access</span>}
        {isActive && <span style={s.activeDot} />}
        <button style={s.removeRootBtn} onClick={e => { e.stopPropagation(); onRemove() }} title="remove folder">×</button>
      </div>
      {isActive && (
        <input
          type="text"
          value={pathDraft}
          placeholder={root.absPath ? undefined : 'C:\\path\\to\\folder  (for Show in Explorer)'}
          spellCheck={false}
          style={s.absPathInput}
          onChange={e => setPathDraft(e.target.value)}
          onBlur={commitPath}
          onKeyDown={e => { if (e.key === 'Enter') { commitPath(); e.target.blur() } }}
        />
      )}
    </div>
  )
}

// ── Tag Manager ────────────────────────────────────────────────────────────

function TagManager({ tagManager }) {
  const { getAllTags, getTagStats, getTagColor, setTagColor, renameTag, mergeTag, deleteTag, createTag } = tagManager
  const allTags  = getAllTags()
  const stats    = getTagStats()

  const [newName,  setNewName]  = useState('')
  const [newColor, setNewColor] = useState('#e8b84b')
  const colorPickRef = useRef()

  function handleCreate() {
    const t = newName.trim().toLowerCase()
    if (!t) return
    createTag(t, newColor)
    setNewName('')
  }

  return (
    <div style={s.tagManager}>
      {allTags.length === 0 && (
        <div style={s.tagEmpty}>no tags yet — create one below or add tags via right-click</div>
      )}

      {allTags.map(tag => (
        <TagRow
          key={tag}
          tag={tag}
          count={stats[tag] || 0}
          color={getTagColor(tag)}
          allTags={allTags}
          onSetColor={hex => setTagColor(tag, hex)}
          onRename={newName => renameTag(tag, newName)}
          onMerge={into => mergeTag(tag, into)}
          onDelete={() => deleteTag(tag)}
        />
      ))}

      {/* New tag row */}
      <div style={s.newTagRow}>
        <label style={s.newColorLabel} title="pick color for new tag">
          <input
            ref={colorPickRef}
            type="color"
            value={newColor}
            style={{ position: 'absolute', opacity: 0, width: 0, height: 0, pointerEvents: 'none' }}
            onChange={e => setNewColor(e.target.value)}
          />
          <span style={{ ...s.tagDot, background: newColor }} />
        </label>
        <input
          type="text"
          value={newName}
          placeholder="new tag name"
          style={s.newTagInput}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleCreate() }}
        />
        <button style={s.newTagAdd} onClick={handleCreate} disabled={!newName.trim()}>add</button>
      </div>

      {/* Preset color swatches for new tag */}
      <div style={s.newSwatchRow}>
        {PRESET_COLORS.map(c => (
          <button
            key={c}
            style={{ ...s.newSwatch, background: c, outline: newColor === c ? '2px solid var(--text-primary)' : '2px solid transparent', outlineOffset: 1 }}
            onClick={() => setNewColor(c)}
          />
        ))}
      </div>
    </div>
  )
}

function TagRow({ tag, count, color, allTags, onSetColor, onRename, onMerge, onDelete }) {
  const [editing,    setEditing]    = useState(false)
  const [editVal,    setEditVal]    = useState(tag)
  const [mergeOpen,  setMergeOpen]  = useState(false)
  const colorRef = useRef()

  function commitRename() {
    setEditing(false)
    if (editVal.trim() && editVal.trim() !== tag) onRename(editVal.trim())
    else setEditVal(tag)
  }

  const otherTags = allTags.filter(t => t !== tag)

  return (
    <div style={s.tagRowWrap}>
      {/* Color dot / picker */}
      <label style={s.tagColorLabel} title="change tag color">
        <input
          ref={colorRef}
          type="color"
          value={color || '#888888'}
          style={{ position: 'absolute', opacity: 0, width: 0, height: 0, pointerEvents: 'none' }}
          onChange={e => onSetColor(e.target.value)}
        />
        <span style={{ ...s.tagDot, background: color || 'var(--border-mid)' }} />
      </label>

      {/* Tag name — editable */}
      {editing ? (
        <input
          autoFocus
          style={s.tagEditInput}
          value={editVal}
          onChange={e => setEditVal(e.target.value)}
          onBlur={commitRename}
          onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') { setEditing(false); setEditVal(tag) } }}
        />
      ) : (
        <span style={s.tagName} onDoubleClick={() => { setEditing(true); setEditVal(tag) }}>{tag}</span>
      )}

      <span style={s.tagCount}>{count}</span>

      {/* Merge */}
      <div style={{ position: 'relative' }}>
        <button style={s.tagActionBtn} onClick={() => setMergeOpen(o => !o)} title="merge into another tag" disabled={otherTags.length === 0}>
          ⊕
        </button>
        {mergeOpen && otherTags.length > 0 && (
          <div style={s.mergeMenu}>
            <div style={s.mergeLabel}>merge into:</div>
            {otherTags.map(t => (
              <button
                key={t}
                style={s.mergeItem}
                onClick={() => { onMerge(t); setMergeOpen(false) }}
              >
                {t}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Rename shortcut */}
      <button style={s.tagActionBtn} onClick={() => { setEditing(true); setEditVal(tag) }} title="rename">✎</button>

      {/* Delete */}
      <button style={{ ...s.tagActionBtn, color: '#e05050' }} onClick={onDelete} title="delete tag">×</button>
    </div>
  )
}

// ── Custom theme ───────────────────────────────────────────────────────────

function CustomThemeSection({ isActive, onSelect, colors, onChange }) {
  return (
    <div>
      {/* Chip — rendered with the user's own colors as a live preview */}
      <button
        style={{
          display: 'flex', alignItems: 'center', gap: 8, width: '100%',
          padding: '7px 10px', background: colors.bg,
          border: `1.5px solid ${isActive ? colors.accent : '#555'}`,
          borderRadius: 4, cursor: 'pointer', textAlign: 'left', marginBottom: 4,
        }}
        onClick={onSelect}
      >
        <span style={{ width: 9, height: 9, borderRadius: '50%', background: colors.accent, flexShrink: 0, border: `0.5px solid rgba(255,255,255,0.2)` }} />
        <span style={{ flex: 1, fontSize: 'var(--fs-12)', fontFamily: 'var(--font-mono)', color: colors.text, letterSpacing: '0.04em' }}>
          custom
        </span>
        {isActive && <span style={{ fontSize: 'var(--fs-11)', color: colors.accent }}>✓</span>}
      </button>

      {/* Hex editors — only shown when custom is active */}
      {isActive && (
        <div style={s.customEditor}>
          <ColorInput label="background" value={colors.bg}     onChange={v => onChange({ bg: v })} />
          <ColorInput label="accent"     value={colors.accent} onChange={v => onChange({ accent: v })} />
          <ColorInput label="text"       value={colors.text}   onChange={v => onChange({ text: v })} />
        </div>
      )}
    </div>
  )
}

function ColorInput({ label, value, onChange }) {
  const [draft, setDraft] = useState(value)
  const pickerRef = useRef()

  useEffect(() => { setDraft(value) }, [value])

  function apply(raw) {
    const v = raw.trim()
    const h = v.startsWith('#') ? v : '#' + v
    if (/^#[0-9a-f]{6}$/i.test(h)) onChange(h)
  }

  return (
    <div style={s.colorInputRow}>
      <span style={s.colorInputLabel}>{label}</span>
      <label style={{ ...s.colorSwatch, background: value }} title="click to open color picker">
        <input
          ref={pickerRef}
          type="color"
          value={value}
          style={{ position: 'absolute', opacity: 0, width: 0, height: 0, pointerEvents: 'none' }}
          onChange={e => { onChange(e.target.value); setDraft(e.target.value) }}
        />
      </label>
      <input
        type="text"
        value={draft}
        maxLength={7}
        spellCheck={false}
        style={s.colorHexInput}
        onChange={e => { setDraft(e.target.value); apply(e.target.value) }}
        onBlur={() => { apply(draft); setDraft(value) }}
        onKeyDown={e => { if (e.key === 'Enter') apply(draft) }}
      />
    </div>
  )
}

// ── Theme chip ─────────────────────────────────────────────────────────────

function ThemeChip({ theme, isActive, onSelect }) {
  const v = theme.vars
  return (
    <button
      style={{
        display: 'flex', alignItems: 'center', gap: 8, width: '100%',
        padding: '7px 10px', background: v['--bg-surface'],
        border: `1.5px solid ${isActive ? v['--accent'] : v['--border-mid']}`,
        borderRadius: 4, cursor: 'pointer', textAlign: 'left', marginBottom: 4,
      }}
      onClick={onSelect}
    >
      <span style={{ width: 9, height: 9, borderRadius: '50%', background: v['--accent'], flexShrink: 0, border: `0.5px solid ${v['--border-strong']}` }} />
      <span style={{ flex: 1, fontSize: 'var(--fs-12)', fontFamily: 'var(--font-mono)', color: v['--text-secondary'], letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
        {theme.label}
      </span>
      {isActive && <span style={{ fontSize: 'var(--fs-11)', color: v['--accent'] }}>✓</span>}
    </button>
  )
}

// ── Styles ─────────────────────────────────────────────────────────────────

const s = {
  backdrop: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)',
    zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  panel: {
    width: 400, maxHeight: 'calc(90vh / var(--app-scale, 1))',
    background: 'var(--bg-surface)', border: '0.5px solid var(--border-mid)',
    borderRadius: 'var(--radius-lg)', overflow: 'hidden',
    boxShadow: '0 8px 40px rgba(0,0,0,0.5)',
    display: 'flex', flexDirection: 'column',
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '14px 18px', borderBottom: '0.5px solid var(--border-subtle)',
    background: 'var(--bg-deep)', flexShrink: 0,
  },
  title:    { fontSize: 'var(--fs-13)', color: 'var(--text-secondary)', letterSpacing: '0.06em', fontWeight: 700 },
  closeBtn: { fontSize: 'var(--fs-12)', color: 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px 7px', borderRadius: 3 },
  body:     { padding: 18, display: 'flex', flexDirection: 'column', gap: 11, overflowY: 'auto', flex: 1, minHeight: 0 },
  sectionLabel: { fontSize: 'var(--fs-10)', letterSpacing: '0.18em', color: 'var(--border-strong)', textTransform: 'uppercase', fontWeight: 700 },
  rootList: { display: 'flex', flexDirection: 'column', gap: 5 },
  rootEmpty: { fontSize: 'var(--fs-11)', color: 'var(--border-strong)', letterSpacing: '0.04em', fontStyle: 'italic', padding: '4px 2px' },
  rootRow: {
    display: 'flex', alignItems: 'center', gap: 9, padding: '8px 10px',
    background: 'var(--bg-raised)', borderRadius: 'var(--radius-sm)',
    border: '0.5px solid var(--border-subtle)', transition: 'border-color 0.1s',
  },
  folderIcon:    { fontSize: 'var(--fs-14)', flexShrink: 0 },
  rootName:      { flex: 1, fontSize: 'var(--fs-12)', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)', letterSpacing: '0.03em' },
  permBadge:     { fontSize: 'var(--fs-9)', color: 'var(--accent)', border: '0.5px solid var(--accent-dim)', borderRadius: 2, padding: '1px 5px', letterSpacing: '0.06em', flexShrink: 0 },
  activeDot:     { width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 },
  removeRootBtn: { fontSize: 'var(--fs-14)', lineHeight: 1, color: 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer', padding: '0 2px', flexShrink: 0 },
  addFolderBtn: {
    fontSize: 'var(--fs-12)', padding: '7px 14px', borderRadius: 'var(--radius-sm)', border: 'none',
    background: 'var(--accent)', color: 'var(--accent-text)', fontWeight: 700,
    letterSpacing: '0.04em', cursor: 'pointer', fontFamily: 'var(--font-mono)', alignSelf: 'flex-start',
  },
  rule:         { height: '0.5px', background: 'var(--border-subtle)', margin: '2px 0' },
  themeColumns: { display: 'flex', gap: 10 },
  themeCol:     { flex: 1, display: 'flex', flexDirection: 'column' },
  themeColLabel:{ fontSize: 'var(--fs-10)', color: 'var(--text-muted)', letterSpacing: '0.12em', marginBottom: 6, textTransform: 'uppercase' },
  scaleRow:     { display: 'flex', alignItems: 'center', gap: 9 },
  slider:       { flex: 1, cursor: 'pointer', accentColor: 'var(--accent)' },
  scaleValue:   { fontSize: 'var(--fs-12)', color: 'var(--text-secondary)', minWidth: 36, textAlign: 'right', fontWeight: 700 },
  resetBtn: {
    fontSize: 'var(--fs-10)', padding: '4px 9px', border: '0.5px solid var(--border-mid)',
    borderRadius: 'var(--radius-sm)', background: 'transparent', color: 'var(--text-muted)',
    cursor: 'pointer', letterSpacing: '0.03em', fontFamily: 'var(--font-mono)',
  },
  hint: { fontSize: 'var(--fs-11)', color: 'var(--border-strong)', lineHeight: 1.8, letterSpacing: '0.04em' },
  hcRow:    { display: 'flex', alignItems: 'center', gap: 12 },
  hcInfo:   { flex: 1, display: 'flex', flexDirection: 'column', gap: 3 },
  hcLabel:  { fontSize: 'var(--fs-12)', color: 'var(--text-secondary)', fontWeight: 700, letterSpacing: '0.04em' },
  hcSub:    { fontSize: 'var(--fs-10)', color: 'var(--text-muted)', lineHeight: 1.6, letterSpacing: '0.03em' },
  hcToggle: { fontSize: 'var(--fs-11)', fontFamily: 'var(--font-mono)', fontWeight: 700, letterSpacing: '0.08em', padding: '6px 14px', border: '1px solid', borderRadius: 'var(--radius-sm)', cursor: 'pointer', flexShrink: 0, transition: 'all 0.15s' },
  absPathInput: {
    width: '100%', boxSizing: 'border-box', marginTop: 3,
    fontSize: 'var(--fs-10)', color: 'var(--text-muted)',
    background: 'var(--bg-base)', border: '0.5px solid var(--border-subtle)',
    borderRadius: 3, padding: '4px 8px',
    fontFamily: 'var(--font-mono)', letterSpacing: '0.04em', outline: 'none',
  },

  // tag manager
  tagManager: { display: 'flex', flexDirection: 'column', gap: 3 },
  tagEmpty:   { fontSize: 'var(--fs-11)', color: 'var(--border-strong)', letterSpacing: '0.04em', fontStyle: 'italic', padding: '4px 0' },
  tagRowWrap: {
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '5px 8px',
    background: 'var(--bg-raised)', borderRadius: 3,
    border: '0.5px solid var(--border-subtle)',
  },
  tagColorLabel: { cursor: 'pointer', flexShrink: 0, position: 'relative', display: 'flex', alignItems: 'center' },
  tagDot:  { width: 10, height: 10, borderRadius: '50%', display: 'block' },
  tagName: { flex: 1, fontSize: 'var(--fs-12)', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', cursor: 'pointer', letterSpacing: '0.04em' },
  tagCount:{ fontSize: 'var(--fs-10)', color: 'var(--border-strong)', minWidth: 18, textAlign: 'right', flexShrink: 0 },
  tagEditInput: {
    flex: 1, fontSize: 'var(--fs-12)', color: 'var(--text-secondary)',
    background: 'var(--bg-base)', border: '0.5px solid var(--accent)',
    borderRadius: 2, padding: '1px 5px', fontFamily: 'var(--font-mono)',
    letterSpacing: '0.04em', outline: 'none',
  },
  tagActionBtn: {
    fontSize: 'var(--fs-12)', color: 'var(--text-muted)', background: 'transparent',
    border: 'none', cursor: 'pointer', padding: '2px 4px', borderRadius: 2, flexShrink: 0,
  },
  mergeMenu: {
    position: 'absolute', top: 'calc(100% + 3px)', right: 0,
    background: 'var(--bg-surface)', border: '0.5px solid var(--border-mid)',
    borderRadius: 3, boxShadow: '0 4px 14px rgba(0,0,0,0.45)',
    zIndex: 300, minWidth: 120, padding: '3px 0',
  },
  mergeLabel: { fontSize: 'var(--fs-9)', color: 'var(--text-muted)', padding: '3px 10px 4px', letterSpacing: '0.1em', textTransform: 'uppercase' },
  mergeItem: {
    display: 'block', width: '100%', textAlign: 'left',
    fontSize: 'var(--fs-11)', color: 'var(--text-secondary)', background: 'transparent',
    border: 'none', padding: '5px 10px', cursor: 'pointer',
    fontFamily: 'var(--font-mono)', letterSpacing: '0.03em',
  },
  newTagRow: { display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 },
  newColorLabel: { cursor: 'pointer', flexShrink: 0, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, borderRadius: 3, border: '0.5px solid var(--border-mid)', background: 'var(--bg-base)' },
  newTagInput: {
    flex: 1, fontSize: 'var(--fs-11)', color: 'var(--text-secondary)',
    background: 'var(--bg-raised)', border: '0.5px solid var(--border-mid)',
    borderRadius: 3, padding: '4px 8px', fontFamily: 'var(--font-mono)',
    letterSpacing: '0.04em', outline: 'none',
  },
  newTagAdd: {
    fontSize: 'var(--fs-11)', padding: '4px 10px', background: 'var(--accent)', color: 'var(--accent-text)',
    border: 'none', borderRadius: 3, cursor: 'pointer', fontWeight: 700,
    fontFamily: 'var(--font-mono)', letterSpacing: '0.04em', flexShrink: 0,
  },
  newSwatchRow: { display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 },
  newSwatch: { width: 16, height: 16, borderRadius: 2, border: 'none', cursor: 'pointer', padding: 0 },

  customEditor: {
    display: 'flex', flexDirection: 'column', gap: 6,
    padding: '10px 12px',
    background: 'var(--bg-raised)', border: '0.5px solid var(--border-subtle)',
    borderRadius: 4, marginTop: 2,
  },
  colorInputRow: { display: 'flex', alignItems: 'center', gap: 8 },
  colorInputLabel: {
    fontSize: 'var(--fs-11)', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)',
    letterSpacing: '0.06em', width: 80, flexShrink: 0,
  },
  colorSwatch: {
    width: 22, height: 22, borderRadius: 3, flexShrink: 0,
    border: '0.5px solid var(--border-mid)', cursor: 'pointer',
    position: 'relative', display: 'block',
  },
  colorHexInput: {
    flex: 1, fontSize: 'var(--fs-11)', color: 'var(--text-secondary)',
    background: 'var(--bg-base)', border: '0.5px solid var(--border-mid)',
    borderRadius: 3, padding: '4px 8px',
    fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', outline: 'none',
  },
}
