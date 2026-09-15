document.addEventListener("DOMContentLoaded", function () {
    const question = document.getElementById("question");
    const investigateBtn = document.getElementById("investigateBtn");
    
    // Telemetry & Simulation State
    let currentTelemetry = null;
    let simTemp = null;
    let isFirstTelemetry = true;
    let lastHealthState = "NORMAL";
    let currentIncidentReportData = null;
    let investigationHistory = [];

    // Initialize
    document.getElementById("activityLog").innerHTML = `<div class="activity-item"><div class="act-time">Just now</div><div class="act-desc">System initialized</div></div>`;
    setInterval(pollTelemetry, 3000);
    pollTelemetry();

    async function pollModelRouter() {
        try {
            const res = await fetch("http://127.0.0.1:8000/api/models");
            if (res.ok) {
                const mData = await res.json();
                const badge = document.getElementById("stat-model-router");
                if (badge) {
                    const rModel = mData.registry ? mData.registry.REASONING_MODEL : "qwen2.5:7b";
                    if (mData.ollama_online) {
                        badge.innerHTML = `<span class="pulse-dot green"></span> ROUTER: ${escapeHTML(rModel)} (ONLINE)`;
                        badge.style.color = "var(--green)";
                        badge.style.borderColor = "rgba(16, 185, 129, 0.4)";
                    } else {
                        badge.innerHTML = `<span class="pulse-dot"></span> ROUTER: SOVEREIGN LOCAL`;
                        badge.style.color = "var(--cyan)";
                        badge.style.borderColor = "rgba(0, 217, 255, 0.4)";
                    }
                }
            }
        } catch(e) {}
    }
    pollModelRouter();

    // ----------------------------------------------------
    // SIMULATION & DEMO CONTROLS
    // ----------------------------------------------------
    function updateDemoUI() {
        const telTitle = document.getElementById("tel-header-title");
        const demoIndicator = document.getElementById("demo-indicator");
        if (simTemp !== null) {
            if(telTitle) telTitle.textContent = "DEMO TELEMETRY";
            if(demoIndicator) demoIndicator.style.display = "inline-block";
        } else {
            if(telTitle) telTitle.textContent = "LIVE TELEMETRY";
            if(demoIndicator) demoIndicator.style.display = "none";
        }
    }

    function setSim(e, temp) {
        document.querySelectorAll(".sim-btn").forEach(b => b.classList.remove("active"));
        if(e && e.currentTarget) e.currentTarget.classList.add("active");
        simTemp = temp;
        updateDemoUI();
        pollTelemetry();
    }

    const simLiveBtn = document.getElementById("sim-live");
    if (simLiveBtn) simLiveBtn.addEventListener("click", (e) => setSim(e, null));
    const simNormalBtn = document.getElementById("sim-normal");
    if (simNormalBtn) simNormalBtn.addEventListener("click", (e) => setSim(e, 72));
    const simWarnBtn = document.getElementById("sim-warning");
    if (simWarnBtn) simWarnBtn.addEventListener("click", (e) => setSim(e, 85));
    const simCritBtn = document.getElementById("sim-critical");
    if (simCritBtn) simCritBtn.addEventListener("click", (e) => setSim(e, 100));

    const startDemoBtn = document.getElementById("btn-start-demo");
    if (startDemoBtn) {
        startDemoBtn.addEventListener("click", function() {
            const resetBtn = document.getElementById("btn-reset-demo");
            if (resetBtn) resetBtn.click();
            
            setTimeout(() => {
                if (simWarnBtn) simWarnBtn.click();
                setTimeout(() => {
                    const actionBtn = document.querySelector('.btn-alert-action');
                    if (actionBtn) {
                        actionBtn.click();
                    } else if (investigateBtn) {
                        investigateBtn.click();
                    }
                }, 1500);
            }, 500);
        });
    }

    const resetDemoBtn = document.getElementById("btn-reset-demo");
    if (resetDemoBtn) {
        resetDemoBtn.addEventListener("click", function() {
            if (simLiveBtn) simLiveBtn.click();
            investigationHistory = [];
            renderHistory();
            
            const aiResult = document.getElementById("aiResult");
            if(aiResult) aiResult.classList.add("hidden");
            
            const reportContainer = document.getElementById("incidentReportContainer");
            if (reportContainer) reportContainer.classList.add("hidden");
            currentIncidentReportData = null;
            
            document.getElementById("eventTimeline").innerHTML = '';
            document.getElementById("activityLog").innerHTML = `<div class="activity-item"><div class="act-time">Just now</div><div class="act-desc">System initialized</div></div>`;
            isFirstTelemetry = true;
            lastHealthState = "NORMAL";
            if (question) question.value = '';
            
            document.querySelectorAll('.pipe-node').forEach(n => {
                n.classList.remove('active', 'running', 'skipped');
                const st = n.querySelector('.node-status');
                if(st) st.textContent = 'WAITING';
            });
            document.querySelectorAll('.pipe-connector').forEach(l => l.classList.remove('active'));
            
            // clear selected twin components
            document.querySelectorAll(".twin-comp").forEach(c => c.classList.remove("selected"));
            const askBtn = document.getElementById("ins-ask-btn");
            if(askBtn) askBtn.style.display = "none";
            const insName = document.getElementById("ins-comp-name");
            if(insName) insName.textContent = "SELECT A MACHINE COMPONENT";
            const insStatus = document.getElementById("ins-comp-status");
            if(insStatus) insStatus.textContent = "--";
            const insValue = document.getElementById("ins-comp-value");
            if(insValue) insValue.textContent = "--";
        });
    }

    // ----------------------------------------------------
    // TELEMETRY POLLING
    // ----------------------------------------------------
    async function pollTelemetry() {
        try {
            const res = await fetch("http://127.0.0.1:8000/telemetry");
            if (!res.ok) throw new Error("Telemetry request failed");
            let data = await res.json();
            
            if (simTemp !== null) {
                data.temperature = simTemp;
            }
            currentTelemetry = data;
            updateTelemetry(data);
            processHealthAndAlerts(data);
            
            if (isFirstTelemetry) {
                isFirstTelemetry = false;
                addActivityLog("Telemetry connected");
            }
        } catch (error) {
            console.error("Telemetry error:", error);
        }
    }

    function updateElement(id, value) {
        const el = document.getElementById(id);
        if (el) el.innerHTML = value;
    }

    function updateTelemetry(data) {
        updateElement("tel-temp", data.temperature + "&deg;C");
        updateElement("tel-rpm", data.rpm);
        updateElement("tel-pressure", data.pressure);
        updateElement("tel-coolant", data.coolant);
        updateElement("tel-vibration", data.vibration);
        updateElement("tel-fan", data.fan);
        
        // Update inspection panel if something is selected
        const selectedComp = document.querySelector(".twin-comp.selected");
        if (selectedComp) {
            updateInspectionPanel(selectedComp.id, data);
        }
    }

    // ----------------------------------------------------
    // HEALTH, ALERTS & MAINTENANCE
    // ----------------------------------------------------
    function processHealthAndAlerts(data) {
        let healthScore = 100;
        let currentState = "NORMAL";
        let tempDiff = 0;
        
        if (data.temperature > 80 && data.temperature <= 95) {
            healthScore -= 20;
            currentState = "WARNING";
            tempDiff = data.temperature - 80;
        } else if (data.temperature > 95) {
            healthScore -= 45;
            currentState = "CRITICAL";
            tempDiff = data.temperature - 80;
        }
        
        // update UI health circle
        updateElement("health-score-val", healthScore);
        const circle = document.getElementById("health-progress");
        if (circle) {
            const offset = 283 - (283 * healthScore) / 100;
            circle.style.strokeDashoffset = offset;
            
            circle.classList.remove("text-green", "text-amber", "text-red");
            const healthText = document.getElementById("health-status-text");
            if (healthText) {
                healthText.classList.remove("text-green", "text-amber", "text-red");
                healthText.textContent = currentState;
                if (currentState === "NORMAL") {
                    circle.classList.add("text-green");
                    healthText.classList.add("text-green");
                } else if (currentState === "WARNING") {
                    circle.classList.add("text-amber");
                    healthText.classList.add("text-amber");
                } else {
                    circle.classList.add("text-red");
                    healthText.classList.add("text-red");
                }
            }
        }
        
        // Handle twin flashing
        const tempSensor = document.getElementById("comp-temp-sensor");
        const fan = document.getElementById("comp-cooling-fan");
        if (tempSensor) tempSensor.classList.remove("warning", "critical");
        if (fan) fan.classList.remove("warning", "critical");
        
        if (currentState === "WARNING") {
            if (tempSensor) tempSensor.classList.add("warning");
            if (fan) fan.classList.add("warning");
        } else if (currentState === "CRITICAL") {
            if (tempSensor) tempSensor.classList.add("critical");
            if (fan) fan.classList.add("critical");
        }

        // Maintenance Intelligence update
        const mStatus = document.getElementById("maint-status");
        const mRisk = document.getElementById("maint-risk");
        const mAction = document.getElementById("maint-action");
        if (currentState === "NORMAL") {
            if (mStatus) mStatus.textContent = "READY";
            if (mRisk) { mRisk.textContent = "LOW"; mRisk.className = "maint-value text-green"; }
            if (mAction) mAction.textContent = "Continue routine monitoring and scheduled maintenance.";
        } else if (currentState === "WARNING") {
            if (mStatus) mStatus.textContent = "ATTENTION REQUIRED";
            if (mRisk) { mRisk.textContent = "MEDIUM / HIGH"; mRisk.className = "maint-value text-amber"; }
            if (mAction) mAction.textContent = "Maintenance Risk Assessment suggests inspecting the cooling fan and checking for dust accumulation.";
        } else if (currentState === "CRITICAL") {
            if (mStatus) mStatus.textContent = "ATTENTION REQUIRED";
            if (mRisk) { mRisk.textContent = "CRITICAL"; mRisk.className = "maint-value text-red"; }
            if (mAction) mAction.textContent = "Maintenance Risk Assessment advises immediate shutdown. Inspect cooling and pressure systems.";
        }
        
        // Timeline & Alerts update on state change
        if (currentState !== lastHealthState) {
            addActivityLog(`State changed to ${currentState}`);
            
            if (currentState === "WARNING") {
                addTimelineEvent("ALERT", `Temperature warning detected: ${data.temperature}°C`, "tl-state-warning");
            } else if (currentState === "CRITICAL") {
                addTimelineEvent("ALERT", `Critical temperature detected: ${data.temperature}°C`, "tl-state-critical");
            } else if (currentState === "NORMAL") {
                addTimelineEvent("SYSTEM", `System returned to normal state`, "tl-state-normal");
            }
            
            lastHealthState = currentState;
        }
    }

    // ----------------------------------------------------
    // DIGITAL TWIN
    // ----------------------------------------------------
    const comps = document.querySelectorAll(".twin-comp");
    comps.forEach(c => {
        c.addEventListener("click", () => {
            comps.forEach(other => other.classList.remove("selected"));
            c.classList.add("selected");
            if (currentTelemetry) {
                updateInspectionPanel(c.id, currentTelemetry);
            }
        });
    });

    function updateInspectionPanel(id, data) {
        const insName = document.getElementById("ins-comp-name");
        const insStatus = document.getElementById("ins-comp-status");
        const insValue = document.getElementById("ins-comp-value");
        const askBtn = document.getElementById("ins-ask-btn");
        if (!insName || !insStatus || !insValue || !askBtn) return;
        
        askBtn.style.display = "block";
        insStatus.className = "ins-val"; // reset classes
        
        if (id === "comp-cooling-fan") {
            insName.textContent = "COOLING FAN";
            insStatus.textContent = data.fan;
            insStatus.classList.add("text-green");
            insValue.textContent = data.rpm + " RPM";
            askBtn.onclick = () => autoFill("Is the cooling fan operating correctly?");
        } else if (id === "comp-temp-sensor") {
            insName.textContent = "TEMPERATURE SENSOR";
            insStatus.textContent = (data.temperature > 80) ? "ALERT" : "NORMAL";
            insStatus.classList.add((data.temperature > 80) ? "text-amber" : "text-green");
            insValue.textContent = data.temperature + " °C";
            askBtn.onclick = () => autoFill("What is causing the high temperature reading?");
        } else if (id === "comp-coolant-sys") {
            insName.textContent = "COOLANT SYSTEM";
            insStatus.textContent = "NORMAL";
            insStatus.classList.add("text-green");
            insValue.textContent = data.coolant + " %";
            askBtn.onclick = () => autoFill("Is the coolant level sufficient?");
        } else if (id === "comp-pressure-sys") {
            insName.textContent = "PRESSURE SYSTEM";
            insStatus.textContent = "NORMAL";
            insStatus.classList.add("text-green");
            insValue.textContent = data.pressure + " bar";
            askBtn.onclick = () => autoFill("Is the pressure system operating normally?");
        } else if (id === "comp-main-unit") {
            insName.textContent = "MAIN UNIT";
            insStatus.textContent = "ACTIVE";
            insStatus.classList.add("text-cyan");
            insValue.textContent = "VIB " + data.vibration;
            askBtn.onclick = () => autoFill("What is the overall condition of Machine 101?");
        }
    }

    function autoFill(text) {
        if (question) {
            question.value = text;
            question.focus();
        }
    }

    // ----------------------------------------------------
    // LOGS & TIMELINES
    // ----------------------------------------------------
    function addActivityLog(desc) {
        const activityLog = document.getElementById("activityLog");
        if (!activityLog) return;
        const time = new Date().toLocaleTimeString('en-US', { hour12: false, hour: "numeric", minute: "numeric", second: "numeric" });
        const item = document.createElement("div");
        item.className = "activity-item";
        item.innerHTML = `<div class="act-time">${time}</div><div class="act-desc">${escapeHTML(desc)}</div>`;
        activityLog.prepend(item);
    }

    function addTimelineEvent(tag, desc, stateClass) {
        const time = new Date().toLocaleTimeString('en-US', { hour12: false, hour: "numeric", minute: "numeric", second: "numeric" });
        const eventTimeline = document.getElementById("eventTimeline");
        if (!eventTimeline) return;
        const item = document.createElement("div");
        item.className = `tl-event ${stateClass}`;
        item.innerHTML = `
            <div class="tl-time">${time}</div>
            <div class="tl-content">
                <span class="tl-tag">${escapeHTML(tag)}</span>
                <div class="tl-desc">${escapeHTML(desc)}</div>
            </div>
        `;
        eventTimeline.prepend(item);
    }

    // ----------------------------------------------------
    // INVESTIGATION PIPELINE
    // ----------------------------------------------------
    if (investigateBtn) {
        investigateBtn.addEventListener("click", async function () {
            const text = question.value.trim();
            if (!text) {
                alert("Please enter a question");
                return;
            }

            addActivityLog("Investigation started");
            addTimelineEvent("AI INVESTIGATION", "Investigation started", "tl-state-investigation");

            const aiResult = document.getElementById("aiResult");
            if(aiResult) aiResult.classList.add("hidden");
            
            const repCont = document.getElementById("incidentReportContainer");
            if(repCont) repCont.classList.add("hidden");

            document.querySelectorAll('.pipe-node').forEach(n => {
                n.classList.remove('active', 'running', 'skipped');
                const st = n.querySelector('.node-status');
                if(st) st.textContent = 'WAITING';
            });
            document.querySelectorAll('.pipe-connector').forEach(l => l.classList.remove('active'));

            investigateBtn.disabled = true;
            const btnText = investigateBtn.querySelector('.btn-text');
            if(btnText) btnText.textContent = 'PROCESSING...';
            
            const pipelineSteps = [
                { id: 'node-agent', status: 'ANALYZING', time: 0 },
                { id: 'node-manual', status: 'SEARCHING', time: 1000 },
                { id: 'node-vision', status: 'ANALYZING', time: 2000 },
                { id: 'node-fusion', status: 'SYNTHESIZING', time: 3000 }
            ];

            let timeouts = [];
            pipelineSteps.forEach((step, index) => {
                timeouts.push(setTimeout(() => {
                    const node = document.getElementById(step.id);
                    if(node) {
                        node.classList.add('active', 'running');
                        const st = node.querySelector('.node-status');
                        if(st) st.textContent = step.status;
                    }
                    if (index > 0) {
                        const conn = document.getElementById('conn-' + index);
                        if (conn) conn.classList.add('active');
                    }
                }, step.time));
            });

            try {
                const response = await fetch("http://127.0.0.1:8000/investigate", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ 
                        question: text,
                        telemetry: currentTelemetry 
                    })
                });

                if (!response.ok) {
                    throw new Error("Backend returned HTTP " + response.status);
                }

                const data = await response.json();
                timeouts.forEach(clearTimeout);

                document.querySelectorAll('.pipe-node').forEach(n => n.classList.remove('running', 'active', 'skipped'));
                document.querySelectorAll('.pipe-connector').forEach(l => l.classList.remove('active'));

                const dec = data.decision || "UNKNOWN";

                const nodeAgent = document.getElementById('node-agent');
                if(nodeAgent) {
                    nodeAgent.classList.add('active');
                    nodeAgent.querySelector('.node-status').textContent = 'COMPLETED';
                }
                const conn1 = document.getElementById('conn-1');
                if(conn1) conn1.classList.add('active');

                const nodeManual = document.getElementById('node-manual');
                const conn2 = document.getElementById('conn-2');
                if (dec === 'MANUAL_SEARCH' || dec === 'BOTH') {
                    if(nodeManual) {
                        nodeManual.classList.add('active');
                        nodeManual.querySelector('.node-status').textContent = 'COMPLETED';
                    }
                    if(conn2) conn2.classList.add('active');
                } else {
                    if(nodeManual) {
                        nodeManual.classList.add('skipped');
                        nodeManual.querySelector('.node-status').textContent = 'NOT USED';
                    }
                }

                const nodeVision = document.getElementById('node-vision');
                const conn3 = document.getElementById('conn-3');
                if (dec === 'IMAGE_ANALYSIS' || dec === 'BOTH') {
                    if(nodeVision) {
                        nodeVision.classList.add('active');
                        nodeVision.querySelector('.node-status').textContent = 'COMPLETED';
                    }
                    if(conn3) conn3.classList.add('active');
                } else {
                    if(nodeVision) {
                        nodeVision.classList.add('skipped');
                        nodeVision.querySelector('.node-status').textContent = 'NOT USED';
                    }
                }

                const nodeFusion = document.getElementById('node-fusion');
                if(nodeFusion) {
                    nodeFusion.classList.add('active');
                    nodeFusion.querySelector('.node-status').textContent = 'COMPLETED';
                }

                addActivityLog("Investigation completed");
                addTimelineEvent("AI INVESTIGATION", "Investigation completed", "tl-state-investigation");
                
                addHistory(text, data);
                renderAiResult(text, data, currentTelemetry);

            } catch (error) {
                timeouts.forEach(clearTimeout);
                addActivityLog("Investigation failed");
                addTimelineEvent("AI INVESTIGATION", "Investigation failed", "tl-state-critical");
                
                if (aiResult) {
                    aiResult.innerHTML = `
                        <div class="result-header">
                            <h3 class="text-red">SYSTEM ERROR</h3>
                        </div>
                        <div class="markdown-body text-red">
                            Failed to connect to the backend API.<br>
                            ${escapeHTML(error.message)}
                        </div>
                    `;
                    aiResult.classList.remove("hidden");
                }
                
            } finally {
                investigateBtn.disabled = false;
                if(btnText) btnText.textContent = 'RUN INVESTIGATION';
            }
        });
    }

    // ----------------------------------------------------
    // RENDERING
    // ----------------------------------------------------
    function escapeHTML(value) {
        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function formatAnswer(text) {
        let html = escapeHTML(text);
        html = html.replace(/^#### (.*)$/gm, '<h3 class="text-cyan mt-4">$1</h3>');
        html = html.replace(/^### (.*)$/gm, '<h3 class="text-cyan mt-4">$1</h3>');
        html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        html = html.replace(/^- (.*)$/gm, '<ul><li>$1</li></ul>');
        html = html.replace(/<\/ul>\n<ul>/g, ''); 
        html = html.replace(/<\/ul>\n<br>\n<ul>/g, ''); 
        html = html.replace(/^(\d+)\. (.*)$/gm, '<div class="ordered-list"><span class="list-num">$1.</span> $2</div>');
        html = html.replace(/\n\n/g, "<br><br>");
        return html;
    }

    function addHistory(questionText, data) {
        investigationHistory.push({ q: questionText, d: data });
        renderHistory();
    }

    function renderHistory() {
        const historyList = document.getElementById('historyList');
        if (!historyList) return;
        historyList.innerHTML = '';
        if (investigationHistory.length === 0) {
            historyList.innerHTML = '<div class="history-empty">No previous investigations</div>';
            return;
        }
        [...investigationHistory].reverse().forEach((item, index) => {
            const div = document.createElement('div');
            div.className = 'history-item';
            const title = escapeHTML(item.q.length > 40 ? item.q.substring(0, 40) + '...' : item.q);
            div.innerHTML = `<div class="history-q">${title}</div><div class="history-a">Agent: ${item.d.decision}</div>`;
            div.onclick = () => {
                const telToPass = item.d.telemetry || currentTelemetry; 
                renderAiResult(item.q, item.d, telToPass, true);
            };
            historyList.appendChild(div);
        });
    }

    function renderAiResult(text, data, tel, fromHistory = false) {
        const aiResult = document.getElementById("aiResult");
        if (!aiResult) return;
        
        let manualHtml = `<div class="ee-card empty"><div class="ee-card-title">MANUAL EVIDENCE</div><div class="ee-card-status">NOT USED</div></div>`;
        if (data.decision === "MANUAL_SEARCH" || data.decision === "BOTH") {
            manualHtml = `<div class="ee-card"><div class="ee-card-title">MANUAL EVIDENCE</div><div class="ee-card-status text-green">RETRIEVED</div><div class="ee-card-desc">Machine manual queried via ChromaDB vector search.</div></div>`;
        }

        let visionHtml = `<div class="ee-card empty"><div class="ee-card-title">VISION EVIDENCE</div><div class="ee-card-status">NOT USED</div></div>`;
        if (data.decision === "IMAGE_ANALYSIS" || data.decision === "BOTH") {
            visionHtml = `<div class="ee-card"><div class="ee-card-title">VISION EVIDENCE</div><div class="ee-card-status text-green">ANALYZED</div><div class="ee-card-desc">Image processed by Qwen2.5-VL vision model.</div></div>`;
        }

        let telHtml = `<div class="ee-card"><div class="ee-card-title">MACHINE TELEMETRY</div><div class="ee-card-status text-cyan">INCLUDED</div><div class="ee-card-desc">Real-time state passed to reasoning engine.</div></div>`;

        const taskType = data.task_type || "DOCUMENT_ANALYSIS";
        const selectedModel = data.selected_model || "qwen2.5:7b (Local)";
        const targetRole = data.target_role || "REASONING_MODEL";
        const execution = data.execution || "LOCAL";
        const fallbackApplied = data.model_routing && data.model_routing.fallback_applied;
        const fallbackReason = data.model_routing && data.model_routing.fallback_reason;

        let routerHtml = `
            <div class="router-banner">
                <div class="router-item">
                    <span class="router-label">TASK CLASSIFICATION</span>
                    <span class="router-val">${escapeHTML(taskType)}</span>
                </div>
                <div class="router-item">
                    <span class="router-label">MODEL ROLE & SELECTION</span>
                    <span class="router-val highlight">${escapeHTML(selectedModel)}</span>
                    <span style="font-size:10px; color:var(--text-secondary); font-family:var(--font-mono);">Role: ${escapeHTML(targetRole)}</span>
                </div>
                <div class="router-item">
                    <span class="router-label">EXECUTION TOPOLOGY</span>
                    <span class="router-val badge">AIR-GAPPED ${escapeHTML(execution)}</span>
                </div>
                ${fallbackApplied && fallbackReason ? `<div class="router-fallback-note">⚠️ ${escapeHTML(fallbackReason)}</div>` : ''}
            </div>
        `;

        let planHtml = '';
        if (data.plan && Array.isArray(data.plan) && data.plan.length > 0) {
            let itemsHtml = data.plan.map(step => {
                return `
                    <div class="plan-item">
                        <span class="plan-step-num">${step.step}</span>
                        <div class="plan-step-content">
                            <div class="plan-step-action">${escapeHTML(step.action)}</div>
                            <div class="plan-step-meta">
                                <span>Tool: <span class="plan-step-tool">${escapeHTML(step.tool)}</span></span>
                                <span>Status: <span class="plan-step-status">COMPLETED</span></span>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');

            planHtml = `
                <div class="plan-container">
                    <div class="plan-header-row">
                        <span class="plan-header-title">MULTI-STEP AGENT EXECUTION PLAN</span>
                        <span style="font-size:11px; font-family:var(--font-mono); color:var(--text-secondary);">${data.plan.length} STEPS EXECUTED</span>
                    </div>
                    <div class="plan-list">
                        ${itemsHtml}
                    </div>
                </div>
            `;
        }

        let verifyHtml = '';
        if (data.verification && data.verification.checks && data.verification.checks.length > 0) {
            let checksHtml = data.verification.checks.map(c => `
                <div class="verify-item">
                    <span class="verify-icon">✓</span>
                    <span><strong>${escapeHTML(c.check || c.rule)}</strong>: ${escapeHTML(c.result || 'Verified')}</span>
                </div>
            `).join('');

            verifyHtml = `
                <div class="verify-box">
                    <div class="verify-title">
                        <span>🛡️ SOVEREIGN INTEGRITY AUDIT TRAIL (AIR-GAP VERIFIED)</span>
                    </div>
                    ${checksHtml}
                </div>
            `;
        }

        let deliverablesHtml = '';
        if (data.deliverables && Array.isArray(data.deliverables) && data.deliverables.length > 0) {
            let btns = data.deliverables.map(d => {
                const icon = d.type === 'DOCX' ? '📄' : (d.type === 'XLSX' ? '📊' : '📁');
                return `
                    <a href="http://127.0.0.1:8000/deliverables/${encodeURIComponent(d.filename)}" class="btn-deliverable" download>
                        <span>${icon}</span>
                        <span>DOWNLOAD ${escapeHTML(d.type)} (${escapeHTML(d.filename)})</span>
                    </a>
                `;
            }).join('');

            deliverablesHtml = `
                <div class="deliverables-box">
                    <div class="deliverables-title">GENERATED AUDIT DELIVERABLES</div>
                    <div class="deliverables-grid">
                        ${btns}
                    </div>
                </div>
            `;
        }

        let knowledgeEvidenceHtml = '';
        if (data.knowledge_evidence && Array.isArray(data.knowledge_evidence) && data.knowledge_evidence.length > 0) {
            let cards = data.knowledge_evidence.map(item => `
                <div class="knowledge-evidence-card">
                    <div class="ke-header">
                        <div class="ke-source">
                            <span class="ke-label">Source:</span>
                            <span class="ke-val">${escapeHTML(item.source)}</span>
                        </div>
                        <div class="ke-meta">
                            <span class="ke-page">Page: <strong>${item.page}</strong></span>
                            <span class="ke-match">${escapeHTML(item.similarity_percent || 'Verified')}</span>
                        </div>
                    </div>
                    <div class="ke-body">
                        <span class="ke-evidence-label">Relevant evidence:</span>
                        <div class="ke-evidence-text">${escapeHTML(item.relevant_evidence)}</div>
                    </div>
                </div>
            `).join('');

            knowledgeEvidenceHtml = `
                <div class="ee-title" style="margin-top:20px;">ORGANIZATIONAL KNOWLEDGE EVIDENCE</div>
                <div class="knowledge-evidence-grid">
                    ${cards}
                </div>
            `;
        }

        aiResult.innerHTML = `
            <div class="result-header">
                <h3>AI INVESTIGATION RESULT</h3>
                <div class="result-status">
                    <span class="status-dot green"></span> COMPLETED
                </div>
            </div>

            ${routerHtml}
            ${planHtml}

            <div class="ee-title">EVIDENCE EXPLORER</div>
            <div class="ee-grid">
                ${manualHtml}
                ${visionHtml}
                ${telHtml}
            </div>

            ${knowledgeEvidenceHtml}

            <div class="assessment-title">AI ASSESSMENT</div>
            <div class="markdown-body">
                ${formatAnswer(data.answer || "No assessment generated.")}
            </div>

            ${verifyHtml}
            ${deliverablesHtml}
            
            <div style="margin-top: 30px; display: flex; justify-content: flex-end; border-top: 1px solid var(--border-color); padding-top: 15px;">
                <button id="btn-generate-report" class="btn-small">GENERATE INCIDENT REPORT</button>
            </div>
        `;
        
        aiResult.classList.remove("hidden");
        if (!fromHistory) {
            aiResult.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }

        const genRepBtn = document.getElementById('btn-generate-report');
        if(genRepBtn) {
            genRepBtn.addEventListener('click', () => {
                generateIncidentReport(data, tel, text);
            });
        }
    }

    // ----------------------------------------------------
    // INCIDENT REPORT
    // ----------------------------------------------------
    function generateIncidentReport(data, tel, questionText) {
        const timestamp = new Date().toLocaleString();
        let status = "NORMAL";
        let condition = "Operating normally";
        if (tel && tel.temperature > 95) {
            status = "CRITICAL";
            condition = "Temperature exceeded critical threshold.";
        } else if (tel && tel.temperature > 80) {
            status = "WARNING";
            condition = "Temperature exceeded normal operating range.";
        }

        const dataMode = (simTemp === null) ? "LIVE" : "DEMO / SIMULATED";
        
        let evidenceUsed = "Telemetry";
        if (data.decision === "MANUAL_SEARCH" || data.decision === "BOTH") evidenceUsed += ", Manual";
        if (data.decision === "IMAGE_ANALYSIS" || data.decision === "BOTH") evidenceUsed += ", Vision";

        let rootCauseAssessment = "See full AI result.";
        let recommendedAction = "See full AI result.";
        if (data.answer) {
            let assessmentMatch = data.answer.match(/#### ASSESSMENT\s*([\s\S]*?)(?=####|$)/);
            let actionMatch = data.answer.match(/#### RECOMMENDED ACTION\s*([\s\S]*?)(?=####|$)/);
            if(assessmentMatch) rootCauseAssessment = assessmentMatch[1].trim();
            if(actionMatch) recommendedAction = actionMatch[1].trim();
        }

        const reportHtml = `
            <div class="ee-grid" style="grid-template-columns: 1fr 1fr;">
                <div class="report-section">
                    <div class="report-label">MACHINE</div>
                    <div class="report-value">Machine 101</div>
                </div>
                <div class="report-section">
                    <div class="report-label">INCIDENT STATUS</div>
                    <div class="report-value ${status === 'CRITICAL' ? 'text-red' : (status === 'WARNING' ? 'text-amber' : 'text-green')}">${status}</div>
                </div>
                <div class="report-section">
                    <div class="report-label">DATA MODE</div>
                    <div class="report-value">${dataMode}</div>
                </div>
                <div class="report-section">
                    <div class="report-label">TIMESTAMP</div>
                    <div class="report-value">${timestamp}</div>
                </div>
                <div class="report-section" style="grid-column: span 2;">
                    <div class="report-label">DETECTED CONDITION</div>
                    <div class="report-value">${condition}</div>
                </div>
                <div class="report-section" style="grid-column: span 2;">
                    <div class="report-label">INVESTIGATION DECISION</div>
                    <div class="report-value">${data.decision}</div>
                </div>
                <div class="report-section" style="grid-column: span 2;">
                    <div class="report-label">EVIDENCE USED</div>
                    <div class="report-value">${evidenceUsed}</div>
                </div>
            </div>
            
            <div class="report-section mt-4">
                <div class="report-label">TELEMETRY SNAPSHOT</div>
                <div class="report-text-block" style="font-family: var(--font-mono); font-size: 12px; display: grid; grid-template-columns: 1fr 1fr; gap: 5px;">
                    <div>Temp: ${tel ? tel.temperature : 'N/A'}°C</div>
                    <div>RPM: ${tel ? tel.rpm : 'N/A'}</div>
                    <div>Pressure: ${tel ? tel.pressure : 'N/A'} bar</div>
                    <div>Coolant: ${tel ? tel.coolant : 'N/A'}%</div>
                    <div>Vibration: ${tel ? tel.vibration : 'N/A'}</div>
                    <div>Fan: ${tel ? tel.fan : 'N/A'}</div>
                </div>
            </div>
            <div class="report-section">
                <div class="report-label">ROOT CAUSE ASSESSMENT</div>
                <div class="report-text-block">${escapeHTML(rootCauseAssessment)}</div>
            </div>
            <div class="report-section">
                <div class="report-label">RECOMMENDED ACTION</div>
                <div class="report-text-block">${escapeHTML(recommendedAction)}</div>
            </div>
        `;

        currentIncidentReportData = {
            machine: "Machine 101",
            status: status,
            dataMode: dataMode,
            timestamp: timestamp,
            condition: condition,
            decision: data.decision,
            evidenceUsed: evidenceUsed,
            telemetry: tel || {},
            rootCauseAssessment: rootCauseAssessment,
            recommendedAction: recommendedAction
        };

        const container = document.getElementById("incidentReportContainer");
        const content = document.getElementById("incidentReportContent");
        if(container && content) {
            content.innerHTML = reportHtml;
            container.classList.remove("hidden");
            container.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        
        addTimelineEvent("REPORT", "Incident report generated", "tl-state-maintenance");
    }

    const exportBtn = document.getElementById("btn-export-report");
    if(exportBtn) {
        exportBtn.addEventListener("click", () => {
            if (!currentIncidentReportData) return;
            
            let textContent = `INCIDENT REPORT\n`;
            textContent += `====================================\n`;
            textContent += `Machine: ${currentIncidentReportData.machine}\n`;
            textContent += `Status: ${currentIncidentReportData.status}\n`;
            textContent += `Data Mode: ${currentIncidentReportData.dataMode}\n`;
            textContent += `Timestamp: ${currentIncidentReportData.timestamp}\n\n`;
            textContent += `Detected Condition: ${currentIncidentReportData.condition}\n\n`;
            textContent += `--- TELEMETRY SNAPSHOT ---\n`;
            textContent += `Temperature: ${currentIncidentReportData.telemetry.temperature}°C\n`;
            textContent += `RPM: ${currentIncidentReportData.telemetry.rpm}\n`;
            textContent += `Pressure: ${currentIncidentReportData.telemetry.pressure} bar\n`;
            textContent += `Coolant: ${currentIncidentReportData.telemetry.coolant}%\n`;
            textContent += `Vibration: ${currentIncidentReportData.telemetry.vibration}\n`;
            textContent += `Fan: ${currentIncidentReportData.telemetry.fan}\n\n`;
            textContent += `--- INVESTIGATION ---\n`;
            textContent += `Decision: ${currentIncidentReportData.decision}\n`;
            textContent += `Evidence Used: ${currentIncidentReportData.evidenceUsed}\n\n`;
            textContent += `Root Cause Assessment:\n${currentIncidentReportData.rootCauseAssessment}\n\n`;
            textContent += `Recommended Action:\n${currentIncidentReportData.recommendedAction}\n`;

            const blob = new Blob([textContent], { type: "text/plain" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `Incident_Report_Machine_101_${Date.now()}.txt`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        });
    }

});
