/* The Goals surface — the identity layer, composed above Notes by the shell
   (the slot keeps DemoList's internals untouched). The app's Goals.tsx at
   demo scope: one capture parsing $1/$2/$3 + #tag, three horizon groups
   (centered labels, no hairlines — the stack-head pattern), a checkbox that
   achieves (timeless rows render ∞ — a direction is never done), the dim
   Achieved group at the bottom, and the pause axis. Timeframe drag stays an
   app-only verb: the demo has no DnD anywhere. */

import { cloneElement } from 'react'
import type { Features } from './DemoSettings'
import { CaptureField, HideMenu, ProjectMenu, EditInput, type CaptureHandle, type Pop, type Sel } from './DemoList'
import {
  fmtMonth, fmtReminder, projectColor, clipProject,
  type GoalRow, type HideDuration, type Project,
} from './model'

export interface GoalAct {
  addGoal(raw: string): void
  achieve(goal: GoalRow): void
  del(goal: GoalRow): void
  commitEdit(goal: GoalRow, raw: string): void
  setProject(id: number, projectId: number | null): void
  pause(id: number, duration: HideDuration): void
  resume(id: number): void
  createProject(name: string): number
}

const HORIZON_GROUPS: { horizon: GoalRow['horizon']; label: string }[] = [
  { horizon: 'timeless', label: 'Timeless' },
  { horizon: 'long', label: 'Long term' },
  { horizon: 'short', label: 'Short term' },
]

export default function DemoGoals({ features, goals, projects, sel, setSel, pop, setPop, editingId, setEditingId, captureRef, act }: {
  features: Features
  goals: GoalRow[]
  projects: Project[]
  sel: Sel
  setSel(s: Sel): void
  pop: Pop
  setPop(p: Pop): void
  editingId: number | null
  setEditingId(id: number | null): void
  captureRef?: React.RefObject<CaptureHandle | null>
  act: GoalAct
}) {
  const f = features
  const goalFlags = { projects: f.goalProjects, timeframes: f.goalTimeframes }
  // the capture hints teach only the grammar that exists, the app's pools
  const examples = [
    ...(f.goalTimeframes ? ['Read 12 books this year $1'] : []),
    ...(f.goalTimeframes ? ['Run a half marathon $2'] : []),
    ...(f.goalTimeframes ? ['Stay close to the family $3'] : []),
    ...(f.goalProjects ? ['Launch the side project #build'] : []),
    'Ship the portfolio site this month',
  ]

  // the reveal state rides in through `goals` (paused rows render inline,
  // dimmed, where they live) — this surface only splits achieved from active
  const active = goals.filter((g) => g.status === 'active')
  const achieved = goals.filter((g) => g.status === 'achieved')
  const row = (g: GoalRow) => (
    <GoalRow key={g.id} goal={g} features={f} projects={projects}
      selected={sel?.kind === 'goal' && sel.id === g.id}
      setSel={setSel} pop={pop} setPop={setPop}
      editing={editingId === g.id} setEditingId={setEditingId} act={act} />
  )

  return (
    <section className="d-section d-goals">
      <div className="surface-head">Goals</div>
      <CaptureField
        surface="goal-capture"
        flags={goalFlags}
        demoExamples={examples}
        handleRef={captureRef ?? { current: null }}
        onSubmit={act.addGoal}
      />
      {f.goalTimeframes
        ? HORIZON_GROUPS.map(({ horizon, label }) => {
            const rows = active.filter((g) => g.horizon === horizon)
            if (!rows.length) return null
            return (
              <div key={horizon}>
                <div className="tier-divider"><span className="tier-label">{label}</span></div>
                {rows.map(row)}
              </div>
            )
          })
        : active.map(row)}
      {achieved.length > 0 && (
        <div>
          <div className="tier-divider"><span className="tier-label">Achieved</span></div>
          {achieved.map(row)}
        </div>
      )}
    </section>
  )
}

