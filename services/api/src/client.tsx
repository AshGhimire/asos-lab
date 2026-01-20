import React from 'react';
import ReactDOM from 'react-dom/client';
import { LoginModal } from './LoginModal';

const API_URL = window.location.origin;

function log(msg: string) {
    const el = document.getElementById("log");
    if (!el) return;
    const line = document.createElement("div");
    line.textContent = "> " + msg;
    el.prepend(line);
}

async function updateState() {
    try {
        const res = await fetch(API_URL + "/state");
        const data = await res.json();

        const amountEl = document.getElementById("amount");
        if (amountEl) amountEl.textContent = String(data.currentBid);

        const holderEl = document.getElementById("holder");
        if (holderEl) holderEl.textContent = String(data.highestBidder);

        const listEl = document.getElementById("history-list");
        if (listEl && data.history) {
            listEl.innerHTML = "";
            data.history.forEach((bid: any) => {
                const li = document.createElement("li");
                li.className = "history-item";
                const time = new Date(bid.ts).toLocaleTimeString();
                li.innerHTML = `<span>${time} - <b>${bid.bidder}</b></span> <span class="bid-amount">${bid.amount}</span>`;
                listEl.prepend(li);
            });
        }
    } catch (e) { console.error(e); }
}

// Global Manual Functions
(window as any).switchTab = (mode: string) => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    const tab = document.getElementById('tab-' + mode);
    if (tab) tab.classList.add('active');

    const userView = document.getElementById('view-user');
    const adminView = document.getElementById('view-admin');

    if (!userView || !adminView) return;

    if (mode === 'user') {
        userView.classList.remove('hidden');
        adminView.classList.add('hidden');
    } else {
        userView.classList.add('hidden');
        adminView.classList.remove('hidden');
    }
};

(window as any).placeBid = async (amount: number = 50) => {
    const username = localStorage.getItem("auction_user") || "Anonymous";

    try {
        log(`Placing bid: +${amount}...`);
        const res = await fetch(API_URL + "/bid", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ bidder: username, amount: amount })
        });
        if (res.ok) {
            const data = await res.json();
            log("Bid accepted! New price: " + data.currentBid);
            updateState();
        } else {
            log("Bid failed: " + res.status);
        }
    } catch (e: any) { log("Network Error: " + e.message); }
};

(window as any).placeCustomBid = () => {
    const input = document.getElementById("custom-bid") as HTMLInputElement;
    if (!input || !input.value) return;
    const amount = parseInt(input.value);
    if (isNaN(amount) || amount <= 0) return;
    (window as any).placeBid(amount);
    input.value = "";
};

(window as any).simulateCrash = () => {
    if (!confirm("WARNING: Pod Crash. Proceed?")) return;
    log("Sending poison pill...");
    fetch(API_URL + "/crash", { method: "POST" });
};

// --- Init Logic ---

let loopId: ReturnType<typeof setInterval> | null = null;

function startManualLoop() {
    if (loopId !== null) return; // already running
    updateState();
    loopId = setInterval(updateState, 1000); // 1s refresh
    log("Session started. Welcome.");
}

function handleAuthSuccess(user: string, role: string) {
    console.log(`[DEBUG] Login Success: User=${user}, Role=${role}`);

    // Save to LocalStorage
    localStorage.setItem("auction_user", user);
    localStorage.setItem("auction_role", role);

    // 1. Hide React Modal
    const root = document.getElementById("auth-root");
    if (root) root.style.display = "none";

    // 2. Reveal App
    const app = document.getElementById("app-container");
    if (app) app.classList.remove("hidden");

    // 3. Show/Hide Admin Tab based on Role
    const adminTab = document.getElementById("tab-admin");

    if (adminTab) {
        if (role === 'admin') {
            adminTab.classList.remove("hidden");
        } else {
            adminTab.classList.add("hidden");
        }
    }

    // 4. Start Manual Loop
    startManualLoop();
}

// Start React
const rootEl = document.getElementById("auth-root");
if (rootEl) {
    const root = ReactDOM.createRoot(rootEl);
    root.render(
        <React.StrictMode>
            <LoginModal onSuccess={handleAuthSuccess} />
        </React.StrictMode>
    );
}