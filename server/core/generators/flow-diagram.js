/**
 * Generates Mermaid sequenceDiagram(s) with autonumber, activation boxes,
 * action-specific arrows, and description notes.
 *
 * @param {Array} dependencyFlows  From the aggregated codebase model
 * @returns {string} Mermaid diagram string (no markdown fences)
 */
export function generateFlowDiagram(dependencyFlows) {
  if (!dependencyFlows || dependencyFlows.length === 0) {
    return 'sequenceDiagram\n    Note over App: No dependency flows detected';
  }

  const sections = [];

  for (const flow of dependencyFlows) {
    const lines = ['sequenceDiagram'];
    lines.push('    autonumber');

    // Flow name as a title note
    lines.push(`    Note over Client: ${sanitize(flow.name || 'Unnamed Flow')}`);

    // Collect all participants
    const participants = new Set();
    if (Array.isArray(flow.steps)) {
      for (const step of flow.steps) {
        if (step.from) participants.add(step.from);
        if (step.to) participants.add(step.to);
      }
    }

    // Declare participants with alias
    for (const p of participants) {
      lines.push(`    participant ${safeName(p)} as ${sanitize(p)}`);
    }

    // Track activation state
    const activeParticipants = new Set();

    // Add flow steps
    if (Array.isArray(flow.steps)) {
      for (let i = 0; i < flow.steps.length; i++) {
        const step = flow.steps[i];
        const from = safeName(step.from);
        const to = safeName(step.to);
        if (!from || !to || from === to) continue;

        const arrow = getArrowType(step.action);

        // Build label: action + description
        const action = step.action || '';
        const desc = step.description || '';
        let label = '';
        if (action && desc && action !== desc) {
          label = `${sanitize(action)}: ${sanitize(desc)}`;
        } else {
          label = sanitize(desc || action || 'call');
        }

        // Activate the target if not already active
        if (!activeParticipants.has(to)) {
          lines.push(`    activate ${to}`);
          activeParticipants.add(to);
        }

        lines.push(`    ${from}${arrow}${to}: ${label}`);

        // Check if this is the last step involving this target
        const isLastStepForTarget = !flow.steps.slice(i + 1).some(
          s => safeName(s.from) === to || safeName(s.to) === to
        );
        if (isLastStepForTarget && activeParticipants.has(to)) {
          lines.push(`    deactivate ${to}`);
          activeParticipants.delete(to);
        }
      }
    }

    // Deactivate any remaining participants
    for (const p of activeParticipants) {
      lines.push(`    deactivate ${p}`);
    }

    sections.push(lines.join('\n'));
  }

  return sections.join('\n\n');
}

function getArrowType(action) {
  switch ((action || '').toLowerCase()) {
    case 'queries':
    case 'reads':
      return '->>';           // thin arrow for reads
    case 'sends':
    case 'publishes':
    case 'emits':
      return '-)';            // async arrow for events
    case 'returns':
    case 'responds':
      return '-->>';          // dashed return arrow
    case 'calls':
    case 'invokes':
    case 'requests':
      return '->>';           // solid arrow for calls
    default:
      return '->>';
  }
}

function safeName(name) {
  return (name || 'Unknown').replace(/[^a-zA-Z0-9_]/g, '_');
}

function sanitize(str) {
  return (str || '')
    .replace(/[\u{1F300}-\u{1FFFF}]/gu, '')
    .replace(/"/g, "'")
    .replace(/[[\]]/g, '')
    .substring(0, 60)
    .trim();
}
