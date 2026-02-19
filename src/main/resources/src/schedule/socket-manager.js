const DEFAULTS = {
    retryDelay: 5000,
    debug: false
};

export class WebSocketManager {

    constructor(pathBuilder, options = {}) {
        this.pathBuilder = pathBuilder;
        this.options = { ...DEFAULTS, ...options };

        this.socket = null;
        this.id = null;

        this.manualClose = false;
        this.isConnecting = false;

        this.reconnectTimer = null;

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
            this.#clearReconnect();

            if (this.options.debug) {
                console.log("[WS] Connected");
            }

            this.#emit("open");
        };

        this.socket.onmessage = (e) => {
            try {
                const parsed = JSON.parse(e.data);
                this.#emit("message", parsed);
            } catch {
                if (this.options.debug) {
                    console.warn("[WS] Invalid JSON");
                }
            }
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

            if (this.options.debug) {
                console.log("[WS] Closed — scheduling retry");
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

        if (this.options.debug) {
            console.log(`[WS] Retrying in ${this.options.retryDelay}ms`);
        }

        this.#emit("reconnect", {
            delay: this.options.retryDelay
        });

        this.reconnectTimer = setTimeout(() => {
            this.#clearReconnect();
            this.connect(this.id);
        }, this.options.retryDelay);
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
