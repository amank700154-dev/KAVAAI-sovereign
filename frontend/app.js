const API_BASE_URL = window.SIH_API_BASE_URL || (
    (window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost") 
    ? "http://127.0.0.1:8000" 
    : ""
);

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
    let typewriterTimer = null;

    // Initialize
    document.getElementById("activityLog").innerHTML = `<div class="activity-item"><div class="act-time">Just now</div><div class="act-desc">System initialized</div></div>`;
    setInterval(pollTelemetry, 3000);
    pollTelemetry();

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
            
            if (typewriterTimer) { clearInterval(typewriterTimer); typewriterTimer = null; }
            
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
            const res = await fetch(`${API_BASE_URL}/telemetry`);
            if (!res.ok) throw new Error("Telemetry request failed");
            let data = await res.json();
            
            if (simTemp === 85) {
                data.temperature = 85;
                data.rpm = 1240;
                data.pressure = 2.4;
                data.coolant = 68;
                data.vibration = 0.18;
                data.fan = "ACTIVE";
            } else if (simTemp !== null) {
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
            updateElement("tel-temp", "ERR");
            updateElement("tel-rpm", "ERR");
            updateElement("tel-pressure", "ERR");
            updateElement("tel-coolant", "ERR");
            updateElement("tel-vibration", "ERR");
            updateElement("tel-fan", "ERR");
            
            const circle = document.getElementById("health-progress");
            if (circle) circle.classList.add("text-muted");
            
            const healthText = document.getElementById("health-status-text");
            if (healthText) {
                healthText.textContent = "DISCONNECTED";
                healthText.className = "health-status text-muted";
            }
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
        
        updateDigitalTwin(data);
        
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

    function updateDigitalTwin(data) {
        // Temperature glow
        const mCore = document.getElementById("comp-main");
        if (mCore) {
            if (data.temperature > 95) {
                mCore.style.boxShadow = "inset 0 0 40px rgba(239, 68, 68, 0.4)";
                mCore.style.borderColor = "var(--red)";
            } else if (data.temperature > 80) {
                mCore.style.boxShadow = "inset 0 0 30px rgba(245, 158, 11, 0.4)";
                mCore.style.borderColor = "var(--amber)";
            } else {
                mCore.style.boxShadow = "inset 0 0 20px rgba(0, 217, 255, 0.2)";
                mCore.style.borderColor = "var(--blue)";
            }
        }
        
        // RPM affects Fan Speed
        const dtFan = document.getElementById("dt-fan");
        if (dtFan) {
            if (data.rpm > 0) {
                const duration = Math.max(0.1, 1240 / data.rpm);
                dtFan.style.animationDuration = duration + "s";
                dtFan.style.animationPlayState = "running";
            } else {
                dtFan.style.animationPlayState = "paused";
            }
        }

        // Pressure visual intensity
        const mPipeRight = document.querySelector(".pipe-right");
        if (mPipeRight) {
            if (data.pressure > 3.0) {
                mPipeRight.style.background = "var(--red)";
                mPipeRight.style.boxShadow = "0 0 10px var(--red)";
            } else if (data.pressure > 2.5) {
                mPipeRight.style.background = "var(--amber)";
                mPipeRight.style.boxShadow = "0 0 10px var(--amber)";
            } else {
                mPipeRight.style.background = "var(--blue)";
                mPipeRight.style.boxShadow = "none";
            }
        }
        
        // Coolant level visualization
        const mPipeLeft = document.querySelector(".pipe-left");
        if (mPipeLeft) {
            const perc = Math.min(100, Math.max(0, data.coolant));
            mPipeLeft.style.background = `linear-gradient(to top, var(--cyan) ${perc}%, var(--bg-main) ${perc}%)`;
        }

        // Vibration
        if (mCore) {
            const vib = data.vibration;
            if (vib > 0.1) {
                mCore.style.animation = `machine-vib ${Math.max(0.05, 0.5 / vib)}s linear infinite`;
                mCore.style.setProperty('--vib-x', `${vib * 2}px`);
                mCore.style.setProperty('--vib-y', `${vib * 2}px`);
            } else {
                mCore.style.animation = "none";
            }
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
            
            if (typewriterTimer) { clearInterval(typewriterTimer); typewriterTimer = null; }

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
                let data;
                try {
                    const response = await fetch(`${API_BASE_URL}/investigate`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ 
                            question: text,
                            telemetry: currentTelemetry 
                        })
                    });
                    
                    try {
                        data = await response.json();
                    } catch (e) {
                        throw new Error("Unable to parse JSON from investigation server.");
                    }

                    if (!response.ok) {
                        throw new Error(data.answer || "Backend returned HTTP " + response.status);
                    }
                } catch (fetchError) {
                    if (!data) {
                        throw new Error("Unable to connect to the investigation server.");
                    }
                    throw fetchError;
                }

                timeouts.forEach(clearTimeout);

                document.querySelectorAll('.pipe-node').forEach(n => n.classList.remove('running', 'active', 'skipped'));
                document.querySelectorAll('.pipe-connector').forEach(l => l.classList.remove('active'));

                const dec = data.decision || "UNKNOWN";
                const mStatus = data.manual_status || "NOT_USED";
                const vStatus = data.image_status || "NOT_USED";

                const nodeAgent = document.getElementById('node-agent');
                if(nodeAgent) {
                    nodeAgent.classList.add('active');
                    nodeAgent.querySelector('.node-status').textContent = 'COMPLETED';
                }
                const conn1 = document.getElementById('conn-1');
                if(conn1) conn1.classList.add('active');

                const nodeManual = document.getElementById('node-manual');
                const conn2 = document.getElementById('conn-2');
                if(nodeManual) {
                    nodeManual.querySelector('.node-status').textContent = mStatus;
                    if (mStatus === 'COMPLETED' || mStatus === 'ERROR') {
                        nodeManual.classList.add('active');
                        if (conn2) conn2.classList.add('active');
                    } else {
                        nodeManual.classList.add('skipped');
                    }
                }

                const nodeVision = document.getElementById('node-vision');
                const conn3 = document.getElementById('conn-3');
                if(nodeVision) {
                    nodeVision.querySelector('.node-status').textContent = vStatus;
                    if (vStatus === 'COMPLETED' || vStatus === 'ERROR') {
                        nodeVision.classList.add('active');
                        if (conn3) conn3.classList.add('active');
                    } else {
                        nodeVision.classList.add('skipped');
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
        
        let manualHtml = `<div class="ee-card empty"><div class="ee-card-header"><span class="ee-label">MANUAL EVIDENCE</span><span class="ee-status">NOT USED</span></div></div>`;
        const mStatus = data.manual_status || "NOT USED";
        let mContext = data.manual_context ? data.manual_context : "No manual evidence retrieved.";
        if (mContext.length > 200) mContext = mContext.substring(0, 200) + "...";
        
        if (mStatus === "COMPLETED") {
            manualHtml = `<div class="ee-card active">
                <div class="ee-card-header">
                    <span class="ee-label">MANUAL EVIDENCE</span>
                    <span class="ee-status active">COMPLETED</span>
                </div>
                <div class="ee-content">
                    <div style="font-size:10px; color:var(--text-secondary); margin-bottom:5px;">SOURCE: Machine Manual<br>RETRIEVAL: ChromaDB</div>
                    <div style="font-style:italic; padding-left:5px; border-left:2px solid var(--border-color);">${escapeHTML(mContext)}</div>
                </div>
            </div>`;
        } else if (mStatus === "ERROR") {
            manualHtml = `<div class="ee-card">
                <div class="ee-card-header">
                    <span class="ee-label">MANUAL EVIDENCE</span>
                    <span class="ee-status text-red">ERROR</span>
                </div>
                <div class="ee-content">Failed to retrieve manual evidence.</div>
            </div>`;
        } else if (mStatus === "UNAVAILABLE") {
            manualHtml = `<div class="ee-card">
                <div class="ee-card-header">
                    <span class="ee-label">MANUAL EVIDENCE</span>
                    <span class="ee-status text-amber">UNAVAILABLE</span>
                </div>
                <div class="ee-content">Manual evidence could not be retrieved.</div>
            </div>`;
        }

        let visionHtml = `<div class="ee-card empty"><div class="ee-card-header"><span class="ee-label">VISION EVIDENCE</span><span class="ee-status">NOT USED</span></div></div>`;
        const vStatus = data.image_status || "NOT USED";
        let vContext = data.vision_evidence ? data.vision_evidence : "No vision evidence retrieved.";
        if (vContext.length > 200) vContext = vContext.substring(0, 200) + "...";
        
        if (vStatus === "COMPLETED") {
            visionHtml = `<div class="ee-card active">
                <div class="ee-card-header">
                    <span class="ee-label">VISION EVIDENCE</span>
                    <span class="ee-status active">COMPLETED</span>
                </div>
                <div class="ee-content">
                    <div style="margin-bottom:8px;"><img src="../ChatGPT Image Sep 13, 2026, 01_44_35 PM.png" style="max-width:100%; height:auto; max-height:80px; border:1px solid var(--border-cyan); border-radius:4px;" onerror="this.style.display='none'"></div>
                    <div style="font-size:10px; color:var(--text-secondary); margin-bottom:5px;">SOURCE: Camera 1<br>MODEL: Qwen2.5-VL</div>
                    <div style="font-style:italic; padding-left:5px; border-left:2px solid var(--border-color);">${escapeHTML(vContext)}</div>
                </div>
            </div>`;
        } else if (vStatus === "ERROR") {
            visionHtml = `<div class="ee-card">
                <div class="ee-card-header">
                    <span class="ee-label">VISION EVIDENCE</span>
                    <span class="ee-status text-red">ERROR</span>
                </div>
                <div class="ee-content">Failed to analyze image evidence.</div>
            </div>`;
        }

        let telHtml = `<div class="ee-card active">
            <div class="ee-card-header">
                <span class="ee-label">MACHINE TELEMETRY</span>
                <span class="ee-status text-cyan">INCLUDED</span>
            </div>
            <div class="ee-content">Real-time state passed to reasoning engine.</div>
        </div>`;

        aiResult.innerHTML = `
            <div class="result-header">
                <h3>AI INVESTIGATION RESULT</h3>
                <div class="result-status">
                    <span class="status-dot green"></span> COMPLETED
                </div>
            </div>

            <div class="ee-title">EVIDENCE EXPLORER</div>
            <div class="ee-grid">
                ${manualHtml}
                ${visionHtml}
                ${telHtml}
            </div>

            <div class="assessment-title">AI ASSESSMENT</div>
            <div class="markdown-body" id="ai-assessment-body"></div>
            
            <div id="report-btn-container" style="display: none; margin-top: 30px; justify-content: flex-end; border-top: 1px solid var(--border-color); padding-top: 15px;">
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

        const rawHtml = formatAnswer(data.answer || "No assessment generated.");
        const mb = document.getElementById("ai-assessment-body");
        const rbc = document.getElementById("report-btn-container");
        const statusIndicator = aiResult.querySelector('.result-status');

        if (fromHistory || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            mb.innerHTML = rawHtml;
            rbc.style.display = "flex";
        } else {
            statusIndicator.innerHTML = `<span class="status-dot amber"></span> GENERATING ASSESSMENT...`;
            if (typewriterTimer) { clearInterval(typewriterTimer); typewriterTimer = null; }
            
            const hiddenDiv = document.createElement("div");
            hiddenDiv.innerHTML = rawHtml;
            const nodesToReveal = [];
            
            function walk(node, parent) {
                if (node.nodeType === Node.TEXT_NODE) {
                    const text = node.textContent;
                    for (let i = 0; i < text.length; i++) {
                        nodesToReveal.push({ parent: parent, char: text[i] });
                    }
                } else if (node.nodeType === Node.ELEMENT_NODE) {
                    const clone = node.cloneNode(false);
                    parent.appendChild(clone);
                    for (let i = 0; i < node.childNodes.length; i++) {
                        walk(node.childNodes[i], clone);
                    }
                }
            }
            
            mb.innerHTML = "";
            walk(hiddenDiv, mb);
            
            let currentIndex = 0;
            typewriterTimer = setInterval(() => {
                for (let step = 0; step < 2; step++) {
                    if (currentIndex < nodesToReveal.length) {
                        const item = nodesToReveal[currentIndex];
                        item.parent.appendChild(document.createTextNode(item.char));
                        currentIndex++;
                    }
                }
                
                if (currentIndex >= nodesToReveal.length) {
                    clearInterval(typewriterTimer);
                    typewriterTimer = null;
                    rbc.style.display = "flex";
                    statusIndicator.innerHTML = `<span class="status-dot green"></span> COMPLETED`;
                }
            }, 20);
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
            recommendedAction: recommendedAction,
            manualContext: data.manual_context,
            visionEvidence: data.vision_evidence
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
            
            const htmlContent = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Incident Report - Machine 101</title>
    <style>
        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #333; line-height: 1.6; padding: 40px; max-width: 800px; margin: 0 auto; background: #f8f9fa; }
        .report-header { border-bottom: 3px solid #2a52be; padding-bottom: 20px; margin-bottom: 30px; }
        h1 { font-size: 24px; color: #1a1a1a; margin: 0 0 5px 0; text-transform: uppercase; letter-spacing: 1px; }
        .subtitle { font-size: 14px; color: #666; letter-spacing: 2px; }
        .badge { display: inline-block; padding: 5px 10px; border-radius: 4px; font-weight: bold; font-size: 12px; letter-spacing: 1px; }
        .badge-live { background: #d1fae5; color: #065f46; border: 1px solid #34d399; }
        .badge-demo { background: #fee2e2; color: #991b1b; border: 1px solid #f87171; }
        .badge-critical { background: #fee2e2; color: #991b1b; }
        .badge-warning { background: #fef3c7; color: #92400e; }
        .badge-normal { background: #d1fae5; color: #065f46; }
        @media (max-width: 1200px) {
            .monitoring-grid { grid-template-columns: 1fr; }
            .center-panel { min-height: 400px; }
            .inv-console { flex-direction: column; }
            button { width: 100%; height: 50px; }
            .evidence-overview { grid-template-columns: 1fr; }
            .maintenance-grid { grid-template-columns: 1fr; }
            .inv-layout-grid { grid-template-columns: 1fr; }
        }

        @media (max-width: 768px) {
            .ee-grid { grid-template-columns: 1fr; }
            .pipeline-container { flex-direction: column; align-items: stretch; gap: 10px; }
            .pipe-node { flex-direction: row; justify-content: flex-start; padding: 5px 20px; }
            .pipe-node .node-label { flex: 1; text-align: left; padding-left: 15px; }
            .pipe-connector { width: 2px; height: 30px; margin: 0 0 0 35px; flex: none; }
        }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
        .box { background: #fff; padding: 15px; border: 1px solid #e5e7eb; border-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
        .box-title { font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 5px; }
        .box-val { font-size: 15px; font-weight: bold; color: #111827; }
        .section { background: #fff; padding: 25px; border: 1px solid #e5e7eb; border-radius: 4px; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
        .section-title { font-size: 14px; color: #2a52be; text-transform: uppercase; letter-spacing: 1px; border-bottom: 1px solid #e5e7eb; padding-bottom: 10px; margin-top: 0; margin-bottom: 15px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
        th, td { text-align: left; padding: 8px; border-bottom: 1px solid #e5e7eb; font-size: 13px; }
        th { color: #6b7280; font-weight: normal; }
        td { font-weight: bold; color: #111827; }
        .pre-wrap { white-space: pre-wrap; font-size: 13px; color: #374151; background: #f9fafb; padding: 15px; border: 1px solid #e5e7eb; border-radius: 4px; border-left: 4px solid #2a52be; overflow-wrap: break-word;}
    </style>
</head>
<body>
    <div class="report-header">
        <h1>MACHINE 101 <span style="float:right;">INDUSTRIAL INCIDENT REPORT</span></h1>
        <div class="subtitle">Generated At: ${currentIncidentReportData.timestamp}</div>
    </div>
    
    <div class="grid">
        <div class="box">
            <div class="box-title">Data Source</div>
            <div class="box-val"><span class="badge ${currentIncidentReportData.dataMode.includes('LIVE') ? 'badge-live' : 'badge-demo'}">${currentIncidentReportData.dataMode}</span></div>
        </div>
        <div class="box">
            <div class="box-title">Incident Status</div>
            <div class="box-val"><span class="badge ${currentIncidentReportData.status === 'CRITICAL' ? 'badge-critical' : (currentIncidentReportData.status === 'WARNING' ? 'badge-warning' : 'badge-normal')}">${currentIncidentReportData.status}</span></div>
        </div>
        <div class="box" style="grid-column: span 2;">
            <div class="box-title">Detected Condition</div>
            <div class="box-val">${currentIncidentReportData.condition}</div>
        </div>
    </div>
    
    <div class="section">
        <h2 class="section-title">MACHINE TELEMETRY SNAPSHOT</h2>
        <table>
            <tr><th>Temperature</th><td>${currentIncidentReportData.telemetry.temperature}°C</td><th>Coolant</th><td>${currentIncidentReportData.telemetry.coolant}%</td></tr>
            <tr><th>RPM</th><td>${currentIncidentReportData.telemetry.rpm}</td><th>Vibration</th><td>${currentIncidentReportData.telemetry.vibration}</td></tr>
            <tr><th>Pressure</th><td>${currentIncidentReportData.telemetry.pressure} bar</td><th>Fan State</th><td>${currentIncidentReportData.telemetry.fan}</td></tr>
        </table>
    </div>

    <div class="section">
        <h2 class="section-title">INVESTIGATION OVERVIEW</h2>
        <div style="margin-bottom: 10px;"><span class="box-title">AGENT DECISION:</span> <strong>${currentIncidentReportData.decision}</strong></div>
        <div style="margin-bottom: 10px;"><span class="box-title">EVIDENCE SOURCES:</span> <strong>${currentIncidentReportData.evidenceUsed}</strong></div>
        
        <h3 style="font-size: 13px; color: #6b7280; text-transform: uppercase; margin-top: 20px;">Manual Evidence</h3>
        <div class="pre-wrap" style="border-left-color: #10b981;">${currentIncidentReportData.manualContext ? escapeHTML(currentIncidentReportData.manualContext) : 'Not available from current investigation.'}</div>
        
        <h3 style="font-size: 13px; color: #6b7280; text-transform: uppercase; margin-top: 20px;">Vision Evidence</h3>
        <div class="pre-wrap" style="border-left-color: #8b5cf6;">${currentIncidentReportData.visionEvidence ? escapeHTML(currentIncidentReportData.visionEvidence) : 'Not available from current investigation.'}</div>
    </div>

    <div class="section">
        <h2 class="section-title">AI ASSESSMENT</h2>
        <div class="pre-wrap">${escapeHTML(currentIncidentReportData.rootCauseAssessment)}</div>
    </div>

    <div class="section">
        <h2 class="section-title">RECOMMENDED ACTION</h2>
        <div class="pre-wrap" style="background: #eff6ff; border-color: #bfdbfe; border-left-color: #3b82f6;">${escapeHTML(currentIncidentReportData.recommendedAction)}</div>
    </div>
    
    <div style="text-align: center; color: #9ca3af; font-size: 12px; margin-top: 40px; border-top: 1px solid #e5e7eb; padding-top: 20px;">
        End of Report
    </div>
</body>
</html>`;

            const blob = new Blob([htmlContent], { type: "text/html" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `Incident_Report_Machine_101_${Date.now()}.html`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        });
    }

});
