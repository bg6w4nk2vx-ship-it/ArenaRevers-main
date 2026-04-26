#!/usr/bin/env node
/*
  Build compact security summary for AI gate from Semgrep and npm audit JSON.
*/
const fs = require('fs');
const path = require('path');

function readJsonSafe(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    const raw = fs.readFileSync(filePath, 'utf8').trim();
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    return { _parseError: String(err) };
  }
}

function semgrepToFindings(semgrepJson) {
  if (!semgrepJson || !Array.isArray(semgrepJson.results)) return [];
  return semgrepJson.results.slice(0, 50).map((r) => ({
    source: 'semgrep',
    rule_id: r.check_id || 'unknown',
    severity: (r.extra && r.extra.severity ? String(r.extra.severity) : 'UNKNOWN').toUpperCase(),
    message: r.extra && r.extra.message ? r.extra.message : '',
    path: r.path || '',
    line: r.start && r.start.line ? r.start.line : null,
  }));
}

function npmAuditToFindings(auditJson) {
  if (!auditJson) return [];

  const findings = [];

  if (auditJson.vulnerabilities && typeof auditJson.vulnerabilities === 'object') {
    for (const [pkg, vuln] of Object.entries(auditJson.vulnerabilities)) {
      findings.push({
        source: 'npm-audit',
        rule_id: pkg,
        severity: String((vuln && vuln.severity) || 'unknown').toUpperCase(),
        message: (vuln && vuln.title) || (vuln && vuln.name) || 'Dependency vulnerability',
        path: (vuln && Array.isArray(vuln.via) && vuln.via[0] && vuln.via[0].source)
          ? String(vuln.via[0].source)
          : pkg,
        line: null,
      });
    }
  }

  return findings.slice(0, 50);
}

function countBySeverity(findings) {
  const counts = { CRITICAL: 0, HIGH: 0, MODERATE: 0, MEDIUM: 0, LOW: 0, UNKNOWN: 0 };
  for (const f of findings) {
    const sev = String(f.severity || 'UNKNOWN').toUpperCase();
    if (Object.prototype.hasOwnProperty.call(counts, sev)) {
      counts[sev] += 1;
    } else {
      counts.UNKNOWN += 1;
    }
  }
  return counts;
}

function estimateRiskScore(counts) {
  const score =
    counts.CRITICAL * 30 +
    counts.HIGH * 15 +
    (counts.MODERATE + counts.MEDIUM) * 7 +
    counts.LOW * 2;
  return Math.max(0, Math.min(100, score));
}

function buildDecisionHints(counts, riskScore) {
  if (counts.CRITICAL > 0 || riskScore >= 70) {
    return { suggested_decision: 'BLOCK_DEPLOY', rationale: 'Critical findings or high aggregate risk score.' };
  }
  if (riskScore >= 40) {
    return { suggested_decision: 'MANUAL_REVIEW', rationale: 'Medium risk score requires human validation.' };
  }
  return { suggested_decision: 'ALLOW_DEPLOY', rationale: 'No critical findings and low aggregate risk.' };
}

function main() {
  const semgrepPath = process.argv[2] || path.resolve(process.cwd(), 'semgrep.json');
  const auditPath = process.argv[3] || path.resolve(process.cwd(), 'npm-audit.json');
  const outputPath = process.argv[4] || path.resolve(process.cwd(), 'security-summary.json');

  const semgrep = readJsonSafe(semgrepPath);
  const audit = readJsonSafe(auditPath);

  const findings = [
    ...semgrepToFindings(semgrep),
    ...npmAuditToFindings(audit),
  ];

  const counts = countBySeverity(findings);
  const risk_score = estimateRiskScore(counts);
  const hint = buildDecisionHints(counts, risk_score);

  const summary = {
    generated_at: new Date().toISOString(),
    inputs: {
      semgrep_path: semgrepPath,
      npm_audit_path: auditPath,
      semgrep_loaded: !!semgrep,
      npm_audit_loaded: !!audit,
    },
    totals: {
      findings: findings.length,
      by_severity: counts,
      risk_score,
    },
    suggestion: hint,
    findings: findings.slice(0, 100),
  };

  fs.writeFileSync(outputPath, JSON.stringify(summary, null, 2));
  console.log(`Security summary written to ${outputPath}`);
}

main();
