import { useState, useEffect } from 'react'
import { CHECKLIST_PHASES } from '../data/ticketChecklist'
import './TicketChecklist.css'

export default function TicketChecklist({ ticketId }) {
  const storageKey = `checklist_${ticketId}`

  const [checked, setChecked] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem(storageKey) || '{}') }
    catch { return {} }
  })
  const [openPhases, setOpenPhases] = useState({ 0: true })
  const [collapsed,  setCollapsed]  = useState(true)

  useEffect(() => {
    sessionStorage.setItem(storageKey, JSON.stringify(checked))
  }, [checked, storageKey])

  const totalSteps = CHECKLIST_PHASES.reduce((s, p) => s + p.steps.length, 0)
  const doneSteps  = Object.values(checked).filter(Boolean).length
  const pct        = Math.round(doneSteps / totalSteps * 100)
  const allDone    = doneSteps === totalSteps

  function toggle(phaseId, stepId) {
    const key = phaseId + '_' + stepId
    setChecked(prev => ({ ...prev, [key]: !prev[key] }))
  }

  function togglePhase(idx) {
    setOpenPhases(prev => ({ ...prev, [idx]: !prev[idx] }))
  }

  function reset() {
    setChecked({})
    setOpenPhases({ 0: true })
  }

  function phaseDone(phase) {
    return phase.steps.every(s => checked[phase.id + '_' + s.id])
  }

  function phasePartial(phase) {
    return phase.steps.some(s => checked[phase.id + '_' + s.id])
  }

  return (
    <div className="checklist-card glass">
      <div className="checklist-header" onClick={() => setCollapsed(c => !c)}>
        <span className="checklist-title">Bearbeitungs-Checkliste</span>
        <span className="checklist-progress-text">{doneSteps}/{totalSteps}</span>
        <span className="checklist-chevron">{collapsed ? '▸' : '▾'}</span>
      </div>

      {!collapsed && (
        <>
          <div className="checklist-bar-track">
            <div
              className={'checklist-bar-fill' + (allDone ? ' checklist-bar-fill--done' : '')}
              style={{ width: pct + '%' }}
            />
          </div>

          {allDone && (
            <div className="checklist-complete">
              Alle Schritte abgeschlossen — Ticket kann geschlossen werden
            </div>
          )}

          <div className="checklist-phases">
            {CHECKLIST_PHASES.map((phase, idx) => {
              const done    = phaseDone(phase)
              const partial = phasePartial(phase)
              const isOpen  = openPhases[idx]
              const stepsDone = phase.steps.filter(s => checked[phase.id + '_' + s.id]).length

              return (
                <div key={phase.id} className={'checklist-phase' + (isOpen ? ' open' : '')}>
                  <div className="checklist-phase-header" onClick={() => togglePhase(idx)}>
                    <span className={'checklist-phase-num' + (done ? ' done' : partial ? ' partial' : '')}>
                      {done ? '✓' : idx + 1}
                    </span>
                    <span className="checklist-phase-title">{phase.title}</span>
                    <span className="checklist-phase-count">{stepsDone}/{phase.steps.length}</span>
                    <span className="checklist-phase-chevron">{isOpen ? '▾' : '▸'}</span>
                  </div>

                  {isOpen && (
                    <div className="checklist-steps">
                      {phase.steps.map(step => {
                        const key    = phase.id + '_' + step.id
                        const isDone = !!checked[key]
                        return (
                          <div
                            key={step.id}
                            className={'checklist-step' + (isDone ? ' done' : '')}
                            onClick={() => toggle(phase.id, step.id)}
                          >
                            <div className="checklist-checkbox">
                              {isDone && (
                                <svg width="10" height="8" viewBox="0 0 10 8">
                                  <path d="M1 4L3.5 6.5L9 1" stroke="currentColor" strokeWidth="1.8"
                                    strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                                </svg>
                              )}
                            </div>
                            <div className="checklist-step-content">
                              <div className="checklist-step-text">{step.text}</div>
                              <div className="checklist-step-hint">{step.hint}</div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <button className="checklist-reset-btn" onClick={reset}>
            Zuruecksetzen
          </button>
        </>
      )}
    </div>
  )
}