function GoalRow({ goal, features, projects, selected, setSel, pop, setPop, editing, setEditingId, act }: {
  goal: GoalRow
  features: Features
  projects: Project[]
  selected: boolean
  setSel(s: Sel): void
  pop: Pop
  setPop(p: Pop): void
  editing: boolean
  setEditingId(id: number | null): void
  act: GoalAct
}) {
  const achieved = goal.status === 'achieved'
  const paused = goal.hidden
  const project = features.goalProjects ? projects.find((p) => p.id === goal.projectId) ?? null : null
  const checkable = goal.horizon !== 'timeless'

  return (
    <div
      className={`item goal-row${achieved ? ' done' : ''}${paused ? ' hidden' : ''}${selected ? ' selected' : ''}`}
      data-goal-id={goal.id}
      onClick={() => {
        setSel({ kind: 'goal', id: goal.id })
        if (!editing) setEditingId(goal.id)
      }}
    >
      <span className="grip" title="Drag between horizons (in the app)">⠿</span>
      {checkable ? (
        <button
          className={`item-check${achieved ? ' checked' : ''}`}
          data-kb={paused ? undefined : 1}
          title={paused ? 'Paused — hover for ↺ resume' : achieved ? 'Achieved — click to undo' : 'Mark achieved'}
          onClick={(e) => { e.stopPropagation(); if (!paused) act.achieve(goal) }}
        />
      ) : (
        <span className="goal-eternal" title="Timeless — a direction, never done">∞</span>
      )}
      {editing ? (
        <EditInput
          initial={goal.text}
          surface="goal-edit"
          flags={{ projects: features.goalProjects, timeframes: features.goalTimeframes }}
          onCommit={(raw) => { act.commitEdit(goal, raw); setEditingId(null) }}
        />
      ) : (
        <span className="item-text">{goal.text}</span>
      )}
      {!editing && (
        <>
          <div className="item-meta">
            {paused && <span className="hidden-chip">◐ {goal.hiddenUntil ? `until ${fmtReminder(goal.hiddenUntil)}` : 'forever'}</span>}
            {achieved && goal.achievedDay && <span className="time-label" title={`Achieved ${goal.achievedDay}`}>{fmtMonth(goal.achievedDay)}</span>}
            {project && (
              <span className="project-label" style={{ color: projectColor(project.id) }} title={`Project: ${project.name}`}>
                {clipProject(project.name)}
              </span>
            )}
          </div>
          {((paused ? [
            <button key="resume" className="item-action" title="Resume" onClick={(e) => { e.stopPropagation(); act.resume(goal.id) }}>↺</button>,
            <button key="del" className="item-action danger" title="Delete" onClick={(e) => { e.stopPropagation(); act.del(goal) }}>×</button>,
          ] : [
            features.goalProjects && (
              <button key="proj" className={`item-action${pop?.kind === 'project' && pop.on === 'goal' && pop.id === goal.id ? ' active' : ''}`} title="Project"
                onClick={(e) => { e.stopPropagation(); setPop(pop?.kind === 'project' && pop.on === 'goal' && pop.id === goal.id ? null : { kind: 'project', on: 'goal', id: goal.id }) }}>#</button>
            ),
            !achieved && features.goalPause && (
              <button key="pause" className={`item-action${pop?.kind === 'hide' && pop.on === 'goal' && pop.id === goal.id ? ' active' : ''}`} title="Pause"
                onClick={(e) => { e.stopPropagation(); setPop(pop?.kind === 'hide' && pop.on === 'goal' && pop.id === goal.id ? null : { kind: 'hide', on: 'goal', id: goal.id }) }}>◐</button>
            ),
            <button key="del" className="item-action danger" title="Delete" onClick={(e) => { e.stopPropagation(); act.del(goal) }}>×</button>,
          ]).filter(Boolean) as React.ReactElement<any>[]).map((b, i) =>
            cloneElement(b, { 'data-kb': i + (checkable && !paused ? 2 : 1) }),
          )}
        </>
      )}
      {pop && pop.on === 'goal' && pop.id === goal.id && pop.kind === 'project' && (
        <ProjectMenu
          projects={projects}
          current={goal.projectId}
          onPick={(pid) => { act.setProject(goal.id, pid); setPop(null) }}
          onCreate={(name) => { const id = act.createProject(name); act.setProject(goal.id, id); setPop(null) }}
          onClose={() => setPop(null)}
        />
      )}
      {pop && pop.on === 'goal' && pop.id === goal.id && pop.kind === 'hide' && (
        <HideMenu verb="Pause" onPick={(d) => { act.pause(goal.id, d); setPop(null) }} />
      )}
    </div>
  )
}
