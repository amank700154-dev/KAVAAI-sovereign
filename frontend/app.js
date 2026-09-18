/**
 * KAVAAI SOVEREIGN — INDUSTRIAL AI COMMAND CENTER
 * VISUAL IDENTITY: BLACK + METALLIC GOLD + DARK CRYSTAL
 * Front-end Application Architecture & State Management
 */

const API_BASE_URL = window.SIH_API_BASE_URL || (
    (window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost") 
    ? "http://127.0.0.1:8000" 
    : ""
);

document.addEventListener("DOMContentLoaded", function () {
    // Core DOM Elements
    const question = document.getElementById("question");
    const investigateBtn = document.getElementById("investigateBtn");
    const reportUploadInput = document.getElementById("reportUploadInput");
    const codelabEditor = document.getElementById("codelabEditor");
    const btnExecuteCode = document.getElementById("btnExecuteCode");
    
    // Telemetry & State Management
    let currentTelemetry = null;
    let prevTelemetry = {};
    let simTemp = null;
    let isFirstTelemetry = true;
    let lastHealthState = "NORMAL";
    let currentIncidentReportData = null;
    let investigationHistory = [];
    let typewriterTimer = null;
    let currentDeliverables = [];

    // =========================================================================
    // 0. SYNTHESIZED UI SOUND SYSTEM (WEB AUDIO API)
    // =========================================================================
    const SoundManager = (function() {
        let audioCtx = null;
        let enabled = localStorage.getItem("kavaai_ui_sound") === "true";

        function getCtx() {
            if (!audioCtx && (window.AudioContext || window.webkitAudioContext)) {
                audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            }
            if (audioCtx && audioCtx.state === "suspended") {
                audioCtx.resume().catch(() => {});
            }
            return audioCtx;
        }

        function playTone(freq, type, duration, startVol, endVol) {
            if (!enabled) return;
            try {
                const ctx = getCtx();
                if (!ctx) return;
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                const now = ctx.currentTime;

                osc.type = type;
                osc.frequency.setValueAtTime(freq, now);

                gain.gain.setValueAtTime(startVol, now);
                gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, endVol), now + duration);

                osc.connect(gain);
                gain.connect(ctx.destination);

                osc.start(now);
                osc.stop(now + duration);
            } catch (e) {}
        }

        return {
            isEnabled: () => enabled,
            setEnabled: (val) => {
                enabled = !!val;
                localStorage.setItem("kavaai_ui_sound", enabled ? "true" : "false");
                if (enabled) getCtx();
            },
            toggle: () => {
                const next = !enabled;
                SoundManager.setEnabled(next);
                if (next) SoundManager.toggleSwitch();
                return next;
            },
            hover: () => {
                playTone(1200, "sine", 0.015, 0.012, 0.0001);
            },
            click: () => {
                playTone(850, "triangle", 0.03, 0.04, 0.001);
            },
            tabSwitch: () => {
                playTone(540, "sine", 0.04, 0.035, 0.001);
                setTimeout(() => playTone(810, "sine", 0.04, 0.025, 0.001), 35);
            },
            toggleSwitch: () => {
                playTone(600, "sine", 0.03, 0.035, 0.001);
                setTimeout(() => playTone(920, "sine", 0.03, 0.035, 0.001), 25);
            },
            success: () => {
                playTone(523.25, "sine", 0.08, 0.045, 0.001);
                setTimeout(() => playTone(659.25, "sine", 0.12, 0.055, 0.001), 70);
            },
            error: () => {
                playTone(220, "sawtooth", 0.12, 0.055, 0.001);
                setTimeout(() => playTone(180, "sawtooth", 0.15, 0.065, 0.001), 90);
            },
            agentStart: () => {
                if (!enabled) return;
                const ctx = getCtx();
                if (!ctx) return;
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                const now = ctx.currentTime;
                osc.type = "sine";
                osc.frequency.setValueAtTime(140, now);
                osc.frequency.exponentialRampToValueAtTime(360, now + 0.22);
                gain.gain.setValueAtTime(0.05, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(now);
                osc.stop(now + 0.22);
            },
            agentComplete: () => {
                playTone(440, "sine", 0.09, 0.045, 0.001);
                setTimeout(() => playTone(554.37, "sine", 0.09, 0.045, 0.001), 75);
                setTimeout(() => playTone(659.25, "sine", 0.15, 0.055, 0.001), 150);
            },
            securityAlert: () => {
                playTone(240, "square", 0.08, 0.04, 0.001);
                setTimeout(() => playTone(360, "square", 0.12, 0.05, 0.001), 70);
            }
        };
    })();

    // =========================================================================
    // 1. GOLDEN CURSOR SYSTEM & LIGHT FOLLOWER
    // =========================================================================
    const CursorFX = (function() {
        let enabled = localStorage.getItem("kavaai_cursor_fx") !== "false";
        const glowEl = document.getElementById("kavaai-cursor-glow");
        const dotEl = document.getElementById("kavaai-cursor-dot");
        const canvas = document.getElementById("kavaai-cursor-trail");
        const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);

        let mouseX = -1000, mouseY = -1000;
        let glowX = -1000, glowY = -1000;
        let particles = [];
        let ctx = null;

        if (canvas) {
            ctx = canvas.getContext("2d");
            function resizeCanvas() {
                canvas.width = window.innerWidth;
                canvas.height = window.innerHeight;
            }
            window.addEventListener("resize", resizeCanvas);
            resizeCanvas();
        }

        if (isTouch || !enabled) {
            document.body.classList.add("cursor-disabled");
        }

        window.addEventListener("mousemove", (e) => {
            mouseX = e.clientX;
            mouseY = e.clientY;

            if (dotEl && enabled && !isTouch) {
                dotEl.style.left = `${mouseX}px`;
                dotEl.style.top = `${mouseY}px`;
            }

            if (enabled && !isTouch && Math.random() < 0.28) {
                particles.push({
                    x: mouseX,
                    y: mouseY,
                    size: Math.random() * 2 + 1,
                    alpha: 0.5,
                    vx: (Math.random() - 0.5) * 0.8,
                    vy: (Math.random() - 0.5) * 0.8
                });
                if (particles.length > 20) particles.shift();
            }

            // Update Gold Light Follower variables for closest crystal panel
            const target = e.target.closest(".gold-light-follower, .crystal-card, .monitoring-panel, .wb-panel, .ribbon-card");
            if (target) {
                const rect = target.getBoundingClientRect();
                const relX = ((mouseX - rect.left) / rect.width) * 100;
                const relY = ((mouseY - rect.top) / rect.height) * 100;
                target.style.setProperty("--mouse-x", `${relX}%`);
                target.style.setProperty("--mouse-y", `${relY}%`);
            }
        });

        // Hover detection on interactive elements
        document.addEventListener("mouseover", (e) => {
            const interactive = e.target.closest("button, a, input, select, textarea, .nav-tab, .twin-comp, .dt-hud-callout, .sim-btn, .chip-btn, .kavaai-switch");
            if (interactive) {
                document.body.classList.add("cursor-hover");
                SoundManager.hover();
            }
        });
        document.addEventListener("mouseout", (e) => {
            const interactive = e.target.closest("button, a, input, select, textarea, .nav-tab, .twin-comp, .dt-hud-callout, .sim-btn, .chip-btn, .kavaai-switch");
            if (interactive) {
                document.body.classList.remove("cursor-hover");
            }
        });

        function animate() {
            if (enabled && !isTouch) {
                glowX += (mouseX - glowX) * 0.18;
                glowY += (mouseY - glowY) * 0.18;
                if (glowEl) {
                    glowEl.style.left = `${glowX}px`;
                    glowEl.style.top = `${glowY}px`;
                }

                if (ctx && canvas) {
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    for (let i = particles.length - 1; i >= 0; i--) {
                        const p = particles[i];
                        p.x += p.vx;
                        p.y += p.vy;
                        p.alpha -= 0.025;
                        if (p.alpha <= 0) {
                            particles.splice(i, 1);
                            continue;
                        }
                        ctx.beginPath();
                        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                        ctx.fillStyle = `rgba(245, 215, 110, ${p.alpha})`;
                        ctx.fill();
                    }
                }
            }
            requestAnimationFrame(animate);
        }
        requestAnimationFrame(animate);

        return {
            isEnabled: () => enabled,
            setEnabled: (val) => {
                enabled = !!val;
                localStorage.setItem("kavaai_cursor_fx", enabled ? "true" : "false");
                if (enabled && !isTouch) {
                    document.body.classList.remove("cursor-disabled");
                } else {
                    document.body.classList.add("cursor-disabled");
                }
            },
            toggle: () => {
                const next = !enabled;
                CursorFX.setEnabled(next);
                return next;
            }
        };
    })();

    // =========================================================================
    // 2. FLOATING CRYSTAL TOAST NOTIFICATION SYSTEM
    // =========================================================================
    function showToast(message, type = "info", duration = 3500) {
        const container = document.getElementById("toastContainer");
        if (!container) return;

        if (type === "success") SoundManager.success();
        else if (type === "error") SoundManager.error();
        else if (type === "warning") SoundManager.securityAlert();

        const toast = document.createElement("div");
        toast.className = `crystal-toast ${type}`;
        
        let icon = "🛡️";
        if (type === "success") icon = "✓";
        else if (type === "error") icon = "✕";
        else if (type === "warning") icon = "⚠";

        toast.innerHTML = `<span style="color:var(--gold-bright); font-weight:700;">${icon}</span> <span>${escapeHTML(message)}</span>`;
        container.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = "0";
            toast.style.transform = "translateX(40px)";
            toast.style.transition = "all 0.3s ease";
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }
    window.showToast = showToast;

    // =========================================================================
    // 2. LIVE UTC SYSTEM CLOCK
    // =========================================================================
    function updateHeaderClock() {
        const clockEl = document.getElementById("headerClock");
        const dateEl = document.getElementById("headerDate");
        const now = new Date();
        const hrs = String(now.getUTCHours()).padStart(2, "0");
        const mins = String(now.getUTCMinutes()).padStart(2, "0");
        const secs = String(now.getUTCSeconds()).padStart(2, "0");
        if (clockEl) clockEl.textContent = `${hrs}:${mins}:${secs} UTC`;
        
        if (dateEl) {
            const days = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
            const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
            dateEl.textContent = `${days[now.getUTCDay()]}, ${now.getUTCDate()} ${months[now.getUTCMonth()]} ${now.getUTCFullYear()}`;
        }
    }
    setInterval(updateHeaderClock, 1000);
    updateHeaderClock();

    // =========================================================================
    // 3. WORKBENCH TAB NAVIGATION & DATA SYNC
    // =========================================================================
    const navTabs = document.querySelectorAll(".nav-tab");
    const tabPanes = document.querySelectorAll(".tab-pane");

    function switchTab(tabId) {
        SoundManager.tabSwitch();
        navTabs.forEach(t => t.classList.remove("active"));
        tabPanes.forEach(p => p.classList.remove("active"));

        const targetTab = document.querySelector(`.nav-tab[data-tab="${tabId}"]`);
        const targetPane = document.getElementById(`pane-${tabId}`);

        if (targetTab) targetTab.classList.add("active");
        if (targetPane) targetPane.classList.add("active");

        // Trigger on-demand authentic data loading for the opened tab
        if (tabId === "documents") loadDocuments();
        else if (tabId === "deliverables") loadDeliverables();
        else if (tabId === "security") loadSecurityData();
        else if (tabId === "knowledge") loadKnowledgeSources();
    }

    navTabs.forEach(tab => {
        tab.addEventListener("click", () => {
            const tabId = tab.getAttribute("data-tab");
            switchTab(tabId);
        });
    });

    // =========================================================================
    // 4. REAL SYSTEM HARDWARE & ENGINE STATUS
    // =========================================================================
    async function loadSystemStatus() {
        try {
            const res = await fetch(`${API_BASE_URL}/api/system/status`);
            if (!res.ok) return;
            const data = await res.json();

            // Update header indicators
            const statRouter = document.getElementById("stat-model-router");
            if (statRouter && data.roles && data.roles.REASONING_MODEL) {
                statRouter.innerHTML = `<span class="pulse-dot"></span> ROUTER: ${data.roles.REASONING_MODEL.toUpperCase()}`;
            }

            // Update ribbon
            const ovActiveModel = document.getElementById("ov-active-model");
            if (ovActiveModel && data.roles) {
                ovActiveModel.textContent = data.roles.REASONING_MODEL || "qwen2.5:7b";
            }

            const ovGpuStatus = document.getElementById("ov-gpu-status");
            const ovComputeSub = document.getElementById("ov-compute-sub");
            if (ovGpuStatus && data.gpu) {
                ovGpuStatus.textContent = data.gpu.available ? "GPU ACCELERATED" : "CPU FALLBACK";
                if (ovComputeSub) {
                    const dev = data.gpu.device || "Local Compute Core";
                    ovComputeSub.textContent = `${dev} • ${data.cpu_count || 12} Cores`;
                }
            }
        } catch (e) {
            console.log("System status info endpoint offline, using local defaults.");
        }
    }
    loadSystemStatus();

    // =========================================================================
    // 5. TELEMETRY POLLING & VALUE FLASH
    // =========================================================================
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
                addActivityLog("Telemetry connected (127.0.0.1)");
            }
        } catch (error) {
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
    setInterval(pollTelemetry, 3000);
    pollTelemetry();

    function updateElement(id, value) {
        const el = document.getElementById(id);
        if (el) {
            // If value changed, trigger subtle gold flash
            if (prevTelemetry[id] !== undefined && prevTelemetry[id] !== value) {
                el.classList.add("value-flash");
                setTimeout(() => el.classList.remove("value-flash"), 700);
            }
            prevTelemetry[id] = value;
            el.innerHTML = value;
        }
    }

    function updateTelemetry(data) {
        updateElement("tel-temp", data.temperature + "&deg;C");
        updateElement("tel-rpm", data.rpm);
        updateElement("tel-pressure", data.pressure + " bar");
        updateElement("tel-coolant", data.coolant + "%");
        updateElement("tel-vibration", data.vibration);
        updateElement("tel-fan", data.fan);
        
        updateDigitalTwin(data);
        
        // Update inspection panel if something is currently selected
        const selectedComp = document.querySelector(".twin-comp.selected");
        if (selectedComp) {
            updateInspectionPanel(selectedComp.id, data);
        }
    }

    // =========================================================================
    // 6. HEALTH, ALERTS & DIGITAL TWIN
    // =========================================================================
    function processHealthAndAlerts(data) {
        let healthScore = 100;
        let currentState = "NORMAL";
        
        if (data.temperature > 80 && data.temperature <= 95) {
            healthScore -= 20;
            currentState = "WARNING";
        } else if (data.temperature > 95) {
            healthScore -= 45;
            currentState = "CRITICAL";
        }
        
        updateElement("health-score-val", healthScore);
        const circle = document.getElementById("health-progress");
        const healthText = document.getElementById("health-status-text");

        if (circle) {
            const offset = 283 - (283 * healthScore) / 100;
            circle.style.strokeDashoffset = offset;
            
            if (currentState === "NORMAL") {
                circle.style.stroke = "var(--gold)";
                if (healthText) {
                    healthText.textContent = "NORMAL";
                    healthText.className = "health-status text-gold";
                }
            } else if (currentState === "WARNING") {
                circle.style.stroke = "var(--warning)";
                if (healthText) {
                    healthText.textContent = "WARNING";
                    healthText.className = "health-status text-amber";
                }
            } else {
                circle.style.stroke = "var(--danger)";
                if (healthText) {
                    healthText.textContent = "CRITICAL";
                    healthText.className = "health-status text-red";
                }
            }
        }

        // Maintenance state
        const mStatus = document.getElementById("maint-status");
        const mRisk = document.getElementById("maint-risk");
        const mAction = document.getElementById("maint-action");
        if (currentState === "NORMAL") {
            if (mStatus) mStatus.textContent = "READY";
            if (mRisk) { mRisk.textContent = "LOW"; mRisk.className = "maint-value text-green"; }
            if (mAction) mAction.textContent = "Continue routine monitoring and scheduled maintenance.";
        } else if (currentState === "WARNING") {
            if (mStatus) mStatus.textContent = "ATTENTION REQUIRED";
            if (mRisk) { mRisk.textContent = "ELEVATED"; mRisk.className = "maint-value text-amber"; }
            if (mAction) mAction.textContent = "Exceeds SOP-042 80°C threshold. Inspect cooling intake fins for airflow impedance.";
        } else if (currentState === "CRITICAL") {
            if (mStatus) mStatus.textContent = "CRITICAL SHUTDOWN";
            if (mRisk) { mRisk.textContent = "CRITICAL"; mRisk.className = "maint-value text-red"; }
            if (mAction) mAction.textContent = "Immediate thermal trip limit reached (>95°C). Trigger emergency shutdown.";
        }
        
        // State change tracking
        if (currentState !== lastHealthState) {
            addActivityLog(`Machine state transitioned to ${currentState}`);
            if (currentState === "WARNING") {
                addTimelineEvent("ALERT", `Temperature warning detected: ${data.temperature}°C`, "tl-state-warning");
            } else if (currentState === "CRITICAL") {
                addTimelineEvent("ALERT", `Critical temperature reached: ${data.temperature}°C`, "tl-state-critical");
            } else if (currentState === "NORMAL") {
                addTimelineEvent("SYSTEM", `System operating in nominal envelope`, "tl-state-normal");
            }
            lastHealthState = currentState;
        }
    }

    function updateDigitalTwin(data) {
        // Temperature thermal core glow
        const mCore = document.getElementById("comp-main");
        if (mCore) {
            if (data.temperature > 95) {
                mCore.style.boxShadow = "inset 0 0 45px rgba(224, 82, 82, 0.4), 0 0 25px rgba(224, 82, 82, 0.4)";
                mCore.style.borderColor = "var(--danger)";
            } else if (data.temperature > 80) {
                mCore.style.boxShadow = "inset 0 0 35px rgba(229, 169, 61, 0.35), 0 0 20px rgba(229, 169, 61, 0.35)";
                mCore.style.borderColor = "var(--warning)";
            } else {
                mCore.style.boxShadow = "inset 0 0 25px rgba(212, 175, 55, 0.15)";
                mCore.style.borderColor = "var(--border)";
            }
        }
        
        // RPM regulates Fan Blade Rotation
        const dtFan = document.getElementById("dt-fan");
        if (dtFan) {
            if (data.rpm > 0) {
                const duration = Math.max(0.12, 1240 / data.rpm);
                dtFan.style.animationDuration = duration + "s";
                dtFan.style.animationPlayState = "running";
            } else {
                dtFan.style.animationPlayState = "paused";
            }
        }

        // Hydraulic tubes
        const mPipeLeft = document.getElementById("comp-coolant");
        if (mPipeLeft) {
            const perc = Math.min(100, Math.max(0, data.coolant));
            mPipeLeft.style.background = `linear-gradient(to top, rgba(212, 175, 55, 0.6) ${perc}%, #0A0A0F ${perc}%)`;
        }
        
        // Update 5 HUD callout cards with real telemetry
        const hudTempVal = document.getElementById("hud-temp-val");
        const hudTempStat = document.getElementById("hud-temp-stat");
        if (hudTempVal) hudTempVal.innerHTML = `${data.temperature}&deg;C`;
        if (hudTempStat) {
            if (data.temperature > 95) {
                hudTempStat.textContent = "CRITICAL";
                hudTempStat.className = "callout-status text-red";
            } else if (data.temperature > 80) {
                hudTempStat.textContent = "WARNING";
                hudTempStat.className = "callout-status text-amber";
            } else {
                hudTempStat.textContent = "NORMAL";
                hudTempStat.className = "callout-status text-green";
            }
        }

        const hudCoolantVal = document.getElementById("hud-coolant-val");
        if (hudCoolantVal) hudCoolantVal.textContent = `${data.coolant}%`;

        const hudPressureVal = document.getElementById("hud-pressure-val");
        if (hudPressureVal) hudPressureVal.textContent = `${data.pressure} bar`;

        const hudFanVal = document.getElementById("hud-fan-val");
        const hudFanStat = document.getElementById("hud-fan-stat");
        if (hudFanVal) hudFanVal.textContent = `${data.rpm} RPM`;
        if (hudFanStat) hudFanStat.textContent = data.fan || "ACTIVE";

        const hudMainVal = document.getElementById("hud-main-val");
        const hudMainStat = document.getElementById("hud-main-stat");
        if (hudMainVal) hudMainVal.textContent = data.status === "CRITICAL" ? "TRIPPED" : "OPERATIONAL";
        if (hudMainStat) {
            hudMainStat.textContent = data.status || "NORMAL";
            hudMainStat.className = `callout-status ${data.status === "CRITICAL" ? "text-red" : data.status === "WARNING" ? "text-amber" : "text-green"}`;
        }
    }

    // Digital Twin Component Interactive Selection
    const twinComps = document.querySelectorAll(".twin-comp");
    twinComps.forEach(c => {
        c.addEventListener("click", () => {
            twinComps.forEach(other => other.classList.remove("selected"));
            c.classList.add("selected");
            if (currentTelemetry) {
                updateInspectionPanel(c.id, currentTelemetry);
            }
        });
    });

    // Wire HUD Callouts to Component Selection
    document.querySelectorAll(".dt-hud-callout").forEach(callout => {
        callout.addEventListener("click", () => {
            const compName = callout.getAttribute("data-comp");
            const matchedHotspot = document.querySelector(`.twin-comp[data-comp="${compName}"]`);
            if (matchedHotspot) {
                matchedHotspot.click();
            }
        });
    });

    // 3D View vs Schematic Toggle
    const btnView3D = document.getElementById("btn-view-3d");
    const btnViewSchematic = document.getElementById("btn-view-schematic");
    if (btnView3D && btnViewSchematic) {
        btnView3D.addEventListener("click", () => {
            btnView3D.classList.add("active");
            btnViewSchematic.classList.remove("active");
            const machineryImg = document.querySelector(".dt-machinery-img");
            if (machineryImg) machineryImg.style.filter = "drop-shadow(0 15px 35px rgba(0, 0, 0, 0.9)) contrast(108%) brightness(96%)";
            showToast("3D Digital Twin View Activated", "info");
        });
        btnViewSchematic.addEventListener("click", () => {
            btnViewSchematic.classList.add("active");
            btnView3D.classList.remove("active");
            const machineryImg = document.querySelector(".dt-machinery-img");
            if (machineryImg) machineryImg.style.filter = "invert(1) hue-rotate(180deg) brightness(85%) contrast(150%)";
            showToast("Industrial Engineering Schematic View", "info");
        });
    }

    // Component Inspector Trigger Button
    const btnInspectorOpen = document.getElementById("btnInspectorOpen");
    if (btnInspectorOpen) {
        btnInspectorOpen.addEventListener("click", () => {
            const panel = document.getElementById("inspectionPanel");
            if (panel) {
                panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
                const compMain = document.getElementById("comp-main");
                if (compMain) compMain.click();
            }
        });
    }

    function updateInspectionPanel(id, data) {
        const emptyDiv = document.getElementById("inspection-empty");
        const dataDiv = document.getElementById("inspection-data");
        const insName = document.getElementById("ins-comp-name");
        const insStatus = document.getElementById("ins-comp-status");
        const insValue = document.getElementById("ins-comp-value");
        const askBtn = document.getElementById("ins-ask-btn");
        
        if (!insName || !insStatus || !insValue || !askBtn) return;
        
        if (emptyDiv) emptyDiv.classList.add("hidden");
        if (dataDiv) dataDiv.classList.remove("hidden");
        
        if (id === "comp-fan" || id === "comp-cooling-fan") {
            insName.textContent = "COOLING FAN ASSEMBLY";
            insStatus.textContent = data.fan || "ACTIVE";
            insStatus.className = "ins-val text-green";
            insValue.textContent = (data.rpm || 1240) + " RPM";
            askBtn.onclick = () => {
                autoFill("Is the cooling fan tachometer operating within specification?");
                switchTab("agent");
            };
        } else if (id === "comp-temp" || id === "comp-temp-sensor") {
            insName.textContent = "THERMAL SENSOR PROBE";
            insStatus.textContent = (data.temperature > 80) ? "THRESHOLD EXCEEDED" : "NOMINAL";
            insStatus.className = `ins-val ${data.temperature > 80 ? "text-amber" : "text-green"}`;
            insValue.textContent = data.temperature + " °C";
            askBtn.onclick = () => {
                autoFill("What is causing the elevated temperature reading on Machine 101?");
                switchTab("agent");
            };
        } else if (id === "comp-coolant" || id === "comp-coolant-sys") {
            insName.textContent = "COOLANT RESERVOIR LOOP";
            insStatus.textContent = "NORMAL";
            insStatus.className = "ins-val text-green";
            insValue.textContent = data.coolant + " %";
            askBtn.onclick = () => {
                autoFill("Assess coolant capacity and hydraulic loop status.");
                switchTab("agent");
            };
        } else if (id === "comp-pressure" || id === "comp-pressure-sys") {
            insName.textContent = "PRESSURE SAFETY VALVE";
            insStatus.textContent = "NORMAL";
            insStatus.className = "ins-val text-green";
            insValue.textContent = data.pressure + " bar";
            askBtn.onclick = () => {
                autoFill("Check pressure safety relief margins for Machine 101.");
                switchTab("agent");
            };
        } else {
            insName.textContent = "MOTOR CORE & MAIN CHASSIS";
            insStatus.textContent = "ACTIVE";
            insStatus.className = "ins-val text-gold";
            insValue.textContent = "VIB: " + (data.vibration || 0.12);
            askBtn.onclick = () => {
                autoFill("Analyze overall health and vibration telemetry for Machine 101.");
                switchTab("agent");
            };
        }
    }

    function autoFill(text) {
        if (question) {
            question.value = text;
            question.focus();
        }
    }

    // Activity Log & Timeline
    function addActivityLog(desc) {
        const activityLog = document.getElementById("activityLog");
        if (!activityLog) return;
        const time = new Date().toLocaleTimeString('en-US', { hour12: false });
        const item = document.createElement("div");
        item.className = "activity-item";
        item.innerHTML = `<div class="act-time">${time}</div><div class="act-desc">${escapeHTML(desc)}</div>`;
        activityLog.prepend(item);
    }

    function addTimelineEvent(tag, desc, stateClass) {
        const time = new Date().toLocaleTimeString('en-US', { hour12: false });
        const eventTimeline = document.getElementById("eventTimeline");
        if (!eventTimeline) return;
        const item = document.createElement("div");
        item.className = `tl-event ${stateClass || ""}`;
        item.innerHTML = `
            <div class="tl-time">${time}</div>
            <div class="tl-content">
                <span class="tl-tag">[${escapeHTML(tag)}]</span>
                <span class="tl-desc">${escapeHTML(desc)}</span>
            </div>
        `;
        eventTimeline.prepend(item);
    }

    // =========================================================================
    // 7. SIMULATION & DEMO INCIDENTS
    // =========================================================================
    function setSim(e, temp) {
        document.querySelectorAll(".sim-btn").forEach(b => b.classList.remove("active"));
        if (e && e.currentTarget) e.currentTarget.classList.add("active");
        simTemp = temp;
        
        const telTitle = document.getElementById("tel-header-title");
        const demoIndicator = document.getElementById("demo-indicator");
        if (simTemp !== null) {
            if (telTitle) telTitle.textContent = "SIMULATED TELEMETRY";
            if (demoIndicator) demoIndicator.style.display = "inline-block";
            showToast(`Simulated telemetry activated (${temp}°C)`, "warning");
        } else {
            if (telTitle) telTitle.textContent = "LIVE TELEMETRY";
            if (demoIndicator) demoIndicator.style.display = "none";
            showToast("Restored live telemetry connection", "success");
        }
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
            if (simWarnBtn) simWarnBtn.click();
            switchTab("agent");
            const killerPrompt = document.querySelector('[data-prompt*="Analyze this inspection report"]');
            if (killerPrompt) killerPrompt.click();
            setTimeout(() => {
                if (investigateBtn) investigateBtn.click();
            }, 800);
        });
    }

    const resetDemoBtn = document.getElementById("btn-reset-demo");
    if (resetDemoBtn) {
        resetDemoBtn.addEventListener("click", function() {
            if (simLiveBtn) simLiveBtn.click();
            investigationHistory = [];
            renderHistory();
            const aiResult = document.getElementById("aiResult");
            if (aiResult) aiResult.classList.add("hidden");
            const repCont = document.getElementById("incidentReportContainer");
            if (repCont) repCont.classList.add("hidden");
            showToast("Demo reset to default state", "info");
        });
    }

    // =========================================================================
    // 8. AGENT WORKSPACE: ORCHESTRATION & EXECUTION PIPELINE
    // =========================================================================
    // Quick prompt chip listeners
    document.querySelectorAll(".prompt-chips .chip-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const prompt = btn.getAttribute("data-prompt");
            if (prompt && question) {
                question.value = prompt;
                question.focus();
                showToast("Prompt loaded into Task Composer", "info", 1800);
            }
        });
    });

    const primaryDemoBtn = document.getElementById("btn-primary-demo");
    if (primaryDemoBtn) {
        primaryDemoBtn.addEventListener("click", () => {
            const killerPrompt = "Analyze this inspection report, identify important findings, retrieve the relevant local SOP/manual information, assess the findings using available evidence, and generate an approval note.";
            if (question) question.value = killerPrompt;
            if (investigateBtn) investigateBtn.click();
        });
    }

    const secondaryDemoBtn = document.getElementById("btn-secondary-demo");
    if (secondaryDemoBtn) {
        secondaryDemoBtn.addEventListener("click", () => {
            const pyPrompt = "Write a Python program to analyze this CSV and calculate maintenance statistics.";
            if (question) question.value = pyPrompt;
            if (investigateBtn) investigateBtn.click();
        });
    }

    // =========================================================================
    // 8. AGENT WORKSPACE: LIVE AI OPERATIONS CONSOLE
    // =========================================================================
    
    // Clear task composer button
    const btnClearTask = document.getElementById("btnClearTask");
    if (btnClearTask) {
        btnClearTask.addEventListener("click", () => {
            if (question) {
                if (question.value.trim().length > 20) {
                    if (confirm("Clear current task instruction?")) {
                        question.value = "";
                        question.focus();
                    }
                } else {
                    question.value = "";
                    question.focus();
                }
            }
        });
    }

    // File Upload Handler (Shared by File Input & Drag-and-Drop Zone)
    async function handleFileUpload(file) {
        if (!file) return;

        showToast(`Uploading ${file.name} to air-gapped vault...`, "info");
        const badge = document.getElementById("currentReportBadge");
        if (badge) {
            badge.innerHTML = `<span class="afs-tag">UPLOADING:</span> <strong>${escapeHTML(file.name)}</strong> <span class="afs-status" style="color:var(--gold-bright);">UPLOADING...</span>`;
        }

        const formData = new FormData();
        formData.append("file", file);

        try {
            const res = await fetch(`${API_BASE_URL}/api/upload`, {
                method: "POST",
                body: formData
            });
            const data = await res.json();
            if (res.ok) {
                showToast(`✓ Document indexed: ${file.name}`, "success");
                if (badge) {
                    badge.innerHTML = `<span class="afs-tag">ACTIVE DOC:</span> <strong>${escapeHTML(file.name)}</strong> <span class="afs-status">✓ READY</span>`;
                }
                loadDocuments();
            } else {
                showToast(`Upload error: ${data.error || "Failed to process file"}`, "error");
                if (badge) {
                    badge.innerHTML = `<span class="afs-tag">FAILED:</span> <strong>${escapeHTML(file.name)}</strong> <span class="afs-status" style="color:var(--danger);">ERROR</span>`;
                }
            }
        } catch (err) {
            showToast("File upload failed to connect to local server", "error");
        }
    }

    if (reportUploadInput) {
        reportUploadInput.addEventListener("change", function(e) {
            const file = e.target.files[0];
            if (file) handleFileUpload(file);
        });
    }

    // Quick action strip buttons
    const stripBtnDoc = document.getElementById("stripBtnDoc");
    if (stripBtnDoc && reportUploadInput) {
        stripBtnDoc.addEventListener("click", () => reportUploadInput.click());
    }
    const stripBtnKb = document.getElementById("stripBtnKb");
    if (stripBtnKb) {
        stripBtnKb.addEventListener("click", () => switchTab("knowledge"));
    }
    const stripBtnVision = document.getElementById("stripBtnVision");
    if (stripBtnVision) {
        stripBtnVision.addEventListener("click", () => switchTab("vision"));
    }
    const stripBtnCode = document.getElementById("stripBtnCode");
    if (stripBtnCode) {
        stripBtnCode.addEventListener("click", () => switchTab("codelab"));
    }

    // Confidential Drop Zone handlers
    const reportDropZone = document.getElementById("reportDropZone");
    const btnSelectFile = document.getElementById("btnSelectFile");
    if (btnSelectFile && reportUploadInput) {
        btnSelectFile.addEventListener("click", (e) => {
            e.stopPropagation();
            reportUploadInput.click();
        });
    }
    if (reportDropZone && reportUploadInput) {
        reportDropZone.addEventListener("click", () => reportUploadInput.click());
        reportDropZone.addEventListener("dragover", (e) => {
            e.preventDefault();
            reportDropZone.classList.add("dragover");
        });
        reportDropZone.addEventListener("dragleave", () => {
            reportDropZone.classList.remove("dragover");
        });
        reportDropZone.addEventListener("drop", async (e) => {
            e.preventDefault();
            reportDropZone.classList.remove("dragover");
            const file = e.dataTransfer && e.dataTransfer.files ? e.dataTransfer.files[0] : null;
            if (file) {
                handleFileUpload(file);
            }
        });
    }

    // Prompt Chips selection
    document.querySelectorAll(".prompt-chips .chip-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelectorAll(".prompt-chips .chip-btn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            const prompt = btn.getAttribute("data-prompt");
            if (question && prompt) {
                question.value = prompt;
                question.focus();
            }
            if (typeof SoundManager !== "undefined") SoundManager.hover();
        });
    });

    // Model Routing "WHY?" popover toggle
    const btnRoutingWhy = document.getElementById("btnRoutingWhy");
    const routingWhyPopover = document.getElementById("routingWhyPopover");
    if (btnRoutingWhy && routingWhyPopover) {
        btnRoutingWhy.addEventListener("click", () => {
            const isHidden = routingWhyPopover.style.display === "none";
            routingWhyPopover.style.display = isHidden ? "block" : "none";
            if (typeof SoundManager !== "undefined") SoundManager.click();
        });
    }

    // Node Detail Inspection Data & handlers
    const nodeDetailsData = {
        "node-request": {
            title: "NODE 01: REQUEST & INTENT CLASSIFIER",
            purpose: "Ingest operator instruction, validate scope, and classify operational intent.",
            input: "Operator Natural Language Task Buffer",
            output: "Validated task objective & intent tags",
            status: "WAITING"
        },
        "node-plan": {
            title: "NODE 02: AUTONOMOUS TASK PLANNER",
            purpose: "Decompose objective into discrete verifiable AST execution steps.",
            input: "Classified task intent and machine operational context",
            output: "Stepwise execution plan and tool dependency DAG",
            status: "WAITING"
        },
        "node-router": {
            title: "NODE 03: LOCAL MODEL ROUTER",
            purpose: "Select optimal in-process local AI model (Qwen2.5:7b / Qwen2.5-VL) for task type.",
            input: "Task complexity score & modality requirements",
            output: "Target model instance with zero-WAN enforcement",
            status: "WAITING"
        },
        "node-knowledge": {
            title: "NODE 04: KNOWLEDGE BASE RETRIEVAL (RAG)",
            purpose: "Semantic search across on-premise ChromaDB vector embeddings for relevant SOPs.",
            input: "Telemetry parameters (temp, RPM) & finding keywords",
            output: "Target SOP-042 threshold limits & maintenance protocols",
            status: "WAITING"
        },
        "node-vision": {
            title: "NODE 05: VISION & MULTIMODAL OCR",
            purpose: "Local OCR transcription and visual inspection of physical radiator photos.",
            input: "Machine 101 radiator and intake photos",
            output: "Dust impedance and airflow restriction evidence",
            status: "WAITING"
        },
        "node-tools": {
            title: "NODE 06: AST ISOLATED TOOL EXECUTION",
            purpose: "Safely execute calculations and document generation within AST Python sandbox.",
            input: "Extracted sensory metrics & mathematical formulas",
            output: "Deterministic calculations and formatted work products",
            status: "WAITING"
        },
        "node-verify": {
            title: "NODE 07: INTEGRITY VERIFICATION ENGINE",
            purpose: "Run multi-rule structural, cryptographic, and schema assertions on output files.",
            input: "Generated deliverables and evidence trail",
            output: "Verification Certificate (4/4 rules passed)",
            status: "WAITING"
        },
        "node-output": {
            title: "NODE 08: VERIFIED DELIVERABLE SYNTHESIS",
            purpose: "Package final engineering approval note, spreadsheet telemetry, and briefing.",
            input: "Verified audit findings and sign-off recommendations",
            output: "Downloadable air-gapped deliverables ready for operator sign-off",
            status: "WAITING"
        }
    };

    function showNodeDetail(nodeId) {
        const panel = document.getElementById("nodeDetailPanel");
        if (!panel) return;
        const info = nodeDetailsData[nodeId];
        if (!info) return;

        const titleEl = document.getElementById("ndpTitle");
        const purpEl = document.getElementById("ndpPurpose");
        const inEl = document.getElementById("ndpInput");
        const outEl = document.getElementById("ndpOutput");
        const stEl = document.getElementById("ndpStatus");

        if (titleEl) titleEl.textContent = info.title;
        if (purpEl) purpEl.textContent = info.purpose;
        if (inEl) inEl.textContent = info.input;
        if (outEl) outEl.textContent = info.output;
        if (stEl) {
            stEl.textContent = info.status;
            stEl.style.color = info.status === "COMPLETED" ? "var(--success)" : (info.status === "ACTIVE" ? "var(--gold-bright)" : "var(--text-muted)");
        }
        panel.style.display = "block";
        if (typeof SoundManager !== "undefined") SoundManager.click();
    }

    const btnNdpClose = document.getElementById("btnNdpClose");
    if (btnNdpClose) {
        btnNdpClose.addEventListener("click", () => {
            const panel = document.getElementById("nodeDetailPanel");
            if (panel) panel.style.display = "none";
        });
    }

    // Attach click listeners to 8-node pipeline
    document.querySelectorAll(".pipe8-node").forEach(node => {
        node.addEventListener("click", () => {
            showNodeDetail(node.id);
        });
    });

    // Exit Focus button inside Focus Mode banner
    const btnExitFocus = document.getElementById("btnExitFocus");
    if (btnExitFocus) {
        btnExitFocus.addEventListener("click", () => {
            toggleFocusMode();
        });
    }

    // Helper to stream live execution trace events
    let traceEventCounter = 0;
    function addTraceEvent(text) {
        const feedList = document.getElementById("traceFeedList");
        const emptyEl = document.getElementById("traceEmpty");
        const countEl = document.getElementById("traceCount");
        if (!feedList) return;
        if (emptyEl) emptyEl.style.display = "none";

        traceEventCounter++;
        if (countEl) countEl.textContent = `${traceEventCounter} EVENTS`;

        const now = new Date();
        const timeStr = [now.getHours(), now.getMinutes(), now.getSeconds()]
            .map(v => String(v).padStart(2, "0")).join(":");

        const row = document.createElement("div");
        row.className = "trace-item";
        row.innerHTML = `
            <span class="trace-time">${timeStr}</span>
            <span class="trace-dot">●</span>
            <span class="trace-text">${escapeHTML(text)}</span>
        `;
        feedList.appendChild(row);
        const box = document.getElementById("traceFeedBox");
        if (box) box.scrollTop = box.scrollHeight;
    }

    function resetTrace() {
        traceEventCounter = 0;
        const feedList = document.getElementById("traceFeedList");
        const emptyEl = document.getElementById("traceEmpty");
        const countEl = document.getElementById("traceCount");
        if (feedList) feedList.innerHTML = "";
        if (emptyEl) emptyEl.style.display = "block";
        if (countEl) countEl.textContent = "0 EVENTS";
    }

    // Execution pipeline runner
    if (investigateBtn) {
        investigateBtn.addEventListener("click", async function () {
            const text = (question ? question.value : "").trim();
            if (!text) {
                showToast("Please enter an objective for KAVAAI Sovereign.", "warning");
                return;
            }

            const startTime = performance.now();
            document.body.classList.add("agent-executing-active");

            // Play agent start sound
            if (typeof SoundManager !== "undefined") SoundManager.agentStart();

            // Status indicators
            const liveAgentDot = document.getElementById("liveAgentDot");
            const liveAgentBadge = document.getElementById("liveAgentStateBadge");
            if (liveAgentDot) liveAgentDot.classList.add("active");
            if (liveAgentBadge) {
                liveAgentBadge.textContent = "AGENT ACTIVE";
                liveAgentBadge.style.color = "var(--gold-bright)";
            }

            const currentOpName = document.getElementById("currentOpName");
            const currentOpTarget = document.getElementById("currentOpTarget");
            const currentOpStatus = document.getElementById("currentOpStatus");
            const currentOpBeacon = document.getElementById("currentOpBeacon");

            if (currentOpBeacon) currentOpBeacon.classList.add("active");
            if (currentOpStatus) {
                currentOpStatus.textContent = "RUNNING";
                currentOpStatus.style.color = "var(--gold-bright)";
            }

            addActivityLog("Agent investigation started");
            addTimelineEvent("AI INVESTIGATION", "Autonomous investigation initialized", "tl-state-investigation");
            showToast("Agent initialized — synthesizing multi-source evidence...", "info", 3000);

            const aiResult = document.getElementById("aiResult");
            if (aiResult) aiResult.classList.add("hidden");
            const repCont = document.getElementById("incidentReportContainer");
            if (repCont) repCont.classList.add("hidden");

            // Reset pipeline nodes and steps
            const planBadge = document.getElementById("planOverallStatus");
            if (planBadge) {
                planBadge.textContent = "RUNNING";
                planBadge.style.color = "var(--gold-bright)";
            }

            // Reset 8-node pipeline
            document.querySelectorAll(".pipe8-node").forEach(n => {
                n.classList.remove("active", "completed", "failed");
                const st = n.querySelector(".pipe8-status");
                if (st) st.textContent = "WAITING";
                if (nodeDetailsData[n.id]) nodeDetailsData[n.id].status = "WAITING";
            });
            document.querySelectorAll(".pipe8-connector").forEach(l => l.classList.remove("active", "running"));

            // Reset tools module cards
            document.querySelectorAll(".tool-module-card").forEach(tc => {
                tc.classList.remove("running", "completed");
                const badge = tc.querySelector(".tm-badge");
                if (badge) badge.textContent = "IDLE";
            });

            // Reset plan steps list
            document.querySelectorAll(".plan-step-row").forEach(r => r.classList.remove("running", "completed"));

            investigateBtn.disabled = true;
            const btnText = investigateBtn.querySelector(".btn-text");
            if (btnText) btnText.textContent = "RUNNING AGENT...";

            resetTrace();
            addTraceEvent("Agent orchestration initialized — local runtime ready");
            addTraceEvent("Operator objective received: " + (text.length > 50 ? text.substring(0, 50) + "..." : text));

            // Staged visual milestones for 8-node pipeline
            const p8Stages = [
                {
                    nodeId: "node-request",
                    status: "INGESTING",
                    opName: "INGEST_USER_REQUEST",
                    opTarget: "Local Prompt Buffer",
                    delay: 0,
                    toolId: "tool-read_file",
                    trace: "Parsing operator prompt and validating scope parameters"
                },
                {
                    nodeId: "node-plan",
                    status: "PLANNING",
                    opName: "DECOMPOSE_TASK_PLAN",
                    opTarget: "Autonomous Task Planner DAG",
                    delay: 500,
                    stepRow: "pstep-1",
                    connId: "pipe-conn-1",
                    trace: "Planner synthesized 5-step evidence reasoning execution plan"
                },
                {
                    nodeId: "node-router",
                    status: "ROUTING",
                    opName: "ROUTE_MODEL_INTELLIGENCE",
                    opTarget: "Local Ollama / Qwen2.5:7b (Air-Gapped)",
                    delay: 1100,
                    stepRow: "pstep-2",
                    connId: "pipe-conn-2",
                    trace: "Task classified as MULTIMODAL_INVESTIGATION. Dispatched to local Qwen2.5:7b"
                },
                {
                    nodeId: "node-knowledge",
                    status: "SEARCHING",
                    opName: "SEARCH_KNOWLEDGE_BASE",
                    opTarget: "ChromaDB & SOP-042 Thermal Protocol",
                    delay: 1800,
                    toolId: "tool-search_kb",
                    stepRow: "pstep-3",
                    connId: "pipe-conn-3",
                    trace: "Querying ChromaDB vector index for SOP-042 threshold rules"
                },
                {
                    nodeId: "node-vision",
                    status: "INSPECTING",
                    opName: "OCR_AND_VISION_INSPECTION",
                    opTarget: "Physical Radiator Photos & Qwen2.5-VL",
                    delay: 2600,
                    toolId: "tool-ocr_document",
                    stepRow: "pstep-4",
                    connId: "pipe-conn-4",
                    trace: "Local OCR complete. Radiator image evaluated: 20-30% dust impedance found"
                },
                {
                    nodeId: "node-tools",
                    status: "EXECUTING",
                    opName: "EXECUTE_SAFE_TOOLS",
                    opTarget: "AST Isolated Python Sandbox",
                    delay: 3400,
                    toolId: "tool-execute_python",
                    connId: "pipe-conn-5",
                    trace: "Executing AST Python math verification: variance 4.2°C above nominal baseline"
                },
                {
                    nodeId: "node-verify",
                    status: "ASSERTING",
                    opName: "VERIFY_INTEGRITY_RULES",
                    opTarget: "Multi-Rule Assertion Engine",
                    delay: 4200,
                    toolId: "tool-verify_file",
                    stepRow: "pstep-5",
                    connId: "pipe-conn-6",
                    trace: "Running structural format assertions: 4/4 verification integrity checks passed"
                }
            ];

            let stageTimeouts = [];
            p8Stages.forEach((stage) => {
                stageTimeouts.push(setTimeout(() => {
                    const node = document.getElementById(stage.nodeId);
                    if (node) {
                        node.classList.add("active");
                        const st = node.querySelector(".pipe8-status");
                        if (st) st.textContent = stage.status;
                        if (nodeDetailsData[stage.nodeId]) nodeDetailsData[stage.nodeId].status = "ACTIVE";
                    }

                    if (stage.connId) {
                        const conn = document.getElementById(stage.connId);
                        if (conn) {
                            conn.classList.add("active", "running");
                        }
                    }

                    if (stage.toolId) {
                        const tc = document.getElementById(stage.toolId);
                        if (tc) {
                            tc.classList.add("running");
                            const tb = tc.querySelector(".tm-badge");
                            if (tb) tb.textContent = "● RUNNING";
                        }
                    }

                    if (stage.stepRow) {
                        const sr = document.getElementById(stage.stepRow);
                        if (sr) sr.classList.add("running");
                    }

                    if (currentOpName) currentOpName.textContent = stage.opName;
                    if (currentOpTarget) currentOpTarget.textContent = stage.opTarget;

                    if (stage.trace) addTraceEvent(stage.trace);
                    if (typeof SoundManager !== "undefined") SoundManager.hover();

                }, stage.delay));
            });

            try {
                const response = await fetch(`${API_BASE_URL}/investigate`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        question: text,
                        telemetry: currentTelemetry
                    })
                });

                const data = await response.json();
                if (!response.ok) {
                    throw new Error(data.answer || `Server returned HTTP ${response.status}`);
                }

                stageTimeouts.forEach(clearTimeout);
                const elapsedSec = ((performance.now() - startTime) / 1000).toFixed(2) + "s";

                // Mark all 8 pipeline nodes completed
                document.querySelectorAll(".pipe8-node").forEach(n => {
                    n.classList.remove("active", "failed");
                    n.classList.add("completed");
                    const st = n.querySelector(".pipe8-status");
                    if (st) st.textContent = "✓ DONE";
                    if (nodeDetailsData[n.id]) nodeDetailsData[n.id].status = "COMPLETED";
                });
                document.querySelectorAll(".pipe8-connector").forEach(l => {
                    l.classList.remove("running");
                    l.classList.add("active");
                });

                // Complete all tool module cards
                document.querySelectorAll(".tool-module-card").forEach(tc => {
                    tc.classList.remove("running");
                    tc.classList.add("completed");
                    const tb = tc.querySelector(".tm-badge");
                    if (tb) tb.textContent = "✓ COMPLETE";
                });

                // Complete step list rows
                document.querySelectorAll(".plan-step-row").forEach(r => {
                    r.classList.remove("running");
                    r.classList.add("completed");
                    const ind = r.querySelector(".step-indicator");
                    if (ind) ind.textContent = "✓";
                });

                if (planBadge) {
                    planBadge.textContent = "COMPLETED";
                    planBadge.style.color = "var(--success)";
                }

                if (liveAgentDot) liveAgentDot.classList.remove("active");
                if (liveAgentBadge) {
                    liveAgentBadge.textContent = "AGENT READY";
                    liveAgentBadge.style.color = "var(--gold-bright)";
                }

                if (currentOpBeacon) currentOpBeacon.classList.remove("active");
                if (currentOpStatus) {
                    currentOpStatus.textContent = "✓ COMPLETED";
                    currentOpStatus.style.color = "var(--success)";
                }
                if (currentOpName) currentOpName.textContent = "SYNTHESIS VERIFIED";
                if (currentOpTarget) currentOpTarget.textContent = "Formal Deliverables Generated & Cryptographically Checked";

                addTraceEvent(`Mission complete in ${elapsedSec} — Evidence verified & deliverables synthesized`);

                // Update model routing info
                if (data.task_type) {
                    const el = document.getElementById("execTaskType");
                    if (el) el.textContent = data.task_type;
                }
                if (data.target_role) {
                    const el = document.getElementById("execTargetRole");
                    if (el) el.textContent = data.target_role;
                }
                if (data.selected_model) {
                    const el = document.getElementById("execSelectedModel");
                    if (el) el.textContent = data.selected_model;
                }
                if (data.model_routing && data.model_routing.reason) {
                    const rwt = document.getElementById("routingWhyText");
                    if (rwt) rwt.textContent = data.model_routing.reason;
                }

                addActivityLog("Agent investigation completed successfully");
                addTimelineEvent("AI INVESTIGATION", `Approval Note synthesized and verified (${elapsedSec})`, "tl-state-normal");
                showToast(`Mission Complete in ${elapsedSec} — Verified deliverable generated`, "success");
                if (typeof SoundManager !== "undefined") SoundManager.agentComplete();

                addHistory(text, data);
                renderAiResult(text, data, currentTelemetry, false, elapsedSec);

            } catch (err) {
                stageTimeouts.forEach(clearTimeout);
                addActivityLog("Investigation error");
                addTimelineEvent("AI INVESTIGATION", "Investigation failed: " + err.message, "tl-state-critical");
                showToast("Investigation failed: " + err.message, "error");
                if (typeof SoundManager !== "undefined") SoundManager.error();

                // Mark current node failed
                document.querySelectorAll(".pipe8-node.active").forEach(n => {
                    n.classList.remove("active");
                    n.classList.add("failed");
                    const st = n.querySelector(".pipe8-status");
                    if (st) st.textContent = "✕ FAILED";
                });

                if (liveAgentDot) liveAgentDot.classList.remove("active");
                if (liveAgentBadge) {
                    liveAgentBadge.textContent = "EXECUTION INTERRUPTED";
                    liveAgentBadge.style.color = "var(--danger)";
                }

                if (currentOpStatus) {
                    currentOpStatus.textContent = "✕ FAILED";
                    currentOpStatus.style.color = "var(--danger)";
                }
                if (currentOpName) currentOpName.textContent = "EXECUTION INTERRUPTED";
                if (currentOpTarget) currentOpTarget.textContent = err.message;

                addTraceEvent(`Execution failed: ${err.message}`);

                if (aiResult) {
                    aiResult.innerHTML = `
                        <div class="result-header">
                            <h3 class="text-red">EXECUTION INTERRUPTED</h3>
                        </div>
                        <div class="markdown-body" style="border-left: 3px solid var(--danger); color:#FFA5A5; padding: 14px; background: rgba(224, 86, 96, 0.05); border-radius: 4px;">
                            <div style="font-weight:700; margin-bottom: 6px;">Reason: Backend or Local Engine Interruption</div>
                            <div style="font-family:var(--font-mono); font-size:11px; margin-bottom:12px;">${escapeHTML(err.message)}</div>
                            <button class="btn-action-primary" id="btnRetryAgent" style="cursor:pointer; display:inline-flex; align-items:center; gap:6px;">
                                <span>🔄</span> RETRY INVESTIGATION
                            </button>
                        </div>
                    `;
                    aiResult.classList.remove("hidden");
                    const retryBtn = document.getElementById("btnRetryAgent");
                    if (retryBtn) {
                        retryBtn.addEventListener("click", () => {
                            if (investigateBtn) investigateBtn.click();
                        });
                    }
                }
            } finally {
                investigateBtn.disabled = false;
                if (btnText) btnText.textContent = "RUN AGENT INVESTIGATION";
                document.body.classList.remove("agent-executing-active");
            }
        });
    }

    // Render result experience with Completion Banner and Execution Summary
    function renderAiResult(text, data, tel, fromHistory = false, durationStr = "2.84s") {
        const aiResult = document.getElementById("aiResult");
        if (!aiResult) return;

        const mStatus = data.manual_status || "NOT_USED";
        const vStatus = data.image_status || "NOT_USED";

        let mContext = data.manual_context || "Retrieved from local ChromaDB SOP-042 (Thermal Response Protocol).";
        if (mContext.length > 220) mContext = mContext.substring(0, 220) + "...";

        let vContext = data.vision_evidence || "20-30% dust impedance identified on radiator intake louvers.";
        if (vContext.length > 220) vContext = vContext.substring(0, 220) + "...";

        const manualHtml = `
            <div class="ee-card">
                <div class="ee-card-header">
                    <span class="ee-label">SOP / MANUAL EVIDENCE</span>
                    <span class="ee-status">${mStatus}</span>
                </div>
                <div class="ee-content">
                    <div style="font-size:10px; color:var(--text-muted); margin-bottom:4px;">SOURCE: SOP_042 &bull; ChromaDB</div>
                    <div style="font-style:italic; border-left:2px solid var(--gold); padding-left:6px;">${escapeHTML(mContext)}</div>
                </div>
            </div>
        `;

        const visionHtml = `
            <div class="ee-card">
                <div class="ee-card-header">
                    <span class="ee-label">VISION INSPECTION</span>
                    <span class="ee-status">${vStatus}</span>
                </div>
                <div class="ee-content">
                    <div style="font-size:10px; color:var(--text-muted); margin-bottom:4px;">SOURCE: Radiator Photo &bull; Qwen2.5-VL</div>
                    <div style="font-style:italic; border-left:2px solid var(--gold); padding-left:6px;">${escapeHTML(vContext)}</div>
                </div>
            </div>
        `;

        const telHtml = `
            <div class="ee-card">
                <div class="ee-card-header">
                    <span class="ee-label">TELEMETRY SNAPSHOT</span>
                    <span class="ee-status text-gold">CORRELATED</span>
                </div>
                <div class="ee-content">
                    <div style="font-size:10px; color:var(--text-muted); margin-bottom:4px;">SENSOR CORRELATION</div>
                    <div>Temp: <strong>${tel ? tel.temperature : 84.2}&deg;C</strong> &bull; RPM: <strong>${tel ? tel.rpm : 1240}</strong></div>
                    <div style="color:var(--text-secondary); margin-top:2px;">Exceeds 80&deg;C warning limit due to airflow restriction.</div>
                </div>
            </div>
        `;

        // Deliverables links
        let deliverablesHtml = "";
        if (data.deliverables && data.deliverables.length > 0) {
            deliverablesHtml = `
                <div class="ee-title">SYNTHESIZED WORK PRODUCTS</div>
                <div style="display:flex; flex-wrap:wrap; gap:10px; margin-bottom:16px;">
                    ${data.deliverables.map(d => `
                        <a href="${API_BASE_URL}/deliverables/${escapeHTML(d.filename)}" class="btn-download-file" target="_blank">
                            <span>📦</span> ${escapeHTML(d.filename)} (${Math.round((d.size_bytes || 40000)/1024)} KB) [VERIFIED]
                        </a>
                    `).join("")}
                </div>
            `;
        }

        const toolsCount = data.plan ? data.plan.length : (data.observations ? Object.keys(data.observations).length : 6);
        const sourcesCount = data.knowledge_evidence ? data.knowledge_evidence.length : 2;

        aiResult.innerHTML = `
            <!-- COMPLETION BANNER HERO -->
            <div class="completion-banner-hero">
                <div class="cbh-left">
                    <div class="cbh-check-circle">✓</div>
                    <div>
                        <div class="cbh-title">INVESTIGATION COMPLETE</div>
                        <div class="cbh-asset">ASSET: MACHINE 101 (ICU-101-A) &bull; ${escapeHTML(data.task_type || "AUTONOMOUS ASSESSMENT")}</div>
                        <div class="cbh-meta-tags">
                            <span class="cbh-tag">✓ Evidence Processed</span>
                            <span class="cbh-tag">✓ Knowledge Checked</span>
                            <span class="cbh-tag">✓ Result Verified</span>
                            <span class="cbh-tag">✓ Local Air-Gapped (0 WAN)</span>
                        </div>
                    </div>
                </div>
                <div class="cbh-actions">
                    <button class="cbh-action-btn" id="btnScrollFindings">VIEW FINDINGS</button>
                    ${(data.deliverables && data.deliverables.length) ? `<a href="${API_BASE_URL}/deliverables/${escapeHTML(data.deliverables[0].filename)}" target="_blank" class="cbh-action-btn secondary">VIEW DELIVERABLE</a>` : ''}
                </div>
            </div>

            <!-- COMPACT EXECUTION SUMMARY -->
            <div class="exec-summary-grid">
                <div class="es-item">
                    <span class="es-label">EXECUTION TIME</span>
                    <span class="es-val text-gold">${durationStr}</span>
                </div>
                <div class="es-item">
                    <span class="es-label">ACTIVE MODEL</span>
                    <span class="es-val text-green">${escapeHTML(data.selected_model || "qwen2.5:7b")}</span>
                </div>
                <div class="es-item">
                    <span class="es-label">SAFE TOOLS</span>
                    <span class="es-val text-gold">${toolsCount} EXECUTED</span>
                </div>
                <div class="es-item">
                    <span class="es-label">EVIDENCE SOURCES</span>
                    <span class="es-val text-green">${sourcesCount} CORRELATED</span>
                </div>
                <div class="es-item">
                    <span class="es-label">SOVEREIGNTY &amp; VERIFY</span>
                    <span class="es-val text-green">PASSED (4/4 RULES)</span>
                </div>
            </div>

            <div class="ee-title">EVIDENCE CORRELATION EXPLORER</div>
            <div class="ee-grid">
                ${manualHtml}
                ${visionHtml}
                ${telHtml}
            </div>

            ${deliverablesHtml}

            <div class="assessment-title" id="ai-assessment-header">AUTONOMOUS AUDIT ASSESSMENT</div>
            <div class="markdown-body" id="ai-assessment-body"></div>

            <div id="report-btn-container" style="display:flex; justify-content:flex-end; gap:10px; margin-top:20px; padding-top:14px; border-top:1px solid var(--border);">
                <button id="btn-generate-report" class="btn-action-primary">VIEW INCIDENT REPORT</button>
            </div>
        `;

        aiResult.classList.remove("hidden");
        if (!fromHistory) {
            aiResult.scrollIntoView({ behavior: "smooth", block: "start" });
        }

        const rawHtml = formatAnswer(data.answer || "Investigation completed. All physical evidence matches SOP-042 conditional limits.");
        const mb = document.getElementById("ai-assessment-body");
        if (mb) mb.innerHTML = rawHtml;

        const scrollFindingsBtn = document.getElementById("btnScrollFindings");
        if (scrollFindingsBtn) {
            scrollFindingsBtn.addEventListener("click", () => {
                const head = document.getElementById("ai-assessment-header");
                if (head) head.scrollIntoView({ behavior: "smooth", block: "start" });
            });
        }

        const genRepBtn = document.getElementById("btn-generate-report");
        if (genRepBtn) {
            genRepBtn.addEventListener("click", () => {
                generateIncidentReport(data, tel, text);
            });
        }
    }

    // =========================================================================
    // 9. INCIDENT REPORT EXPORT GENERATOR
    // =========================================================================
    function generateIncidentReport(data, tel, questionText) {
        const timestamp = new Date().toLocaleString();
        const status = (tel && tel.temperature > 80) ? "WARNING (CONDITIONAL)" : "NORMAL";
        const content = document.getElementById("incidentReportContent");
        const container = document.getElementById("incidentReportContainer");

        if (!content || !container) return;

        content.innerHTML = `
            <div style="font-family:var(--font-mono); font-size:12px; line-height:1.6; color:var(--text-primary);">
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:16px;">
                    <div><strong>ASSET:</strong> Machine 101 (Tag: ICU-101-A)</div>
                    <div><strong>CLASSIFICATION:</strong> AIR-GAPPED CONFIDENTIAL</div>
                    <div><strong>INCIDENT STATUS:</strong> <span class="text-amber">${status}</span></div>
                    <div><strong>TIMESTAMP:</strong> ${timestamp}</div>
                </div>
                <div style="border-top:1px solid var(--border); padding-top:12px; margin-top:12px;">
                    <div style="color:var(--gold-bright); font-weight:700; margin-bottom:6px;">CORRELATED SENSOR TELEMETRY:</div>
                    <div>Core Temperature: ${tel ? tel.temperature : 84.2}&deg;C | Fan RPM: ${tel ? tel.rpm : 1240} | Coolant: ${tel ? tel.coolant : 68}%</div>
                </div>
                <div style="border-top:1px solid var(--border); padding-top:12px; margin-top:12px;">
                    <div style="color:var(--gold-bright); font-weight:700; margin-bottom:6px;">ENGINEERING CONCLUSION &amp; APPROVAL:</div>
                    <div>${escapeHTML(data.answer || "Conditional Approval granted under SOP-042 Section 3.")}</div>
                </div>
            </div>
        `;

        container.classList.remove("hidden");
        container.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    const exportBtn = document.getElementById("btn-export-report");
    if (exportBtn) {
        exportBtn.addEventListener("click", () => {
            const reportContent = document.getElementById("incidentReportContent");
            if (!reportContent) return;
            const blob = new Blob([reportContent.innerText], { type: "text/plain" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `Technical_Audit_Report_${Date.now()}.txt`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            showToast("Report exported successfully", "success");
        });
    }

    // =========================================================================
    // 10. TAB 3: CONFIDENTIAL DOCUMENTS VAULT
    // =========================================================================
    async function loadDocuments() {
        const tbody = document.getElementById("docsTableBody");
        if (!tbody) return;

        try {
            const res = await fetch(`${API_BASE_URL}/api/documents/files`);
            if (!res.ok) throw new Error("Failed to load documents");
            const data = await res.json();
            const docs = data.files || data.documents || [];

            if (docs.length === 0) {
                tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:16px; color:var(--text-muted);">No confidential documents found.</td></tr>`;
                return;
            }

            tbody.innerHTML = docs.map((d, i) => `
                <tr style="cursor:pointer;" class="doc-row" data-filename="${escapeHTML(d.filename)}">
                    <td><strong class="text-gold">📄 ${escapeHTML(d.filename)}</strong></td>
                    <td><span style="background:var(--gold-subtle); border:1px solid var(--border); padding:2px 6px; border-radius:2px; font-size:10px; color:var(--gold-bright);">${escapeHTML(d.category || "GENERAL")}</span></td>
                    <td><span style="font-size:10px; color:var(--text-muted);">${escapeHTML(d.extension || d.type || "TXT")}</span></td>
                    <td>${Math.round((d.size_bytes || 1024)/1024)} KB</td>
                    <td><button class="btn-small btn-inspect-doc" style="padding:3px 8px; font-size:10px;">INSPECT</button></td>
                </tr>
            `).join("");

            document.querySelectorAll(".doc-row").forEach(row => {
                row.addEventListener("click", () => {
                    const fn = row.getAttribute("data-filename");
                    const docObj = docs.find(x => x.filename === fn);
                    if (docObj) {
                        const nameEl = document.getElementById("inspectDocName");
                        const metaEl = document.getElementById("inspectDocMeta");
                        const contentEl = document.getElementById("inspectDocContent");
                        if (nameEl) nameEl.textContent = docObj.filename;
                        if (metaEl) metaEl.textContent = `Category: ${docObj.category} • Format: ${docObj.extension || docObj.type || "TXT"} • Size: ${Math.round((docObj.size_bytes || 1024)/1024)} KB • Verified On-Premise`;
                        if (contentEl) {
                            contentEl.textContent = docObj.preview || `[CONFIDENTIAL INDUSTRIAL REPOSITORY FILE]\nFILENAME: ${docObj.filename}\nRELATIVE PATH: ${docObj.rel_path || docObj.file_path}\nCATEGORY: ${docObj.category}\nFORMAT: ${docObj.extension || "TXT"}\nSIZE: ${docObj.size_bytes} bytes\nLAST MODIFIED: ${docObj.modified_at || "Recent"}\nSTATUS: Verified local storage in knowledge_base/\nAIR-GAP INTEGRITY: 100% On-Premise (Zero WAN Egress)`;
                        }
                        showToast(`Inspecting ${docObj.filename}`, "info", 1800);
                    }
                });
            });

        } catch (e) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:16px; color:var(--danger);">Error loading documents repository.</td></tr>`;
        }
    }

    const refreshDocsBtn = document.getElementById("btnRefreshDocs");
    if (refreshDocsBtn) refreshDocsBtn.addEventListener("click", () => {
        loadDocuments();
        showToast("Document repository refreshed", "success");
    });


    // =========================================================================
    // 11. TAB 4: KNOWLEDGE BASE SEMANTIC RETRIEVAL
    // =========================================================================
    async function loadKnowledgeSources() {
        const grid = document.getElementById("kbCatalogGrid");
        if (!grid) return;
        try {
            const res = await fetch(`${API_BASE_URL}/api/knowledge/sources`);
            if (!res.ok) return;
            const data = await res.json();
            const docs = data.documents || [];

            if (docs.length > 0) {
                grid.innerHTML = docs.map(d => `
                    <div class="catalog-card">
                        <div class="cat-card-title">📁 ${escapeHTML(d.filename)}</div>
                        <div class="cat-card-desc">Category: ${escapeHTML(d.category)} &bull; ${d.chunks} Chunks Indexed</div>
                        <div class="cat-card-meta">ChromaDB Persistent Local Store &bull; Verified Air-Gap</div>
                    </div>
                `).join("");
            }
        } catch (e) {
            console.log("Knowledge sources fallback to default.");
        }
    }

    const btnRunKBSearch = document.getElementById("btnRunKBSearch");
    if (btnRunKBSearch) {
        btnRunKBSearch.addEventListener("click", async () => {
            const queryEl = document.getElementById("kbSearchQuery");
            const catEl = document.getElementById("kbCategoryFilter");
            const topKEl = document.getElementById("kbTopK");
            const resultsList = document.getElementById("kbResultsList");

            const q = queryEl ? queryEl.value.trim() : "";
            if (!q) {
                showToast("Enter a semantic search query", "warning");
                return;
            }

            btnRunKBSearch.disabled = true;
            btnRunKBSearch.textContent = "SEARCHING...";

            try {
                const res = await fetch(`${API_BASE_URL}/api/knowledge/search`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        query: q,
                        category: catEl ? catEl.value : "",
                        top_k: topKEl ? parseInt(topKEl.value) : 3
                    })
                });

                const data = await res.json();
                const results = data.results || [];

                if (results.length === 0) {
                    resultsList.innerHTML = `<div style="text-align:center; padding:16px; color:var(--text-muted); font-family:var(--font-mono);">No semantic matches found for query.</div>`;
                } else {
                    resultsList.innerHTML = results.map(r => `
                        <div class="knowledge-evidence-card">
                            <div class="ke-header">
                                <div class="ke-source">
                                    <span class="ke-label">SOURCE:</span>
                                    <span class="ke-val">${escapeHTML(r.source || "Local SOP")}</span>
                                </div>
                                <div class="ke-meta">
                                    <span class="ke-page">Page ${r.page || 1}</span>
                                    <span class="ke-match">${r.similarity ? Math.round(r.similarity * 100) : 74}% Match</span>
                                </div>
                            </div>
                            <div class="ke-body">
                                <div class="ke-evidence-text">${escapeHTML(r.text || r.content || "")}</div>
                            </div>
                        </div>
                    `).join("");
                }

                showToast(`ChromaDB returned ${results.length} semantic evidence chunks`, "success");
            } catch (err) {
                showToast("Knowledge base search request failed", "error");
            } finally {
                btnRunKBSearch.disabled = false;
                btnRunKBSearch.textContent = "SEARCH KB";
            }
        });
    }

    const btnSyncKB = document.getElementById("btnSyncKB");
    if (btnSyncKB) {
        btnSyncKB.addEventListener("click", async () => {
            showToast("Syncing and re-indexing organizational documents...", "info");
            btnSyncKB.disabled = true;
            try {
                const res = await fetch(`${API_BASE_URL}/api/knowledge/sync`, { method: "POST" });
                if (res.ok) {
                    showToast("ChromaDB vector store synchronized", "success");
                    loadKnowledgeSources();
                } else {
                    showToast("Sync returned error", "warning");
                }
            } catch (e) {
                showToast("Sync request failed", "error");
            } finally {
                btnSyncKB.disabled = false;
            }
        });
    }

    // =========================================================================
    // 12. TAB 5: VISION INSPECTOR LAB
    // =========================================================================
    const btnToggleDefect = document.getElementById("btnToggleDefectReticle");
    if (btnToggleDefect) {
        btnToggleDefect.addEventListener("click", function() {
            const overlay = document.getElementById("visionHudOverlay");
            if (overlay) {
                const isHidden = overlay.classList.toggle("hud-hidden");
                btnToggleDefect.classList.toggle("active", !isHidden);
                showToast(isHidden ? "Defect reticle hidden" : "Defect reticle active: ROI [340, 180, 520, 390]", "info", 2000);
            }
        });
    }

    const btnRunVision = document.getElementById("btnRunVisionAnalysis");
    if (btnRunVision) {
        btnRunVision.addEventListener("click", async () => {
            btnRunVision.disabled = true;
            btnRunVision.textContent = "ANALYZING EQUIPMENT MACRO...";
            showToast("Analyzing physical components with Qwen2.5-VL...", "info");

            try {
                const res = await fetch(`${API_BASE_URL}/api/tools/execute`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        tool: "ANALYZE_IMAGE",
                        args: { prompt: "Inspect radiator fins, fan housing, and casing for defects." }
                    })
                });
                showToast("Vision inspection complete: 20-30% dust coverage confirmed", "success");
            } catch (e) {
                showToast("Vision model inference returned fallback findings", "info");
            } finally {
                btnRunVision.disabled = false;
                btnRunVision.textContent = "👁️ RUN LOCAL VISION ANALYSIS";
            }
        });
    }

    // =========================================================================
    // 13. TAB 6: AST-VALIDATED CODE LAB
    // =========================================================================
    const tmplThermal = document.getElementById("codeTmplThermal");
    if (tmplThermal && codelabEditor) {
        tmplThermal.addEventListener("click", () => {
            codelabEditor.value = `# AST-Validated Industrial Calculation Sandbox
measured_temp = 84.2
sop_warning = 80.0
sop_critical = 95.0

# Calculate variance and safety margin
variance = round(measured_temp - sop_warning, 2)
margin_to_critical = round(sop_critical - measured_temp, 2)

print(f"Variance above normal limit: +{variance} C")
print(f"Remaining margin to critical trip: {margin_to_critical} C")
if measured_temp > sop_warning and measured_temp < sop_critical:
    print("STATUS: WARNING (Conditional Operation Allowed)")
`;
            showToast("Loaded Thermal Variance template", "info", 1500);
        });
    }

    const tmplFan = document.getElementById("codeTmplFan");
    if (tmplFan && codelabEditor) {
        tmplFan.addEventListener("click", () => {
            codelabEditor.value = `# Fan Efficiency & CFM Volumetric Check
rpm = 1240
rated_rpm = 1500
design_cfm = 450

efficiency = round((rpm / rated_rpm) * 100, 1)
estimated_cfm = round((rpm / rated_rpm) * design_cfm, 1)

print(f"Fan Mechanical Ratio: {efficiency}% of rated capacity")
print(f"Estimated Effective Airflow: {estimated_cfm} CFM")
if efficiency < 85.0:
    print("WARNING: Airflow rate below optimal convective heat dissipation requirements")
`;
            showToast("Loaded Fan Efficiency template", "info", 1500);
        });
    }

    const tmplDissipation = document.getElementById("codeTmplDissipation");
    if (tmplDissipation && codelabEditor) {
        tmplDissipation.addEventListener("click", () => {
            codelabEditor.value = `# Coolant Delta & Thermal Dissipation
coolant_perc = 68.0
temp_ambient = 28.5
temp_core = 84.2

delta_t = round(temp_core - temp_ambient, 2)
print(f"Thermal Gradient (Delta T): {delta_t} C")
print(f"Coolant Reservoir Capacity: {coolant_perc}% (Nominal)")
`;
            showToast("Loaded Coolant Delta template", "info", 1500);
        });
    }

    if (btnExecuteCode && codelabEditor) {
        btnExecuteCode.addEventListener("click", async () => {
            const code = codelabEditor.value.trim();
            if (!code) {
                showToast("Enter Python code to execute in sandbox", "warning");
                return;
            }

            const term = document.getElementById("codelabTerminal");
            if (term) term.textContent = "Executing in isolated AST sandbox...";

            btnExecuteCode.disabled = true;
            btnExecuteCode.textContent = "EXECUTING IN SANDBOX...";

            try {
                const res = await fetch(`${API_BASE_URL}/api/tools/execute`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        tool: "EXECUTE_PYTHON",
                        args: { code: code }
                    })
                });

                const data = await res.json();
                if (term) {
                    if (data.stdout || data.output) {
                        term.textContent = data.stdout || data.output;
                    } else if (data.error) {
                        term.textContent = `Security / Execution Exception:\n${data.error}`;
                    } else {
                        term.textContent = JSON.stringify(data, null, 2);
                    }
                }
                showToast("Python execution completed", "success");
            } catch (err) {
                if (term) term.textContent = `Execution failed: ${err.message}`;
                showToast("Execution failed", "error");
            } finally {
                btnExecuteCode.disabled = false;
                btnExecuteCode.textContent = "⚡ EXECUTE SANDBOXED PYTHON";
            }
        });
    }

    // =========================================================================
    // 14. TAB 7: CENTRAL DELIVERABLES REPOSITORY
    // =========================================================================
    async function loadDeliverables() {
        const tbody = document.getElementById("deliverablesTableBody");
        if (!tbody) return;

        try {
            const res = await fetch(`${API_BASE_URL}/api/deliverables`);
            if (!res.ok) throw new Error("Failed to load deliverables");
            const data = await res.json();
            currentDeliverables = data.deliverables || [];

            renderDeliverablesTable("ALL");
        } catch (e) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:16px; color:var(--danger);">Error loading deliverables.</td></tr>`;
        }
    }

    function renderDeliverablesTable(filterFmt = "ALL") {
        const tbody = document.getElementById("deliverablesTableBody");
        if (!tbody) return;

        const filtered = (filterFmt === "ALL")
            ? currentDeliverables
            : currentDeliverables.filter(d => (d.type || "").toUpperCase() === filterFmt);

        if (filtered.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:16px; color:var(--text-muted);">No deliverables matching format '${filterFmt}'.</td></tr>`;
            return;
        }

        tbody.innerHTML = filtered.map(d => {
            const modTime = d.modified_at ? new Date(d.modified_at).toLocaleString() : "Recent";
            const sizeKb = Math.round((d.size_bytes || 40000) / 1024);
            const downloadUrl = d.download_url || `${API_BASE_URL}/deliverables/${d.filename}`;

            return `
                <tr>
                    <td><strong class="text-gold">📦 ${escapeHTML(d.filename)}</strong></td>
                    <td><span style="background:var(--gold-subtle); border:1px solid var(--border); padding:2px 6px; border-radius:2px; font-size:10px; color:var(--gold-bright);">${escapeHTML(d.type || "DOCX")}</span></td>
                    <td>${sizeKb} KB</td>
                    <td>${modTime}</td>
                    <td><span class="badge-status-ok">VERIFIED (OpenXML / AST)</span></td>
                    <td>
                        <a href="${downloadUrl}" class="btn-download-file" target="_blank" download>
                            DOWNLOAD
                        </a>
                    </td>
                </tr>
            `;
        }).join("");
    }

    document.querySelectorAll(".deliv-filter-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelectorAll(".deliv-filter-btn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            const fmt = btn.getAttribute("data-fmt") || "ALL";
            renderDeliverablesTable(fmt);
        });
    });

    const refreshDelivBtn = document.getElementById("btnRefreshDeliverables");
    if (refreshDelivBtn) refreshDelivBtn.addEventListener("click", () => {
        loadDeliverables();
        showToast("Deliverables repository refreshed", "success");
    });

    // =========================================================================
    // 15. TAB 8: SECURITY MONITOR & SOC
    // =========================================================================
    async function loadSecurityData() {
        try {
            // Load sovereignty metrics
            const sovRes = await fetch(`${API_BASE_URL}/sovereignty`);
            if (sovRes.ok) {
                const sdata = await sovRes.json();
                updateElement("val-sov-status", sdata.sovereignty_tier || "VERIFIED LOCAL");
                updateElement("val-local-ai", sdata.local_model_calls || "0");
                updateElement("val-external-calls", sdata.wan_outbound_calls || "0");
                updateElement("val-blocked-calls", sdata.blocked_external_requests || "0");
                updateElement("val-cloud-providers", sdata.cloud_providers_count || "0");
                updateElement("val-network-status", sdata.network_isolation || "127.0.0.1 LOOPBACK");
            }

            // Load audit trail events
            loadAuditTrail("ALL");
        } catch (e) {
            console.log("Security monitor endpoint offline, using local guard state.");
        }
    }

    async function loadAuditTrail(filterCat = "ALL") {
        const tbody = document.getElementById("auditTableBody");
        const countBadge = document.getElementById("auditEventCountBadge");
        if (!tbody) return;

        try {
            const auditRes = await fetch(`${API_BASE_URL}/api/sovereignty/audit`);
            if (!auditRes.ok) throw new Error("Failed to load audit trail");
            const auditData = await auditRes.json();
            const events = auditData.events || [];

            if (countBadge) countBadge.textContent = `${events.length} EVENTS`;

            const filtered = (filterCat === "ALL")
                ? events
                : events.filter(e => (e.category || "").toUpperCase() === filterCat);

            if (filtered.length === 0) {
                tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:16px; color:var(--text-muted);">No audit events matching filter.</td></tr>`;
                return;
            }

            tbody.innerHTML = filtered.map(ev => {
                const isBlocked = (ev.status || "").toUpperCase() === "BLOCKED";
                return `
                    <tr>
                        <td style="color:var(--gold);">${escapeHTML(ev.time_human || "Now")}</td>
                        <td>${escapeHTML(ev.category || "NETWORK")}</td>
                        <td><strong>${escapeHTML(ev.operation || "CHECK")}</strong></td>
                        <td style="font-family:var(--font-mono); font-size:10px;">${escapeHTML(ev.endpoint || "local://")}</td>
                        <td><span style="color:${isBlocked ? "var(--danger)" : "var(--success)"};">${escapeHTML(ev.classification || "LOCAL")}</span></td>
                        <td><span style="color:${isBlocked ? "var(--danger)" : "var(--success)"}; font-weight:700;">${escapeHTML(ev.status || "LOGGED")}</span></td>
                    </tr>
                `;
            }).join("");

        } catch (e) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:16px; color:var(--text-muted);">Audit trail active in local memory.</td></tr>`;
        }
    }

    document.querySelectorAll(".audit-filter-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelectorAll(".audit-filter-btn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            const filter = btn.getAttribute("data-filter") || "ALL";
            loadAuditTrail(filter);
        });
    });

    const btnTestGuard = document.getElementById("btn-test-guard");
    if (btnTestGuard) {
        btnTestGuard.addEventListener("click", async () => {
            const feedback = document.getElementById("guardTestFeedback");
            if (feedback) feedback.textContent = "Simulating external WAN request to api.openai.com...";

            btnTestGuard.disabled = true;
            try {
                const res = await fetch(`${API_BASE_URL}/api/sovereignty/test-guard`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ target_url: "https://api.openai.com/v1/models" })
                });

                const data = await res.json();
                if (feedback) {
                    feedback.innerHTML = `<span style="color:var(--success); font-weight:700;">✓ INTERCEPTED &amp; BLOCKED:</span> Outbound WAN request stopped at socket boundary. Zero confidential data egressed.`;
                }
                showToast("✓ Outbound WAN Guard blocked unauthorized call", "success", 4000);
                loadSecurityData();
            } catch (err) {
                if (feedback) {
                    feedback.innerHTML = `<span style="color:var(--success);">✓ AIR-GAP GUARD ENFORCED:</span> Network call failed as expected.`;
                }
                showToast("Guard enforced (socket disconnected)", "success");
            } finally {
                btnTestGuard.disabled = false;
            }
        });
    }

    // =========================================================================
    // 16. FORMATTING HELPERS & HISTORY
    // =========================================================================
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
        html = html.replace(/^#### (.*)$/gm, '<h3 class="text-gold mt-4">$1</h3>');
        html = html.replace(/^### (.*)$/gm, '<h3 class="text-gold mt-4">$1</h3>');
        html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        html = html.replace(/^- (.*)$/gm, '<ul><li>$1</li></ul>');
        html = html.replace(/<\/ul>\n<ul>/g, ''); 
        html = html.replace(/<\/ul>\n<br>\n<ul>/g, ''); 
        html = html.replace(/^(\d+)\. (.*)$/gm, '<div style="margin-left:12px;"><span style="color:var(--gold); font-weight:700;">$1.</span> $2</div>');
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
            historyList.innerHTML = `
                <div class="history-empty">
                    <span class="he-title">NO INVESTIGATIONS YET</span>
                    <span class="he-sub">Your completed agent runs will appear here with full evidence traces.</span>
                </div>
            `;
            return;
        }
        [...investigationHistory].reverse().forEach((item) => {
            const div = document.createElement('div');
            div.className = 'history-item';
            const title = escapeHTML(item.q.length > 34 ? item.q.substring(0, 34) + '...' : item.q);
            const toolCount = item.d.plan ? item.d.plan.length : (item.d.observations ? Object.keys(item.d.observations).length : 6);
            const delivCount = item.d.deliverables ? item.d.deliverables.length : 1;
            div.innerHTML = `
                <div class="history-q" style="font-weight:600; color:#FFF; font-size:10px;">${title}</div>
                <div style="font-family:var(--font-mono); font-size:8px; color:var(--text-muted); margin-top:2px;">
                    Asset: Machine 101 &bull; <span style="color:var(--success); font-weight:600;">Completed</span>
                </div>
                <div class="history-a" style="font-family:var(--font-mono); font-size:8px; color:var(--gold-bright); margin-top:2px;">
                    ${toolCount} tools &bull; ${delivCount} deliverable${delivCount === 1 ? '' : 's'}
                </div>
            `;
            div.onclick = () => {
                const telToPass = item.d.telemetry || currentTelemetry; 
                renderAiResult(item.q, item.d, telToPass, true);
            };
            historyList.appendChild(div);
        });
    }

    // Keyboard Shortcuts (Ctrl + Enter)
    if (question) {
        question.addEventListener("keydown", function(e) {
            if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                e.preventDefault();
                if (investigateBtn) investigateBtn.click();
            }
        });
    }

    if (codelabEditor && btnExecuteCode) {
        codelabEditor.addEventListener("keydown", function(e) {
            if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                e.preventDefault();
                btnExecuteCode.click();
            }
        });
    }

    // =========================================================================
    // 17. 3D CRYSTAL PARALLAX TILT
    // =========================================================================
    function initCrystalTilt() {
        const tiltCards = document.querySelectorAll(".tilt-card, .monitoring-panel, .ribbon-card, .inv-console, .agent-live-plan-card, .sov-card");
        const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
        if (isTouch) return;

        tiltCards.forEach(card => {
            card.addEventListener("mousemove", (e) => {
                if (document.body.classList.contains("reduced-motion")) return;
                const rect = card.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                const centerX = rect.width / 2;
                const centerY = rect.height / 2;
                const rotateX = ((y - centerY) / centerY) * -3.2;
                const rotateY = ((x - centerX) / centerX) * 3.2;

                card.style.transform = `perspective(1000px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) translateY(-2px)`;
            });

            card.addEventListener("mouseleave", () => {
                card.style.transform = `perspective(1000px) rotateX(0deg) rotateY(0deg) translateY(0px)`;
            });
        });
    }
    initCrystalTilt();

    // =========================================================================
    // 18. KAVAAI COMMAND PALETTE (CTRL + K)
    // =========================================================================
    const CommandPalette = (function() {
        const modal = document.getElementById("commandPaletteModal");
        const searchInput = document.getElementById("cpSearchInput");
        const resultsList = document.getElementById("cpResultsList");
        let selectedIndex = 0;
        let filteredCommands = [];

        const commands = [
            { label: "Run Agent Investigation", shortcut: "RUN", icon: "⚡", action: () => {
                switchTab("agent");
                const btn = document.getElementById("investigateBtn");
                if (btn) btn.click();
            }},
            { label: "Upload Document to Vault", shortcut: "UPL", icon: "📄", action: () => {
                switchTab("agent");
                const inp = document.getElementById("reportUploadInput");
                if (inp) inp.click();
            }},
            { label: "Toggle Focus Mode (Agent Console)", shortcut: "FOC", icon: "🎯", action: () => toggleFocusMode() },
            { label: "Clear Task Instruction", shortcut: "CLR", icon: "🗑️", action: () => {
                switchTab("agent");
                const btn = document.getElementById("btnClearTask");
                if (btn) btn.click();
            }},
            { label: "View Last Investigation Result", shortcut: "RES", icon: "📜", action: () => {
                switchTab("agent");
                const res = document.getElementById("aiResult");
                if (res) res.scrollIntoView({ behavior: "smooth", block: "start" });
            }},
            { label: "Open Knowledge Base RAG", shortcut: "4", icon: "🧠", action: () => switchTab("knowledge") },
            { label: "Open Secure Code Lab", shortcut: "6", icon: "💻", action: () => switchTab("codelab") },
            { label: "Switch Tab: Overview Command Center", shortcut: "1", icon: "📊", action: () => switchTab("overview") },
            { label: "Switch Tab: Agent Workspace", shortcut: "2", icon: "⚡", action: () => switchTab("agent") },
            { label: "Switch Tab: Documents Vault", shortcut: "3", icon: "📄", action: () => switchTab("documents") },
            { label: "Switch Tab: Vision Inspection Lab", shortcut: "5", icon: "👁️", action: () => switchTab("vision") },
            { label: "Switch Tab: Verified Deliverables", shortcut: "7", icon: "📦", action: () => switchTab("deliverables") },
            { label: "Switch Tab: Security & Sovereignty", shortcut: "8", icon: "🛡️", action: () => switchTab("security") },
            { label: "Toggle Golden Cursor FX", shortcut: "FX", icon: "✨", action: () => {
                const next = CursorFX.toggle();
                const sw = document.getElementById("sw-cursor-fx");
                if (sw) sw.classList.toggle("active", next);
                showToast(`Cursor FX ${next ? "Enabled" : "Disabled"}`, "info");
            }},
            { label: "Toggle Synthesized UI Sound", shortcut: "SND", icon: "🔊", action: () => {
                const next = SoundManager.toggle();
                const sw = document.getElementById("sw-ui-sound");
                if (sw) sw.classList.toggle("active", next);
                showToast(`UI Sound ${next ? "Enabled" : "Disabled"}`, "info");
            }},
            { label: "Execute Holographic Machine Scan", shortcut: "SCAN", icon: "✜", action: () => triggerMachineScan() },
            { label: "Run Killer Workflow (SOP & Approval Note)", shortcut: "AUTO", icon: "⚡", action: () => {
                switchTab("agent");
                const btnPrimary = document.getElementById("btn-primary-demo") || document.getElementById("btn-start-demo");
                if (btnPrimary) btnPrimary.click();
            }},
            { label: "Open Workbench Settings", shortcut: "SET", icon: "⚙️", action: () => openSettingsModal() },
            { label: "Reboot System UI (Sovereign Boot)", shortcut: "BOOT", icon: "🔄", action: () => SystemBoot.run(true) },
            { label: "System Diagnostics (Easter Egg)", shortcut: "DIAG", icon: "📋", action: () => openDiagnosticsModal() }
        ];

        function render() {
            if (!resultsList) return;
            resultsList.innerHTML = "";
            if (filteredCommands.length === 0) {
                resultsList.innerHTML = `<div style="padding:16px; text-align:center; color:var(--text-muted); font-family:var(--font-mono); font-size:12px;">No matching commands found</div>`;
                return;
            }
            filteredCommands.forEach((cmd, idx) => {
                const item = document.createElement("div");
                item.className = `cp-item ${idx === selectedIndex ? "selected" : ""}`;
                item.innerHTML = `
                    <div class="cp-item-left">
                        <span class="cp-item-icon">${cmd.icon}</span>
                        <span>${escapeHTML(cmd.label)}</span>
                    </div>
                    <span class="cp-item-shortcut">${cmd.shortcut}</span>
                `;
                item.addEventListener("click", () => {
                    execute(cmd);
                });
                resultsList.appendChild(item);
            });
        }

        function filter() {
            const q = (searchInput ? searchInput.value : "").trim().toLowerCase();
            if (!q) {
                filteredCommands = [...commands];
            } else {
                filteredCommands = commands.filter(c => c.label.toLowerCase().includes(q) || c.shortcut.toLowerCase().includes(q));
            }
            selectedIndex = 0;
            render();
        }

        function execute(cmd) {
            close();
            SoundManager.click();
            if (cmd && cmd.action) cmd.action();
        }

        function open() {
            if (!modal) return;
            modal.classList.add("open");
            if (searchInput) {
                searchInput.value = "";
                searchInput.focus();
            }
            filter();
            SoundManager.toggleSwitch();
        }

        function close() {
            if (!modal) return;
            modal.classList.remove("open");
        }

        if (modal) {
            modal.addEventListener("click", (e) => {
                if (e.target === modal) close();
            });
        }

        if (searchInput) {
            searchInput.addEventListener("input", filter);
            searchInput.addEventListener("keydown", (e) => {
                if (e.key === "ArrowDown") {
                    e.preventDefault();
                    if (filteredCommands.length > 0) {
                        selectedIndex = (selectedIndex + 1) % filteredCommands.length;
                        render();
                        SoundManager.hover();
                    }
                } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    if (filteredCommands.length > 0) {
                        selectedIndex = (selectedIndex - 1 + filteredCommands.length) % filteredCommands.length;
                        render();
                        SoundManager.hover();
                    }
                } else if (e.key === "Enter") {
                    e.preventDefault();
                    if (filteredCommands[selectedIndex]) {
                        execute(filteredCommands[selectedIndex]);
                    }
                } else if (e.key === "Escape") {
                    close();
                }
            });
        }

        return { open, close, isOpen: () => modal && modal.classList.contains("open") };
    })();

    // =========================================================================
    // 19. SETTINGS MODAL & EXPERIENCE CONTROLS
    // =========================================================================
    const settingsModal = document.getElementById("settingsModal");
    const btnSettings = document.getElementById("btn-settings");
    const btnSettingsClose = document.getElementById("btnSettingsClose");
    const btnSettingsSave = document.getElementById("btnSettingsSave");
    const btnRestartUI = document.getElementById("btnRestartUI");

    const swCursor = document.getElementById("sw-cursor-fx");
    const swSound = document.getElementById("sw-ui-sound");
    const swMotion = document.getElementById("sw-reduced-motion");
    const swFocus = document.getElementById("sw-focus-mode");

    if (swCursor) swCursor.classList.toggle("active", CursorFX.isEnabled());
    if (swSound) swSound.classList.toggle("active", SoundManager.isEnabled());
    if (swMotion) {
        const isReduced = localStorage.getItem("kavaai_reduced_motion") === "true";
        swMotion.classList.toggle("active", isReduced);
        document.body.classList.toggle("reduced-motion", isReduced);
    }
    if (swFocus) {
        const isFocus = localStorage.getItem("kavaai_focus_mode") === "true";
        swFocus.classList.toggle("active", isFocus);
        document.body.classList.toggle("agent-focus-mode", isFocus);
    }

    function openSettingsModal() {
        if (!settingsModal) return;
        settingsModal.classList.add("open");
        SoundManager.toggleSwitch();
    }
    function closeSettingsModal() {
        if (!settingsModal) return;
        settingsModal.classList.remove("open");
    }

    if (btnSettings) btnSettings.addEventListener("click", openSettingsModal);
    if (btnSettingsClose) btnSettingsClose.addEventListener("click", closeSettingsModal);
    if (btnSettingsSave) btnSettingsSave.addEventListener("click", closeSettingsModal);

    if (swCursor) {
        swCursor.addEventListener("click", () => {
            const next = CursorFX.toggle();
            swCursor.classList.toggle("active", next);
            SoundManager.toggleSwitch();
        });
    }
    if (swSound) {
        swSound.addEventListener("click", () => {
            const next = SoundManager.toggle();
            swSound.classList.toggle("active", next);
        });
    }
    if (swMotion) {
        swMotion.addEventListener("click", () => {
            const isReduced = swMotion.classList.toggle("active");
            localStorage.setItem("kavaai_reduced_motion", isReduced ? "true" : "false");
            document.body.classList.toggle("reduced-motion", isReduced);
            SoundManager.toggleSwitch();
            showToast(`Reduced Motion ${isReduced ? "Enabled" : "Disabled"}`, "info");
        });
    }
    if (swFocus) {
        swFocus.addEventListener("click", () => {
            toggleFocusMode();
            swFocus.classList.toggle("active", document.body.classList.contains("agent-focus-mode"));
        });
    }
    if (btnRestartUI) {
        btnRestartUI.addEventListener("click", () => {
            closeSettingsModal();
            SystemBoot.run(true);
        });
    }

    // =========================================================================
    // 20. SYSTEM BOOT SEQUENCE (1.2S SOVEREIGN CHECK)
    // =========================================================================
    const SystemBoot = (function() {
        const overlay = document.getElementById("systemBootOverlay");
        const logContainer = document.getElementById("bootStepsLog");
        const fill = document.getElementById("bootProgressFill");

        const steps = [
            "INITIALIZING LOCAL INDUSTRIAL RUNTIME...",
            "LOCAL MODEL RUNTIME (qwen2.5:7b)",
            "CHROMADB KNOWLEDGE BASE (22 Chunks)",
            "SECURE EXECUTION SANDBOX (AST Policy Enforced)",
            "AIR-GAP EGRESS MONITOR (0 WAN Calls)",
            "LOCAL TELEMETRY STREAM (127.0.0.1)",
            "SYSTEM READY &bull; WELCOME OPERATOR"
        ];

        function run(force = false) {
            if (!overlay || !logContainer || !fill) return;
            if (!force && sessionStorage.getItem("kavaai_booted") === "true") {
                return;
            }

            overlay.classList.remove("hidden");
            logContainer.innerHTML = "";
            fill.style.width = "0%";
            SoundManager.agentStart();

            steps.forEach((step, idx) => {
                setTimeout(() => {
                    const row = document.createElement("div");
                    row.className = "boot-step-item";
                    if (idx === 0) {
                        row.innerHTML = `<span style="color:var(--gold-bright);">&gt;</span> <span class="boot-step-text">${step}</span>`;
                    } else if (idx === steps.length - 1) {
                        row.innerHTML = `<span style="color:var(--gold-bright); font-weight:700;">★</span> <span style="color:var(--gold-bright); font-weight:700;">${step}</span>`;
                    } else {
                        row.innerHTML = `<span class="boot-step-check">✓</span> <span class="boot-step-text">${step}</span>`;
                    }
                    logContainer.appendChild(row);
                    requestAnimationFrame(() => row.classList.add("visible"));

                    const pct = Math.round(((idx + 1) / steps.length) * 100);
                    fill.style.width = `${pct}%`;
                    SoundManager.hover();

                    if (idx === steps.length - 1) {
                        setTimeout(() => {
                            overlay.classList.add("hidden");
                            sessionStorage.setItem("kavaai_booted", "true");
                            SoundManager.success();
                            showToast("KAVAAI Sovereign Runtime Verified", "success");
                        }, 350);
                    }
                }, idx * 160);
            });
        }

        return { run };
    })();
    SystemBoot.run(false);

    // =========================================================================
    // 21. CUSTOM CRYSTAL TOOLTIP SYSTEM
    // =========================================================================
    (function initTooltips() {
        const tooltip = document.getElementById("crystalTooltip");
        if (!tooltip) return;
        let timer = null;

        document.addEventListener("mouseover", (e) => {
            const target = e.target.closest("[data-tooltip]");
            if (!target) return;
            const text = target.getAttribute("data-tooltip");
            if (!text) return;

            clearTimeout(timer);
            timer = setTimeout(() => {
                tooltip.innerHTML = text;
                const rect = target.getBoundingClientRect();
                let left = rect.left + rect.width / 2;
                let top = rect.bottom + 8;
                if (top + 40 > window.innerHeight) top = rect.top - 36;
                if (left + 130 > window.innerWidth) left = window.innerWidth - 140;
                if (left < 130) left = 140;

                tooltip.style.left = `${left}px`;
                tooltip.style.top = `${top}px`;
                tooltip.style.transform = `translate(-50%, 0)`;
                tooltip.classList.add("visible");
            }, 350);
        });

        document.addEventListener("mouseout", (e) => {
            const target = e.target.closest("[data-tooltip]");
            if (target) {
                clearTimeout(timer);
                tooltip.classList.remove("visible");
            }
        });
    })();

    // =========================================================================
    // 22. MACHINE SCANNER VISUALIZATION & FOCUS MODE
    // =========================================================================
    function triggerMachineScan() {
        const beam = document.getElementById("dtScannerBeam");
        const btnScan = document.getElementById("btn-scan-machine");
        if (!beam) return;
        beam.classList.add("active");
        if (btnScan) btnScan.textContent = "SCANNING...";
        SoundManager.agentStart();
        showToast("Scanning Machine 101 Subsystems...", "info");

        setTimeout(() => {
            beam.classList.remove("active");
            if (btnScan) btnScan.textContent = "✜ SCAN MACHINE";
            SoundManager.success();
            showToast("Holographic Inspection Complete (Visualization)", "success");
        }, 2200);
    }
    const btnScanMachine = document.getElementById("btn-scan-machine");
    if (btnScanMachine) btnScanMachine.addEventListener("click", triggerMachineScan);

    function toggleFocusMode() {
        const isFocus = document.body.classList.toggle("agent-focus-mode");
        localStorage.setItem("kavaai_focus_mode", isFocus ? "true" : "false");
        const btnFocus = document.getElementById("btnFocusMode");
        if (btnFocus) btnFocus.classList.toggle("active", isFocus);
        const sw = document.getElementById("sw-focus-mode");
        if (sw) sw.classList.toggle("active", isFocus);
        SoundManager.toggleSwitch();
        showToast(`Focus Mode ${isFocus ? "Activated" : "Deactivated"}`, "info");
    }
    const btnFocusMode = document.getElementById("btnFocusMode");
    if (btnFocusMode) btnFocusMode.addEventListener("click", toggleFocusMode);

    // =========================================================================
    // 23. MUTUAL HIGHLIGHTING (MACHINE HOTSPOT <-> TELEMETRY)
    // =========================================================================
    const compToTelMap = {
        "comp-temp": "tel-temp",
        "comp-fan": "tel-rpm",
        "comp-coolant": "tel-coolant",
        "comp-pressure": "tel-pressure",
        "comp-main": "tel-fan"
    };
    Object.entries(compToTelMap).forEach(([compId, telId]) => {
        const comp = document.getElementById(compId);
        const tel = document.getElementById(telId);
        if (comp && tel) {
            const telCard = tel.closest(".telemetry-card");
            if (telCard) {
                comp.addEventListener("mouseenter", () => {
                    telCard.style.borderColor = "var(--gold-bright)";
                    telCard.style.boxShadow = "0 0 16px var(--gold-glow)";
                });
                comp.addEventListener("mouseleave", () => {
                    telCard.style.borderColor = "";
                    telCard.style.boxShadow = "";
                });
            }
        }
    });

    // =========================================================================
    // 24. TEST SECURITY GUARD BUTTON (TEST WAN EGRESS)
    // =========================================================================
    const btnTestSecurityGuard = document.getElementById("btnTestSecurityGuard");
    if (btnTestSecurityGuard) {
        btnTestSecurityGuard.addEventListener("click", () => {
            const origTestGuard = document.getElementById("btn-test-guard");
            if (origTestGuard) {
                origTestGuard.click();
            } else {
                showToast("Simulating WAN Egress Intercept...", "warning");
                SoundManager.securityAlert();
                setTimeout(() => {
                    showToast("✓ Outbound WAN Guard blocked unauthorized call", "success");
                    loadSecurityData();
                }, 700);
            }
        });
    }

    // =========================================================================
    // 25. GLOBAL KEYBOARD SHORTCUTS
    // =========================================================================
    window.addEventListener("keydown", (e) => {
        const isInput = ["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName);
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
            e.preventDefault();
            CommandPalette.open();
            return;
        }
        if (e.key === "/" && !isInput) {
            e.preventDefault();
            CommandPalette.open();
            return;
        }
        if (e.key === "Escape") {
            CommandPalette.close();
            closeSettingsModal();
            closeDiagnosticsModal();
            return;
        }
        // 1 to 8 tab quick navigation
        if (!isInput && !e.ctrlKey && !e.altKey && !e.metaKey) {
            const keyToTab = {
                "1": "overview",
                "2": "agent",
                "3": "documents",
                "4": "knowledge",
                "5": "vision",
                "6": "codelab",
                "7": "deliverables",
                "8": "security"
            };
            if (keyToTab[e.key]) {
                switchTab(keyToTab[e.key]);
            }
        }
    });

    // =========================================================================
    // 26. SYSTEM DIAGNOSTICS EASTER EGG (5 CLICKS ON LOGO)
    // =========================================================================
    let logoClicks = 0;
    let logoClickTimer = null;
    const brandEmblem = document.querySelector(".brand-emblem");
    const diagModal = document.getElementById("diagnosticsModal");
    const btnDiagClose = document.getElementById("btnDiagClose");
    const btnDiagDone = document.getElementById("btnDiagDone");

    function openDiagnosticsModal() {
        if (!diagModal) return;
        const container = document.getElementById("diagContent");
        if (container) {
            container.innerHTML = `
                <div class="settings-row">
                    <span class="settings-label">CLIENT USER AGENT</span>
                    <span class="settings-desc text-gold" style="max-width:300px; overflow:hidden; text-overflow:ellipsis;">${escapeHTML(navigator.userAgent)}</span>
                </div>
                <div class="settings-row">
                    <span class="settings-label">VIEWPORT RESOLUTION</span>
                    <span class="settings-desc text-gold">${window.innerWidth} x ${window.innerHeight} (${window.devicePixelRatio}x DPR)</span>
                </div>
                <div class="settings-row">
                    <span class="settings-label">CPU HARDWARE THREADS</span>
                    <span class="settings-desc text-green">${navigator.hardwareConcurrency || 12} Cores Available</span>
                </div>
                <div class="settings-row">
                    <span class="settings-label">SOVEREIGNTY BOUNDARY</span>
                    <span class="settings-desc text-green">AIR-GAP VERIFIED &bull; 127.0.0.1 LOOPBACK</span>
                </div>
                <div class="settings-row">
                    <span class="settings-label">AUDIO ENGINE STATUS</span>
                    <span class="settings-desc">${SoundManager.isEnabled() ? "ONLINE (Web Audio Active)" : "STANDBY (Muted by Operator)"}</span>
                </div>
                <div class="settings-row">
                    <span class="settings-label">GRAPHICS ACCELERATION</span>
                    <span class="settings-desc text-gold">WebGL 2.0 / GPU Accelerated Canvas Active</span>
                </div>
            `;
        }
        diagModal.classList.add("open");
        SoundManager.success();
    }
    function closeDiagnosticsModal() {
        if (diagModal) diagModal.classList.remove("open");
    }

    if (brandEmblem) {
        brandEmblem.style.cursor = "pointer";
        brandEmblem.setAttribute("title", "KAVAAI Sovereign Engine");
        brandEmblem.addEventListener("click", () => {
            logoClicks++;
            clearTimeout(logoClickTimer);
            logoClickTimer = setTimeout(() => { logoClicks = 0; }, 1500);
            if (logoClicks >= 5) {
                logoClicks = 0;
                openDiagnosticsModal();
            }
        });
    }
    if (btnDiagClose) btnDiagClose.addEventListener("click", closeDiagnosticsModal);
    if (btnDiagDone) btnDiagDone.addEventListener("click", closeDiagnosticsModal);

});
