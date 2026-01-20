import { useState } from 'react';

interface LoginModalProps {
    onSuccess: (user: string, role: string) => void;
}

export function LoginModal({ onSuccess }: LoginModalProps) {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [isSignup, setIsSignup] = useState(false);

    const API_URL = window.location.origin;

    const handleSubmit = async () => {
        const endpoint = isSignup ? "/signup" : "/login";
        try {
            const res = await fetch(API_URL + endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, password })
            });

            if (res.ok) {
                const data = await res.json();
                onSuccess(data.username, data.role);
            } else {
                const data = await res.json();
                setError(data.error || "Authentication failed");
            }
        } catch (e) { setError("Network error"); }
    };

    const handleSkip = () => {

        const existingUser = localStorage.getItem("auction_user");
        const existingRole = localStorage.getItem("auction_role");

        // If both exist, reuse them (don’t create a new guest)
        if (existingUser && existingRole) {
            onSuccess(existingUser, existingRole);
            return;
        }

        const randomId = "Guest-" + Math.floor(Math.random() * 1000);
        onSuccess(randomId, "guest");
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <h2 style={{ color: "#38bdf8", marginBottom: "1.5rem" }}>
                    {isSignup ? "NEW IDENTITY" : "IDENTITY REQUIRED"}
                </h2>

                {error && <div style={{ color: "#ef4444", marginBottom: "1rem" }}>{error}</div>}

                <input
                    className="auth-input"
                    placeholder="Username"
                    value={username}
                    onChange={(e: any) => setUsername(e.target.value)}
                />
                <input
                    className="auth-input"
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e: any) => setPassword(e.target.value)}
                />

                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                    <button onClick={handleSubmit}>
                        {isSignup ? "ESTABLISH IDENTITY" : "AUTHENTICATE"}
                    </button>

                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.9rem" }}>
                        <span className="text-link" onClick={() => { setIsSignup(!isSignup); setError(""); }}>
                            {isSignup ? "Has Account? Login" : "No Account? Sign Up"}
                        </span>
                        <span className="text-link" onClick={handleSkip}>Skip (View Only)</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
