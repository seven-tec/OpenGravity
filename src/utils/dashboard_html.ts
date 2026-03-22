export const DASHBOARD_HTML = `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>OpenGravity HUD | Iron Man Mode</title>
    <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700&family=Inter:wght@300;400;600&display=swap" rel="stylesheet">
    <style>
        :root {
            --primary: #00f2ff;
            --secondary: #7000ff;
            --bg: #050505;
            --glass: rgba(255, 255, 255, 0.05);
            --border: rgba(255, 255, 255, 0.1);
        }

        * { margin: 0; padding: 0; box-sizing: border-box; }

        body {
            background: var(--bg);
            color: #fff;
            font-family: 'Inter', sans-serif;
            overflow: hidden;
            background: radial-gradient(circle at center, #111 0%, #050505 100%);
        }

        .container {
            display: grid;
            grid-template-columns: 350px 1fr;
            height: 100vh;
            padding: 20px;
            gap: 20px;
        }

        .sidebar {
            background: var(--glass);
            backdrop-filter: blur(10px);
            border: 1px solid var(--border);
            border-radius: 20px;
            padding: 25px;
            display: flex;
            flex-direction: column;
            gap: 20px;
        }

        h1 {
            font-family: 'Orbitron', sans-serif;
            font-size: 1.5rem;
            color: var(--primary);
            text-transform: uppercase;
            letter-spacing: 2px;
            text-shadow: 0 0 10px rgba(0, 242, 255, 0.5);
            margin-bottom: 10px;
        }

        .stats-card {
            background: rgba(0, 0, 0, 0.3);
            border: 1px solid var(--border);
            padding: 15px;
            border-radius: 12px;
        }

        .stats-label { font-size: 0.7rem; color: #888; text-transform: uppercase; }
        .stats-value { font-size: 1.2rem; font-weight: 600; color: #fff; margin-top: 5px; }

        .main-content {
            display: flex;
            flex-direction: column;
            gap: 20px;
        }

        .header-bar {
            height: 60px;
            background: var(--glass);
            backdrop-filter: blur(10px);
            border: 1px solid var(--border);
            border-radius: 15px;
            display: flex;
            align-items: center;
            padding: 0 20px;
            justify-content: space-between;
        }

        .status-dot {
            width: 10px; height: 10px;
            background: #00ff00;
            border-radius: 50%;
            box-shadow: 0 0 10px #00ff00;
            margin-right: 10px;
        }

        .feed-container {
            flex: 1;
            background: var(--glass);
            backdrop-filter: blur(10px);
            border: 1px solid var(--border);
            border-radius: 20px;
            padding: 20px;
            overflow-y: auto;
            position: relative;
        }

        .event {
            padding: 15px;
            border-bottom: 1px solid var(--border);
            animation: fadeIn 0.5s ease-out;
            margin-bottom: 10px;
            border-radius: 8px;
            transition: background 0.3s;
        }

        .event:hover { background: rgba(255, 255, 255, 0.03); }

        .type-thought { border-left: 4px solid var(--secondary); }
        .type-tool_call { border-left: 4px solid var(--primary); }
        .type-tool_result { border-left: 4px solid #fff; }
        .type-answer { border-left: 4px solid #00ff00; }
        .type-error { border-left: 4px solid #ff0000; }

        .event-meta { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 0.8rem; }
        .event-label { font-weight: bold; text-transform: uppercase; letter-spacing: 1px; }
        .event-time { color: #666; }
        .event-content { font-size: 0.95rem; line-height: 1.4; color: #ddd; white-space: pre-wrap; word-break: break-all; }

        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(-10px); }
            to { opacity: 1; transform: translateY(0); }
        }

        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 10px; }
    </style>
</head>
<body>
    <div class="container">
        <aside class="sidebar">
            <h1>OpenGravity HUD</h1>
            <div class="stats-card">
                <div class="stats-label">Status</div>
                <div class="stats-value" style="display:flex; align-items:center;">
                    <span class="status-dot"></span> Online
                </div>
            </div>
            <div class="stats-card">
                <div class="stats-label">Architect Module</div>
                <div class="stats-value">v1.2 Active</div>
            </div>
            <div class="stats-card">
                <div class="stats-label">Omni-Brain Sync</div>
                <div class="stats-value">Connected</div>
            </div>
            <div style="flex:1"></div>
            <div class="stats-label" style="text-align:center">OpenGravity core by Stark Industries</div>
        </aside>

        <main class="main-content">
            <div class="header-bar">
                <span style="font-size: 0.8rem; color: #888;">REAL-TIME THOUGHT STREAM</span>
                <span id="update-timer" style="font-size: 0.8rem; color: #00f2ff;">Pooling...</span>
            </div>
            <div id="feed" class="feed-container">
                <!-- Events will stream here -->
                <div class="event" style="text-align: center; color: #555;">Waiting for neural interface data...</div>
            </div>
        </main>
    </div>

    <script>
        const feed = document.getElementById('feed');
        const timer = document.getElementById('update-timer');
        let lastEventCount = 0;

        async function fetchStatus() {
            try {
                const res = await fetch('/api/status');
                const data = await res.json();
                
                if (data.events && data.events.length !== lastEventCount) {
                    renderEvents(data.events);
                    lastEventCount = data.events.length;
                }
            } catch (e) {
                console.error('HUD Sync Lost:', e);
            }
        }

        function renderEvents(events) {
            feed.innerHTML = '';
            [...events].reverse().forEach(ev => {
                const div = document.createElement('div');
                div.className = 'event type-' + ev.type;
                
                const content = typeof ev.content === 'string' ? ev.content : JSON.stringify(ev.content, null, 2);
                const time = new Date(ev.timestamp).toLocaleTimeString();

                div.innerHTML = '<div class="event-meta">' +
                    '<span class="event-label" style="color: ' + getColor(ev.type) + '">' + ev.type + '</span>' +
                    '<span class="event-time">' + time + ' | UID: ' + ev.userId + '</span>' +
                    '</div>' +
                    '<div class="event-content">' + escapeHtml(content) + '</div>';
                feed.appendChild(div);
            });
        }

        function getColor(type) {
            switch(type) {
                case 'thought': return '#7000ff';
                case 'tool_call': return '#00f2ff';
                case 'answer': return '#00ff00';
                case 'error': return '#ff0000';
                default: return '#fff';
            }
        }

        function escapeHtml(unsafe) {
            return unsafe
                 .replace(/&/g, "&amp;")
                 .replace(/</g, "&lt;")
                 .replace(/>/g, "&gt;")
                 .replace(/"/g, "&quot;")
                 .replace(/'/g, "&#039;");
         }

        setInterval(fetchStatus, 2000);
        fetchStatus();
    </script>
</body>
</html>
\`;
