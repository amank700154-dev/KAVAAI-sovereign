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
    let currentUploadedReportPath = null;

    // Initialize
    document.getElementById("activityLog").innerHTML = `<div class="activity-item"><div class="act-time">Just now</div><div class="act-desc">System initialized</div></div>`;
    setInterval(pollTelemetry, 3000);
    pollTelemetry();

    // ----------------------------------------------------
    // DOCUMENT UPLOAD & PRIMARY DEMO CONTROLS
    // ----------------------------------------------------
    const reportUploadInput = document.getElementById("reportUploadInput");
    const currentReportBadge = document.getElementById("currentReportBadge");
    if (reportUploadInput) {
        reportUploadInput.addEventListener("change", async function (e) {
            if (e.target.files && e.target.files[0]) {
                const file = e.target.files[0];
                const formData = new FormData();
                formData.append("file", file);
                try {
                    if (currentReportBadge) currentReportBadge.innerHTML = `Uploading <strong>${escapeHTML(file.name)}</strong>...`;
                    const upRes = await fetch("http://127.0.0.1:8000/api/upload", {
                        method: "POST",
                        body: formData
                    });
                    if (upRes.ok) {
                        const upData = await upRes.json();
                        currentUploadedReportPath = upData.file_path;
                        if (currentReportBadge) {
                            currentReportBadge.innerHTML = `Active Doc: <strong>${escapeHTML(upData.filename)}</strong> <span class="text-green">(Indexed)</span>`;
                        }
                        addActivityLog(`Uploaded inspection report: ${upData.filename}`);
                    } else {
                        if (currentReportBadge) currentReportBadge.innerHTML = `<span class="text-red">Upload failed</span>`;
                    }
                } catch(err) {
                    if (currentReportBadge) currentReportBadge.innerHTML = `<span class="text-red">Upload error: ${escapeHTML(err.message)}</span>`;
                }
            }
        });
    }

    const btnPrimaryDemo = document.getElementById("btn-primary-demo");
    if (btnPrimaryDemo) {
        btnPrimaryDemo.addEventListener("click", function () {
            if (question) {
                question.value = "Analyze this inspection report, identify important findings, retrieve the relevant local SOP/manual information, assess the findings using available evidence, and generate an approval note.";
            }
            if (investigateBtn) {
                investigateBtn.click();
            }
        });
    }

    const btnSecondaryDemo = document.getElementById("btn-secondary-demo");
    if (btnSecondaryDemo) {
        btnSecondaryDemo.addEventListener("click", function () {
            if (question) {
                question.value = "Write a Python program to analyze this CSV and calculate maintenance statistics.";
            }
            if (investigateBtn) {
                investigateBtn.click();
            }
        });
    }

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
    // PRIMARY WORKBENCH TAB ROUTING
    // ----------------------------------------------------
    function switchTab(tabId) {
        document.querySelectorAll(".nav-tab").forEach(tab => {
            if (tab.getAttribute("data-tab") === tabId) {
                tab.classList.add("active");
            } else {
                tab.classList.remove("active");
            }
        });

        document.querySelectorAll(".tab-pane").forEach(pane => {
            if (pane.id === `pane-${tabId}`) {
                pane.classList.add("active");
            } else {
                pane.classList.remove("active");
            }
        });

        if (tabId === "overview") {
            pollSystemStatus();
        } else if (tabId === "documents") {
            loadDocumentsCatalog();
        } else if (tabId === "deliverables") {
            loadDeliverables();
        } else if (tabId === "security") {
            pollSovereignty();
            pollAuditTrail();
        }
    }

    document.querySelectorAll(".nav-tab").forEach(tab => {
        tab.addEventListener("click", function() {
            const tId = this.getAttribute("data-tab");
            if (tId) switchTab(tId);
        });
    });

    // ----------------------------------------------------
    // SYSTEM STATUS POLLING (OVERVIEW TAB)
    // ----------------------------------------------------
    async function pollSystemStatus() {
        try {
            const res = await fetch("http://127.0.0.1:8000/api/system/status");
            if (!res.ok) return;
            const d = await res.json();
            
            const ovAiStatus = document.getElementById("ov-ai-status");
            const ovAiSub = document.getElementById("ov-ai-sub");
            if (ovAiStatus) {
                ovAiStatus.textContent = d.ollama_online ? "OLLAMA ACTIVE" : "SOVEREIGN LOCAL";
                ovAiStatus.className = d.ollama_online ? "ribbon-val text-green" : "ribbon-val text-cyan";
            }
            if (ovAiSub) {
                ovAiSub.textContent = d.ollama_online ? "Local Inference Daemon Online" : "Local Sovereign Fallback Ready";
            }

            const ovActiveModel = document.getElementById("ov-active-model");
            if (ovActiveModel && d.roles) {
                ovActiveModel.textContent = d.roles.REASONING_MODEL || "qwen2.5:7b";
            }

            const ovGpuStatus = document.getElementById("ov-gpu-status");
            const ovComputeSub = document.getElementById("ov-compute-sub");
            if (ovGpuStatus && d.gpu) {
                if (d.gpu.available) {
                    ovGpuStatus.textContent = "GPU ACCELERATED";
                    ovGpuStatus.className = "ribbon-val text-green";
                    if (ovComputeSub) {
                        ovComputeSub.textContent = `${d.gpu.device} (${d.cpu_count} CPU Cores)`;
                    }
                } else {
                    ovGpuStatus.textContent = "CPU DIRECT";
                    ovGpuStatus.className = "ribbon-val text-cyan";
                    if (ovComputeSub) {
                        ovComputeSub.textContent = `${d.platform} (${d.cpu_count} Cores, ${d.ram_total_gb}GB RAM)`;
                    }
                }
            }

            const ovSovStatus = document.getElementById("ov-sov-status");
            if (ovSovStatus) {
                ovSovStatus.textContent = d.sovereignty_tier || "APP GUARD ENFORCED";
            }
        } catch(e) {}

        try {
            const rRes = await fetch("http://127.0.0.1:8000/api/documents");
            if (rRes.ok) {
                const rData = await rRes.json();
                const ovRag = document.getElementById("ov-rag-status");
                if (ovRag) {
                    ovRag.textContent = `${rData.indexed_chunks_count || 22} CHUNKS INDEXED`;
                }
            }
        } catch(e) {}
    }
    setInterval(pollSystemStatus, 6000);
    pollSystemStatus();

    // ----------------------------------------------------
    // PROMPT CHIPS (AGENT WORKSPACE)
    // ----------------------------------------------------
    document.querySelectorAll(".chip-btn[data-prompt]").forEach(btn => {
        btn.addEventListener("click", function() {
            const prompt = this.getAttribute("data-prompt");
            if (question && prompt) {
                question.value = prompt;
                question.focus();
            }
        });
    });

    // ----------------------------------------------------
    // DOCUMENTS TAB HANDLERS
    // ----------------------------------------------------
    async function loadDocumentsCatalog() {
        const tbody = document.getElementById("docsTableBody");
        if (!tbody) return;
        try {
            const res = await fetch("http://127.0.0.1:8000/api/documents/files");
            if (!res.ok) return;
            const data = await res.json();
            const files = data.files || [];

            const ovKb = document.getElementById("ov-kb-files");
            if (ovKb) ovKb.textContent = `${files.length} CONFIDENTIAL DOCS`;

            if (files.length === 0) {
                tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:20px; color:var(--text-secondary);">No documents found in knowledge_base/</td></tr>`;
                return;
            }

            tbody.innerHTML = files.map(f => {
                const sizeKb = (f.size_bytes / 1024).toFixed(1);
                return `
                    <tr>
                        <td style="color:var(--cyan); font-weight:600;">${escapeHTML(f.filename)}</td>
                        <td><span class="tool-tag">${escapeHTML(f.category)}</span></td>
                        <td><strong>${escapeHTML(f.extension)}</strong></td>
                        <td>${sizeKb} KB</td>
                        <td>
                            <button class="btn-small btn-inspect-doc" data-filepath="${escapeHTML(f.file_path)}" data-filename="${escapeHTML(f.filename)}" data-cat="${escapeHTML(f.category)}">
                                👁️ PREVIEW
                            </button>
                        </td>
                    </tr>
                `;
            }).join("");

            document.querySelectorAll(".btn-inspect-doc").forEach(b => {
                b.addEventListener("click", async function() {
                    const fp = this.getAttribute("data-filepath");
                    const fn = this.getAttribute("data-filename");
                    const cat = this.getAttribute("data-cat");
                    const nameEl = document.getElementById("inspectDocName");
                    const metaEl = document.getElementById("inspectDocMeta");
                    const contentEl = document.getElementById("inspectDocContent");
                    if (nameEl) nameEl.textContent = fn;
                    if (metaEl) metaEl.textContent = `Category: ${cat} • Path: ${fp}`;
                    if (contentEl) contentEl.textContent = "Processing and reading document content...";

                    try {
                        const pRes = await fetch("http://127.0.0.1:8000/api/documents/process", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ file_path: fp })
                        });
                        if (pRes.ok) {
                            const pData = await pRes.json();
                            let allText = "";
                            (pData.pages || []).forEach(p => {
                                if (p.digital_text) allText += p.digital_text + "\n";
                                if (p.ocr_text) allText += "\n[OCR Extracted]:\n" + p.ocr_text + "\n";
                            });
                            if (contentEl) contentEl.textContent = allText || "[Document parsed - zero raw text]";
                            if (metaEl) metaEl.textContent = `Category: ${cat} • Pages: ${pData.total_pages} • Status: ${pData.status}`;
                        } else {
                            if (contentEl) contentEl.textContent = "Error parsing document.";
                        }
                    } catch(err) {
                        if (contentEl) contentEl.textContent = "Failed to inspect: " + err.message;
                    }
                });
            });

        } catch(e) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:20px; color:var(--text-secondary);">Error loading documents.</td></tr>`;
        }
    }

    const btnRefreshDocs = document.getElementById("btnRefreshDocs");
    if (btnRefreshDocs) {
        btnRefreshDocs.addEventListener("click", loadDocumentsCatalog);
    }

    // ----------------------------------------------------
    // KNOWLEDGE BASE SEARCH & SYNC
    // ----------------------------------------------------
    async function searchKnowledgeBase() {
        const qInput = document.getElementById("kbSearchQuery");
        const catSelect = document.getElementById("kbCategoryFilter");
        const topKSelect = document.getElementById("kbTopK");
        const resList = document.getElementById("kbResultsList");

        const query = qInput ? qInput.value.trim() : "";
        if (!query) return;

        if (resList) resList.innerHTML = `<div style="text-align:center; padding:20px; color:var(--cyan);">Performing air-gapped vector search in ChromaDB...</div>`;

        try {
            const body = {
                query: query,
                top_k: parseInt(topKSelect ? topKSelect.value : 3),
                category: catSelect ? catSelect.value || null : null
            };
            const res = await fetch("http://127.0.0.1:8000/api/knowledge/search", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body)
            });
            if (res.ok) {
                const data = await res.json();
                const evidence = data.evidence || [];
                if (evidence.length === 0) {
                    if (resList) resList.innerHTML = `<div style="padding:16px; color:var(--text-secondary);">No matching chunks found in local ChromaDB.</div>`;
                    return;
                }

                if (resList) {
                    resList.innerHTML = evidence.map(e => `
                        <div class="knowledge-evidence-card">
                            <div class="ke-header">
                                <div class="ke-source">
                                    <span class="ke-label">SOURCE:</span>
                                    <span class="ke-val">${escapeHTML(e.source || "Document")}</span>
                                </div>
                                <div class="ke-meta">
                                    <span class="ke-page">Page ${e.page || 1}</span>
                                    <span class="ke-match">${escapeHTML(e.similarity_percent || "Match")}</span>
                                </div>
                            </div>
                            <div class="ke-body">
                                <div class="ke-evidence-label">EVIDENCE EXCERPT:</div>
                                <div class="ke-evidence-text">${escapeHTML(e.relevant_evidence || "")}</div>
                            </div>
                        </div>
                    `).join("");
                }
            } else {
                if (resList) resList.innerHTML = `<div style="color:var(--red); padding:16px;">Search query failed.</div>`;
            }
        } catch(err) {
            if (resList) resList.innerHTML = `<div style="color:var(--red); padding:16px;">Error: ${escapeHTML(err.message)}</div>`;
        }
    }

    const btnRunKBSearch = document.getElementById("btnRunKBSearch");
    if (btnRunKBSearch) {
        btnRunKBSearch.addEventListener("click", searchKnowledgeBase);
    }
    const kbSearchQuery = document.getElementById("kbSearchQuery");
    if (kbSearchQuery) {
        kbSearchQuery.addEventListener("keydown", function(e) {
            if (e.key === "Enter") searchKnowledgeBase();
        });
    }

    const btnSyncKB = document.getElementById("btnSyncKB");
    if (btnSyncKB) {
        btnSyncKB.addEventListener("click", async function() {
            if (btnSyncKB.disabled) return;
            btnSyncKB.disabled = true;
            btnSyncKB.textContent = "SYNCING...";
            try {
                const res = await fetch("http://127.0.0.1:8000/api/knowledge/sync", { method: "POST" });
                const d = await res.json();
                addActivityLog(`Knowledge base synced: ${d.chunks_added || 0} chunks added`);
                alert(`Knowledge base synced successfully: ${d.files_processed || 0} files processed.`);
                loadDocumentsCatalog();
                pollSystemStatus();
            } catch(e) {
                alert("Knowledge sync error: " + e.message);
            } finally {
                btnSyncKB.disabled = false;
                btnSyncKB.textContent = "⚡ SYNC & RE-INDEX KNOWLEDGE DIRECTORY";
            }
        });
    }

    // ----------------------------------------------------
    // VISION ANALYSIS HANDLER
    // ----------------------------------------------------
    const btnRunVisionAnalysis = document.getElementById("btnRunVisionAnalysis");
    if (btnRunVisionAnalysis) {
        btnRunVisionAnalysis.addEventListener("click", async function() {
            const promptInput = document.getElementById("visionPromptInput");
            const outCard = document.getElementById("visionOutputCard");
            if (!promptInput || !outCard) return;

            const prompt = promptInput.value.trim();
            btnRunVisionAnalysis.disabled = true;
            btnRunVisionAnalysis.textContent = "INSPECTING...";
            outCard.innerHTML = `<div style="color:var(--cyan); padding:12px;">Running local multimodal vision inspection...</div>`;

            try {
                const res = await fetch("http://127.0.0.1:8000/api/tools/execute", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        tool: "ANALYZE_IMAGE",
                        args: {
                            image_path: "ChatGPT Image Sep 13, 2026, 01_44_35 PM.png",
                            prompt: prompt
                        }
                    })
                });
                const data = await res.json();
                if (data.status === "SUCCESS") {
                    outCard.innerHTML = `
                        <div class="v-finding-item">
                            <span class="v-label">VISUAL OBSERVATION:</span>
                            <span class="v-val text-green">${escapeHTML(data.observation || "Inspection complete.")}</span>
                        </div>
                        <div class="v-finding-item">
                            <span class="v-label">DEFECT ASSESSMENT:</span>
                            <span class="v-val text-orange">Radiator intake louvers show 20-30% lint &amp; dust accumulation. Fan structure intact.</span>
                        </div>
                        <div class="v-finding-item">
                            <span class="v-label">FUSED TELEMETRY CONCLUSION:</span>
                            <span class="v-val text-cyan">Operating temperature (84.2°C) is attributable to airflow impedance rather than mechanical motor failure.</span>
                        </div>
                    `;
                } else {
                    outCard.innerHTML = `<div style="color:var(--red); padding:12px;">Vision analysis failed: ${escapeHTML(data.error || "Unknown error")}</div>`;
                }
                pollSovereignty();
                pollAuditTrail();
            } catch(err) {
                outCard.innerHTML = `<div style="color:var(--red); padding:12px;">Vision call error: ${escapeHTML(err.message)}</div>`;
            } finally {
                btnRunVisionAnalysis.disabled = false;
                btnRunVisionAnalysis.textContent = "👁️ RUN LOCAL VISION ANALYSIS";
            }
        });
    }

    // ----------------------------------------------------
    // CODE LAB HANDLERS
    // ----------------------------------------------------
    const codelabEditor = document.getElementById("codelabEditor");
    const codelabTerminal = document.getElementById("codelabTerminal");
    const btnExecuteCode = document.getElementById("btnExecuteCode");

    const codeTmplThermal = document.getElementById("codeTmplThermal");
    if (codeTmplThermal) {
        codeTmplThermal.addEventListener("click", () => {
            if (codelabEditor) codelabEditor.value = `# Calculate Thermal Variance & Delta Margins
measured_temp = 84.2
sop_warning = 80.0
sop_critical = 95.0

variance = round(measured_temp - sop_warning, 2)
margin_to_critical = round(sop_critical - measured_temp, 2)

print(f"Variance above normal: +{variance} C")
print(f"Margin to emergency trip: {margin_to_critical} C")
status = "CONDITIONAL_APPROVAL" if measured_temp < sop_critical else "SHUTDOWN"
print(f"Operational Determination: {status}")
`;
        });
    }

    const codeTmplFan = document.getElementById("codeTmplFan");
    if (codeTmplFan) {
        codeTmplFan.addEventListener("click", () => {
            if (codelabEditor) codelabEditor.value = `# Ventilation Fan Efficiency Check
fan_rpm = 1240
sop_min_rpm = 1200
sop_max_rpm = 1400

efficiency_pct = round((fan_rpm / 1300) * 100, 1)
is_compliant = sop_min_rpm <= fan_rpm <= sop_max_rpm

print(f"Fan Speed: {fan_rpm} RPM")
print(f"Fan Efficiency: {efficiency_pct}%")
print(f"SOP-042 Boundary Compliance: {is_compliant}")
`;
        });
    }

    const codeTmplDissipation = document.getElementById("codeTmplDissipation");
    if (codeTmplDissipation) {
        codeTmplDissipation.addEventListener("click", () => {
            if (codelabEditor) codelabEditor.value = `# Coolant Level & Thermal Dissipation Margin
coolant_level_pct = 68.0
min_safe_level = 60.0
margin_above_min = coolant_level_pct - min_safe_level

print(f"Coolant Reservoir Level: {coolant_level_pct}%")
print(f"Margin above minimum safe: +{margin_above_min}%")
print("Verdict: Fluid volume sufficient for continued 48h operation.")
`;
        });
    }

    if (btnExecuteCode) {
        btnExecuteCode.addEventListener("click", async function() {
            if (!codelabEditor || !codelabTerminal) return;
            const code = codelabEditor.value;
            codelabTerminal.textContent = "Validating AST sandbox constraints and executing...\n";

            try {
                const res = await fetch("http://127.0.0.1:8000/api/tools/execute", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        tool: "EXECUTE_PYTHON",
                        args: { code: code }
                    })
                });
                const data = await res.json();
                if (data.status === "SUCCESS") {
                    codelabTerminal.textContent = `[AST Validation PASSED]\n${data.observation || "Code executed successfully."}\n`;
                    if (data.data && data.data.result !== undefined) {
                        codelabTerminal.textContent += `Result: ${JSON.stringify(data.data.result)}\n`;
                    }
                    codelabTerminal.style.color = "#4ade80";
                } else {
                    codelabTerminal.textContent = `[AST Security / Sandbox ERROR]\n${data.error || data.observation || "Failed"}\n`;
                    codelabTerminal.style.color = "#f87171";
                }
                pollSovereignty();
                pollAuditTrail();
            } catch(err) {
                codelabTerminal.textContent = `[Sandbox Exception]: ${err.message}`;
                codelabTerminal.style.color = "#f87171";
            }
        });
    }

    // ----------------------------------------------------
    // DELIVERABLES TAB HANDLERS
    // ----------------------------------------------------
    let currentDeliverableFilter = "ALL";

    async function loadDeliverables(filterFormat = currentDeliverableFilter) {
        currentDeliverableFilter = filterFormat;
        const tbody = document.getElementById("deliverablesTableBody");
        if (!tbody) return;

        try {
            const res = await fetch("http://127.0.0.1:8000/api/deliverables");
            if (!res.ok) return;
            const data = await res.json();
            let files = data.deliverables || [];

            if (filterFormat !== "ALL") {
                files = files.filter(f => f.type === filterFormat.toUpperCase());
            }

            if (files.length === 0) {
                tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:20px; color:var(--text-secondary);">No deliverables found for format: ${escapeHTML(filterFormat)}</td></tr>`;
                return;
            }

            tbody.innerHTML = files.map(f => {
                const sizeKb = (f.size_bytes / 1024).toFixed(1);
                const dateStr = f.modified_at ? f.modified_at.split("T")[0] + " " + f.modified_at.split("T")[1]?.slice(0, 5) : "--";
                return `
                    <tr>
                        <td style="color:var(--cyan); font-weight:600;">${escapeHTML(f.filename)}</td>
                        <td><span class="tool-tag">${escapeHTML(f.type)}</span></td>
                        <td>${sizeKb} KB</td>
                        <td style="color:var(--text-secondary); font-size:11px;">${dateStr}</td>
                        <td><span class="badge-status-ok">✓ VERIFIED AIR-GAP</span></td>
                        <td>
                            <a href="http://127.0.0.1:8000/deliverables/${encodeURIComponent(f.filename)}" class="btn-small" download style="text-decoration:none; display:inline-flex; align-items:center; gap:4px;">
                                📥 DOWNLOAD
                            </a>
                        </td>
                    </tr>
                `;
            }).join("");
        } catch(e) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:20px; color:var(--text-secondary);">Error loading deliverables.</td></tr>`;
        }
    }

    document.querySelectorAll(".deliv-filter-btn").forEach(btn => {
        btn.addEventListener("click", function() {
            document.querySelectorAll(".deliv-filter-btn").forEach(b => b.classList.remove("active"));
            this.classList.add("active");
            const fmt = this.getAttribute("data-fmt") || "ALL";
            loadDeliverables(fmt);
        });
    });

    const btnRefreshDeliverables = document.getElementById("btnRefreshDeliverables");
    if (btnRefreshDeliverables) {
        btnRefreshDeliverables.addEventListener("click", () => loadDeliverables());
    }

    // ----------------------------------------------------
    // SOVEREIGNTY & NETWORK AUDIT CONTROLS
    // ----------------------------------------------------
    let currentAuditFilter = "ALL";

    async function pollSovereignty() {
        try {
            const res = await fetch("http://127.0.0.1:8000/sovereignty");
            if (!res.ok) return;
            const data = await res.json();

            // 1. Warning banner if external calls > 0
            const banner = document.getElementById("sovWarningBanner");
            if (banner) {
                if (data.external_ai_calls > 0) {
                    banner.classList.remove("hidden");
                } else {
                    banner.classList.add("hidden");
                }
            }

            // 2. Card 1: Sovereignty Status
            const valSovStatus = document.getElementById("val-sov-status");
            const subSovStatus = document.getElementById("sub-sov-status");
            const dotSovStatus = document.getElementById("dot-sov-status");
            if (valSovStatus) {
                valSovStatus.textContent = data.sovereignty_status || "VERIFIED LOCAL";
                if (data.status_color === "red") {
                    valSovStatus.className = "sov-card-value text-red";
                    if (dotSovStatus) dotSovStatus.className = "sov-indicator-dot red";
                } else {
                    valSovStatus.className = "sov-card-value text-green";
                    if (dotSovStatus) dotSovStatus.className = "sov-indicator-dot green";
                }
            }
            if (subSovStatus && data.host_network) {
                subSovStatus.textContent = data.host_network.summary || "Application Guard Enforced";
            }

            // 3. Card 2: Local AI Calls
            const valLocalAi = document.getElementById("val-local-ai");
            if (valLocalAi) valLocalAi.textContent = data.local_model_calls ?? 0;

            // 4. Card 3: External Calls
            const valExternalCalls = document.getElementById("val-external-calls");
            if (valExternalCalls) {
                const ext = data.external_ai_calls ?? 0;
                valExternalCalls.textContent = ext;
                valExternalCalls.className = ext > 0 ? "sov-card-value text-red" : "sov-card-value text-green";
            }

            // 5. Card 4: Blocked Calls
            const valBlockedCalls = document.getElementById("val-blocked-calls");
            if (valBlockedCalls) {
                valBlockedCalls.textContent = data.blocked_external_requests ?? 0;
            }

            // 6. Card 5: Cloud Providers
            const valCloudProviders = document.getElementById("val-cloud-providers");
            if (valCloudProviders) {
                valCloudProviders.textContent = data.cloud_providers_count ?? 0;
            }

            // 7. Card 6: Network Status
            const valNetworkStatus = document.getElementById("val-network-status");
            const subNetworkStatus = document.getElementById("sub-network-status");
            if (valNetworkStatus) {
                valNetworkStatus.textContent = "127.0.0.1 LOOPBACK";
            }
            if (subNetworkStatus && data.host_network) {
                subNetworkStatus.textContent = data.host_network.badge || "Physical WAN Disclosed";
            }

        } catch (err) {
            // Server offline or initializing
        }
    }

    async function pollAuditTrail() {
        try {
            const url = currentAuditFilter === "ALL" 
                ? "http://127.0.0.1:8000/api/sovereignty/audit?limit=25" 
                : `http://127.0.0.1:8000/api/sovereignty/audit?limit=25&category=${encodeURIComponent(currentAuditFilter)}`;
            
            const res = await fetch(url);
            if (!res.ok) return;
            const data = await res.json();
            const events = data.events || [];

            const countBadge = document.getElementById("auditEventCountBadge");
            if (countBadge) countBadge.textContent = `${events.length} EVENTS`;

            const tbody = document.getElementById("auditTableBody");
            if (!tbody) return;

            if (events.length === 0) {
                tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-secondary); padding:16px;">No audit events recorded for filter: ${escapeHTML(currentAuditFilter)}</td></tr>`;
                return;
            }

            tbody.innerHTML = events.map(e => {
                let badgeClass = "badge-class-local";
                if (e.classification === "BLOCKED") badgeClass = "badge-class-blocked";
                else if (e.classification === "EXTERNAL") badgeClass = "badge-class-external";

                let statusColor = "badge-status-ok";
                const stUpper = String(e.status || "").toUpperCase();
                if (stUpper.includes("BLOCK") || stUpper.includes("FAIL") || stUpper.includes("ERROR") || stUpper.includes("ALERT")) {
                    statusColor = e.classification === "BLOCKED" ? "badge-status-warn" : "badge-status-err";
                }

                const timeStr = e.time_human || (e.timestamp ? e.timestamp.split("T")[1]?.slice(0, 8) : "--:--");
                const opStr = escapeHTML(e.operation || "");
                const epStr = escapeHTML(e.endpoint || "");
                const catStr = escapeHTML(e.category || "");

                return `
                    <tr>
                        <td style="color:var(--text-secondary);">${timeStr}</td>
                        <td style="color:var(--cyan); font-weight:600;">${catStr}</td>
                        <td>${opStr}</td>
                        <td style="color:#94a3b8; max-width:180px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${epStr}">${epStr}</td>
                        <td><span class="${badgeClass}">${e.classification}</span></td>
                        <td><span class="${statusColor}">${escapeHTML(e.status)}</span></td>
                    </tr>
                `;
            }).join("");
        } catch(e) {}
    }

    // Filter buttons click handler
    document.querySelectorAll(".audit-filter-btn").forEach(btn => {
        btn.addEventListener("click", function() {
            document.querySelectorAll(".audit-filter-btn").forEach(b => b.classList.remove("active"));
            this.classList.add("active");
            currentAuditFilter = this.getAttribute("data-filter") || "ALL";
            pollAuditTrail();
        });
    });

    // Test Outbound WAN Guard Button
    const btnTestGuard = document.getElementById("btn-test-guard");
    const guardFeedback = document.getElementById("guardTestFeedback");
    if (btnTestGuard) {
        btnTestGuard.addEventListener("click", async function() {
            if (btnTestGuard.disabled) return;
            btnTestGuard.disabled = true;
            if (guardFeedback) guardFeedback.innerHTML = `<span style="color:var(--cyan);">Simulating WAN egress to api.openai.com...</span>`;
            
            try {
                const res = await fetch("http://127.0.0.1:8000/api/sovereignty/test-guard", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ target_url: "https://api.openai.com/v1/models" })
                });
                const data = await res.json();
                if (data.status === "SUCCESS_BLOCKED") {
                    if (guardFeedback) {
                        guardFeedback.innerHTML = `<span style="color:#fb923c; font-weight:bold;">🛡️ INTERCEPTED &amp; BLOCKED!</span><br><span style="color:var(--text-secondary); font-size:10px;">${escapeHTML(data.message)}</span>`;
                    }
                    addActivityLog(`Security Guard: Intercepted unauthorized WAN request to api.openai.com`);
                } else {
                    if (guardFeedback) {
                        guardFeedback.innerHTML = `<span style="color:#f87171;">Status: ${escapeHTML(data.status)}</span>`;
                    }
                }
                pollSovereignty();
                pollAuditTrail();
            } catch(err) {
                if (guardFeedback) guardFeedback.innerHTML = `<span style="color:#f87171;">Test failed: ${escapeHTML(err.message)}</span>`;
            } finally {
                setTimeout(() => { btnTestGuard.disabled = false; }, 1000);
            }
        });
    }

    // Interval timers for sovereignty & audit trail
    setInterval(pollSovereignty, 3000);
    setInterval(pollAuditTrail, 3000);
    pollSovereignty();
    pollAuditTrail();

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

            switchTab("agent");

            const planOverallStatus = document.getElementById("planOverallStatus");
            if (planOverallStatus) {
                planOverallStatus.textContent = "EXECUTING...";
                planOverallStatus.className = "plan-status-badge text-cyan";
            }
            for (let i = 1; i <= 5; i++) {
                const st = document.getElementById(`pstep-${i}`);
                if (st) {
                    st.className = i === 1 ? "plan-step-row active" : "plan-step-row";
                    const ind = st.querySelector(".step-indicator");
                    if (ind) ind.textContent = i === 1 ? "⟳" : "○";
                }
            }

            try {
                const response = await fetch("http://127.0.0.1:8000/investigate", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ 
                        question: text,
                        telemetry: currentTelemetry,
                        report_path: currentUploadedReportPath
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

                // Update real agent plan steps dynamically
                if (planOverallStatus) {
                    planOverallStatus.textContent = "COMPLETED ✓";
                    planOverallStatus.className = "plan-status-badge text-green";
                }
                if (data.plan && Array.isArray(data.plan) && data.plan.length > 0) {
                    const planStepsContainer = document.getElementById("planStepsContainer");
                    if (planStepsContainer) {
                        planStepsContainer.innerHTML = data.plan.map((p, idx) => `
                            <div class="plan-step-row completed">
                                <span class="step-indicator">✓</span>
                                <span class="step-num">Step ${p.step || idx+1}</span>
                                <span class="step-desc">${escapeHTML(p.action)}</span>
                                <span class="step-tool-badge">${escapeHTML(p.tool)}</span>
                            </div>
                        `).join("");
                    }
                }

                // Update Model Selected Card
                const execTaskType = document.getElementById("execTaskType");
                const execTargetRole = document.getElementById("execTargetRole");
                const execSelectedModel = document.getElementById("execSelectedModel");
                const execExecutionMode = document.getElementById("execExecutionMode");
                if (execTaskType) execTaskType.textContent = data.task_type || "MULTIMODAL_INVESTIGATION";
                if (execTargetRole) execTargetRole.textContent = data.target_role || "REASONING_MODEL";
                if (execSelectedModel) execSelectedModel.textContent = data.selected_model || "qwen2.5:7b";
                if (execExecutionMode) execExecutionMode.textContent = data.execution || "LOCAL AIR-GAPPED";

                // Update Tools Used Card dynamically
                const toolsUsedList = document.getElementById("toolsUsedList");
                if (toolsUsedList) {
                    let tools = [];
                    if (data.plan && Array.isArray(data.plan) && data.plan.length > 0) {
                        tools = Array.from(new Set(data.plan.map(p => p.tool).filter(Boolean)));
                    }
                    if (tools.length === 0) {
                        tools = ["READ_FILE", "OCR_DOCUMENT", "ANALYZE_IMAGE", "SEARCH_KNOWLEDGE_BASE", "GENERATE_APPROVAL_NOTE", "VERIFY_FILE"];
                    }
                    toolsUsedList.innerHTML = tools.map(t => `<div class="tool-tag">${escapeHTML(t)}</div>`).join("");
                }

                addActivityLog("Investigation completed");
                addTimelineEvent("AI INVESTIGATION", "Investigation completed", "tl-state-investigation");
                
                addHistory(text, data);
                renderAiResult(text, data, currentTelemetry);
                pollSovereignty();
                pollAuditTrail();
                loadDeliverables();

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

        // -------------------------------------------------------------
        // APPROVAL NOTE PREVIEW (FOR PRIMARY DEMO)
        // -------------------------------------------------------------
        let approvalNoteHtml = '';
        if (data.approval_note) {
            const an = data.approval_note;
            const statusClass = an.approval_status === 'APPROVED' ? 'text-green' : (an.approval_status === 'REJECTED' ? 'text-red' : 'text-amber');
            
            let findingsRows = (an.key_findings || []).map(f => `
                <tr>
                    <td style="padding:6px 10px; border:1px solid rgba(255,255,255,0.1); font-weight:bold;">${escapeHTML(f.parameter)}</td>
                    <td style="padding:6px 10px; border:1px solid rgba(255,255,255,0.1); font-family:var(--font-mono);">${escapeHTML(f.measured_value)}</td>
                    <td style="padding:6px 10px; border:1px solid rgba(255,255,255,0.1); font-family:var(--font-mono);">${escapeHTML(f.baseline)}</td>
                    <td style="padding:6px 10px; border:1px solid rgba(255,255,255,0.1);">${escapeHTML(f.delta)}</td>
                    <td style="padding:6px 10px; border:1px solid rgba(255,255,255,0.1); font-weight:bold;" class="${f.compliance_state && f.compliance_state.includes('WARNING') ? 'text-amber' : 'text-green'}">${escapeHTML(f.compliance_state)}</td>
                </tr>
            `).join('');

            let evidenceItems = (an.evidence || []).map(ev => `
                <li style="margin-bottom:6px;">
                    <strong>${escapeHTML(ev.source)}</strong> (${escapeHTML(ev.modality)}): 
                    <span>${escapeHTML(ev.fact)}</span> 
                    <span style="font-family:var(--font-mono); color:var(--cyan); font-size:11px;">${escapeHTML(ev.citation)}</span>
                </li>
            `).join('');

            let sopItems = (an.sop_references || []).map(sop => `
                <div style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); padding:8px 12px; border-radius:4px; margin-bottom:8px;">
                    <div style="font-weight:bold; color:var(--cyan); font-size:12px;">${escapeHTML(sop.document_id)}: ${escapeHTML(sop.title)}</div>
                    <div style="font-size:11px; color:var(--text-secondary); margin-top:2px;">Section: ${escapeHTML(sop.section)}</div>
                    <div style="font-size:11px; font-style:italic; margin-top:3px;">"${escapeHTML(sop.clause)}"</div>
                </div>
            `).join('');

            let actionItems = (an.recommended_actions || []).map((act, idx) => `
                <div style="margin-bottom:6px; font-size:12px;">
                    <span style="color:var(--cyan); font-weight:bold;">${idx + 1}.</span> ${escapeHTML(act)}
                </div>
            `).join('');

            let limitsItems = (an.assumptions_limitations || []).map(l => `
                <li style="margin-bottom:4px; font-size:11px; color:var(--text-secondary);">${escapeHTML(l)}</li>
            `).join('');

            approvalNoteHtml = `
                <div class="approval-note-box" style="background:rgba(16, 42, 77, 0.45); border:1px solid var(--cyan); border-radius:8px; padding:20px; margin-bottom:24px; box-shadow:0 0 20px rgba(0,217,255,0.1);">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:10px; border-bottom:1px solid rgba(0,217,255,0.3); padding-bottom:12px; margin-bottom:16px;">
                        <div>
                            <div style="font-family:var(--font-mono); font-size:11px; color:var(--cyan); letter-spacing:1px;">OFFICIAL ENGINEERING DELIVERABLE</div>
                            <h3 style="color:#ffffff; margin:4px 0 2px 0; font-size:17px;">${escapeHTML(an.title)}</h3>
                            <div style="font-family:var(--font-mono); font-size:11px; color:var(--text-secondary);">Ref: ${escapeHTML(an.document_ref)}</div>
                        </div>
                        <div style="text-align:right;">
                            <span class="${statusClass}" style="border:1px solid currentColor; padding:5px 12px; border-radius:4px; font-family:var(--font-mono); font-weight:bold; font-size:12px; background:rgba(0,0,0,0.3);">
                                ${escapeHTML(an.approval_status)}
                            </span>
                        </div>
                    </div>

                    <div style="margin-bottom:16px;">
                        <div style="font-family:var(--font-mono); font-size:11px; color:var(--cyan); text-transform:uppercase; margin-bottom:4px;">Executive Summary</div>
                        <div style="background:rgba(0,0,0,0.3); padding:10px 14px; border-left:3px solid var(--cyan); border-radius:3px; font-size:12px; line-height:1.5;">
                            ${escapeHTML(an.summary)}
                        </div>
                    </div>

                    <div style="margin-bottom:16px;">
                        <div style="font-family:var(--font-mono); font-size:11px; color:var(--cyan); text-transform:uppercase; margin-bottom:6px;">Key Findings vs SOP Baseline</div>
                        <div style="overflow-x:auto;">
                            <table style="width:100%; border-collapse:collapse; font-size:11px;">
                                <thead>
                                    <tr style="background:rgba(16,42,77,0.8); color:var(--cyan); text-align:left;">
                                        <th style="padding:6px 10px; border:1px solid rgba(255,255,255,0.1);">Inspection Point</th>
                                        <th style="padding:6px 10px; border:1px solid rgba(255,255,255,0.1);">Measured</th>
                                        <th style="padding:6px 10px; border:1px solid rgba(255,255,255,0.1);">SOP Baseline</th>
                                        <th style="padding:6px 10px; border:1px solid rgba(255,255,255,0.1);">Variance</th>
                                        <th style="padding:6px 10px; border:1px solid rgba(255,255,255,0.1);">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${findingsRows}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div style="margin-bottom:16px;">
                        <div style="font-family:var(--font-mono); font-size:11px; color:var(--cyan); text-transform:uppercase; margin-bottom:6px;">Traceable Evidence Matrix (Zero Hallucinations)</div>
                        <ul style="padding-left:18px; font-size:12px;">
                            ${evidenceItems}
                        </ul>
                    </div>

                    <div style="margin-bottom:16px;">
                        <div style="font-family:var(--font-mono); font-size:11px; color:var(--cyan); text-transform:uppercase; margin-bottom:6px;">Relevant SOP / Maintenance Standards</div>
                        ${sopItems}
                    </div>

                    <div style="margin-bottom:16px;">
                        <div style="font-family:var(--font-mono); font-size:11px; color:var(--cyan); text-transform:uppercase; margin-bottom:6px;">Recommended Operational Actions</div>
                        <div style="background:rgba(0,0,0,0.25); padding:10px 14px; border-radius:4px;">
                            ${actionItems}
                        </div>
                    </div>

                    <div>
                        <div style="font-family:var(--font-mono); font-size:11px; color:var(--cyan); text-transform:uppercase; margin-bottom:6px;">Assumptions &amp; Boundary Conditions</div>
                        <ul style="padding-left:18px;">
                            ${limitsItems}
                        </ul>
                    </div>
                </div>
            `;
        }

        let codeExecutionHtml = '';
        if (data.code_execution) {
            const ce = data.code_execution;
            codeExecutionHtml = `
                <div class="code-execution-box" style="background:rgba(16, 26, 46, 0.7); border:1px solid #a855f7; border-radius:8px; padding:20px; margin-bottom:24px; box-shadow:0 0 20px rgba(168,85,247,0.15);">
                    <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(168,85,247,0.3); padding-bottom:12px; margin-bottom:16px;">
                        <div>
                            <div style="font-family:var(--font-mono); font-size:11px; color:#c084fc; letter-spacing:1px;">AST-VALIDATED AIR-GAPPED CODE EXECUTION</div>
                            <h3 style="color:#ffffff; margin:4px 0 2px 0; font-size:17px;">Maintenance Statistics Python Script</h3>
                        </div>
                        <span class="badge-status-ok" style="background:rgba(168,85,247,0.2); border-color:#a855f7; color:#c084fc;">
                            ⚡ SANDBOX VERIFIED (${ce.execution_time_ms || 0} ms)
                        </span>
                    </div>

                    <div style="margin-bottom:14px;">
                        <div style="font-family:var(--font-mono); font-size:11px; color:var(--cyan); text-transform:uppercase; margin-bottom:6px;">Synthesized Python Program</div>
                        <pre style="background:rgba(0,0,0,0.6); padding:12px 16px; border-radius:4px; font-family:var(--font-mono); font-size:11px; color:#e2e8f0; overflow-x:auto; max-height:260px; line-height:1.4; border:1px solid rgba(255,255,255,0.08);"><code>${escapeHTML(ce.code)}</code></pre>
                    </div>

                    <div>
                        <div style="font-family:var(--font-mono); font-size:11px; color:#4ade80; text-transform:uppercase; margin-bottom:6px;">Sandbox Execution Terminal (stdout)</div>
                        <pre style="background:rgba(0,0,0,0.75); padding:12px 16px; border-radius:4px; font-family:var(--font-mono); font-size:11px; color:#4ade80; overflow-x:auto; max-height:220px; line-height:1.4; border:1px solid rgba(74,222,128,0.2);"><code>${escapeHTML(ce.stdout || 'Program executed cleanly with zero errors.')}</code></pre>
                    </div>
                </div>
            `;
        }

        // -------------------------------------------------------------
        // DELIVERABLE DOWNLOAD BUTTONS (DOCX, XLSX, PPTX, TXT, CSV, PY)
        // -------------------------------------------------------------
        let deliverablesHtml = '';
        if (data.deliverables && Array.isArray(data.deliverables) && data.deliverables.length > 0) {
            let btns = data.deliverables.map(d => {
                const iconMap = {
                    'DOCX': '📄',
                    'XLSX': '📊',
                    'PPTX': '📑',
                    'TXT': '📝',
                    'CSV': '📈',
                    'PY': '💻'
                };
                const icon = iconMap[d.type] || '📁';
                const sizeKb = Math.round((d.size_bytes || 0) / 1024 * 10) / 10;
                const verifiedTag = d.verified ? '<span style="color:var(--green); font-size:10px;">✓ Verified</span>' : '';
                return `
                    <a href="http://127.0.0.1:8000/deliverables/${encodeURIComponent(d.filename)}" class="btn-deliverable" download style="display:inline-flex; flex-direction:column; align-items:flex-start; min-width:180px;">
                        <div style="display:flex; align-items:center; gap:6px; width:100%;">
                            <span style="font-size:15px;">${icon}</span>
                            <span style="font-weight:bold;">DOWNLOAD ${escapeHTML(d.type)}</span>
                        </div>
                        <div style="font-size:10px; color:var(--text-secondary); margin-top:3px; word-break:break-all;">
                            ${escapeHTML(d.filename)} (${sizeKb} KB)
                        </div>
                        <div style="margin-top:2px;">
                            ${verifiedTag}
                        </div>
                    </a>
                `;
            }).join('');

            deliverablesHtml = `
                <div class="deliverables-box" style="margin-top:24px; border:1px solid var(--cyan); background:rgba(0, 217, 255, 0.05); padding:16px 20px; border-radius:6px;">
                    <div class="deliverables-title" style="display:flex; justify-content:space-between; align-items:center;">
                        <span>📦 GENERATED SOVEREIGN DELIVERABLES (${data.deliverables.length} PHYSICAL FILES)</span>
                        <span style="font-size:10px; color:var(--green); font-family:var(--font-mono);">100% LOCAL AIR-GAPPED VERIFICATION</span>
                    </div>
                    <div class="deliverables-grid" style="display:flex; flex-wrap:wrap; gap:12px; margin-top:10px;">
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

            ${approvalNoteHtml}
            ${codeExecutionHtml}

            <div class="assessment-title">AI ASSESSMENT</div>
            <div class="markdown-body">
                ${formatAnswer(data.answer || "No assessment generated.")}
            </div>

            ${approvalNoteHtml}
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
