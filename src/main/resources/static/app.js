const log = (user, text) => {
    const el = document.createElement("chat-message");
    el.setAttribute("user", user);
    el.setAttribute("text", text);

    document.getElementById("log").appendChild(el);
};

const url = "ws://" + "localhost:80" + "/chat"
const ws = new WebSocket(url);

ws.onopen = () => log("SYSTEM", "Connected");

ws.onmessage = e => {
    try {
        const msg = JSON.parse(e.data);
        log(msg.user, msg.content);
    } catch {
        // fallback if server ever sends plain text
        log("SYSTEM", e.data);
    }
};

ws.onclose = () => log("SYSTEM", "Disconnected");

function send() {
    const input = document.getElementById("input");
    const value = input.value.trim();
    if (!value) return;

    ws.send(value);
    input.value = "";
}

function keyDown(e) {
    if (e.key === "Enter") send();
}


class ChatMessage extends HTMLElement {
  connectedCallback() {
    const user = this.getAttribute("user") || "";
    const text = this.getAttribute("text") || "";

    const wrapper = document.createElement("div");
    wrapper.className = user === "SYSTEM" ? "system" : "msg";

    const strong = document.createElement("strong");
    strong.textContent = user;

    const textNode = document.createTextNode(" " + text);

    wrapper.appendChild(strong);
    wrapper.appendChild(textNode);

    // Clear previous content
    this.replaceChildren(wrapper);
  }
}

customElements.define("chat-message", ChatMessage);
