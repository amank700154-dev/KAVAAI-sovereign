/**
 * KAVAAI SOVEREIGN — INDUSTRIAL AUTHENTICATION CONTROLLER & MOTION ENGINE
 * Module: frontend/auth.js
 * Implements: Micro-interactions, multi-stage authenticate button, magnetic hover,
 * dual-layer cursor reflections, and the 600-1000ms system unlock transition.
 */

document.addEventListener("DOMContentLoaded", async function() {
    const authScreen = document.getElementById("kavaai-auth-screen");
    const dashboardWrapper = document.querySelector(".dashboard-wrapper");
    const authForm = document.getElementById("authForm");
    const emailInput = document.getElementById("authEmail");
    const passwordInput = document.getElementById("authPassword");
    const rememberCheckbox = document.getElementById("authRemember");
    const togglePwdBtn = document.getElementById("authTogglePwd");
    const btnAuthenticate = document.getElementById("btnAuthenticate");
    const btnAuthText = document.getElementById("btnAuthText");
    const btnContinueLocal = document.getElementById("btnContinueLocal");
    const errorBanner = document.getElementById("authErrorBanner");
    const errorText = document.getElementById("authErrorText");
    const emailStatus = document.getElementById("authEmailStatus");
    const passwordStatus = document.getElementById("authPasswordStatus");
    const unlockLaser = document.getElementById("authUnlockLaser");
    const authStatusDot = document.getElementById("authStatusAuthDot");
    const authStatusLabel = document.getElementById("authStatusAuthLabel");

    if (!authScreen) return;

    // Initialize Supabase & Session Client
    if (window.KavaaiAuth) {
        await window.KavaaiAuth.init();
        const existingSession = await window.KavaaiAuth.getSession();
        
        if (existingSession) {
            // Already authenticated -> Fast Unlock directly into dashboard
            unlockSystem(false);
            return;
        } else {
            // Unauthenticated -> Lock dashboard and present login console
            if (dashboardWrapper) {
                dashboardWrapper.classList.add("auth-locked");
            }
            authScreen.classList.remove("auth-hidden");
        }

        // Update auth service status dot in the console strip
        if (authStatusDot && authStatusLabel) {
            if (window.KavaaiAuth.isConfigured()) {
                authStatusDot.className = "auth-status-dot";
                authStatusLabel.textContent = "SUPABASE AUTH SERVICE READY";
            } else {
                authStatusDot.className = "auth-status-dot orange";
                authStatusLabel.textContent = "LOCAL AIR-GAP AUTH SERVICE READY";
            }
        }
    }

    // =========================================================================
    // 1. INPUT MICRO-INTERACTIONS & TYPING STATUS
    // =========================================================================
    if (emailInput && emailStatus) {
        emailInput.addEventListener("input", () => {
            if (emailInput.value.trim().length > 0) {
                emailStatus.textContent = "INPUT RECEIVED";
                emailStatus.classList.add("active");
            } else {
                emailStatus.textContent = "READY";
                emailStatus.classList.remove("active");
            }
            hideError();
        });
    }

    if (passwordInput && passwordStatus) {
        passwordInput.addEventListener("input", () => {
            if (passwordInput.value.length > 0) {
                passwordStatus.textContent = "KEY DETECTED";
                passwordStatus.classList.add("active");
            } else {
                passwordStatus.textContent = "READY";
                passwordStatus.classList.remove("active");
            }
            hideError();
        });
    }

    // Password visibility toggle
    if (togglePwdBtn && passwordInput) {
        togglePwdBtn.addEventListener("click", () => {
            const isPassword = passwordInput.type === "password";
            passwordInput.type = isPassword ? "text" : "password";
            togglePwdBtn.innerHTML = isPassword 
                ? `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`
                : `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
            if (window.SoundManager) window.SoundManager.click();
        });
    }

    function showError(msg) {
        if (errorBanner && errorText) {
            errorText.textContent = msg;
            errorBanner.classList.add("visible");
            if (window.SoundManager && window.SoundManager.error) {
                window.SoundManager.error();
            }
        }
    }

    function hideError() {
        if (errorBanner) {
            errorBanner.classList.remove("visible");
        }
    }

    // =========================================================================
    // 2. MULTI-STAGE AUTHENTICATION WORKFLOW
    // =========================================================================
    async function executeAuthentication(email, password, remember) {
        if (!window.KavaaiAuth) return;

        hideError();
        setButtonState("loading", "AUTHENTICATING...");
        if (window.SoundManager) window.SoundManager.click();

        try {
            // Stage 1: Simulating cryptographic local handshake
            await new Promise(r => setTimeout(r, 380));
            setButtonState("loading", "VERIFYING LOCAL NODE...");

            // Stage 2: Supabase Auth or Air-Gapped Local Auth
            const result = await window.KavaaiAuth.signIn(email, password, remember);

            // Stage 3: Access Granted
            await new Promise(r => setTimeout(r, 280));
            setButtonState("granted", "ACCESS GRANTED");
            if (window.SoundManager && window.SoundManager.success) {
                window.SoundManager.success();
            }

            // Stage 4: Trigger 600-1000ms Unlock Transition
            setTimeout(() => {
                unlockSystem(true, result.user);
            }, 550);

        } catch (err) {
            setButtonState("normal", "AUTHENTICATE OPERATOR");
            showError(err.message || "ACCESS DENIED: Authentication could not be completed.");
        }
    }

    function setButtonState(state, text) {
        if (!btnAuthenticate || !btnAuthText) return;

        btnAuthenticate.classList.remove("state-loading", "state-granted");
        btnAuthenticate.disabled = false;

        if (state === "loading") {
            btnAuthenticate.classList.add("state-loading");
            btnAuthenticate.disabled = true;
            btnAuthText.textContent = text;
        } else if (state === "granted") {
            btnAuthenticate.classList.add("state-granted");
            btnAuthenticate.disabled = true;
            btnAuthText.textContent = text;
        } else {
            btnAuthText.textContent = text;
        }
    }

    // Primary Form Submit
    if (authForm) {
        authForm.addEventListener("submit", (e) => {
            e.preventDefault();
            const email = emailInput ? emailInput.value : "";
            const password = passwordInput ? passwordInput.value : "";
            const remember = rememberCheckbox ? rememberCheckbox.checked : true;
            executeAuthentication(email, password, remember);
        });
    }

    // Secondary CTA: Continue With Local Node
    if (btnContinueLocal) {
        btnContinueLocal.addEventListener("click", async () => {
            if (emailInput) emailInput.value = "operator";
            if (passwordInput) passwordInput.value = "kavaai2026";
            executeAuthentication("operator", "kavaai2026", true);
        });
    }

    // =========================================================================
    // 3. SYSTEM UNLOCK TRANSITION SEQUENCE (600–1000ms)
    // =========================================================================
    function unlockSystem(animate = true, user = null) {
        // Update header operator profile with real session details if present
        if (user) {
            const opLabel = document.querySelector(".operator-label");
            const opAvatar = document.querySelector(".operator-avatar");
            const name = (user.user_metadata && user.user_metadata.full_name) || user.email || "KS Operator";
            if (opLabel) opLabel.textContent = name.length > 14 ? name.substring(0, 12) + "..." : name;
            if (opAvatar) {
                const initials = name.split(" ").map(p => p[0]).join("").substring(0, 2).toUpperCase();
                opAvatar.textContent = initials || "KS";
            }
        }

        if (!animate) {
            if (authScreen) authScreen.classList.add("auth-hidden");
            if (dashboardWrapper) {
                dashboardWrapper.classList.remove("auth-locked");
                dashboardWrapper.style.opacity = "1";
            }
            return;
        }

        // Kinetic Sequence: Laser beam burst -> grid expansion -> dashboard slide-in
        if (unlockLaser) {
            unlockLaser.classList.add("active");
        }

        setTimeout(() => {
            if (authScreen) {
                authScreen.classList.add("auth-hidden");
            }
            if (dashboardWrapper) {
                dashboardWrapper.classList.remove("auth-locked");
                dashboardWrapper.style.opacity = "1";
            }
        }, 400);

        setTimeout(() => {
            if (unlockLaser) unlockLaser.classList.remove("active");
        }, 1000);
    }

    // =========================================================================
    // 4. MAGNETIC HOVER EFFECT (EFFECT #2: 1–3px Spring Interpolation)
    // =========================================================================
    const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (!isTouch && !prefersReducedMotion) {
        const magneticElements = document.querySelectorAll(".magnetic-target");
        
        magneticElements.forEach(el => {
            el.addEventListener("mousemove", (e) => {
                const rect = el.getBoundingClientRect();
                const centerX = rect.left + rect.width / 2;
                const centerY = rect.top + rect.height / 2;
                
                // Maximum 2.5px movement towards cursor
                const deltaX = (e.clientX - centerX) * 0.08;
                const deltaY = (e.clientY - centerY) * 0.08;

                el.style.transform = `translate3d(${deltaX}px, ${deltaY}px, 0)`;
            });

            el.addEventListener("mouseleave", () => {
                el.style.transform = "translate3d(0, 0, 0)";
                el.style.transition = "transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)";
                setTimeout(() => { el.style.transition = ""; }, 350);
            });
        });
    }

    // =========================================================================
    // 5. GLOBAL LOGOUT TRIGGER (CONNECTED TO OPERATOR PROFILE)
    // =========================================================================
    const opWrap = document.querySelector(".operator-profile-wrap");
    if (opWrap && !document.getElementById("btnOperatorLogout")) {
        const logoutBtn = document.createElement("button");
        logoutBtn.id = "btnOperatorLogout";
        logoutBtn.className = "operator-logout-btn";
        logoutBtn.title = "Disconnect Operator Session";
        logoutBtn.innerHTML = `
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            LOGOUT
        `;
        opWrap.appendChild(logoutBtn);

        logoutBtn.addEventListener("click", async (e) => {
            e.stopPropagation();
            if (window.KavaaiAuth) {
                await window.KavaaiAuth.signOut();
            }
            if (btnAuthenticate) {
                setButtonState("normal", "AUTHENTICATE OPERATOR");
            }
            if (dashboardWrapper) {
                dashboardWrapper.classList.add("auth-locked");
            }
            if (authScreen) {
                authScreen.classList.remove("auth-hidden");
            }
            if (window.SoundManager) window.SoundManager.click();
        });
    }
});
