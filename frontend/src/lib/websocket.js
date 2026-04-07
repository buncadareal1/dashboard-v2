/**
 * WebSocket client for real-time dashboard updates.
 * Auto-reconnects with exponential backoff.
 */
class DashboardWebSocket {
    constructor() {
        this.ws = null
        this.reconnectAttempts = 0
        this.maxReconnectAttempts = 15
        this.handlers = new Map()
        this.pingInterval = null
        this._token = null
    }

    connect(token) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            return // Already connected
        }

        this._token = token
        const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
        const wsUrl = `${protocol}//${location.host}/ws/${token}`

        try {
            this.ws = new WebSocket(wsUrl)
        } catch (e) {
            console.warn('[WS] Failed to create WebSocket:', e)
            this._scheduleReconnect()
            return
        }

        this.ws.onopen = () => {
            console.log('[WS] Connected')
            this.reconnectAttempts = 0
            this._startPing()
        }

        this.ws.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data)
                if (message.type === 'ping' || message.type === 'pong') {
                    return // Heartbeat
                }
                const handler = this.handlers.get(message.type)
                if (handler) {
                    handler(message.data)
                }
            } catch (e) {
                // Ignore parse errors
            }
        }

        this.ws.onclose = (event) => {
            console.log(`[WS] Disconnected (code=${event.code})`)
            this._stopPing()
            if (event.code !== 4001) { // 4001 = invalid token, don't reconnect
                this._scheduleReconnect()
            }
        }

        this.ws.onerror = () => {
            // onclose will fire after this
        }
    }

    disconnect() {
        this.reconnectAttempts = this.maxReconnectAttempts // Prevent reconnect
        this._stopPing()
        if (this.ws) {
            this.ws.close(1000)
            this.ws = null
        }
    }

    on(eventType, handler) {
        this.handlers.set(eventType, handler)
        return this // Allow chaining
    }

    off(eventType) {
        this.handlers.delete(eventType)
        return this
    }

    get isConnected() {
        return this.ws && this.ws.readyState === WebSocket.OPEN
    }

    _scheduleReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.warn('[WS] Max reconnect attempts reached')
            return
        }

        const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000)
        console.log(`[WS] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts + 1})`)

        setTimeout(() => {
            this.reconnectAttempts++
            if (this._token) {
                this.connect(this._token)
            }
        }, delay)
    }

    _startPing() {
        this._stopPing()
        this.pingInterval = setInterval(() => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.ws.send('ping')
            }
        }, 25000) // Every 25s
    }

    _stopPing() {
        if (this.pingInterval) {
            clearInterval(this.pingInterval)
            this.pingInterval = null
        }
    }
}

// Singleton instance
export const dashboardWS = new DashboardWebSocket()
export default dashboardWS
