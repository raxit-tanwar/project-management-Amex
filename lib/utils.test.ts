import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isOverdue, isCompletedStage, isProjectOverdue } from './utils.ts'

// A date that is firmly in the past and one firmly in the future, relative to "now".
const PAST = new Date(Date.now() - 86_400_000).toISOString()   // yesterday
const FUTURE = new Date(Date.now() + 86_400_000).toISOString() // tomorrow

test('isOverdue: past date is overdue, future is not, null is not', () => {
    assert.equal(isOverdue(PAST), true)
    assert.equal(isOverdue(FUTURE), false)
    assert.equal(isOverdue(null), false)
    assert.equal(isOverdue(undefined), false)
})

test('isCompletedStage: recognises terminal stages case-insensitively', () => {
    for (const name of ['Live', 'live', ' LIVE ', 'Done', 'done', 'Complete', 'Completed', 'Delivered']) {
        assert.equal(isCompletedStage(name), true, `expected "${name}" to be a completed stage`)
    }
    for (const name of ['Build Assigned', 'In Build', 'Kick-off call', 'In Review', 'On Hold', '', null, undefined]) {
        assert.equal(isCompletedStage(name), false, `expected "${name}" NOT to be a completed stage`)
    }
})

// This is the regression case reported for BCED5234 / BCED5678: a project whose
// build-live date has passed but which has already reached the Live/Done stage
// must NOT be flagged overdue — it has shipped, not slipped.
test('isProjectOverdue: completed-stage project with a past due date is NOT overdue', () => {
    assert.equal(isProjectOverdue(PAST, 'Live'), false)
    assert.equal(isProjectOverdue(PAST, 'Done'), false)
    assert.equal(isProjectOverdue(PAST, 'delivered'), false)
})

test('isProjectOverdue: in-flight project with a past due date IS overdue', () => {
    assert.equal(isProjectOverdue(PAST, 'In Build'), true)
    assert.equal(isProjectOverdue(PAST, 'Kick-off call'), true)
    assert.equal(isProjectOverdue(PAST, undefined), true) // no stage info → fall back to date
})

test('isProjectOverdue: future due date is never overdue regardless of stage', () => {
    assert.equal(isProjectOverdue(FUTURE, 'In Build'), false)
    assert.equal(isProjectOverdue(FUTURE, 'Live'), false)
})

test('isProjectOverdue: no due date is never overdue', () => {
    assert.equal(isProjectOverdue(null, 'In Build'), false)
    assert.equal(isProjectOverdue(undefined, 'Live'), false)
})
