<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Performance Logs</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0f0f1a; color: #e0e0e0; padding: 32px; }
        h1 { font-size: 20px; margin-bottom: 4px; color: #fff; }
        .subtitle { color: #888; font-size: 13px; margin-bottom: 24px; }
        table { width: 100%; border-collapse: collapse; font-size: 13px; }
        th { text-align: left; padding: 10px 12px; background: #1a1a2e; color: #888; font-weight: 600; text-transform: uppercase; font-size: 11px; letter-spacing: 0.05em; border-bottom: 1px solid #2a2a3e; }
        td { padding: 10px 12px; border-bottom: 1px solid #1a1a2e; font-family: 'SF Mono', 'Fira Code', monospace; font-size: 12px; }
        tr:hover td { background: #1a1a2e; }
        .slow { color: #ff6b6b; }
        .warn { color: #ffd93d; }
        .ok { color: #6bcb6b; }
        .tag { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; }
        .tag-red { background: rgba(255,107,107,0.15); color: #ff6b6b; }
        .tag-yellow { background: rgba(255,217,61,0.15); color: #ffd93d; }
        .tag-green { background: rgba(107,203,107,0.15); color: #6bcb6b; }
        .mono { font-family: 'SF Mono', 'Fira Code', monospace; }
        .sql { color: #aaa; max-width: 600px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .sql:hover { white-space: normal; word-break: break-all; }
        .empty { text-align: center; padding: 60px 20px; color: #555; }
        .empty strong { display: block; font-size: 18px; margin-bottom: 8px; color: #888; }
    </style>
</head>
<body>
    <h1>⚡ Performance Logs</h1>
    <p class="subtitle">Requests > 500ms · Queries > 100ms · Recent lazy loads</p>

    @if(count($entries) === 0)
        <div class="empty">
            <strong>No slow requests or queries</strong>
            Everything is running within thresholds.
        </div>
    @else
        <table>
            <thead>
                <tr>
                    <th>Time</th>
                    <th>Type</th>
                    <th>Duration</th>
                    <th style="width:60%">Detail</th>
                </tr>
            </thead>
            <tbody>
                @foreach($entries as $entry)
                    <tr>
                        <td class="mono" style="color:#666">{{ $entry['time'] }}</td>
                        <td>
                            @if($entry['type'] === 'query')
                                <span class="tag tag-yellow">QUERY</span>
                            @elseif($entry['type'] === 'request')
                                <span class="tag tag-red">REQUEST</span>
                            @else
                                <span class="tag tag-green">LAZY LOAD</span>
                            @endif
                        </td>
                        <td class="mono {{ $entry['duration'] > 1000 ? 'slow' : ($entry['duration'] > 300 ? 'warn' : 'ok') }}">
                            {{ $entry['duration'] }}ms
                        </td>
                        <td class="sql" title="{{ $entry['detail'] }}">{{ $entry['detail'] }}</td>
                    </tr>
                @endforeach
            </tbody>
        </table>
    @endif
</body>
</html>
