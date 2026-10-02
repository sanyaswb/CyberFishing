class EventLogger {
  #endpoint;
  #enabled;

  constructor(endpoint, enabled = true) {
    this.#endpoint = endpoint;
    this.#enabled = enabled;
  }

  async logEvent(eventType, eventData) {
    if (!this.#enabled || !this.#endpoint) return;

    const payload = {
      id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
      timestamp: new Date().toISOString(),
      event: eventType,
      ...eventData,
    };

    try {
      const response = await fetch(this.#endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        console.log(`[EventLogger] Event ${eventType} successfully sent.`);
      }
    } catch (error) {
      console.error("[EventLogger] Failed to send event.", error);
    }
  }
}

