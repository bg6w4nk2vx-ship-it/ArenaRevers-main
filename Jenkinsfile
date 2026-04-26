pipeline {
  agent any

  parameters {
    string(name: 'N8N_AI_GATE_URL', defaultValue: 'http://n8n:5678/webhook/ai-security-gate', description: 'n8n webhook URL')
    string(name: 'N8N_AI_GATE_TOKEN', defaultValue: 'change-me', description: 'Shared token for AI gate')
    string(name: 'OPA_URL', defaultValue: 'http://opa:8181', description: 'OPA base URL')
  }

  options {
    timestamps()
    disableConcurrentBuilds()
  }

  environment {
    MANUAL_OVERRIDE = 'false'
  }

  stages {
    stage('Checkout') {
      steps {
        sh 'rm -f manual-override.flag'
        echo 'Pipeline script mode: no SCM checkout required.'
      }
    }

    stage('Build Lightweight Security Summary') {
      steps {
        sh '''
          set -e
          CRITICAL_COUNT=$(git grep -nE '(eval\\(|new Function\\(|child_process\\.exec\\()' -- backend frontend 2>/dev/null | wc -l | tr -d ' ' || true)
          HIGH_COUNT=$(git grep -nE '(innerHTML\\s*=|document\\.write\\()' -- backend frontend 2>/dev/null | wc -l | tr -d ' ' || true)
          LOW_COUNT=$(git grep -nE '(console\\.log\\()' -- backend frontend 2>/dev/null | wc -l | tr -d ' ' || true)

          RISK_SCORE=$((CRITICAL_COUNT*30 + HIGH_COUNT*15 + LOW_COUNT*2))
          if [ "$RISK_SCORE" -gt 100 ]; then RISK_SCORE=100; fi

          cat > security-summary.json <<EOF
{
  "generated_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "totals": {
    "findings": $((CRITICAL_COUNT + HIGH_COUNT + LOW_COUNT)),
    "by_severity": {
      "CRITICAL": ${CRITICAL_COUNT},
      "HIGH": ${HIGH_COUNT},
      "MODERATE": 0,
      "MEDIUM": 0,
      "LOW": ${LOW_COUNT},
      "UNKNOWN": 0
    },
    "risk_score": ${RISK_SCORE}
  },
  "suggestion": {
    "suggested_decision": "MANUAL_REVIEW",
    "rationale": "Generated from lightweight repository pattern scan."
  },
  "findings": []
}
EOF

          cat security-summary.json
        '''
      }
    }

    stage('AI Security Gate (n8n)') {
      steps {
        sh '''
          set -e
          BUILD_BRANCH=${BRANCH_NAME:-unknown}
          BUILD_COMMIT=${GIT_COMMIT:-unknown}

          cat > ai-gate-request.json <<EOF
{
  "repo": "${JOB_NAME}",
  "branch": "${BUILD_BRANCH}",
  "commit": "${BUILD_COMMIT}",
  "build_url": "${BUILD_URL}",
  "security_summary":
EOF

          cat security-summary.json >> ai-gate-request.json
          echo '}' >> ai-gate-request.json

          curl -sS -X POST "${N8N_AI_GATE_URL}" \
            -H "Content-Type: application/json" \
            -H "x-ai-gate-token: ${N8N_AI_GATE_TOKEN}" \
            --data @ai-gate-request.json \
            -o ai-gate-response.json

          cat ai-gate-response.json
        '''

        script {
          def decision = sh(
            script: "sed -n 's/.*\\\"decision\\\"[[:space:]]*:[[:space:]]*\\\"\\([^\\\"]*\\)\\\".*/\\1/p' ai-gate-response.json | head -n1",
            returnStdout: true
          ).trim()

          def riskScore = sh(
            script: "sed -n 's/.*\\\"risk_score\\\"[[:space:]]*:[[:space:]]*\\([0-9]*\\).*/\\1/p' ai-gate-response.json | head -n1",
            returnStdout: true
          ).trim()

          if (!decision) {
            decision = 'MANUAL_REVIEW'
          }
          if (!riskScore) {
            riskScore = '50'
          }

          env.AI_DECISION = decision
          env.AI_RISK_SCORE = riskScore
          echo "AI gate decision: ${env.AI_DECISION}, risk_score=${env.AI_RISK_SCORE}"

          if (decision == 'BLOCK_DEPLOY') {
            error('AI Security Gate blocked deployment')
          }

          if (decision == 'MANUAL_REVIEW') {
            timeout(time: 20, unit: 'MINUTES') {
              input message: 'AI Security Gate requested manual review. Continue deployment?', ok: 'Approve Deploy'
            }
            env.MANUAL_OVERRIDE = 'true'
            writeFile file: 'manual-override.flag', text: 'true\n'
          }
        }
      }
    }

    stage('OPA Policy Gate') {
      steps {
        sh '''
          set -e
          MANUAL_OVERRIDE_VALUE=false
          if [ -f manual-override.flag ]; then MANUAL_OVERRIDE_VALUE=true; fi

          cat > ci-gate.rego <<'EOF'
package ci

default allow := false

allow if {
  input.decision == "ALLOW_DEPLOY"
  input.risk_score < 70
}

allow if {
  input.decision == "MANUAL_REVIEW"
  input.manual_override == true
}
EOF

          curl -sS -X PUT "${OPA_URL}/v1/policies/ci_gate" \
            -H "Content-Type: text/plain" \
            --data-binary @ci-gate.rego > /dev/null

          cat > opa-input.json <<EOF
{
  "input": {
    "decision": "${AI_DECISION}",
    "risk_score": ${AI_RISK_SCORE},
    "manual_override": ${MANUAL_OVERRIDE_VALUE}
  }
}
EOF

          curl -sS -X POST "${OPA_URL}/v1/data/ci/allow" \
            -H "Content-Type: application/json" \
            --data @opa-input.json \
            -o opa-response.json

          cat opa-response.json

          grep -q '"result":true' opa-response.json
        '''
      }
    }

    stage('Deploy') {
      steps {
        echo 'Deploy stage passed AI and OPA gates. Add your deploy command here.'
      }
    }
  }

  post {
    always {
      archiveArtifacts artifacts: 'security-summary.json,ai-gate-request.json,ai-gate-response.json,ci-gate.rego,opa-input.json,opa-response.json', allowEmptyArchive: true
    }
  }
}
