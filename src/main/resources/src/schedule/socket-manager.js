const DEFAULTS = {
    baseDelay: 1000,
    maxDelay: 10000,
    debug: false
};

export class WebSocketManager {

    constructor(pathBuilder, options = {}) {
        this.pathBuilder = pathBuilder; // function (id) => ws url
        this.options = { ...DEFAULTS, ...options };

        this.socket = null;
        this.id = null;

        this.manualClose = false;
        this.isConnecting = false;

        this.reconnectTimer = null;
        this.reconnectAttempts = 0;

        this.listeners = {
            open: new Set(),
            message: new Set(),
            close: new Set(),
            reconnect: new Set(),
            error: new Set()
        };
    }

    /* ---------------- PUBLIC ---------------- */

    connect(id) {
        if (!id) return;
        if (this.isConnecting) return;

        this.id = id;
        this.isConnecting = true;

        if (this.socket) {
            this.manualClose = true;
            this.socket.close();
        }

        const url = this.pathBuilder(id);

        if (this.options.debug) {
            console.log("[WS] Connecting:", url);
        }

        this.socket = new WebSocket(url);

        this.socket.onopen = () => {
            this.isConnecting = false;
            this.reconnectAttempts = 0;
            this.#clearReconnect();

            this.#emit("open");
        };

        this.socket.onmessage = (e) => {
            let parsed = null;
            try { parsed = JSON.parse(e.data); }
            catch { return; }

            this.#emit("message", parsed);
        };

        this.socket.onerror = (err) => {
            this.#emit("error", err);
        };

        this.socket.onclose = () => {
            this.isConnecting = false;

            if (this.manualClose) {
                this.manualClose = false;
                return;
            }

            this.#emit("close");
            this.#startReconnect();
        };
    }

    disconnect() {
        if (!this.socket) return;

        this.manualClose = true;
        this.#clearReconnect();
        this.socket.close();
    }

    send(payload) {
        if (this.socket?.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify(payload));
        }
    }

    on(event, callback) {
        this.listeners[event]?.add(callback);
    }

    off(event, callback) {
        this.listeners[event]?.delete(callback);
    }

    /* ---------------- PRIVATE ---------------- */

    #startReconnect() {
        if (this.reconnectTimer) return;

        const delay = Math.min(
            this.options.baseDelay * Math.pow(2, this.reconnectAttempts),
            this.options.maxDelay
        );

        this.reconnectAttempts++;

        if (this.options.debug) {
            console.log(`[WS] Reconnect attempt ${this.reconnectAttempts} in ${delay}ms`);
        }

        this.#emit("reconnect", {
            attempt: this.reconnectAttempts,
            delay
        });

        this.reconnectTimer = setTimeout(() => {
            this.#clearReconnect();
            this.connect(this.id);
        }, delay);
    }

    #clearReconnect() {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
    }

    #emit(event, data) {
        this.listeners[event]?.forEach(cb => cb(data));
    }
}
