const RECONNECT_INTERVAL = 3000;
const CACHE_NAME = 'v1';
const CACHE_ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/application.js',
  '/lib/pwa.js',
  '/worker.js',
  '/database.js',
  '/manifest.json',
  '/icon.svg',
  '/favicon.ico',
  '/404.html',
];

class WsClient {
  reconnectInterval = 0;
  connection = null;
  connected = false;
  connecting = false;
  shutdown = false;
  reconnectTimer = null;
  onOpen = null;
  onClose = null;
  onMessage = null;

  constructor(options) {
    const { reconnectInterval } = options;
    this.reconnectInterval = reconnectInterval || 0;
  }

  async connect() {
    if (this.connected || this.connecting || this.shutdown) return;
    this.connecting = true;

    const protocol = self.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${protocol}//${self.location.host}`;
    this.connection = new WebSocket(url);

    this.connection.onopen = () => {
      this.connected = true;
      this.connecting = false;
      if (this.reconnectTimer) this.reconnectTimer = null;
      this.onOpen();
    };
    this.connection.onclose = () => {
      this.connected = false;
      this.connecting = false;
      if (!this.reconnectTimer) this.onClose();
      if (!this.shutdown && this.reconnectInterval) {
        const connect = () => void this.connect();
        this.reconnectTimer = setTimeout(connect, this.reconnectInterval);
      }
      this.shutdown = false;
    };
    this.connection.onmessage = (event) => {
      this.onMessage(JSON.parse(event.data));
    };
  }

  close() {
    if (this.shutdown || !this.connected) return;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.shutdown = true;
    this.connection.close();
  }

  send(packet) {
    if (!this.connected) return false;
    this.connection.send(JSON.stringify(packet));
    return true;
  }

  get reconnecting() {
    return this.reconnectTimer !== null;
  }
}

class HttpCache {
  constructor(name, assets) {
    this.name = name;
    this.assets = assets;
    this.#setupListeners();
  }

  async update() {
    const cache = await caches.open(this.name);
    console.log('Service Worker: Updating cache...');
    for (const asset of this.assets) {
      try {
        await cache.add(asset);
        console.log('Service Worker: Cached:', asset);
      } catch (error) {
        console.error('Service Worker: Failed to cache:', asset, error);
        throw error;
      }
    }
  }

  async cleanup() {
    const cacheNames = await caches.keys();
    const deletePromises = cacheNames
      .filter((cacheName) => cacheName !== this.name)
      .map(async (cacheName) => {
        console.log('Service Worker: Deleting old cache:', cacheName);
        await caches.delete(cacheName);
      });
    await Promise.all(deletePromises);
  }

  #setupListeners() {
    self.addEventListener('install', (event) => {
      event.waitUntil(this.#install());
    });
    self.addEventListener('activate', (event) => {
      event.waitUntil(this.#activate());
    });
    self.addEventListener('fetch', (event) => {
      this.#serve(event);
    });
  }

  async #install() {
    console.log('Service Worker: Installing cache...');
    try {
      await this.update();
      console.log('Service Worker: All assets cached successfully');
      await self.skipWaiting();
    } catch (error) {
      console.error('Service Worker: Failed to cache assets:', error);
    }
  }

  async #activate() {
    console.log('Service Worker: Activating...');
    try {
      await Promise.all([this.cleanup(), self.clients.claim()]);
      console.log('Service Worker: Activated successfully');
    } catch (error) {
      console.error('Service Worker: Activation failed:', error);
    }
  }

  async #serve(event) {
    const { request } = event;
    if (request.method !== 'GET') return;
    if (!request.url.startsWith('http')) return;
    const respond = async () => {
      try {
        const cachedResponse = await this.#serveFromCache(request);
        if (cachedResponse) return cachedResponse;
        return await this.#fetchFromNetwork(request);
      } catch {
        return await this.#offlineFallback(request);
      }
    };
    event.respondWith(respond());
  }

  async #serveFromCache(request) {
    const cache = await caches.open(this.name);
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      console.log('Service Worker: Serving from cache:', request.url);
      return cachedResponse;
    }
    return null;
  }

  async #fetchFromNetwork(request) {
    console.log('Service Worker: Fetching from network:', request.url);
    const networkResponse = await fetch(request);
    if (networkResponse.status === 200) {
      console.log('Service Worker: Caching response:', request.url);
      const cache = await caches.open(this.name);
      await cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  }

  async #offlineFallback(request) {
    console.log('Service Worker: Network failed, checking cache:', request.url);
    const cachedResponse = await this.#serveFromCache(request);
    if (cachedResponse) {
      console.log('Service Worker: Serving from cache (offline):', request.url);
      return cachedResponse;
    }
    console.log('Service Worker: No cache available for:', request.url);
    if (request.mode === 'navigate') {
      const cache = await caches.open(this.name);
      const fallbackResponse = await cache.match('/index.html');
      if (fallbackResponse) {
        return fallbackResponse;
      }
    }
    return new Response('Offline - Content not available', {
      status: 503,
      statusText: 'Service Unavailable',
      headers: { 'Content-Type': 'text/plain' },
    });
  }
}

const broadcast = async (packet, exclude = null) => {
  const clients = await self.clients.matchAll({ includeUncontrolled: true });
  console.log('Broadcasting to clients:', clients.length, packet);
  for (const client of clients) {
    if (client !== exclude) {
      console.log('Sending to client:', client.id);
      client.postMessage(packet);
    }
  }
};

const cache = new HttpCache(CACHE_NAME, CACHE_ASSETS);
const client = new WsClient({ reconnectInterval: RECONNECT_INTERVAL });

client.onOpen = () => {
  console.log('Service Worker: this.websocket this.connected');
  broadcast({ type: 'status', connected: true });
};
client.onClose = () => {
  console.log('Service Worker: websocket disconnected');
  broadcast({ type: 'status', connected: false });
};
client.onMessage = (message) => {
  console.log('Service Worker: websocket message:', message);
  broadcast(message);
};

// Browser interaction
const messageHandlers = {
  online: () => client.connect(),
  offline: () => void client.close(),
  ping: () => void client.send({ type: 'ping' }),
  message: (event) => {
    const packet = { type: 'message', content: event.data.content };
    client.send(packet);
    broadcast(packet, event.source);
  },
  updateCache: async (event) => {
    console.log('Service Worker: Manual cache update requested');
    const msgType = 'cacheUpdated';
    try {
      await cache.update();
      event.source.postMessage({ type: msgType });
    } catch ({ message: error }) {
      event.source.postMessage({ type: msgType, error });
    }
  },
};
self.addEventListener('message', (event) => {
  console.log('Service Worker: received', event.data);
  const { type } = event.data;
  const handler = messageHandlers[type];
  if (handler) handler(event);
});
self.addEventListener('beforeunload', (event) => {
  console.log('Service Worker: beforeunload', event);
});

client.connect();
