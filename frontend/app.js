document.addEventListener("DOMContentLoaded", function () {

    const button = document.getElementById("investigateBtn");
    const question = document.getElementById("question");

    if (!button) {
        console.error("RUN INVESTIGATION button not found");
        return;
    }


    button.addEventListener("click", async function () {

        const text = question.value.trim();

        if (!text) {
            alert("Please enter a question");
            return;
        }

        button.disabled = true;
        button.innerHTML = "◌ INVESTIGATING...";

        try {

            const response = await fetch(
                "http://127.0.0.1:8000/investigate",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        question: text
                    })
                }
            );

            if (!response.ok) {
                throw new Error("Investigation request failed");
            }

            const data = await response.json();

            console.log("Investigation:", data);

            showInvestigationResult(data);

        } catch (error) {

            console.error(error);

            showError(
                "Could not reach the AI backend. Make sure backend.py is running."
            );

        } finally {

            button.disabled = false;
            button.innerHTML = "▶ RUN INVESTIGATION";

        }

    });



    async function loadTelemetry() {

        try {

            const response = await fetch(
                "http://127.0.0.1:8000/telemetry"
            );

            if (!response.ok) {
                throw new Error("Telemetry request failed");
            }

            const data = await response.json();

            console.log("Telemetry:", data);

            updateTelemetry(data);

        } catch (error) {

            console.error("Telemetry error:", error);

        }

    }



    function updateTelemetry(data) {

        updateElement(
            ["temperature", "tempValue"],
            data.temperature + "°C"
        );

        updateElement(
            ["rpm", "rpmValue"],
            data.rpm + " RPM"
        );

        updateElement(
            ["pressure", "pressureValue"],
            data.pressure + " bar"
        );

        updateElement(
            ["coolant", "coolantValue"],
            data.coolant + "%"
        );

        updateElement(
            ["vibration", "vibrationValue"],
            data.vibration
        );

        updateElement(
            ["fan", "fanValue"],
            data.fan
        );

    }


    function updateElement(ids, value) {

        for (const id of ids) {

            const element = document.getElementById(id);

            if (element) {
                element.textContent = value;
                return;
            }

        }

    }


    function showInvestigationResult(data) {

        let resultBox = document.getElementById("aiResult");

        if (!resultBox) {

            resultBox = document.createElement("div");

            resultBox.id = "aiResult";

            button.parentElement.appendChild(resultBox);

        }

        resultBox.innerHTML = `

            <div class="result-header">

                <div class="result-label">
                    AI INVESTIGATION RESULT
                </div>

                <div class="result-status">
                    ● COMPLETED
                </div>

            </div>

            <div class="result-metrics">

                <div>
                    <span>AGENT DECISION</span>
                    <strong>${escapeHTML(
                        data.decision || "UNKNOWN"
                    )}</strong>
                </div>

                <div>
                    <span>MANUAL SEARCH</span>
                    <strong>${escapeHTML(
                        data.manual_status || "UNKNOWN"
                    )}</strong>
                </div>

                <div>
                    <span>VISION ANALYSIS</span>
                    <strong>${escapeHTML(
                        data.image_status || "UNKNOWN"
                    )}</strong>
                </div>

            </div>

            <div class="result-divider"></div>

            <div class="answer-content">

                ${formatAnswer(
                    data.answer || "No answer received."
                )}

            </div>
        `;

        resultBox.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });

    }



    function formatAnswer(answer) {

        let html = escapeHTML(answer);

        html = html.replace(
            /^#### (.*)$/gm,
            '<h3>$1</h3>'
        );

        html = html.replace(
            /^### (.*)$/gm,
            '<h3>$1</h3>'
        );

        html = html.replace(
            /\*\*(.*?)\*\*/g,
            '<strong>$1</strong>'
        );

        html = html.replace(
            /^\- (.*)$/gm,
            '<div class="answer-list">• $1</div>'
        );

        html = html.replace(
            /\n\n/g,
            '<br><br>'
        );

        html = html.replace(
            /\n/g,
            '<br>'
        );

        return html;

    }


    function showError(message) {

        let resultBox = document.getElementById("aiResult");

        if (!resultBox) {

            resultBox = document.createElement("div");

            resultBox.id = "aiResult";

            button.parentElement.appendChild(resultBox);

        }

        resultBox.innerHTML = `

            <div class="result-header">

                <div class="result-label">
                    SYSTEM ERROR
                </div>

                <div class="result-status">
                    ● ERROR
                </div>

            </div>

            <div class="answer-content">
                ${escapeHTML(message)}
            </div>

        `;

    }

    function escapeHTML(value) {

        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");

    }

    loadTelemetry();

});