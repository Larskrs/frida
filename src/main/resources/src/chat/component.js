class ChatMessage extends HTMLElement {
    connectedCallback() {
        const user = this.getAttribute("user");
        const text = this.getAttribute("text");

        this.innerHTML = `
      <div class="msg">
        <strong>${user}</strong>: ${text}
      </div>
    `;
    }
}

customElements.define("chat-message", ChatMessage);
